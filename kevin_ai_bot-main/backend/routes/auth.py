from fastapi import APIRouter, Depends

from controllers.dependencies import get_current_user
from models.schemas import AuthResponse, GoogleAuthRequest, LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserResponse
from services.auth_service import (
    authenticate_google,
    login_user,
    refresh_access_token,
    register_user,
    resend_verification,
    revoke_refresh_token,
    serialize_user,
    verify_email_token,
)
from services.billing_service import get_user_billing_snapshot, reconcile_user_billing_state
from pydantic import BaseModel, EmailStr

class ResendVerificationRequest(BaseModel):
    email: EmailStr


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    return await register_user(payload)


@router.get("/verify-email", response_model=AuthResponse)
async def verify_email(token: str):
    return await verify_email_token(token)


@router.post("/resend-verification")
async def resend_verification_link(payload: ResendVerificationRequest):
    return await resend_verification(payload.email)




@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    return await login_user(payload)


@router.post("/google", response_model=AuthResponse)
async def google_login(payload: GoogleAuthRequest):
    return await authenticate_google(payload.id_token, payload.referral_code)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest):
    return await refresh_access_token(payload.refresh_token)


@router.post("/logout")
async def logout(payload: RefreshRequest):
    await revoke_refresh_token(payload.refresh_token)
    return {"message": "Logged out."}


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    return serialize_user(await reconcile_user_billing_state(user))


@router.get("/referral-stats")
async def referral_stats(user=Depends(get_current_user)):
    from config import get_settings
    settings = get_settings()

    code = user.get("referralCode") or ""
    count = int(user.get("referralCount", 0))
    claimed = int(user.get("referralRewardsClaimed", 0))
    next_reward_in = 3 - (count % 3)

    public_url = getattr(settings, "public_app_url", "https://www.kevinhr.in") or "https://www.kevinhr.in"
    referral_link = f"{public_url}/auth?ref={code}"

    return {
        "referralCode": code,
        "referralLink": referral_link,
        "referralCount": count,
        "referralRewardsClaimed": claimed,
        "nextRewardIn": next_reward_in,
        "rewardInterval": 3,
        "rewardDescription": "1 Free 10-Minute Mock Interview per 3 Friends Referred"
    }


@router.get("/config")
async def auth_config():
    from config import get_settings

    settings = get_settings()
    return {
        "google_enabled": bool(settings.google_client_id),
        "google_client_id": settings.google_client_id or "",
    }


@router.get("/billing")
async def billing(user=Depends(get_current_user)):
    return await get_user_billing_snapshot(user)
