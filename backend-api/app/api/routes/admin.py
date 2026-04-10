from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from redis.asyncio import Redis
from sqlalchemy import delete, distinct, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user
from app.core.config import get_settings
from app.db.session import get_db, get_redis
from app.models.admin_setting import AdminSetting
from app.models.admin_audit_log import AdminAuditLog
from app.models.auth_attempt import AuthAttempt
from app.models.notification import Notification
from app.models.portfolio import PortfolioHolding
from app.models.review import Review
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminAuditLogResponse,
    AdminBulkUserActionRequest,
    AdminBulkUserActionResponse,
    AdminDashboardResponse,
    AdminHoldingSnapshot,
    AdminLoginIssueItem,
    AdminOperationsOverviewResponse,
    AdminSettingsOverview,
    AdminStockConcentrationItem,
    AdminSystemStatusResponse,
    AdminUserActivityItem,
    AdminUserDashboardResponse,
    AdminUserStatusUpdateRequest,
    AdminUserSummary,
    AuthAttemptResponse,
)
from app.schemas.review import ReviewResponse
from app.services.portfolio_service import build_portfolio_summary
from app.services.security_service import log_admin_action

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def admin_dashboard(
    _: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)
) -> AdminDashboardResponse:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total_users = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.USER, User.is_demo.is_(False)))
    ).scalar_one()
    new_users = (
        await db.execute(
            select(func.count(User.id)).where(
                User.role == UserRole.USER,
                User.is_demo.is_(False),
                User.created_at >= seven_days_ago,
            )
        )
    ).scalar_one()
    total_notifications = (await db.execute(select(func.count(Notification.id)))).scalar_one()
    total_holdings = (await db.execute(select(func.count(PortfolioHolding.id)))).scalar_one()
    return AdminDashboardResponse(
        total_users=total_users,
        newly_registered_users=new_users,
        total_notifications=total_notifications,
        total_holdings=total_holdings,
    )


@router.get("/users", response_model=list[AdminUserSummary])
async def admin_users(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> list[AdminUserSummary]:
    users = list((await db.execute(select(User).where(User.role == UserRole.USER))).scalars().all())
    summaries: list[AdminUserSummary] = []
    for user in users:
        try:
            holdings = list(
                (await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == user.id))).scalars().all()
            )
            portfolio = await build_portfolio_summary(holdings, redis)
            summaries.append(
                AdminUserSummary(
                    user_id=user.id,
                    username=user.username,
                    fixed_user_id=user.fixed_user_id,
                    full_name=user.full_name,
                    phone_number=user.phone_number,
                    role=user.role.value,
                    is_active=user.is_active,
                    is_demo=user.is_demo,
                    created_at=user.created_at,
                    portfolio_value=portfolio.total_portfolio_value,
                    total_holdings=len(holdings),
                )
            )
        except Exception:
            summaries.append(
                AdminUserSummary(
                    user_id=user.id,
                    username=user.username,
                    fixed_user_id=user.fixed_user_id,
                    full_name=user.full_name,
                    phone_number=user.phone_number,
                    role=user.role.value,
                    is_active=user.is_active,
                    is_demo=user.is_demo,
                    created_at=user.created_at,
                    portfolio_value=0.0,
                    total_holdings=0,
                )
            )
    return summaries


@router.get("/users/{user_id}/dashboard", response_model=AdminUserDashboardResponse)
async def admin_user_dashboard(
    user_id: int,
    request: Request,
    audit: bool = Query(default=True),
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AdminUserDashboardResponse:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    holdings = list(
        (await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == user.id))).scalars().all()
    )
    portfolio = await build_portfolio_summary(holdings, redis)
    snapshots = [
        AdminHoldingSnapshot(
            holding_id=item.holding_id,
            symbol=item.symbol,
            quantity=item.quantity,
            buy_price=item.buy_price,
            current_price=item.current_price,
            value=item.value,
            profit_loss=item.profit_loss,
            percent_change=item.percent_change,
            sector=item.sector,
            exchange=item.exchange,
            created_at=item.created_at,
        )
        for item in portfolio.performance
    ]
    response = AdminUserDashboardResponse(
        user_id=user.id,
        username=user.username,
        fixed_user_id=user.fixed_user_id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        total_portfolio_value=portfolio.total_portfolio_value,
        total_profit_loss=portfolio.total_profit_loss,
        total_holdings=len(holdings),
        holdings=snapshots,
    )
    if audit:
        await log_admin_action(
            db,
            admin_user=current_admin,
            action="view_user_dashboard",
            entity_type="user",
            entity_id=str(user.id),
            ip_address=request.client.host if request.client else None,
            details={"fixed_user_id": user.fixed_user_id, "full_name": user.full_name},
        )
    return response


