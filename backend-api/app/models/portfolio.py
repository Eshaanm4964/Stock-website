from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PortfolioSale(Base):
    __tablename__ = "portfolio_sales"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_portfolio_sales_quantity_positive"),
        CheckConstraint("buy_price > 0", name="ck_portfolio_sales_buy_price_positive"),
        CheckConstraint("sell_price > 0", name="ck_portfolio_sales_sell_price_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), default="NSE", nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    buy_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    sell_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    profit_loss: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="sales")


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_portfolio_holdings_quantity_positive"),
        CheckConstraint("buy_price > 0", name="ck_portfolio_holdings_buy_price_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), default="NSE", nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    buy_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="holdings")
