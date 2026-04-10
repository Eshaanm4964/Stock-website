from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(min_length=2, max_length=120)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=8, max_length=1200)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    rating: int
    message: str
    is_seeded: bool
    created_at: datetime
