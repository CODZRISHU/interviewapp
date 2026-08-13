from datetime import timezone
from typing import Optional

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


import asyncio
import uuid
from services.email_service import send_verification_email

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
        creditBuckets=entitlements.get("creditBuckets", {}),
        mainCreditBuckets=entitlements.get("mainCreditBuckets", {}),
        topupCreditBuckets=entitlements.get("topupCreditBuckets", {}),
        topupEligibility=entitlements.get("topupEligibility", {}),
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
        isEmailVerified=bool(document.get("isEmailVerified", True)),
        createdAt=document["createdAt"],
        resumeFilename=document.get("resumeFilename", ""),
        resumeText=document.get("resumeText", ""),
        entitlements=entitlements,
        referralCode=document.get("referralCode") or "",
        referralCount=int(document.get("referralCount", 0)),
        referralRewardsClaimed=int(document.get("referralRewardsClaimed", 0)),
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


async def process_referral_reward(new_user_id: str, referral_code: str):
    if not referral_code or not referral_code.strip():
        return

    code = referral_code.strip().upper()
    referrer = await database.users.find_one({"referralCode": code})

    if not referrer or referrer.get("id") == new_user_id:
        return

    await database.users.update_one({"id": new_user_id}, {"$set": {"referredBy": referrer["id"]}})

    new_count = int(referrer.get("referralCount", 0)) + 1
    claimed = int(referrer.get("referralRewardsClaimed", 0))
    rewards_due = (new_count // 3) - claimed

    update_fields = {"referralCount": new_count}

    if rewards_due > 0:
        claimed += rewards_due
        update_fields["referralRewardsClaimed"] = claimed

        credits_remaining = int(referrer.get("creditsRemaining", 0)) + rewards_due
        total_credits = int(referrer.get("totalCredits", 0)) + rewards_due

        buckets = referrer.get("creditBuckets") or {
            "10m": {"total": 0, "used": 0, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0}
        }
        m10 = buckets.get("10m") or {"total": 0, "used": 0, "remaining": 0}
        m10["remaining"] = int(m10.get("remaining", 0)) + rewards_due
        m10["total"] = int(m10.get("total", 0)) + rewards_due
        buckets["10m"] = m10

        update_fields["creditsRemaining"] = credits_remaining
        update_fields["totalCredits"] = total_credits
        update_fields["creditBuckets"] = buckets
        update_fields["billingStatus"] = "trial_available"

        await database.referral_rewards.insert_one({
            "id": f"refreward_{uuid.uuid4().hex[:8]}",
            "referrerId": referrer["id"],
            "referredUserId": new_user_id,
            "rewardType": "10min_interview",
            "createdAt": utc_now()
        })

    await database.users.update_one({"id": referrer["id"]}, {"$set": update_fields})


def _generate_referral_code() -> str:
    return f"REF-{uuid.uuid4().hex[:6].upper()}"


def _new_user_document(name: str, email: str, password, auth_provider: str) -> dict:
    now = utc_now()
    is_verified = (auth_provider == "google")
    token = f"vtok_{uuid.uuid4().hex}" if not is_verified else None

    return {
        "id": f"user_{now.strftime('%Y%m%d%H%M%S%f')}",
        "name": name,
        "email": email,
        "password": password,
        "isEmailVerified": is_verified,
        "verificationToken": token,
        "plan": "free",
        "planKey": "free_trial",
        "billingStatus": "trial_available",
        "usageCount": 0,
        "totalCredits": 1,
        "creditsUsed": 0,
        "creditsRemaining": 1,
        "creditBuckets": {
            "10m": {"total": 1, "used": 0, "remaining": 1},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
        "trialUsed": False,
        "referralCode": _generate_referral_code(),
        "referredBy": None,
        "pendingReferralCode": None,
        "referralRewardProcessed": False,
        "referralCount": 0,
        "referralRewardsClaimed": 0,

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
    email = payload.email.strip().lower()

    if not email.endswith("@gmail.com"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is currently restricted to valid @gmail.com email addresses. Please enter a valid Gmail address to receive your verification link.",
        )

    existing = await database.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for this email.")

    user_document = _new_user_document(payload.name, email, hash_password(payload.password), "email")
    if payload.referral_code:
        user_document["pendingReferralCode"] = payload.referral_code.strip().upper()

    await database.users.insert_one(user_document)

    token = user_document.get("verificationToken")
    verif_url = f"{settings.public_app_url}/verify-email?token={token}"
    asyncio.create_task(send_verification_email(email, payload.name, verif_url))

    return AuthResponse(
        requiresVerification=True,
        message="Registration successful! A verification link has been sent to your Gmail inbox. Please click the link to activate your account.",
    )


async def login_user(payload: LoginRequest) -> AuthResponse:
    email = payload.email.strip().lower()
    user_document = await database.users.find_one({"email": email})
    if not user_document or not user_document.get("password"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not verify_password(payload.password, user_document["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if user_document.get("authProvider") == "email" and not user_document.get("isEmailVerified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Gmail address has not been verified yet. Please check your Gmail inbox for the activation link.",
        )

    return await build_auth_response(user_document)


async def verify_email_token(token: str) -> AuthResponse:
    user = await database.users.find_one({"verificationToken": token})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired email verification link. Please request a new link.",
        )

    await database.users.update_one(
        {"id": user["id"]},
        {"$set": {"isEmailVerified": True, "verificationToken": None}},
    )
    user["isEmailVerified"] = True
    user["verificationToken"] = None

    # ONLY process referral reward AFTER email verification!
    pending_code = user.get("pendingReferralCode")
    if pending_code and not user.get("referralRewardProcessed"):
        await process_referral_reward(user["id"], pending_code)
        await database.users.update_one({"id": user["id"]}, {"$set": {"referralRewardProcessed": True}})

    auth_resp = await build_auth_response(user)
    auth_resp.message = "Gmail address verified successfully! Logging you in..."
    return auth_resp


async def resend_verification(email: str) -> dict:
    email = email.strip().lower()
    user = await database.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email.")

    if user.get("isEmailVerified"):
        return {"success": True, "message": "Your email is already verified. You can log in directly."}

    token = user.get("verificationToken") or f"vtok_{uuid.uuid4().hex}"
    await database.users.update_one({"id": user["id"]}, {"$set": {"verificationToken": token}})

    verif_url = f"{settings.public_app_url}/verify-email?token={token}"
    asyncio.create_task(send_verification_email(email, user.get("name", "Candidate"), verif_url))
    return {"success": True, "message": "A new verification link has been sent to your Gmail inbox."}


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


async def authenticate_google(id_token_value: str, referral_code: Optional[str] = None) -> AuthResponse:
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google OAuth is not configured.")
    try:
        token_info = id_token.verify_oauth2_token(id_token_value, google_requests.Request(), settings.google_client_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token.") from exc

    email = token_info["email"].lower()
    user_document = await database.users.find_one({"email": email})
    if not user_document:
        user_document = _new_user_document(token_info.get("name") or email.split("@")[0], email, None, "google")
        await database.users.insert_one(user_document)
        if referral_code:
            await process_referral_reward(user_document["id"], referral_code)
            await database.users.update_one({"id": user_document["id"]}, {"$set": {"referralRewardProcessed": True}})

    return await build_auth_response(user_document)


async def revoke_refresh_token(refresh_token: str) -> None:
    try:
        payload = decode_refresh_token(refresh_token)
    except Exception:
        return
    await database.refresh_tokens.update_one({"tokenId": payload.get("jti")}, {"$set": {"revoked": True}})
