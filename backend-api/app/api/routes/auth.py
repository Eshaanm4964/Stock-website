from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_otp_code,
    get_password_hash,
    verify_password,
)
from app.models.login_otp import LoginOTP
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    OtpRequest,
    OtpResponse,
    SignupRequest,
    SignupOtpRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.user import UserUpdateRequest
from app.services.security_service import enforce_rate_limit, log_auth_attempt
from app.services.sms_service import SmsDeliveryError, normalize_indian_mobile, send_login_otp

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_datetime(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _find_user_for_login(
    role: UserRole, identifier: str, db: AsyncSession
) -> User | None:
    statement = select(User).where(User.role == role)
    if role == UserRole.ADMIN:
        statement = statement.where(User.username == identifier)
    else:
        statement = statement.where(User.fixed_user_id == identifier.upper())
    return (await db.execute(statement)).scalar_one_or_none()


def _normalize_phone_or_raw(phone_number: str) -> str:
    try:
        return normalize_indian_mobile(phone_number)
    except SmsDeliveryError:
        return phone_number.strip()


def _phone_allowed_for_login(role: UserRole, user: User, entered_phone: str) -> bool:
    if role == UserRole.ADMIN:
        allowed_phones = {
            _normalize_phone_or_raw(phone)
            for phone in [user.phone_number, *settings.admin_allowed_phone_numbers]
            if phone
        }
        return entered_phone in allowed_phones
    return _normalize_phone_or_raw(user.phone_number) == entered_phone


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    raise HTTPException(status_code=403, detail="Public registration is disabled. Please ask admin to create the customer.")


@router.post("/signup/request-otp", response_model=OtpResponse)
async def request_signup_otp(payload: SignupOtpRequest, db: AsyncSession = Depends(get_db)) -> OtpResponse:
    raise HTTPException(status_code=403, detail="Public registration is disabled. Please ask admin to create the customer.")


@router.post("/request-otp", response_model=OtpResponse)
async def request_login_otp(
    payload: OtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OtpResponse:
    identifier = payload.identifier if payload.role == UserRole.ADMIN else payload.identifier.upper()
    client_ip = request.client.host if request.client else None
    await enforce_rate_limit(
        db,
        stage="request_otp",
        identifier=identifier,
        role=payload.role.value,
        phone_number=payload.phone_number,
        ip_address=client_ip,
    )
    user = await _find_user_for_login(payload.role, identifier, db)
    if not user or not verify_password(payload.password, user.hashed_password):
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="invalid_credentials",
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    entered_phone = _normalize_phone_or_raw(payload.phone_number)
    if not _phone_allowed_for_login(payload.role, user, entered_phone):
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="phone_verification_failed",
        )
        raise HTTPException(status_code=401, detail="Phone number verification failed")
    if not user.is_active:
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="inactive_user",
        )
        raise HTTPException(status_code=403, detail="User account is inactive")

    if settings.demo_mode:
        await db.execute(delete(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.purpose == "login"))
        db.add(
            LoginOTP(
                user_id=user.id,
                purpose="login",
                otp_hash=get_password_hash(settings.demo_otp_code),
                expires_at=_utc_now() + timedelta(minutes=settings.otp_expire_minutes),
            )
        )
        await db.commit()
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=True,
        )
        return OtpResponse(
            message="Demo OTP is ready",
            otp_preview=settings.demo_otp_code,
        )

    if settings.demo_otp_enabled:
        await db.execute(delete(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.purpose == "login"))
        db.add(
            LoginOTP(
                user_id=user.id,
                purpose="login",
                otp_hash=get_password_hash(settings.demo_otp_code),
                expires_at=_utc_now() + timedelta(minutes=settings.otp_expire_minutes),
            )
        )
        await db.commit()
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=True,
        )
        return OtpResponse(
            message="Demo OTP is ready. Use the fixed demo code for login.",
            otp_preview=settings.demo_otp_code,
        )

    code = generate_otp_code()
    await db.execute(delete(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.purpose == "login"))
    db.add(
        LoginOTP(
            user_id=user.id,
            purpose="login",
            otp_hash=get_password_hash(code),
            expires_at=_utc_now() + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    await db.commit()
    try:
        provider_reference = await send_login_otp(entered_phone, code)
    except SmsDeliveryError as exc:
        await db.execute(delete(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.purpose == "login"))
        await db.commit()
        await log_auth_attempt(
            db,
            stage="request_otp",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="sms_delivery_failed",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OTP could not be sent to this phone number. {exc}",
        ) from exc
    await log_auth_attempt(
        db,
        stage="request_otp",
        role=payload.role.value,
        identifier=identifier,
        user_id=user.id,
        phone_number=payload.phone_number,
        ip_address=client_ip,
        success=True,
    )
    return OtpResponse(
        message=(
            f"OTP generated successfully. Provider reference: {provider_reference}"
            if provider_reference
            else "OTP generated successfully"
        ),
        otp_preview=code if settings.otp_debug_mode else None,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    identifier = payload.identifier if payload.role == UserRole.ADMIN else payload.identifier.upper()
    client_ip = request.client.host if request.client else None
    await enforce_rate_limit(
        db,
        stage="login",
        identifier=identifier,
        role=payload.role.value,
        phone_number=payload.phone_number,
        ip_address=client_ip,
    )
    user = await _find_user_for_login(payload.role, identifier, db)
    if not user or not verify_password(payload.password, user.hashed_password):
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="invalid_credentials",
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    entered_phone = _normalize_phone_or_raw(payload.phone_number)
    if not _phone_allowed_for_login(payload.role, user, entered_phone):
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="phone_verification_failed",
        )
        raise HTTPException(status_code=401, detail="Phone number verification failed")

    if settings.demo_mode:
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=True,
        )
        return TokenResponse(
            access_token=create_access_token(str(user.id), user.role.value, user.username),
            role=user.role,
        )

    otp_record = (
        await db.execute(
            select(LoginOTP)
            .where(
                LoginOTP.user_id == user.id,
                LoginOTP.purpose == "login",
                LoginOTP.consumed_at.is_(None),
            )
            .order_by(LoginOTP.created_at.desc())
        )
    ).scalar_one_or_none()
    if not otp_record:
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="otp_not_requested",
        )
        raise HTTPException(status_code=400, detail="OTP request required before login")
    if _normalize_datetime(otp_record.expires_at) < _utc_now():
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="otp_expired",
        )
        raise HTTPException(status_code=400, detail="OTP has expired")
    if not verify_password(payload.otp, otp_record.otp_hash):
        await log_auth_attempt(
            db,
            stage="login",
            role=payload.role.value,
            identifier=identifier,
            user_id=user.id,
            phone_number=payload.phone_number,
            ip_address=client_ip,
            success=False,
            failure_reason="invalid_otp",
        )
        raise HTTPException(status_code=401, detail="Invalid OTP")

    otp_record.consumed_at = _utc_now()
    await db.commit()
    await log_auth_attempt(
        db,
        stage="login",
        role=payload.role.value,
        identifier=identifier,
        user_id=user.id,
        phone_number=payload.phone_number,
        ip_address=client_ip,
        success=True,
    )
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value, user.username),
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
