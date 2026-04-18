from datetime import timezone

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from config import get_settings
from db import database
from models.schemas import AuthResponse, LoginRequest, RegisterRequest, TokenPair, UserResponse
from services.billing_service import build_entitlements, normalize_user_billing_document, reconcile_user_billing_state
from utils.helpers import utc_now
from utils.security import create_access_token, create_refresh_token, decode_refresh_token, hash_password, verify_password


settings = get_settings()


def _as_utc_datetime(value):
    if value is None:
        return None
    if getattr(value, "tzinfo", None) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _ensure_beta_access(email: str) -> None:
    normalized_email = (email or "").strip().lower()
    if not settings.beta_invite_only:
        return
    if normalized_email in settings.beta_allowed_emails:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Kevin v2 beta is currently invite-only. Please use an invited email address.",
    )


def serialize_user(document: dict) -> UserResponse:
    billing = normalize_user_billing_document(document)
    entitlements = build_entitlements(document)
    return UserResponse(
        id=document["id"],
        name=document["name"],
        email=document["email"],
        plan=entitlements.get("planGroup", "free"),
        planKey=billing["planKey"],
        billingStatus=billing["billingStatus"],
        usageCount=int(document.get("usageCount", 0)),
        totalCredits=int(billing["totalCredits"]),
        creditsUsed=int(billing["creditsUsed"]),
        creditsRemaining=int(billing["creditsRemaining"]),
        trialUsed=bool(billing["trialUsed"]),
        bonusCreditsBalance=int(billing["bonusCreditsBalance"]),
        subscriptionEnd=billing.get("currentPeriodEnd"),
        currentPeriodStart=billing.get("currentPeriodStart"),
        currentPeriodEnd=billing.get("currentPeriodEnd"),
        paymentProvider=billing.get("paymentProvider"),
        providerCustomerId=billing.get("providerCustomerId"),
        providerSubscriptionId=billing.get("providerSubscriptionId"),
        cancelAtPeriodEnd=bool(billing.get("cancelAtPeriodEnd", False)),
        fairUsagePolicy=bool(billing.get("fairUsagePolicy", True)),
        createdAt=document["createdAt"],
        resumeFilename=document.get("resumeFilename", ""),
        resumeText=document.get("resumeText", ""),
        entitlements=entitlements,
    )


async def build_auth_response(user_document: dict) -> AuthResponse:
    user_document = await reconcile_user_billing_state(user_document)
    access_token, access_expiry = create_access_token(user_document["id"], user_document["email"])
    refresh_token, token_id, refresh_expiry = create_refresh_token(user_document["id"], user_document["email"])
    await database.refresh_tokens.insert_one(
        {
            "tokenId": token_id,
            "userId": user_document["id"],
            "expiresAt": refresh_expiry,
            "createdAt": utc_now(),
            "revoked": False,
        }
    )
    return AuthResponse(
        user=serialize_user(user_document),
        tokens=TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int((access_expiry - utc_now()).total_seconds()),
        ),
    )


def _new_user_document(name: str, email: str, password, auth_provider: str) -> dict:
    now = utc_now()
    return {
        "id": f"user_{now.strftime('%Y%m%d%H%M%S%f')}",
        "name": name,
        "email": email,
        "password": password,
        "plan": "free",
        "planKey": "free_trial",
        "billingStatus": "trial_available",
        "usageCount": 0,
        "totalCredits": 1,
        "creditsUsed": 0,
        "creditsRemaining": 1,
        "trialUsed": False,
        "bonusCreditsBalance": 0,
        "subscriptionEnd": None,
        "currentPeriodStart": None,
        "currentPeriodEnd": None,
        "paymentProvider": None,
        "providerCustomerId": None,
        "providerSubscriptionId": None,
        "providerPaymentLinkId": None,
        "providerSubscriptionShortUrl": None,
        "cancelAtPeriodEnd": False,
        "fairUsagePolicy": True,
        "launchOfferPurchasedAt": None,
        "createdAt": now,
        "resumeFilename": "",
        "resumeText": "",
        "structuredResume": None,
        "authProvider": auth_provider,
    }


async def register_user(payload: RegisterRequest) -> AuthResponse:
    _ensure_beta_access(payload.email)
    existing = await database.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for this email.")

    user_document = _new_user_document(payload.name, payload.email.lower(), hash_password(payload.password), "email")
    await database.users.insert_one(user_document)
    return await build_auth_response(user_document)


async def login_user(payload: LoginRequest) -> AuthResponse:
    _ensure_beta_access(payload.email)
    user_document = await database.users.find_one({"email": payload.email.lower()})
    if not user_document or not user_document.get("password"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not verify_password(payload.password, user_document["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return await build_auth_response(user_document)


async def refresh_access_token(refresh_token: str) -> TokenPair:
    try:
        payload = decode_refresh_token(refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.") from exc

    token_record = await database.refresh_tokens.find_one({"tokenId": payload.get("jti"), "revoked": False})
    if not token_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked.")
    expires_at = _as_utc_datetime(token_record.get("expiresAt"))
    if expires_at and expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired.")

    user_document = await database.users.find_one({"id": payload["sub"]})
    if not user_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    access_token, access_expiry = create_access_token(user_document["id"], user_document["email"])
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=int((access_expiry - utc_now()).total_seconds()),
    )


async def authenticate_google(id_token_value: str) -> AuthResponse:
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google OAuth is not configured.")
    try:
        token_info = id_token.verify_oauth2_token(id_token_value, google_requests.Request(), settings.google_client_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token.") from exc

    email = token_info["email"].lower()
    _ensure_beta_access(email)
    user_document = await database.users.find_one({"email": email})
    if not user_document:
        user_document = _new_user_document(token_info.get("name") or email.split("@")[0], email, None, "google")
        await database.users.insert_one(user_document)

    return await build_auth_response(user_document)


async def revoke_refresh_token(refresh_token: str) -> None:
    try:
        payload = decode_refresh_token(refresh_token)
    except Exception:
        return
    await database.refresh_tokens.update_one({"tokenId": payload.get("jti")}, {"$set": {"revoked": True}})
