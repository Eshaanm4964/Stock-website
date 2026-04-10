from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
import yfinance as yf
from redis.asyncio import Redis

from app.core.config import get_settings
from app.schemas.stock import NewsArticle, StockQuote, TechnicalIndicators
from app.services.cache_service import get_cached_json, set_cached_json

settings = get_settings()
LOCAL_QUOTE_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}
FALLBACK_QUOTES: dict[str, dict[str, Any]] = {
    "INFY": {"price": 1512.0, "shortName": "Infosys", "marketCap": 6.4e12, "sector": "Technology"},
    "SBIN": {"price": 768.0, "shortName": "State Bank of India", "marketCap": 6.8e12, "sector": "Financial Services"},
    "TATAMOTORS": {"price": 904.0, "shortName": "Tata Motors", "marketCap": 3.3e12, "sector": "Automotive"},
    "HDFCBANK": {"price": 1618.0, "shortName": "HDFC Bank", "marketCap": 12.1e12, "sector": "Financial Services"},
    "RELIANCE": {"price": 2910.0, "shortName": "Reliance Industries", "marketCap": 19.8e12, "sector": "Conglomerate"},
    "LT": {"price": 3475.0, "shortName": "Larsen & Toubro", "marketCap": 4.9e12, "sector": "Engineering"},
    "ICICIBANK": {"price": 1112.0, "shortName": "ICICI Bank", "marketCap": 8.2e12, "sector": "Financial Services"},
    "TCS": {"price": 3660.0, "shortName": "TCS", "marketCap": 13.2e12, "sector": "Technology"},
    "SUNPHARMA": {"price": 1710.0, "shortName": "Sun Pharma", "marketCap": 4.2e12, "sector": "Healthcare"},
}


def _normalize_symbol(symbol: str, exchange: str = "NSE") -> str:
    upper = symbol.upper()
    if upper.endswith(".NS") or upper.endswith(".BO"):
        return upper
    return f"{upper}.NS" if exchange.upper() == "NSE" else f"{upper}.BO"


def classify_market_cap(market_cap: float | None) -> str:
    if market_cap is None:
        return "Unknown"
    if market_cap >= 200_000_000_000:
        return "Large Cap"
    if market_cap >= 50_000_000_000:
        return "Mid Cap"
    return "Small Cap"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(symbol: str, exchange: str) -> str:
    return f"quote:{exchange.upper()}:{symbol.upper()}"


def _serialize_quote(quote: StockQuote) -> dict[str, Any]:
    return quote.model_dump()


def _get_local_cached_quote(key: str) -> StockQuote | None:
    cached = LOCAL_QUOTE_CACHE.get(key)
    if not cached:
        return None
    expires_at, payload = cached
    if expires_at <= _utc_now():
        LOCAL_QUOTE_CACHE.pop(key, None)
        return None
    return StockQuote(**payload)


def _set_local_cached_quote(key: str, quote: StockQuote) -> None:
    LOCAL_QUOTE_CACHE[key] = (
        _utc_now() + timedelta(seconds=settings.cache_ttl_seconds),
        _serialize_quote(quote),
    )


def _build_quote(symbol: str, exchange: str, info: dict[str, Any], *, source: str, is_fallback: bool) -> StockQuote:
    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("price") or 0.0
    previous = info.get("previousClose") or info.get("regularMarketPreviousClose") or price or 1
    if not price:
        previous = price or 0.0
    fetched_at = _utc_now()
    cache_until = fetched_at + timedelta(seconds=settings.cache_ttl_seconds)
    return StockQuote(
        symbol=symbol.upper(),
        short_name=info.get("shortName") or info.get("longName") or symbol.upper(),
        exchange=exchange.upper(),
        price=float(price),
        change_percent=float(((price - previous) / previous) * 100) if previous else 0.0,
        currency=info.get("currency") or "INR",
        market_cap=info.get("marketCap"),
        sector=info.get("sector"),
        previous_close=float(previous) if previous else None,
        fetched_at=fetched_at.isoformat(),
        cache_until=cache_until.isoformat(),
        data_source=source,
        is_fallback=is_fallback,
    )


