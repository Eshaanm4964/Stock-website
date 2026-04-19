import secrets
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


def build_client_id_candidate() -> str:
    letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(3))
    numbers = f"{secrets.randbelow(1000):03d}"
    return f"{letters}{numbers}"


async def generate_unique_client_id(db: AsyncSession) -> str:
    for _ in range(40):
        candidate = build_client_id_candidate()
        existing = (await db.execute(select(User).where(User.fixed_user_id == candidate))).scalar_one_or_none()
        if not existing:
            return candidate
    raise RuntimeError("Could not generate a unique client ID")
