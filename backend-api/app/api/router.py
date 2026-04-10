from fastapi import APIRouter

from app.api.routes import admin, ai, alerts, auth, notifications, portfolio, site, stocks, watchlist

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(stocks.router)
api_router.include_router(portfolio.router)
api_router.include_router(watchlist.router)
api_router.include_router(alerts.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
api_router.include_router(site.router)
api_router.include_router(ai.router)