async def fetch_quote(symbol: str, exchange: str = "NSE", redis: Redis | None = None) -> StockQuote:
    cache_key = _cache_key(symbol, exchange)
    if redis:
        cached = await get_cached_json(redis, cache_key)
        if cached:
            return StockQuote(**cached)
    else:
        local_cached = _get_local_cached_quote(cache_key)
        if local_cached:
            return local_cached

    info: dict[str, Any]
    source = "yfinance"
    is_fallback = False
    try:
        ticker = yf.Ticker(_normalize_symbol(symbol, exchange))
        info = ticker.info
    except Exception:
        info = FALLBACK_QUOTES.get(symbol.upper(), {})
        source = "fallback"
        is_fallback = True
    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("price") or 0.0
    if not price:
        info = FALLBACK_QUOTES.get(symbol.upper(), {})
        source = "fallback"
        is_fallback = True
        if not info:
            info = {"price": 100.0, "shortName": symbol.upper(), "currency": "INR"}
    quote = _build_quote(symbol, exchange, info, source=source, is_fallback=is_fallback)
    if redis:
        await set_cached_json(redis, cache_key, _serialize_quote(quote), settings.cache_ttl_seconds)
    else:
        _set_local_cached_quote(cache_key, quote)
    return quote


async def fetch_market_feed(
    symbols: list[str], exchange: str = "NSE", redis: Redis | None = None
) -> list[StockQuote]:
    quotes = []
    for symbol in symbols:
        try:
            quotes.append(await fetch_quote(symbol, exchange, redis))
        except Exception:
            continue
    return quotes


def _series_tail_or_none(series: pd.Series) -> float | None:
    if series.empty or pd.isna(series.iloc[-1]):
        return None
    value = float(series.iloc[-1])
    return round(value, 2) if not math.isnan(value) else None


async def fetch_indicator_bundle(symbol: str, exchange: str = "NSE") -> TechnicalIndicators:
    ticker = yf.Ticker(_normalize_symbol(symbol, exchange))
    history = ticker.history(period="6mo", interval="1d")
    close = history["Close"]
    delta = close.diff()
    gains = delta.clip(lower=0).rolling(window=14).mean()
    losses = -delta.clip(upper=0).rolling(window=14).mean()
    rs = gains / losses.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    sma_20 = close.rolling(window=20).mean()
    sma_50 = close.rolling(window=50).mean()
    ema_20 = close.ewm(span=20, adjust=False).mean()
    rolling_std = close.rolling(window=20).std()
    upper = sma_20 + (rolling_std * 2)
    lower = sma_20 - (rolling_std * 2)
    latest_rsi = _series_tail_or_none(rsi)
    latest_macd = _series_tail_or_none(macd)
    latest_signal = _series_tail_or_none(macd_signal)

    interpretation = []
    if latest_rsi is not None:
        interpretation.append(
            "RSI indicates overbought momentum."
            if latest_rsi >= 70
            else "RSI indicates oversold conditions."
            if latest_rsi <= 30
            else "RSI is in a neutral range."
        )
    if latest_macd is not None and latest_signal is not None:
        interpretation.append(
            "MACD is above the signal line, suggesting bullish momentum."
            if latest_macd > latest_signal
            else "MACD is below the signal line, suggesting bearish pressure."
        )

    return TechnicalIndicators(
        rsi=latest_rsi,
        macd=latest_macd,
        macd_signal=latest_signal,
        sma_20=_series_tail_or_none(sma_20),
        sma_50=_series_tail_or_none(sma_50),
        ema_20=_series_tail_or_none(ema_20),
        bollinger_upper=_series_tail_or_none(upper),
        bollinger_lower=_series_tail_or_none(lower),
        interpretation=" ".join(interpretation) or "Indicator data is currently limited.",
    )


def sentiment_from_text(text: str) -> str:
    positive_terms = {"gain", "surge", "beat", "strong", "up", "growth", "record"}
    negative_terms = {"fall", "drop", "miss", "weak", "down", "loss", "concern"}
    score = sum(1 for term in positive_terms if term in text.lower())
    score -= sum(1 for term in negative_terms if term in text.lower())
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


def coerce_articles(raw_articles: list[dict[str, Any]]) -> list[NewsArticle]:
    items: list[NewsArticle] = []
    for item in raw_articles:
        title = item.get("title", "")
        description = item.get("description")
        items.append(
            NewsArticle(
                title=title,
                description=description,
                url=item.get("url", ""),
                source=item.get("source", {}).get("name")
                if isinstance(item.get("source"), dict)
                else item.get("source", "Unknown"),
                published_at=item.get("publishedAt"),
                sentiment=sentiment_from_text(" ".join(filter(None, [title, description]))),
            )
        )
    return items
