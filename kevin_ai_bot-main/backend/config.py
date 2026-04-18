from functools import lru_cache
from typing import List, Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Kevin AI"
    api_prefix: str = "/api"
    environment: str = "development"
    debug: bool = False
    app_env: str = Field(default="production", alias="APP_ENV")
    app_version: str = Field(default="v1", alias="APP_VERSION")
    beta_invite_only: bool = Field(default=False, alias="BETA_INVITE_ONLY")
    beta_allowed_emails: List[str] = Field(default_factory=list, alias="BETA_ALLOWED_EMAILS")
    mongo_url: str = Field(..., alias="MONGO_URL")
    db_name: str = Field("kevin_ai", alias="DB_NAME")
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_refresh_secret_key: str = Field(..., alias="JWT_REFRESH_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    frontend_app_url: str = Field(default="http://localhost:3000", alias="FRONTEND_APP_URL")
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o-mini"
    stt_provider: str = Field(default="browser", alias="STT_PROVIDER")
    faster_whisper_model: str = Field(default="base", alias="FASTER_WHISPER_MODEL")
    faster_whisper_device: str = Field(default="cpu", alias="FASTER_WHISPER_DEVICE")
    faster_whisper_compute_type: str = Field(default="int8", alias="FASTER_WHISPER_COMPUTE_TYPE")
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = "gemini-2.5-flash-lite"
    google_client_id: Optional[str] = Field(default=None, alias="GOOGLE_CLIENT_ID")
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    max_resume_size_mb: int = 5
    public_app_url: str = Field("http://localhost:3000", alias="PUBLIC_APP_URL")
    support_email: str = Field("support@kevinai.app", alias="SUPPORT_EMAIL")
    razorpay_key_id: Optional[str] = Field(default=None, alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: Optional[str] = Field(default=None, alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: Optional[str] = Field(default=None, alias="RAZORPAY_WEBHOOK_SECRET")
    razorpay_starter_plan_id: Optional[str] = Field(default=None, alias="RAZORPAY_STARTER_PLAN_ID")
    razorpay_pro_plan_id: Optional[str] = Field(default=None, alias="RAZORPAY_PRO_PLAN_ID")
    razorpay_portal_url: Optional[str] = Field(default=None, alias="RAZORPAY_PORTAL_URL")
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    @model_validator(mode="after")
    def validate_production_settings(self):
        is_production = self.environment.lower() == "production"
        weak_secrets = {
            "local-dev-jwt-secret-change-me",
            "local-dev-refresh-secret-change-me",
            "replace-with-a-long-random-secret",
            "replace-with-a-second-long-random-secret",
        }

        if is_production:
            if self.jwt_secret_key in weak_secrets or len(self.jwt_secret_key) < 24:
                raise ValueError("JWT_SECRET_KEY must be a strong production secret.")
            if self.jwt_refresh_secret_key in weak_secrets or len(self.jwt_refresh_secret_key) < 24:
                raise ValueError("JWT_REFRESH_SECRET_KEY must be a strong production secret.")
            if not self.mongo_url.startswith("mongodb"):
                raise ValueError("MONGO_URL must be configured for production.")

        self.app_env = self.app_env.lower()
        self.app_version = self.app_version.lower()
        self.beta_allowed_emails = sorted({email.strip().lower() for email in self.beta_allowed_emails if email.strip()})

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
