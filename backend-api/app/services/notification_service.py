from app.models.notification import Notification


def build_notification_payload(notification: Notification) -> dict[str, str | int | bool | None]:
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }
