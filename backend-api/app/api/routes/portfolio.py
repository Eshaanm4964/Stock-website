from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db, get_redis
from app.models.portfolio import PortfolioHolding
from app.models.user import User
from app.schemas.portfolio import HoldingCreateRequest, HoldingResponse, PortfolioSummaryResponse
from app.services.portfolio_service import build_portfolio_summary
from app.services.stock_service import fetch_quote

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
async def add_holding(
    payload: HoldingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> HoldingResponse:
    quote = await fetch_quote(payload.symbol, payload.exchange, redis)
    holding = PortfolioHolding(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=payload.exchange.upper(),
        quantity=payload.quantity,
        buy_price=payload.buy_price,
        sector=quote.sector,
    )
    db.add(holding)
    await db.commit()
    await db.refresh(holding)
    return HoldingResponse.model_validate(holding)


@router.get("", response_model=list[HoldingResponse])
async def list_holdings(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[HoldingResponse]:
    result = await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == current_user.id))
    return [HoldingResponse.model_validate(item) for item in result.scalars().all()]


@router.get("/summary", response_model=PortfolioSummaryResponse)
async def portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PortfolioSummaryResponse:
    result = await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == current_user.id))
    return await build_portfolio_summary(result.scalars().all(), redis)


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
    holding_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(PortfolioHolding).where(
            PortfolioHolding.id == holding_id,
            PortfolioHolding.user_id == current_user.id,
        )
    )
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    await db.execute(delete(PortfolioHolding).where(PortfolioHolding.id == holding_id))
    await db.commit()
