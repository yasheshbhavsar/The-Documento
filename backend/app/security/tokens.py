import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
import jwt
from backend.app.core.config import get_settings


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"iat": now, "exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        decoded = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        return decoded
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid or expired token: {e}") from e


def generate_secure_random_token(length: int = 32) -> str:
    """Generates a cryptographically strong, URL-safe random string."""
    return secrets.token_urlsafe(length)


def hash_opaque_token(token: str) -> str:
    """Computes SHA-256 hash of an opaque token for safe database persistence."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
