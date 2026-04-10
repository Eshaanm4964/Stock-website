from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertCreateRequest, AlertResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    if payload.condition not in {"above", "below"}:
        raise HTTPException(status_code=400, detail="Condition must be 'above' or 'below'")
    alert = Alert(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        target_price=payload.target_price,
        condition=payload.condition,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[AlertResponse]:
    result = await db.execute(select(Alert).where(Alert.user_id == current_user.id))
    return [AlertResponse.model_validate(alert) for alert in result.scalars().all()]


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.execute(delete(Alert).where(Alert.id == alert_id))
    await db.commit()
