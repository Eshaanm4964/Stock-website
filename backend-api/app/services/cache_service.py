import json
from typing import Any

from redis.asyncio import Redis


async def get_cached_json(redis: Redis, key: str) -> Any | None:
    value = await redis.get(key)
    return json.loads(value) if value else None


async def set_cached_json(redis: Redis, key: str, value: Any, ttl_seconds: int) -> None:
    await redis.set(key, json.dumps(value), ex=ttl_seconds)
