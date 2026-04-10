from pydantic import BaseModel


class AIChatRequest(BaseModel):
    message: str
    symbol: str | None = None


class AIChatResponse(BaseModel):
    answer: str
    citations: list[str]
