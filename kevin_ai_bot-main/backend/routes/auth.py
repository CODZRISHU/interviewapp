from fastapi import APIRouter, Depends

from controllers.dependencies import get_current_user
from models.schemas import AuthResponse, GoogleAuthRequest, LoginRequest, OtpResponse, RefreshRequest, RegisterRequest, SendOtpRequest, TokenPair, UserResponse, VerifyOtpRequest
from services.auth_service import (
    authenticate_google,
    login_user,
    refresh_access_token,
    register_user,
    revoke_refresh_token,
    serialize_user,
)
from services.billing_service import get_user_billing_snapshot, reconcile_user_billing_state
from services.otp_service import request_otp_for_email, verify_otp_for_email


router = APIRouter(prefix="/auth", tags=["auth"])



@router.post("/send-otp", response_model=OtpResponse)
async def send_otp(payload: SendOtpRequest):
    return await request_otp_for_email(payload.email)


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest):
    await verify_otp_for_email(payload.email, payload.otp)
    return {"verified": True, "message": "OTP verified successfully."}


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    return await register_user(payload)



@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    return await login_user(payload)


@router.post("/google", response_model=AuthResponse)
async def google_login(payload: GoogleAuthRequest):
    return await authenticate_google(payload.id_token)


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
