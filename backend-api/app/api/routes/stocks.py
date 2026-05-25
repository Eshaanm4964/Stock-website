from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis

from app.db.session import get_redis
from app.schemas.stock import StockDetailResponse, StockQuote, StockSearchResult
from app.services.news_service import fetch_market_news, fetch_news
from app.services.kite_service import get_random_instruments
from app.services.stock_service import fetch_indicator_bundle, fetch_market_feed, fetch_quote, search_stock_symbols

router = APIRouter(prefix="/stocks", tags=["stocks"])
DEFAULT_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN"]


@router.get("/feed", response_model=list[StockQuote])
async def market_feed(
    symbols: str | None = Query(default=None),
    exchange: str = Query(default="NSE"),
    redis: Redis = Depends(get_redis),
) -> list[StockQuote]:
    selected = [item.strip() for item in symbols.split(",")] if symbols else DEFAULT_SYMBOLS
    return await fetch_market_feed(selected, exchange, redis)


@router.get("/random", response_model=list[StockQuote])
async def random_stocks(
    count: int = Query(default=12, ge=1, le=30),
    exchange: str = Query(default="NSE"),
    redis: Redis = Depends(get_redis),
) -> list[StockQuote]:
    symbols = await get_random_instruments(exchange, count * 3, redis)  # fetch 3x to account for missing quotes
    if not symbols:
        return []
    feed = await fetch_market_feed(symbols, exchange, redis)
    live = [q for q in feed if q.price and q.price > 0]
    return live[:count]


@router.get("/market/news")
async def market_news(redis: Redis = Depends(get_redis)):
    return await fetch_market_news(redis)


@router.get("/search", response_model=list[StockSearchResult])
async def stock_search(
    q: str = Query(default="", min_length=1),
    exchange: str = Query(default="NSE"),
    limit: int = Query(default=10, ge=1, le=20),
    redis: Redis = Depends(get_redis),
) -> list[StockSearchResult]:
    return await search_stock_symbols(q, exchange, limit, redis)


@router.get("/{symbol}", response_model=StockDetailResponse)
async def stock_detail(
    symbol: str,
    exchange: str = Query(default="NSE"),
    redis: Redis = Depends(get_redis),
) -> StockDetailResponse:
    quote = await fetch_quote(symbol, exchange, redis)
    news = await fetch_news(symbol, redis)
    indicators = await fetch_indicator_bundle(symbol, exchange)
    return StockDetailResponse(quote=quote, news=news, indicators=indicators)
