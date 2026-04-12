from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db, get_redis
from app.models.portfolio import PortfolioHolding, PortfolioSale
from app.models.user import User
from app.schemas.portfolio import HoldingCreateRequest, HoldingResponse, HoldingSellRequest, PortfolioSummaryResponse, SaleResponse
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
    exchange = "NSE"
    quote = await fetch_quote(payload.symbol, exchange, redis)
    holding = PortfolioHolding(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=exchange,
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


@router.get("/sales", response_model=list[SaleResponse])
async def list_sales(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[SaleResponse]:
    result = await db.execute(
        select(PortfolioSale).where(PortfolioSale.user_id == current_user.id).order_by(PortfolioSale.sold_at.desc())
    )
    return [SaleResponse.model_validate(item) for item in result.scalars().all()]


@router.post("/{holding_id}/sell", response_model=SaleResponse)
async def sell_holding(
    holding_id: int,
    payload: HoldingSellRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> SaleResponse:
    result = await db.execute(
        select(PortfolioHolding).where(
            PortfolioHolding.id == holding_id,
            PortfolioHolding.user_id == current_user.id,
        )
    )
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    current_quantity = float(holding.quantity)
    sell_quantity = float(payload.quantity)
    if sell_quantity > current_quantity:
        raise HTTPException(status_code=400, detail="Sell quantity cannot be more than holding quantity")

    quote = await fetch_quote(holding.symbol, "NSE", redis)
    sell_price = float(payload.sell_price or quote.price)
    buy_price = float(holding.buy_price)
    profit_loss = (sell_price - buy_price) * sell_quantity
    sale = PortfolioSale(
        user_id=current_user.id,
        symbol=holding.symbol,
        exchange="NSE",
        quantity=sell_quantity,
        buy_price=buy_price,
        sell_price=sell_price,
        profit_loss=round(profit_loss, 2),
        sector=holding.sector or quote.sector,
    )
    db.add(sale)

    remaining_quantity = round(current_quantity - sell_quantity, 2)
    if remaining_quantity <= 0:
        await db.delete(holding)
    else:
        holding.quantity = remaining_quantity

    await db.commit()
    await db.refresh(sale)
    return SaleResponse.model_validate(sale)


@router.get("/summary", response_model=PortfolioSummaryResponse)
async def portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PortfolioSummaryResponse:
    result = await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == current_user.id))
    sales_result = await db.execute(
        select(PortfolioSale).where(PortfolioSale.user_id == current_user.id).order_by(PortfolioSale.sold_at.desc())
    )
    return await build_portfolio_summary(list(result.scalars().all()), redis, list(sales_result.scalars().all()))


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