@router.patch("/users/{user_id}/status", response_model=AdminUserSummary)
async def update_admin_user_status(
    user_id: int,
    payload: AdminUserStatusUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AdminUserSummary:
    user = (await db.execute(select(User).where(User.id == user_id, User.role == UserRole.USER))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)

    holdings = list(
        (await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == user.id))).scalars().all()
    )
    portfolio = await build_portfolio_summary(holdings, redis)
    await log_admin_action(
        db,
        admin_user=current_admin,
        action="update_user_status",
        entity_type="user",
        entity_id=str(user.id),
        ip_address=request.client.host if request.client else None,
        details={"is_active": user.is_active, "fixed_user_id": user.fixed_user_id},
    )
    return AdminUserSummary(
        user_id=user.id,
        username=user.username,
        fixed_user_id=user.fixed_user_id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        role=user.role.value,
        is_active=user.is_active,
        is_demo=user.is_demo,
        created_at=user.created_at,
        portfolio_value=portfolio.total_portfolio_value,
        total_holdings=len(holdings),
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_admin_user(
    user_id: int,
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = (await db.execute(select(User).where(User.id == user_id, User.role == UserRole.USER))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    fixed_user_id = user.fixed_user_id
    full_name = user.full_name
    await db.delete(user)
    await db.commit()
    await log_admin_action(
        db,
        admin_user=current_admin,
        action="delete_user",
        entity_type="user",
        entity_id=str(user_id),
        ip_address=request.client.host if request.client else None,
        details={"fixed_user_id": fixed_user_id, "full_name": full_name},
    )


@router.get("/audit-logs", response_model=list[AdminAuditLogResponse])
async def admin_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[AdminAuditLogResponse]:
    logs = list(
        (
            await db.execute(
                select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)
            )
        ).scalars().all()
    )
    return [
        AdminAuditLogResponse(
            id=log.id,
            admin_user_id=log.admin_user_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            ip_address=log.ip_address,
            details_json=log.details_json,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/auth-attempts", response_model=list[AuthAttemptResponse])
async def admin_auth_attempts(
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuthAttemptResponse]:
    attempts = list(
        (
            await db.execute(
                select(AuthAttempt).order_by(AuthAttempt.created_at.desc()).limit(limit)
            )
        ).scalars().all()
    )
    return [
        AuthAttemptResponse(
            id=attempt.id,
            user_id=attempt.user_id,
            role=attempt.role,
            stage=attempt.stage,
            identifier=attempt.identifier,
            phone_number=attempt.phone_number,
            ip_address=attempt.ip_address,
            success=attempt.success,
            failure_reason=attempt.failure_reason,
            metadata_json=attempt.metadata_json,
            created_at=attempt.created_at,
        )
        for attempt in attempts
    ]


@router.post("/users/bulk-action", response_model=AdminBulkUserActionResponse)
async def admin_bulk_user_action(
    payload: AdminBulkUserActionRequest,
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> AdminBulkUserActionResponse:
    allowed_actions = {"activate", "disable", "delete"}
    action = payload.action.strip().lower()
    if action not in allowed_actions:
        raise HTTPException(status_code=400, detail="Unsupported bulk action")
    if not payload.user_ids:
        raise HTTPException(status_code=400, detail="Select at least one user")

    users = list(
        (
            await db.execute(
                select(User).where(User.id.in_(payload.user_ids), User.role == UserRole.USER)
            )
        ).scalars().all()
    )
    found_ids = {user.id for user in users}
    processed_ids: list[int] = []

    if action == "delete":
        for user in users:
            processed_ids.append(user.id)
            await db.delete(user)
    else:
        next_active = action == "activate"
        for user in users:
            user.is_active = next_active
            processed_ids.append(user.id)

    await db.commit()
    await log_admin_action(
        db,
        admin_user=current_admin,
        action=f"bulk_{action}_users",
        entity_type="user",
        entity_id=None,
        ip_address=request.client.host if request.client else None,
        details={"user_ids": processed_ids},
    )
    return AdminBulkUserActionResponse(
        action=action,
        processed_count=len(processed_ids),
        skipped_count=len(payload.user_ids) - len(found_ids),
        user_ids=processed_ids,
    )


@router.get("/reviews", response_model=list[ReviewResponse])
async def admin_reviews(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReviewResponse]:
    reviews = list((await db.execute(select(Review).order_by(Review.created_at.desc()))).scalars().all())
    return [ReviewResponse.model_validate(review) for review in reviews]


@router.delete("/reviews/{review_id}", status_code=204)
async def admin_delete_review(
    review_id: int,
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    review = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review_name = review.name
    await db.delete(review)
    await db.commit()
    await log_admin_action(
        db,
        admin_user=current_admin,
        action="delete_review",
        entity_type="review",
        entity_id=str(review_id),
        ip_address=request.client.host if request.client else None,
        details={"name": review_name},
    )


@router.get("/system-status", response_model=AdminSystemStatusResponse)
async def admin_system_status(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: User = Depends(get_admin_user),
) -> AdminSystemStatusResponse:
    database_status = "connected"
    redis_status = "disabled"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"

    if redis is not None:
        try:
            await redis.ping()
            redis_status = "connected"
        except Exception:
            redis_status = "error"

    total_admin_logs = (await db.execute(select(func.count(AdminAuditLog.id)))).scalar_one()
    total_auth_attempts = (await db.execute(select(func.count(AuthAttempt.id)))).scalar_one()
    return AdminSystemStatusResponse(
        backend_status="online",
        database_status=database_status,
        redis_status=redis_status,
        environment=settings.app_env,
        otp_debug_mode=settings.otp_debug_mode,
        total_admin_logs=total_admin_logs,
        total_auth_attempts=total_auth_attempts,
    )


@router.get("/operations-overview", response_model=AdminOperationsOverviewResponse)
async def admin_operations_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminOperationsOverviewResponse:
    users = list((await db.execute(select(User).where(User.role == UserRole.USER))).scalars().all())
    holdings = list((await db.execute(select(PortfolioHolding))).scalars().all())
    auth_attempts = list(
        (await db.execute(select(AuthAttempt).order_by(AuthAttempt.created_at.desc()).limit(200))).scalars().all()
    )
    site_settings = (await db.execute(select(AdminSetting).limit(1))).scalar_one_or_none()

    user_ids_with_holdings = {holding.user_id for holding in holdings}
    values_by_user: dict[int, float] = {}
    quantities_by_symbol: dict[str, float] = {}
    invested_by_symbol: dict[str, float] = {}
    users_by_symbol: dict[str, set[int]] = {}

    for holding in holdings:
        quantity = float(holding.quantity or 0)
        buy_price = float(holding.buy_price or 0)
        values_by_user[holding.user_id] = values_by_user.get(holding.user_id, 0.0) + (quantity * buy_price)
        quantities_by_symbol[holding.symbol] = quantities_by_symbol.get(holding.symbol, 0.0) + quantity
        invested_by_symbol[holding.symbol] = invested_by_symbol.get(holding.symbol, 0.0) + (quantity * buy_price)
        users_by_symbol.setdefault(holding.symbol, set()).add(holding.user_id)

    last_holding_map: dict[int, datetime | None] = {}
    for holding in holdings:
        current = last_holding_map.get(holding.user_id)
        if current is None or (holding.created_at and holding.created_at > current):
            last_holding_map[holding.user_id] = holding.created_at

    last_auth_attempt_map: dict[int, datetime | None] = {}
    issue_counts: dict[str, int] = {}
    for attempt in auth_attempts:
        if attempt.user_id:
          current = last_auth_attempt_map.get(attempt.user_id)
          if current is None or (attempt.created_at and attempt.created_at > current):
              last_auth_attempt_map[attempt.user_id] = attempt.created_at
        if not attempt.success:
            reason = attempt.failure_reason or "unknown"
            issue_counts[reason] = issue_counts.get(reason, 0) + 1

    stock_concentration = sorted(
        [
            AdminStockConcentrationItem(
                symbol=symbol,
                client_count=len(users_by_symbol.get(symbol, set())),
                total_quantity=quantities_by_symbol.get(symbol, 0.0),
                invested_value=invested_by_symbol.get(symbol, 0.0),
            )
            for symbol in quantities_by_symbol
        ],
        key=lambda item: item.invested_value,
        reverse=True,
    )[:6]

    non_demo_users = [user for user in users if not user.is_demo]

    user_activity = sorted(
        [
            AdminUserActivityItem(
                user_id=user.id,
                full_name=user.full_name,
                fixed_user_id=user.fixed_user_id,
                is_active=user.is_active,
                holding_count=sum(1 for holding in holdings if holding.user_id == user.id),
                last_holding_at=last_holding_map.get(user.id),
                last_auth_attempt_at=last_auth_attempt_map.get(user.id),
            )
            for user in non_demo_users
        ],
        key=lambda item: item.last_auth_attempt_at or item.last_holding_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:8]

    portfolio_values = [values_by_user.get(user.id, 0.0) for user in non_demo_users]
    non_demo_user_ids = {user.id for user in non_demo_users}
    return AdminOperationsOverviewResponse(
        active_users=sum(1 for user in non_demo_users if user.is_active),
        inactive_users=sum(1 for user in non_demo_users if not user.is_active),
        users_with_holdings=len(user_ids_with_holdings.intersection(non_demo_user_ids)),
        average_portfolio_value=(sum(portfolio_values) / len(portfolio_values)) if portfolio_values else 0.0,
        largest_client_value=max(portfolio_values) if portfolio_values else 0.0,
        stock_concentration=stock_concentration,
        login_issue_breakdown=[
            AdminLoginIssueItem(reason=reason, count=count)
            for reason, count in sorted(issue_counts.items(), key=lambda item: item[1], reverse=True)[:6]
        ],
        recent_user_activity=user_activity,
        settings_overview=AdminSettingsOverview(
            show_faq_insights=site_settings.show_faq_insights if site_settings else True,
            chat_nudges_enabled=site_settings.chat_nudges_enabled if site_settings else True,
            otp_debug_mode=settings.otp_debug_mode,
            auth_rate_limit_window_minutes=settings.auth_rate_limit_window_minutes,
            auth_max_failed_attempts=settings.auth_max_failed_attempts,
        ),
    )
