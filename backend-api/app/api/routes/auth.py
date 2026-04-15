from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, or_, select
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
from app.services.sms_service import SmsDeliveryError, send_login_otp

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
DEMO_OTP_CODE = "123456"
REGISTER_OTP_CACHE: dict[str, dict[str, datetime | str]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_datetime(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _build_fixed_user_id(full_name: str, phone_number: str) -> str:
    base = "".join(char for char in full_name.upper() if char.isalpha())[:3] or "CLI"
    return f"{base}-{phone_number[-4:]}"


def _signup_otp_key(email: str, phone_number: str) -> str:
    return f"{email.strip().lower()}:{phone_number.strip()}"


def _store_signup_otp(email: str, phone_number: str, code: str) -> None:
    REGISTER_OTP_CACHE[_signup_otp_key(email, phone_number)] = {
        "otp_hash": get_password_hash(code),
        "expires_at": _utc_now() + timedelta(minutes=settings.otp_expire_minutes),
    }


def _verify_signup_otp(email: str, phone_number: str, otp: str) -> None:
    key = _signup_otp_key(email, phone_number)
    record = REGISTER_OTP_CACHE.get(key)
    if not record:
        raise HTTPException(status_code=400, detail="Please send and verify the registration OTP first")
    expires_at = record.get("expires_at")
    if not isinstance(expires_at, datetime) or _normalize_datetime(expires_at) <= _utc_now():
        REGISTER_OTP_CACHE.pop(key, None)
        raise HTTPException(status_code=400, detail="Registration OTP expired. Send a new code")
    if not verify_password(otp, str(record.get("otp_hash") or "")):
        raise HTTPException(status_code=400, detail="Invalid registration OTP")
    REGISTER_OTP_CACHE.pop(key, None)


async def _find_user_for_login(
    role: UserRole, identifier: str, db: AsyncSession
) -> User | None:
    statement = select(User).where(User.role == role)
    if role == UserRole.ADMIN:
        statement = statement.where(User.username == identifier)
    else:
        statement = statement.where(User.fixed_user_id == identifier.upper())
    return (await db.execute(statement)).scalar_one_or_none()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(
        select(User).where(or_(User.email == payload.email, User.phone_number == payload.phone_number))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or phone number already exists")
    _verify_signup_otp(payload.email, payload.phone_number, payload.otp)

    fixed_user_id = _build_fixed_user_id(payload.full_name, payload.phone_number)
    while (
        await db.execute(select(User).where(User.fixed_user_id == fixed_user_id))
    ).scalar_one_or_none():
        fixed_user_id = f"{fixed_user_id}-{generate_otp_code()[:2]}"
    user = User(
        username=fixed_user_id.lower(),
        email=payload.email,
        fixed_user_id=fixed_user_id,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        hashed_password=get_password_hash(payload.password),
        role=UserRole.USER,
        is_demo=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value, user.username),
        role=user.role,
        fixed_user_id=user.fixed_user_id,
    )


@router.post("/signup/request-otp", response_model=OtpResponse)
async def request_signup_otp(payload: SignupOtpRequest, db: AsyncSession = Depends(get_db)) -> OtpResponse:
    existing = await db.execute(
        select(User).where(or_(User.email == payload.email, User.phone_number == payload.phone_number))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or phone number already exists")

    code = DEMO_OTP_CODE if settings.demo_mode else generate_otp_code()
    _store_signup_otp(payload.email, payload.phone_number, code)
    if settings.demo_mode:
        return OtpResponse(message="Demo registration OTP is ready", otp_preview=code)

    try:
        await send_login_otp(payload.phone_number, code)
    except SmsDeliveryError as exc:
        REGISTER_OTP_CACHE.pop(_signup_otp_key(payload.email, payload.phone_number), None)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Registration OTP could not be sent. {exc}",
        ) from exc
    return OtpResponse(
        message="Registration OTP sent successfully",
        otp_preview=code if settings.otp_debug_mode else None,
    )


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
    if user.phone_number != payload.phone_number:
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
                otp_hash=get_password_hash(DEMO_OTP_CODE),
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
            otp_preview=DEMO_OTP_CODE,
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
        await send_login_otp(payload.phone_number, code)
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
        message="OTP generated successfully",
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
    if user.phone_number != payload.phone_number:
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
