from fastapi import APIRouter, Depends

from controllers.dependencies import get_current_user
from models.schemas import AuthResponse, GoogleAuthRequest, LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserResponse
from services.auth_service import (
    authenticate_google,
    login_user,
    refresh_access_token,
    register_user,
    revoke_refresh_token,
    serialize_user,
)
from services.billing_service import get_user_billing_snapshot, reconcile_user_billing_state


router = APIRouter(prefix="/auth", tags=["auth"])


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
        "app_env": settings.app_env,
        "app_version": settings.app_version,
        "beta_invite_only": settings.beta_invite_only,
        "beta_allowed_email_count": len(settings.beta_allowed_emails),
    }


@router.get("/billing")
async def billing(user=Depends(get_current_user)):
    return await get_user_billing_snapshot(user)
