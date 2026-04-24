from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from redis.asyncio import Redis

from app.models.portfolio import PortfolioHolding
from app.schemas.portfolio import (
    MarketCapDistribution,
    PortfolioPerformanceItem,
    PortfolioSummaryResponse,
)
from app.services.stock_service import classify_market_cap, fetch_quote


async def build_portfolio_summary(
    holdings: list[PortfolioHolding], redis: Redis | None = None
) -> PortfolioSummaryResponse:
    grouped_holdings: dict[tuple[int, str, str], dict[str, object]] = {}
    for holding in holdings:
        key = (int(holding.user_id), str(holding.symbol).upper(), str(holding.exchange or "NSE").upper())
        quantity = Decimal(str(holding.quantity or 0))
        buy_price = Decimal(str(holding.buy_price or 0))
        if key not in grouped_holdings:
            grouped_holdings[key] = {
                "holding": holding,
                "quantity": quantity,
                "invested_value": quantity * buy_price,
                "created_at": holding.created_at,
            }
            continue

        grouped_holdings[key]["quantity"] = Decimal(str(grouped_holdings[key]["quantity"])) + quantity
        grouped_holdings[key]["invested_value"] = Decimal(str(grouped_holdings[key]["invested_value"])) + (quantity * buy_price)
        created_at = grouped_holdings[key]["created_at"]
        if holding.created_at and (created_at is None or holding.created_at < created_at):
            grouped_holdings[key]["created_at"] = holding.created_at

    performance: list[PortfolioPerformanceItem] = []
    category_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"quantity": 0.0, "value": 0.0})
    sector_totals: dict[str, float] = defaultdict(float)

    total_value = 0.0
    total_quantity = 0.0
    total_profit_loss = 0.0

    for grouped in grouped_holdings.values():
        holding = grouped["holding"]
        quote = await fetch_quote(holding.symbol, holding.exchange, redis)
        quantity = float(grouped["quantity"])
        invested_value = float(grouped["invested_value"])
        buy_price = invested_value / quantity if quantity else 0.0
        current_price = quote.price
        value = current_price * quantity
        profit_loss = (current_price - buy_price) * quantity
        category = classify_market_cap(quote.market_cap)

        total_value += value
        total_quantity += quantity
        total_profit_loss += profit_loss
        category_totals[category]["quantity"] += quantity
        category_totals[category]["value"] += value
        if quote.sector:
            sector_totals[quote.sector] += value

        performance.append(
            PortfolioPerformanceItem(
                holding_id=holding.id,
                symbol=holding.symbol,
                exchange=holding.exchange,
                quantity=quantity,
                buy_price=buy_price,
                current_price=current_price,
                value=round(value, 2),
                profit_loss=round(profit_loss, 2),
                percent_change=round(((current_price - buy_price) / buy_price) * 100, 2) if buy_price else 0.0,
                market_cap_category=category,
                sector=quote.sector or holding.sector,
                created_at=grouped["created_at"],
            )
        )

    breakdown = [
        MarketCapDistribution(
            category=category,
            quantity=round(values["quantity"], 2),
            value=round(values["value"], 2),
            percentage=round((values["value"] / total_value) * 100, 2) if total_value else 0.0,
        )
        for category, values in category_totals.items()
    ]
    exposure_total = sum(sector_totals.values()) or 1
    sector_exposure = {
        sector: round((value / exposure_total) * 100, 2) for sector, value in sector_totals.items()
    }
    risk_level = "Moderate"
    if len(sector_exposure) <= 1 and total_value > 0:
        risk_level = "High"
    elif len(sector_exposure) >= 4:
        risk_level = "Low"
    diversification = (
        "Portfolio is concentrated in a small number of sectors."
        if len(sector_exposure) <= 2
        else "Portfolio shows a reasonable spread across multiple sectors."
    )
    return PortfolioSummaryResponse(
        total_portfolio_value=round(total_value, 2),
        total_quantity=round(total_quantity, 2),
        total_profit_loss=round(total_profit_loss, 2),
        performance=performance,
        market_cap_breakdown=breakdown,
        risk_level=risk_level,
        diversification_analysis=diversification,
        sector_exposure=sector_exposure,
    )
