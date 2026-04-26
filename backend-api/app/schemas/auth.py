from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing import Annotated

from app.models.user import UserRole


IdentifierStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
OptionalIdentifierStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
PhoneStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=20)]
PasswordStr = Annotated[str, StringConstraints(min_length=8, max_length=128)]
OtpStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=6, pattern=r"^\d{6}$")]


class SignupRequest(BaseModel):
    email: EmailStr
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    phone_number: PhoneStr
    password: PasswordStr
    otp: OtpStr


class SignupOtpRequest(BaseModel):
    email: EmailStr
    phone_number: PhoneStr


class OtpRequest(BaseModel):
    role: UserRole
    identifier: OptionalIdentifierStr | None = None
    password: PasswordStr
    phone_number: PhoneStr


class OtpResponse(BaseModel):
    message: str
    otp_preview: str | None = None


class LoginRequest(BaseModel):
    role: UserRole
    identifier: OptionalIdentifierStr | None = None
    password: PasswordStr
    phone_number: PhoneStr
    otp: OtpStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    fixed_user_id: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    fixed_user_id: str | None
    full_name: str
    phone_number: str
    bio: str | None
    role: UserRole
    is_active: bool
    is_demo: bool
    initial_funds: float
    balance_funds: float
    created_at: datetime
