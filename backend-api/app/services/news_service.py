from __future__ import annotations

import httpx
from redis.asyncio import Redis

from app.core.config import get_settings
from app.schemas.stock import NewsArticle
from app.services.cache_service import get_cached_json, set_cached_json
from app.services.stock_service import coerce_articles

settings = get_settings()
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"


def _coerce_alpha_articles(raw_articles: list[dict]) -> list[NewsArticle]:
    articles: list[NewsArticle] = []
    for item in raw_articles:
        source = item.get("source") or "Alpha Vantage"
        sentiment = item.get("overall_sentiment_label") or "neutral"
        articles.append(
            NewsArticle(
                title=item.get("title", ""),
                description=item.get("summary"),
                url=item.get("url", ""),
                source=source,
                published_at=item.get("time_published"),
                sentiment=sentiment.lower(),
            )
        )
    return [article for article in articles if article.title]


async def fetch_news(symbol: str, redis: Redis | None = None) -> list[NewsArticle]:
    cache_key = f"news:{symbol.upper()}"
    if redis:
        cached = await get_cached_json(redis, cache_key)
        if cached:
            return [NewsArticle(**article) for article in cached]

    if settings.alpha_vantage_api_key:
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": symbol.upper(),
            "sort": "LATEST",
            "limit": 10,
            "apikey": settings.alpha_vantage_api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(ALPHA_VANTAGE_BASE_URL, params=params)
                response.raise_for_status()
                payload = response.json()
            articles = _coerce_alpha_articles(payload.get("feed", []))
            if articles:
                if redis:
                    await set_cached_json(
                        redis,
                        cache_key,
                        [article.model_dump() for article in articles],
                        settings.cache_ttl_seconds * 10,
                    )
                return articles
        except Exception:
            pass

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


async def fetch_market_news(redis: Redis | None = None) -> list[NewsArticle]:
    cache_key = "news:market:nse"
    if redis:
        cached = await get_cached_json(redis, cache_key)
        if cached:
            return [NewsArticle(**article) for article in cached]

    if settings.alpha_vantage_api_key:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(
                    ALPHA_VANTAGE_BASE_URL,
                    params={
                        "function": "NEWS_SENTIMENT",
                        "topics": "financial_markets",
                        "sort": "LATEST",
                        "limit": 10,
                        "apikey": settings.alpha_vantage_api_key,
                    },
                )
                response.raise_for_status()
                articles = _coerce_alpha_articles(response.json().get("feed", []))
            if articles:
                if redis:
                    await set_cached_json(
                        redis,
                        cache_key,
                        [article.model_dump() for article in articles],
                        settings.cache_ttl_seconds * 30,
                    )
                return articles
        except Exception:
            pass

    return []
