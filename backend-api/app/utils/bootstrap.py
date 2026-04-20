from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.admin_setting import AdminSetting
from app.models.portfolio import PortfolioHolding
from app.models.review import Review
from app.models.user import User, UserRole


DEMO_FIXED_USER_IDS = ("CLIENT-1001", "CLIENT-2002", "CLIENT-3003")


async def ensure_admin_user(db: AsyncSession) -> None:
    settings = get_settings()
    existing = await db.execute(select(User).where(User.role == UserRole.ADMIN))
    admin = existing.scalar_one_or_none()
    if admin:
        admin.username = settings.admin_username
        admin.email = settings.admin_email
        admin.full_name = settings.admin_full_name
        admin.phone_number = settings.admin_phone_number
        admin.hashed_password = get_password_hash(settings.admin_password)
        admin.is_active = True
        admin.is_demo = False
        admin.is_archived = False
        admin.archived_at = None
        await db.commit()
        return
    db.add(
        User(
            username=settings.admin_username,
            email=settings.admin_email,
            full_name=settings.admin_full_name,
            phone_number=settings.admin_phone_number,
            hashed_password=get_password_hash(settings.admin_password),
            role=UserRole.ADMIN,
            is_demo=False,
        )
    )
    await db.commit()


async def ensure_demo_users(db: AsyncSession) -> None:
    demo_users = [
        {
            "username": "client_1001",
            "email": "aarav@example.com",
            "fixed_user_id": "CLIENT-1001",
            "full_name": "Aarav Mehta",
            "phone_number": "9123456780",
        },
        {
            "username": "client_2002",
            "email": "meera@example.com",
            "fixed_user_id": "CLIENT-2002",
            "full_name": "Meera Kapoor",
            "phone_number": "9234567890",
        },
        {
            "username": "client_3003",
            "email": "rohan@example.com",
            "fixed_user_id": "CLIENT-3003",
            "full_name": "Rohan Iyer",
            "phone_number": "9345678901",
        },
    ]
    for payload in demo_users:
        existing = await db.execute(select(User).where(User.fixed_user_id == payload["fixed_user_id"]))
        user = existing.scalar_one_or_none()
        if user:
            user.username = payload["username"]
            user.email = payload["email"]
            user.fixed_user_id = payload["fixed_user_id"]
            user.full_name = payload["full_name"]
            user.phone_number = payload["phone_number"]
            user.hashed_password = get_password_hash("User@123")
            user.role = UserRole.USER
            user.is_active = True
            user.is_demo = True
            user.is_archived = False
            user.archived_at = None
        else:
            user = User(
                username=payload["username"],
                email=payload["email"],
                fixed_user_id=payload["fixed_user_id"],
                full_name=payload["full_name"],
                phone_number=payload["phone_number"],
                hashed_password=get_password_hash("User@123"),
                role=UserRole.USER,
                is_demo=True,
            )
            db.add(user)
            await db.flush()

        holdings_exist = (await db.execute(select(PortfolioHolding).where(PortfolioHolding.user_id == user.id))).scalars().first()
        if holdings_exist:
            continue

        seeded_holdings = {
            "CLIENT-1001": [
                {"symbol": "INFY", "quantity": 80, "buy_price": 1420},
                {"symbol": "SBIN", "quantity": 150, "buy_price": 710},
                {"symbol": "TATAMOTORS", "quantity": 75, "buy_price": 945},
            ],
            "CLIENT-2002": [
                {"symbol": "HDFCBANK", "quantity": 100, "buy_price": 1570},
                {"symbol": "RELIANCE", "quantity": 64, "buy_price": 2845},
                {"symbol": "LT", "quantity": 40, "buy_price": 3530},
            ],
            "CLIENT-3003": [
                {"symbol": "ICICIBANK", "quantity": 130, "buy_price": 1086},
                {"symbol": "TCS", "quantity": 38, "buy_price": 3720},
                {"symbol": "SUNPHARMA", "quantity": 55, "buy_price": 1655},
            ],
        }
        for holding in seeded_holdings[payload["fixed_user_id"]]:
            db.add(
                PortfolioHolding(
                    user_id=user.id,
                    symbol=holding["symbol"],
                    exchange="NSE",
                    quantity=holding["quantity"],
                    buy_price=holding["buy_price"],
                )
            )
    await db.commit()


async def remove_demo_users(db: AsyncSession) -> None:
    demo_users = list(
        (
            await db.execute(
                select(User).where(
                    User.role == UserRole.USER,
                    (User.is_demo.is_(True)) | (User.fixed_user_id.in_(DEMO_FIXED_USER_IDS)),
                )
            )
        ).scalars().all()
    )
    for user in demo_users:
        await db.delete(user)
    if demo_users:
        await db.commit()


async def ensure_site_settings(db: AsyncSession) -> None:
    settings = (await db.execute(select(AdminSetting).limit(1))).scalar_one_or_none()
    if settings:
        return
    db.add(AdminSetting(show_faq_insights=True, chat_nudges_enabled=True))
    await db.commit()


async def ensure_seed_reviews(db: AsyncSession) -> None:
    existing = (await db.execute(select(Review).where(Review.is_seeded.is_(True)).limit(1))).scalar_one_or_none()
    if existing:
        return

    reviews = [
        Review(
            name="Anika Rao",
            role="AI-generated Investor Review",
            rating=5,
            message="The portfolio dashboard is clean, the gain-loss colors are easy to read, and the admin report export is genuinely useful for client calls.",
            is_seeded=True,
        ),
        Review(
            name="Dev Malhotra",
            role="AI-generated Advisor Review",
            rating=5,
            message="I like that the website feels like a proper fintech product instead of just a basic dashboard. The trust pages and login flow make it feel more complete.",
            is_seeded=True,
        ),
        Review(
            name="Sara Nair",
            role="AI-generated Wealth Ops Review",
            rating=4,
            message="The admin view gives a quick summary of client portfolios and the single-stock P&L view makes follow-up conversations much easier.",
            is_seeded=True,
        ),
    ]
    db.add_all(reviews)
    await db.commit()
