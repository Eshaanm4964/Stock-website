from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis

from app.db.session import get_redis
from app.schemas.stock import StockDetailResponse, StockQuote, StockSearchResult
from app.services.news_service import fetch_market_news, fetch_news
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
    return await fetch_market_feed(selected, "NSE", redis)


@router.get("/market/news")
async def market_news(redis: Redis = Depends(get_redis)):
    return await fetch_market_news(redis)


@router.get("/search", response_model=list[StockSearchResult])
async def stock_search(
    q: str = Query(default="", min_length=1),
    exchange: str = Query(default="NSE"),
    limit: int = Query(default=10, ge=1, le=20),
) -> list[StockSearchResult]:
    return await search_stock_symbols(q, exchange, limit)


@router.get("/{symbol}", response_model=StockDetailResponse)
async def stock_detail(
    symbol: str,
    exchange: str = Query(default="NSE"),
    redis: Redis = Depends(get_redis),
) -> StockDetailResponse:
    quote = await fetch_quote(symbol, "NSE", redis)
    news = await fetch_news(symbol, redis)
    indicators = await fetch_indicator_bundle(symbol, "NSE")
    return StockDetailResponse(quote=quote, news=news, indicators=indicators)
