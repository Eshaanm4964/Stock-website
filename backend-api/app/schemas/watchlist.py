from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WatchlistCreateRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"


class WatchlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    exchange: str
    created_at: datetime
