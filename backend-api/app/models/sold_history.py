from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SoldHistory(Base):
    __tablename__ = "sold_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    holding_id: Mapped[int | None] = mapped_column(ForeignKey("portfolio_holdings.id", ondelete="SET NULL"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), nullable=False, default="NSE")
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    buy_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    sell_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    profit_loss: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    sold_by_role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    sold_by_identifier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    holding = relationship("PortfolioHolding")
