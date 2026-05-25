from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
import httpx
import yfinance as yf
from redis.asyncio import Redis

from app.core.config import get_settings
from app.schemas.stock import NewsArticle, StockQuote, StockSearchResult, TechnicalIndicators
from app.services.cache_service import get_cached_json, set_cached_json

settings = get_settings()
LOCAL_QUOTE_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}
FALLBACK_QUOTES: dict[str, dict[str, Any]] = {
    "^NSEI": {"price": 22580.35, "shortName": "NIFTY 50", "marketCap": None, "sector": "Index"},
    "^BSESN": {"price": 74221.06, "shortName": "SENSEX", "marketCap": None, "sector": "Index"},
    "NIFTY50": {"price": 22580.35, "shortName": "NIFTY 50", "marketCap": None, "sector": "Index"},
    "SENSEX": {"price": 74221.06, "shortName": "SENSEX", "marketCap": None, "sector": "Index"},
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
MARKET_SYMBOL_CATALOG: list[dict[str, Any]] = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd", "sector": "Technology"},
    {"symbol": "INFY", "name": "Infosys Ltd", "sector": "Technology"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "sector": "Financial Services"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "sector": "Financial Services"},
    {"symbol": "SBIN", "name": "State Bank of India", "sector": "Financial Services"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd", "sector": "Industrials"},
    {"symbol": "ITC", "name": "ITC Ltd", "sector": "Consumer Defensive"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd", "sector": "Financial Services"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd", "sector": "Financial Services"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd", "sector": "Telecom"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "sector": "Automotive"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "sector": "Healthcare"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Ltd", "sector": "Automotive"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "sector": "Consumer Defensive"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "sector": "Financial Services"},
    {"symbol": "HCLTECH", "name": "HCL Technologies Ltd", "sector": "Technology"},
    {"symbol": "WIPRO", "name": "Wipro Ltd", "sector": "Technology"},
    {"symbol": "TECHM", "name": "Tech Mahindra Ltd", "sector": "Technology"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Ltd", "sector": "Industrials"},
    {"symbol": "ADANIPORTS", "name": "Adani Ports and SEZ Ltd", "sector": "Industrials"},
    {"symbol": "ULTRACEMCO", "name": "UltraTech Cement Ltd", "sector": "Materials"},
    {"symbol": "TITAN", "name": "Titan Company Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "POWERGRID", "name": "Power Grid Corporation of India Ltd", "sector": "Utilities"},
    {"symbol": "NTPC", "name": "NTPC Ltd", "sector": "Utilities"},
    {"symbol": "ONGC", "name": "Oil and Natural Gas Corporation Ltd", "sector": "Energy"},
    {"symbol": "COALINDIA", "name": "Coal India Ltd", "sector": "Energy"},
    {"symbol": "JSWSTEEL", "name": "JSW Steel Ltd", "sector": "Materials"},
    {"symbol": "TATASTEEL", "name": "Tata Steel Ltd", "sector": "Materials"},
    {"symbol": "HINDALCO", "name": "Hindalco Industries Ltd", "sector": "Materials"},
    {"symbol": "NESTLEIND", "name": "Nestle India Ltd", "sector": "Consumer Defensive"},
    {"symbol": "BRITANNIA", "name": "Britannia Industries Ltd", "sector": "Consumer Defensive"},
    {"symbol": "CIPLA", "name": "Cipla Ltd", "sector": "Healthcare"},
    {"symbol": "DRREDDY", "name": "Dr Reddy's Laboratories Ltd", "sector": "Healthcare"},
    {"symbol": "APOLLOHOSP", "name": "Apollo Hospitals Enterprise Ltd", "sector": "Healthcare"},
    {"symbol": "GRASIM", "name": "Grasim Industries Ltd", "sector": "Materials"},
    {"symbol": "M&M", "name": "Mahindra & Mahindra Ltd", "sector": "Automotive"},
    {"symbol": "EICHERMOT", "name": "Eicher Motors Ltd", "sector": "Automotive"},
    {"symbol": "HEROMOTOCO", "name": "Hero MotoCorp Ltd", "sector": "Automotive"},
    {"symbol": "BAJAJ-AUTO", "name": "Bajaj Auto Ltd", "sector": "Automotive"},
    {"symbol": "SHRIRAMFIN", "name": "Shriram Finance Ltd", "sector": "Financial Services"},
    {"symbol": "SBILIFE", "name": "SBI Life Insurance Company Ltd", "sector": "Financial Services"},
    {"symbol": "HDFCLIFE", "name": "HDFC Life Insurance Company Ltd", "sector": "Financial Services"},
    {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv Ltd", "sector": "Financial Services"},
    {"symbol": "DMART", "name": "Avenue Supermarts Ltd", "sector": "Consumer Defensive"},
    {"symbol": "PIDILITIND", "name": "Pidilite Industries Ltd", "sector": "Materials"},
    {"symbol": "DABUR", "name": "Dabur India Ltd", "sector": "Consumer Defensive"},
    {"symbol": "GODREJCP", "name": "Godrej Consumer Products Ltd", "sector": "Consumer Defensive"},
    {"symbol": "BANKBARODA", "name": "Bank of Baroda", "sector": "Financial Services"},
    {"symbol": "PNB", "name": "Punjab National Bank", "sector": "Financial Services"},
    {"symbol": "CANBK", "name": "Canara Bank", "sector": "Financial Services"},
    {"symbol": "IDFCFIRSTB", "name": "IDFC First Bank Ltd", "sector": "Financial Services"},
    {"symbol": "INDUSINDBK", "name": "IndusInd Bank Ltd", "sector": "Financial Services"},
    {"symbol": "FEDERALBNK", "name": "Federal Bank Ltd", "sector": "Financial Services"},
    {"symbol": "YESBANK", "name": "Yes Bank Ltd", "sector": "Financial Services"},
    {"symbol": "VEDL", "name": "Vedanta Ltd", "sector": "Materials"},
    {"symbol": "SAIL", "name": "Steel Authority of India Ltd", "sector": "Materials"},
    {"symbol": "IRCTC", "name": "Indian Railway Catering and Tourism Corporation Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "IRFC", "name": "Indian Railway Finance Corporation Ltd", "sector": "Financial Services"},
    {"symbol": "ZOMATO", "name": "Zomato Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "PAYTM", "name": "One 97 Communications Ltd", "sector": "Technology"},
    {"symbol": "NYKAA", "name": "FSN E-Commerce Ventures Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "POLYCAB", "name": "Polycab India Ltd", "sector": "Industrials"},
    {"symbol": "TRENT", "name": "Trent Ltd", "sector": "Consumer Cyclical"},
    {"symbol": "ABB", "name": "ABB India Ltd", "sector": "Industrials"},
    {"symbol": "SIEMENS", "name": "Siemens Ltd", "sector": "Industrials"},
]

YAHOO_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search"


def _normalize_symbol(symbol: str, exchange: str = "NSE") -> str:
    upper = symbol.upper()
    if upper.startswith("^"):
        return upper
    if upper == "NIFTY50":
        return "^NSEI"
    if upper == "SENSEX":
        return "^BSESN"
    if upper.endswith(".NS") or upper.endswith(".BO"):
        return upper
    return f"{upper}.BO" if exchange.upper() == "BSE" else f"{upper}.NS"


def _clean_search_value(value: str) -> str:
    return "".join(char for char in value.lower() if char.isalnum())


def _search_score(query: str, symbol: str, name: str, sector: str | None = None) -> int:
    cleaned_query = _clean_search_value(query)
    cleaned_symbol = _clean_search_value(symbol)
    cleaned_name = _clean_search_value(name)
    cleaned_sector = _clean_search_value(sector or "")
    if not cleaned_query:
        return 0

    has_direct_match = (
        cleaned_query in cleaned_symbol
        or cleaned_query in cleaned_name
        or cleaned_query in cleaned_sector
    )
    if len(cleaned_query) >= 3 and not has_direct_match:
        return 0

    score = 0
    if cleaned_symbol == cleaned_query:
        score += 1000
    if cleaned_symbol.startswith(cleaned_query):
        score += 800
    if cleaned_name.startswith(cleaned_query):
        score += 680
    if cleaned_symbol.find(cleaned_query) >= 0:
        score += 520 - cleaned_symbol.find(cleaned_query)
    if cleaned_name.find(cleaned_query) >= 0:
        score += 420 - cleaned_name.find(cleaned_query)
    if cleaned_sector.find(cleaned_query) >= 0:
        score += 120

    if len(cleaned_query) <= 2:
        cursor = 0
        loose_score = 0
        for char in cleaned_query:
            found_at = cleaned_symbol.find(char, cursor)
            if found_at == -1:
                found_at = cleaned_name.find(char, cursor)
            if found_at == -1:
                continue
            loose_score += max(1, 8 - (found_at - cursor))
            cursor = found_at + 1
        if loose_score >= len(cleaned_query):
            score += loose_score
    return score


def _catalog_search(query: str, limit: int, exchange: str = "NSE") -> list[StockSearchResult]:
    ranked = []
    fallback_rows = [
        {"symbol": symbol, "name": data.get("shortName") or symbol, "sector": data.get("sector")}
        for symbol, data in FALLBACK_QUOTES.items()
        if not symbol.startswith("^") and symbol not in {"NIFTY50", "SENSEX"}
    ]
    rows = MARKET_SYMBOL_CATALOG + fallback_rows
    seen: set[str] = set()
    for row in rows:
        symbol = str(row.get("symbol") or "").upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        name = str(row.get("name") or symbol)
        sector = row.get("sector")
        score = _search_score(query, symbol, name, sector)
        if score > 0:
            ranked.append((score, row))

    ranked.sort(key=lambda item: (-item[0], str(item[1].get("symbol") or "")))
    return [
        StockSearchResult(
            symbol=str(row.get("symbol") or "").upper(),
            name=str(row.get("name") or row.get("symbol") or "").strip(),
            exchange=exchange.upper(),
            sector=row.get("sector"),
            source="catalog",
        )
        for _, row in ranked[:limit]
    ]


def _strip_yahoo_symbol(symbol: str) -> str:
    upper = symbol.upper().strip()
    if upper.endswith(".NS") or upper.endswith(".BO"):
        return upper[:-3]
    return upper


async def _search_yahoo_symbols(query: str, limit: int, exchange_filter: str = "NSE") -> list[StockSearchResult]:
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(
            YAHOO_SEARCH_URL,
            params={
                "q": query,
                "quotesCount": max(limit * 3, 20),
                "newsCount": 0,
                "listsCount": 0,
            },
            headers={"User-Agent": "AssetYantra/1.0"},
        )
        response.raise_for_status()
        payload = response.json()

    results: list[StockSearchResult] = []
    seen: set[str] = set()
    target_exchange = exchange_filter.upper()
    target_suffix = ".BO" if target_exchange == "BSE" else ".NS"
    exchange_aliases = {"BSE", "BO", "BOM"} if target_exchange == "BSE" else {"NSE", "NSI", "NS"}
    for quote in payload.get("quotes", []):
        yahoo_symbol = str(quote.get("symbol") or "").upper()
        exchange = str(quote.get("exchange") or quote.get("exchDisp") or "").upper()
        if not yahoo_symbol.endswith(target_suffix) and target_exchange not in exchange and exchange not in exchange_aliases:
            continue
        symbol = _strip_yahoo_symbol(yahoo_symbol)
        if not symbol or symbol in seen or symbol.startswith("^"):
            continue
        seen.add(symbol)
        name = quote.get("shortname") or quote.get("longname") or quote.get("name") or symbol
        results.append(
            StockSearchResult(
                symbol=symbol,
                name=str(name),
                exchange=target_exchange,
                sector=quote.get("sector") or f"{target_exchange} equity",
                source="market_search",
            )
        )
        if len(results) >= limit:
            break
    return results


async def search_stock_symbols(query: str, exchange: str = "NSE", limit: int = 10, redis: Redis | None = None) -> list[StockSearchResult]:
    cleaned_query = query.strip()
    if len(cleaned_query) < 1:
        return []
    safe_limit = max(1, min(limit, 20))
    safe_exchange = (exchange or "NSE").upper()
    exchange_targets = ["NSE", "BSE"] if safe_exchange in {"ALL", "SME", "MSME"} else [safe_exchange]

    # Attempt 0: Kite instruments list (complete NSE+BSE coverage)
    from app.services.kite_service import kite_search_instruments
    kite_results: list[StockSearchResult] = []
    seen_kite: set[tuple[str, str]] = set()
    for target_exchange in exchange_targets:
        for inst in await kite_search_instruments(cleaned_query, target_exchange, redis, safe_limit):
            key = (inst["symbol"], inst["exchange"])
            if key in seen_kite:
                continue
            seen_kite.add(key)
            kite_results.append(StockSearchResult(
                symbol=inst["symbol"],
                name=inst["name"],
                exchange=inst["exchange"],
                sector=None,
                source="kite",
            ))
    if kite_results:
        return kite_results[:safe_limit]

    results: list[StockSearchResult] = []
    seen: set[tuple[str, str]] = set()

    for target_exchange in exchange_targets:
        try:
            for item in await _search_yahoo_symbols(cleaned_query, safe_limit, target_exchange):
                score = _search_score(cleaned_query, item.symbol, item.name, item.sector)
                key = (item.symbol, item.exchange)
                if score <= 0 or key in seen:
                    continue
                results.append(item)
                seen.add(key)
        except Exception:
            continue

    if not results:
        fallback_exchange = exchange_targets[0] if len(exchange_targets) == 1 else "NSE"
        for item in _catalog_search(cleaned_query, safe_limit, fallback_exchange):
            key = (item.symbol, item.exchange)
            if key in seen:
                continue
            results.append(item)
            seen.add(key)

    results.sort(key=lambda item: (-_search_score(cleaned_query, item.symbol, item.name, item.sector), item.symbol, item.exchange))
    return results[:safe_limit]


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


def _set_local_cached_quote_kite(key: str, quote: StockQuote) -> None:
    LOCAL_QUOTE_CACHE[key] = (
        _utc_now() + timedelta(seconds=settings.kite_cache_ttl_seconds),
        _serialize_quote(quote),
    )


def _build_quote(symbol: str, exchange: str, info: dict[str, Any], *, source: str, is_fallback: bool) -> StockQuote:
    price = float(info.get("currentPrice") or info.get("regularMarketPrice") or info.get("price") or 0.0)

    # Try explicit previous-close fields first
    prev_raw = info.get("previousClose") or info.get("regularMarketPreviousClose")
    previous: float | None = float(prev_raw) if prev_raw else None

    # Derive from regularMarketChangePercent when the field is absent
    if previous is None and price:
        direct_pct = info.get("regularMarketChangePercent")
        if direct_pct is not None:
            pct = float(direct_pct)
            if pct != 0 and pct != -100:
                previous = price / (1 + pct / 100)

    # Derive from regularMarketChange (absolute change)
    if previous is None and price:
        direct_change = info.get("regularMarketChange")
        if direct_change is not None:
            chg = float(direct_change)
            if chg != 0:
                previous = price - chg

    # Mark as unknown — do NOT fall back to price; keep None so callers know
    fetched_at = _utc_now()
    cache_until = fetched_at + timedelta(seconds=settings.cache_ttl_seconds)

    if previous and previous > 0:
        change_percent = ((price - previous) / previous) * 100
        prev_close_out: float | None = round(previous, 4)
    else:
        change_percent = 0.0
        prev_close_out = None

    return StockQuote(
        symbol=symbol.upper(),
        short_name=info.get("shortName") or info.get("longName") or symbol.upper(),
        exchange=exchange.upper(),
        price=price,
        change_percent=round(change_percent, 4),
        currency=info.get("currency") or "INR",
        market_cap=info.get("marketCap"),
        sector=info.get("sector"),
        previous_close=prev_close_out,
        fetched_at=fetched_at.isoformat(),
        cache_until=cache_until.isoformat(),
        data_source=source,
        is_fallback=is_fallback,
    )


def _yf_fetch_info(symbol: str) -> dict[str, Any]:
    try:
        return yf.Ticker(symbol).info
    except Exception:
        return {}


def _yf_fetch_fast_info(symbol: str) -> tuple[float | None, float | None]:
    try:
        fi = yf.Ticker(symbol).fast_info
        lp = fi.last_price
        pc = getattr(fi, "previous_close", None)
        return (float(lp) if lp and lp > 0 else None, float(pc) if pc and pc > 0 else None)
    except Exception:
        return (None, None)


def _yf_fetch_history(symbol: str) -> tuple[float | None, float | None]:
    try:
        hist = yf.Ticker(symbol).history(period="10d")
        if hist.empty:
            return (None, None)
        closes = hist["Close"]
        current = float(closes.iloc[-1])
        prev = float(closes.iloc[-2]) if len(closes) >= 2 else None
        return (current, prev)
    except Exception:
        return (None, None)


async def fetch_quote(symbol: str, exchange: str = "NSE", redis: Redis | None = None) -> StockQuote:
    import asyncio
    cache_key = _cache_key(symbol, exchange)
    if redis:
        cached = await get_cached_json(redis, cache_key)
        if cached:
            return StockQuote(**cached)
    else:
        local_cached = _get_local_cached_quote(cache_key)
        if local_cached:
            return local_cached

    # Only Kite — no Yahoo Finance fallback
    from app.services.kite_service import kite_fetch_quote
    kite_data = await kite_fetch_quote(symbol, exchange, redis)
    if kite_data and kite_data.get("currentPrice"):
        quote = _build_quote(symbol, exchange, kite_data, source="kite", is_fallback=False)
        if redis:
            await set_cached_json(redis, cache_key, _serialize_quote(quote), settings.kite_cache_ttl_seconds)
        else:
            _set_local_cached_quote_kite(cache_key, quote)
        return quote

    # Kite unavailable or token expired — return zero price (not cached, retries on next call)
    return StockQuote(
        symbol=symbol.upper(),
        short_name=symbol.upper(),
        exchange=exchange.upper(),
        price=0.0,
        change_percent=0.0,
        currency="INR",
        previous_close=None,
        data_source="unavailable",
        is_fallback=True,
    )


async def fetch_market_feed(
    symbols: list[str], exchange: str = "NSE", redis: Redis | None = None
) -> list[StockQuote]:
    import asyncio
    results = await asyncio.gather(
        *[fetch_quote(symbol, exchange, redis) for symbol in symbols],
        return_exceptions=True,
    )
    return [r for r in results if isinstance(r, StockQuote)]


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
