import asyncio
import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user
from app.db.session import get_db
from app.models.admin_setting import AdminSetting
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreateRequest, ReviewResponse
from app.schemas.site import SiteSettingsResponse, SiteSettingsUpdateRequest
from app.services.security_service import log_admin_action

logger = logging.getLogger(__name__)

ALGO_DATA_URL = "https://goctechnology.com/gocglobalalgo/data/algos.json"
_algo_cache: dict[str, Any] = {"data": None, "ts": 0}
ALGO_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="/site", tags=["site"])


async def _get_or_create_site_settings(db: AsyncSession) -> AdminSetting:
    settings = (await db.execute(select(AdminSetting).limit(1))).scalar_one_or_none()
    if settings:
        return settings

    settings = AdminSetting(show_faq_insights=True, chat_nudges_enabled=True)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/settings", response_model=SiteSettingsResponse)
async def get_site_settings(db: AsyncSession = Depends(get_db)) -> SiteSettingsResponse:
    settings = await _get_or_create_site_settings(db)
    return SiteSettingsResponse.model_validate(settings)


@router.put("/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    payload: SiteSettingsUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> SiteSettingsResponse:
    settings = await _get_or_create_site_settings(db)
    settings.show_faq_insights = payload.show_faq_insights
    settings.chat_nudges_enabled = payload.chat_nudges_enabled
    await db.commit()
    await db.refresh(settings)
    await log_admin_action(
        db,
        admin_user=current_admin,
        action="update_site_settings",
        entity_type="admin_setting",
        entity_id=str(settings.id),
        ip_address=request.client.host if request.client else None,
        details={
            "show_faq_insights": settings.show_faq_insights,
            "chat_nudges_enabled": settings.chat_nudges_enabled,
        },
    )
    return SiteSettingsResponse.model_validate(settings)


@router.get("/reviews", response_model=list[ReviewResponse])
async def list_reviews(db: AsyncSession = Depends(get_db)) -> list[ReviewResponse]:
    reviews = list((await db.execute(select(Review).order_by(Review.created_at.desc()))).scalars().all())
    return [ReviewResponse.model_validate(review) for review in reviews]


@router.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    payload: ReviewCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    review = Review(
        name=payload.name.strip(),
        role=payload.role.strip(),
        rating=payload.rating,
        message=payload.message.strip(),
        is_seeded=False,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return ReviewResponse.model_validate(review)


@router.delete("/reviews", status_code=status.HTTP_204_NO_CONTENT)
async def clear_reviews(
    request: Request,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(delete(Review).where(Review.is_seeded.is_(False)))
    await db.commit()
    await log_admin_action(
        db,
        admin_user=current_admin,
        action="clear_custom_reviews",
        entity_type="review",
        entity_id=None,
        ip_address=request.client.host if request.client else None,
        details={"scope": "non_seeded_reviews"},
    )


@router.get("/algo-data")
async def get_algo_data() -> Any:
    now = time.time()
    if _algo_cache["data"] is not None and now - _algo_cache["ts"] < ALGO_CACHE_TTL:
        return _algo_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "Mozilla/5.0 (compatible; AssetYantra/1.0)"}) as client:
            resp = await client.get(ALGO_DATA_URL)
            resp.raise_for_status()
            data = resp.json()
            _algo_cache["data"] = data
            _algo_cache["ts"] = now
            return data
    except Exception as exc:
        logger.warning("Failed to fetch algo data: %s", exc)
        if _algo_cache["data"] is not None:
            return _algo_cache["data"]
        return []
