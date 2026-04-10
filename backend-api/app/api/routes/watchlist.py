from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistCreateRequest, WatchlistResponse

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_watchlist_item(
    payload: WatchlistCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.symbol == payload.symbol.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Stock already in watchlist")
    item = WatchlistItem(user_id=current_user.id, symbol=payload.symbol.upper(), exchange=payload.exchange.upper())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return WatchlistResponse.model_validate(item)


@router.get("", response_model=list[WatchlistResponse])
async def list_watchlist(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[WatchlistResponse]:
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.user_id == current_user.id))
    return [WatchlistResponse.model_validate(item) for item in result.scalars().all()]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    await db.execute(delete(WatchlistItem).where(WatchlistItem.id == item_id))
    await db.commit()
