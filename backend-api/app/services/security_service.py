import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.admin_audit_log import AdminAuditLog
from app.models.auth_attempt import AuthAttempt
from app.models.user import User

settings = get_settings()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def enforce_rate_limit(
    db: AsyncSession,
    *,
    stage: str,
    identifier: str,
    role: str,
    phone_number: str | None = None,
    ip_address: str | None = None,
) -> None:
    cutoff = utc_now() - timedelta(minutes=settings.auth_rate_limit_window_minutes)
    matchers = [AuthAttempt.identifier == identifier]
    if phone_number:
        matchers.append(AuthAttempt.phone_number == phone_number)
    if ip_address:
        matchers.append(AuthAttempt.ip_address == ip_address)

    attempt_count = (
        await db.execute(
            select(func.count(AuthAttempt.id)).where(
                AuthAttempt.stage == stage,
                AuthAttempt.role == role,
                AuthAttempt.success.is_(False),
                AuthAttempt.created_at >= cutoff,
                or_(*matchers),
            )
        )
    ).scalar_one()

    if attempt_count >= settings.auth_max_failed_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many failed {stage.replace('_', ' ')} attempts. "
                f"Try again in {settings.auth_rate_limit_window_minutes} minutes."
            ),
        )


async def log_auth_attempt(
    db: AsyncSession,
    *,
    stage: str,
    role: str,
    identifier: str,
    success: bool,
    phone_number: str | None = None,
    ip_address: str | None = None,
    user_id: int | None = None,
    failure_reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuthAttempt(
            user_id=user_id,
            role=role,
            stage=stage,
            identifier=identifier,
            phone_number=phone_number,
            ip_address=ip_address,
            success=success,
            failure_reason=failure_reason,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
    )
    await db.commit()


async def log_admin_action(
    db: AsyncSession,
    *,
    admin_user: User,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            admin_user_id=admin_user.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            details_json=json.dumps(details) if details else None,
        )
    )
    await db.commit()
