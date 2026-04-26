import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from sqlalchemy import select, text

from app.api.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine, redis_client
from app.models import admin_audit_log, admin_setting, alert, auth_attempt, login_otp, notification, portfolio, review, sold_history, user, watchlist  # noqa: F401
from app.models.alert import Alert
from app.models.notification import Notification
from app.services.notification_service import build_notification_payload
from app.services.stock_service import fetch_market_feed, fetch_quote
from app.utils.bootstrap import ensure_admin_user, ensure_demo_users, ensure_seed_reviews, ensure_site_settings
from app.websocket.manager import manager

settings = get_settings()


def _extract_user_id_from_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except Exception:
        return None


async def alert_monitor() -> None:
    while True:
        try:
            async with AsyncSessionLocal() as session:
                alerts = list((await session.execute(select(Alert).where(Alert.is_triggered.is_(False)))).scalars().all())
                for alert in alerts:
                    try:
                        quote = await fetch_quote(alert.symbol, redis=redis_client)
                    except Exception:
                        continue
                    current_price = quote.price
                    should_trigger = (
                        alert.condition == "above" and current_price >= float(alert.target_price)
                    ) or (
                        alert.condition == "below" and current_price <= float(alert.target_price)
                    )
                    if should_trigger:
                        alert.is_triggered = True
                        notification = Notification(
                            user_id=alert.user_id,
                            title=f"Price alert hit for {alert.symbol}",
                            message=f"{alert.symbol} reached Rs. {current_price:.2f} against your {alert.condition} target of Rs. {float(alert.target_price):.2f}.",
                        )
                        session.add(notification)
                        await session.commit()
                        await session.refresh(notification)
                        await manager.send_user_notification(alert.user_id, build_notification_payload(notification))
            await asyncio.sleep(settings.alert_poll_interval_seconds)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(settings.alert_poll_interval_seconds)


async def stock_broadcast() -> None:
    symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN"]
    while True:
        try:
            quotes = await fetch_market_feed(symbols, redis=redis_client)
            await manager.broadcast_stock_update(
                {"type": "stock_feed", "data": [quote.model_dump() for quote in quotes]}
            )
            await asyncio.sleep(settings.cache_ttl_seconds)
        except asyncio.CancelledError:
            break
        except Exception:
            pass
            await asyncio.sleep(settings.cache_ttl_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_funds DOUBLE PRECISION NOT NULL DEFAULT 0"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_funds DOUBLE PRECISION NOT NULL DEFAULT 0"))
    async with AsyncSessionLocal() as session:
        await ensure_admin_user(session)
        await ensure_demo_users(session)
        await ensure_site_settings(session)
        await ensure_seed_reviews(session)
    alert_task = asyncio.create_task(alert_monitor())
    stock_task = asyncio.create_task(stock_broadcast())
    try:
        yield
    finally:
        alert_task.cancel()
        stock_task.cancel()
        await asyncio.gather(alert_task, stock_task, return_exceptions=True)
        if redis_client is not None:
            await redis_client.aclose()
        await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/stocks")
async def stocks_websocket(websocket: WebSocket) -> None:
    await manager.connect_stocks(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_stock(websocket)


@app.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    username = _extract_user_id_from_token(token) if token else None
    if not username:
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as session:
        from app.models.user import User

        user = (await session.execute(select(User).where(User.id == int(username)))).scalar_one_or_none()
        if not user:
            await websocket.close(code=1008)
            return
        await manager.connect_user(user.id, websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect_user(user.id, websocket)
