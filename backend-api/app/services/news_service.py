from __future__ import annotations

import httpx
from redis.asyncio import Redis

from app.core.config import get_settings
from app.schemas.stock import NewsArticle
from app.services.cache_service import get_cached_json, set_cached_json
from app.services.stock_service import coerce_articles

settings = get_settings()


async def fetch_news(symbol: str, redis: Redis | None = None) -> list[NewsArticle]:
    cache_key = f"news:{symbol.upper()}"
    if redis:
        cached = await get_cached_json(redis, cache_key)
        if cached:
            return [NewsArticle(**article) for article in cached]

    if not settings.news_api_key:
        return []

    params = {
        "q": f"{symbol} stock India",
        "sortBy": "publishedAt",
        "apiKey": settings.news_api_key,
        "pageSize": 10,
        "language": "en",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://newsapi.org/v2/everything", params=params)
        response.raise_for_status()
        payload = response.json()

    articles = coerce_articles(payload.get("articles", []))
    if redis:
        await set_cached_json(
            redis,
            cache_key,
            [article.model_dump() for article in articles],
            settings.cache_ttl_seconds * 10,
        )
    return articles
