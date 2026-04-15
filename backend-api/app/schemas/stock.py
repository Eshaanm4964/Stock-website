from pydantic import BaseModel


class StockQuote(BaseModel):
    symbol: str
    short_name: str
    exchange: str
    price: float
    change_percent: float
    currency: str
    market_cap: float | None = None
    sector: str | None = None
    previous_close: float | None = None
    fetched_at: str | None = None
    cache_until: str | None = None
    data_source: str = "provider"
    is_fallback: bool = False


class StockSearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str = "NSE"
    sector: str | None = None
    price: float | None = None
    source: str = "catalog"


class NewsArticle(BaseModel):
    title: str
    description: str | None
    url: str
    source: str
    published_at: str | None
    sentiment: str


class TechnicalIndicators(BaseModel):
    rsi: float | None
    macd: float | None
    macd_signal: float | None
    sma_20: float | None
    sma_50: float | None
    ema_20: float | None
    bollinger_upper: float | None
    bollinger_lower: float | None
    interpretation: str


class StockDetailResponse(BaseModel):
    quote: StockQuote
    news: list[NewsArticle]
    indicators: TechnicalIndicators
