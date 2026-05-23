from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from redis.asyncio import Redis

from app.api.deps import get_admin_user
from app.db.session import get_redis
from app.models.user import User
from app.services.kite_service import (
    exchange_and_store_token,
    get_login_url,
    kite_status,
    set_kite_token,
)

router = APIRouter(prefix="/kite", tags=["kite"])


@router.get("/status")
async def kite_token_status(
    _: User = Depends(get_admin_user),
    redis: Redis = Depends(get_redis),
) -> dict:
    return await kite_status(redis)


@router.get("/login-url")
async def kite_login_url(_: User = Depends(get_admin_user)) -> dict:
    try:
        url = get_login_url()
        return {"login_url": url}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/callback")
async def kite_callback(
    request_token: str = Query(default=""),
    status: str = Query(default=""),
    redis: Redis = Depends(get_redis),
) -> HTMLResponse:
    if status != "success" or not request_token:
        return HTMLResponse(
            "<h2 style='font-family:sans-serif;color:#d95a5a'>Kite login failed or was cancelled.</h2>",
            status_code=400,
        )
    try:
        await exchange_and_store_token(request_token, redis)
        return HTMLResponse("""
            <html><body style='font-family:sans-serif;text-align:center;padding:60px;background:#f5f9ff'>
            <h2 style='color:#27b27e'>&#10003; Kite Connect token activated</h2>
            <p style='color:#0f203d'>Live NSE &amp; BSE prices are now active. This token is valid until midnight.</p>
            <p style='font-size:0.85rem;color:#6b7a99'>You can close this tab.</p>
            </body></html>
        """)
    except Exception as exc:
        return HTMLResponse(
            f"<h2 style='font-family:sans-serif;color:#d95a5a'>Token exchange failed: {exc}</h2>",
            status_code=500,
        )
