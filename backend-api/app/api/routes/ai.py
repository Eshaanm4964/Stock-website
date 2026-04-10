from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db, get_redis
from app.models.portfolio import PortfolioHolding
from app.models.user import User
from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services.ai_service import generate_market_response
from app.services.news_service import fetch_news
from app.services.portfolio_service import build_portfolio_summary
from app.services.stock_service import fetch_indicator_bundle, fetch_quote
from app.core.config import get_settings

router = APIRouter(prefix="/ai", tags=["ai"])
settings = get_settings()


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AIChatResponse:
    if settings.demo_mode:
        fallback = (
            "Market Read: Demo mode is active, so this assistant is showing a guided sample response.\n"
            "Why It Moved: In the full version, this area will explain price moves using live market context.\n"
            "Portfolio Impact: Use the dashboard cards, holdings table, and recommendation panel for the client walkthrough.\n"
            "Watchouts: This demo is for product presentation and does not provide live investment advice."
        )
        return AIChatResponse(answer=fallback, citations=[])

    holdings = list(
        (await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == current_user.id))).scalars().all()
    )
    portfolio_summary = await build_portfolio_summary(holdings, redis)
    quote = await fetch_quote(payload.symbol, redis=redis) if payload.symbol else None
    indicators = await fetch_indicator_bundle(payload.symbol) if payload.symbol else None
    news = await fetch_news(payload.symbol, redis) if payload.symbol else []
    context = {
        "portfolio": portfolio_summary.model_dump(),
        "stock": quote.model_dump() if quote else None,
        "indicators": indicators.model_dump() if indicators else None,
        "news": [article.model_dump() for article in news],
    }
    answer, citations = await generate_market_response(context, payload.message)
    return AIChatResponse(answer=answer, citations=citations)
