from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationCreateRequest, NotificationResponse
from app.services.notification_service import build_notification_payload
from app.websocket.manager import manager

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    )
    return [NotificationResponse.model_validate(item) for item in result.scalars().all()]


@router.post("/send", response_model=list[NotificationResponse], status_code=status.HTTP_201_CREATED)
async def send_notifications(
    payload: NotificationCreateRequest,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    if not payload.broadcast and not payload.user_ids:
        raise HTTPException(status_code=400, detail="Provide user_ids or enable broadcast")

    user_ids = payload.user_ids or []
    if payload.broadcast:
        user_ids = list((await db.execute(select(User.id))).scalars().all())

    created: list[Notification] = []
    for user_id in user_ids:
        notification = Notification(user_id=user_id, title=payload.title, message=payload.message)
        db.add(notification)
        created.append(notification)
    await db.commit()

    for notification in created:
        await db.refresh(notification)
        await manager.send_user_notification(notification.user_id, build_notification_payload(notification))

    return [NotificationResponse.model_validate(item) for item in created]


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return NotificationResponse.model_validate(notification)
