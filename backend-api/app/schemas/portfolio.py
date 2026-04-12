from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HoldingCreateRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    company_name: str | None = None
    quantity: float = Field(gt=0)
    buy_price: float = Field(gt=0)
    exchange: str = Field(default="NSE", min_length=2, max_length=10)


class HoldingSellRequest(BaseModel):
    quantity: float = Field(gt=0)
    sell_price: float | None = Field(default=None, gt=0)


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    exchange: str
    quantity: float
    buy_price: float
    sell_price: float
    profit_loss: float
    sector: str | None
    sold_at: datetime


class HoldingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    exchange: str
    quantity: float
    buy_price: float
    sector: str | None
    created_at: datetime


class PortfolioPerformanceItem(BaseModel):
    holding_id: int
    symbol: str
    exchange: str | None = None
    quantity: float
    buy_price: float
    current_price: float
    value: float
    profit_loss: float
    percent_change: float
    market_cap_category: str
    sector: str | None
    created_at: datetime | None = None


class MarketCapDistribution(BaseModel):
    category: str
    quantity: float
    value: float
    percentage: float


class PortfolioSummaryResponse(BaseModel):
    total_portfolio_value: float
    total_quantity: float
    total_profit_loss: float
    booked_profit_loss: float = 0.0
    lifetime_profit_loss: float = 0.0
    performance: list[PortfolioPerformanceItem]
    market_cap_breakdown: list[MarketCapDistribution]
    risk_level: str
    diversification_analysis: str
    sector_exposure: dict[str, float]
    sales: list[SaleResponse] = []
