from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db, get_redis
from app.models.portfolio import PortfolioHolding
from app.models.sold_history import SoldHistory
from app.models.user import User
from app.schemas.portfolio import HoldingCreateRequest, HoldingResponse, PortfolioSummaryResponse, SoldHistoryResponse
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
    existing_holding = (
        await db.execute(
            select(PortfolioHolding).where(
                PortfolioHolding.user_id == current_user.id,
                PortfolioHolding.symbol == payload.symbol.upper(),
                PortfolioHolding.exchange == payload.exchange.upper(),
            )
        )
    ).scalars().first()

    if existing_holding:
        current_quantity = Decimal(str(existing_holding.quantity))
        incoming_quantity = Decimal(str(payload.quantity))
        current_invested = current_quantity * Decimal(str(existing_holding.buy_price))
        incoming_invested = incoming_quantity * Decimal(str(payload.buy_price))
        total_quantity = current_quantity + incoming_quantity
        average_buy_price = (current_invested + incoming_invested) / total_quantity

        existing_holding.quantity = total_quantity
        existing_holding.buy_price = average_buy_price
        existing_holding.sector = quote.sector or existing_holding.sector
        await db.commit()
        await db.refresh(existing_holding)
        return HoldingResponse.model_validate(existing_holding)

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
    redis: Redis = Depends(get_redis),
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
    quote = await fetch_quote(holding.symbol, holding.exchange, redis)
    db.add(
        SoldHistory(
            user_id=current_user.id,
            holding_id=holding.id,
            symbol=holding.symbol,
            exchange=holding.exchange,
            quantity=holding.quantity,
            buy_price=holding.buy_price,
            sell_price=quote.price,
            profit_loss=(quote.price - float(holding.buy_price)) * float(holding.quantity),
            sold_by_role="user",
            sold_by_identifier=current_user.fixed_user_id or current_user.username,
            created_at=holding.created_at,
        )
    )
    await db.execute(delete(PortfolioHolding).where(PortfolioHolding.id == holding_id))
    await db.commit()


@router.get("/sold-history", response_model=list[SoldHistoryResponse])
async def list_sold_history(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[SoldHistoryResponse]:
    result = await db.execute(
        select(SoldHistory).where(SoldHistory.user_id == current_user.id).order_by(SoldHistory.sold_at.desc())
    )
    return [SoldHistoryResponse.model_validate(item) for item in result.scalars().all()]
