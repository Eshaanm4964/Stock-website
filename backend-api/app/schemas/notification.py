from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationCreateRequest(BaseModel):
    title: str
    message: str
    user_ids: list[int] | None = None
    broadcast: bool = False


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime
