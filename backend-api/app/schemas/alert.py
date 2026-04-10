from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertCreateRequest(BaseModel):
    symbol: str
    target_price: float
    condition: str


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    target_price: float
    condition: str
    is_triggered: bool
    created_at: datetime
