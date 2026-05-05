from datetime import datetime, timedelta, timezone
from secrets import randbelow
from typing import Any
import hashlib
import os

from jose import JWTError, jwt

from app.core.config import get_settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Use PBKDF2 for verification (built-in, no bcrypt dependency)
    salt, hash_value = hashed_password.split("$")
    computed_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), 100000)
    return computed_hash.hex() == hash_value


def get_password_hash(password: str) -> str:
    # Use PBKDF2 instead of bcrypt (no version conflicts)
    salt = os.urandom(16).hex()
    hash_obj = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_obj.hex()}"


def create_access_token(subject: str, role: str, username: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {"sub": subject, "role": role, "username": username, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise ValueError("Invalid authentication token") from exc


def generate_otp_code() -> str:
    return f"{randbelow(1_000_000):06d}"
