from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from config import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, email: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: Dict[str, Any] = {"sub": subject, "email": email, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm), expire


def create_refresh_token(subject: str, email: str) -> tuple[str, str, datetime]:
    token_id = uuid4().hex
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload: Dict[str, Any] = {
        "sub": subject,
        "email": email,
        "type": "refresh",
        "jti": token_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_refresh_secret_key, algorithm=settings.jwt_algorithm), token_id, expire


def decode_refresh_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=[settings.jwt_algorithm])


def safe_decode_access_token(token: str) -> Dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None

