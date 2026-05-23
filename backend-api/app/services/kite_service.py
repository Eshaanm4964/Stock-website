from __future__ import annotations

import json
import logging
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

KITE_TOKEN_KEY = "kite:access_token"
INSTRUMENTS_TTL = 86400  # 24 hours — refresh daily


def _make_kite(access_token: str | None = None):
    from kiteconnect import KiteConnect
    kite = KiteConnect(api_key=settings.kite_api_key)
    if access_token:
        kite.set_access_token(access_token)
    return kite


async def get_kite_token(redis: Redis) -> str | None:
    val = await redis.get(KITE_TOKEN_KEY)
    return val.decode() if val else None


async def set_kite_token(redis: Redis, access_token: str) -> None:
    await redis.set(KITE_TOKEN_KEY, access_token, ex=INSTRUMENTS_TTL)


def get_login_url() -> str:
    return _make_kite().login_url()


async def exchange_and_store_token(request_token: str, redis: Redis) -> str:
    kite = _make_kite()
    data = kite.generate_session(request_token, api_secret=settings.kite_api_secret)
    access_token: str = data["access_token"]
    await set_kite_token(redis, access_token)
    # Warm up instruments cache in background
    import asyncio
    asyncio.create_task(_cache_instruments(access_token, redis))
    return access_token


async def _cache_instruments(access_token: str, redis: Redis) -> None:
    import asyncio
    for exchange in ("NSE", "BSE"):
        try:
            raw = await asyncio.to_thread(_fetch_instruments_sync, access_token, exchange)
            equities = [
                {"symbol": i["tradingsymbol"], "name": i.get("name") or i["tradingsymbol"], "exchange": exchange}
                for i in raw
                if i.get("instrument_type") == "EQ"
            ]
            await redis.set(f"kite:instruments:{exchange}", json.dumps(equities), ex=INSTRUMENTS_TTL)
            logger.info("Cached %d %s instruments", len(equities), exchange)
        except Exception as exc:
            logger.warning("Failed to cache %s instruments: %s", exchange, exc)


def _fetch_instruments_sync(access_token: str, exchange: str) -> list[dict]:
    kite = _make_kite(access_token)
    return kite.instruments(exchange)


async def kite_fetch_quote(symbol: str, exchange: str, redis: Redis) -> dict[str, Any] | None:
    token = await get_kite_token(redis)
    if not token:
        return None
    try:
        import asyncio
        instrument_key = f"{exchange.upper()}:{symbol.upper()}"
        data = await asyncio.to_thread(_quote_sync, token, instrument_key)
        q = data.get(instrument_key) or {}
        if not q or not q.get("last_price"):
            # Try alternate exchange
            alt = "BSE" if exchange.upper() == "NSE" else "NSE"
            alt_key = f"{alt}:{symbol.upper()}"
            data2 = await asyncio.to_thread(_quote_sync, token, alt_key)
            q = data2.get(alt_key) or {}
        if not q or not q.get("last_price"):
            return None
        ohlc = q.get("ohlc") or {}
        return {
            "currentPrice": float(q["last_price"]),
            "previousClose": float(ohlc.get("close") or 0) or None,
            "shortName": q.get("tradingsymbol") or symbol.upper(),
            "currency": "INR",
        }
    except Exception as exc:
        logger.warning("Kite quote failed for %s:%s — %s", exchange, symbol, exc)
        return None


def _quote_sync(access_token: str, instrument_key: str) -> dict:
    return _make_kite(access_token).quote([instrument_key])


async def kite_search_instruments(query: str, exchange: str, redis: Redis, limit: int = 10) -> list[dict]:
    token = await get_kite_token(redis)
    if not token:
        return []

    cache_key = f"kite:instruments:{exchange.upper()}"
    raw = await redis.get(cache_key)

    if raw:
        instruments: list[dict] = json.loads(raw)
    else:
        # Fetch and cache on demand
        try:
            import asyncio
            fetched = await asyncio.to_thread(_fetch_instruments_sync, token, exchange.upper())
            instruments = [
                {"symbol": i["tradingsymbol"], "name": i.get("name") or i["tradingsymbol"], "exchange": exchange.upper()}
                for i in fetched
                if i.get("instrument_type") == "EQ"
            ]
            await redis.set(cache_key, json.dumps(instruments), ex=INSTRUMENTS_TTL)
        except Exception as exc:
            logger.warning("Kite instruments fetch failed for %s: %s", exchange, exc)
            return []

    q = query.strip().upper()
    exact, starts, contains = [], [], []
    for inst in instruments:
        sym = inst["symbol"].upper()
        name = inst["name"].upper()
        if sym == q:
            exact.append(inst)
        elif sym.startswith(q) or name.startswith(q):
            starts.append(inst)
        elif q in sym or q in name:
            contains.append(inst)

    results = (exact + starts + contains)[:limit]
    return results


async def kite_status(redis: Redis) -> dict:
    token = await get_kite_token(redis)
    ttl = await redis.ttl(KITE_TOKEN_KEY) if token else -1
    return {"active": bool(token), "expires_in_seconds": ttl if ttl > 0 else 0}
