"""Redis connection pools used by Aethera API and workers."""

import logging
from typing import Optional

import redis as redis_sync
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

_redis_pool: Optional[aioredis.ConnectionPool] = None
_redis_pool_sync: Optional[redis_sync.ConnectionPool] = None


def get_redis_url() -> str:
    return (
        f"redis://{settings.REDIS_HOST}:"
        f"{settings.REDIS_PORT}/{settings.REDIS_DB}"
    )


def init_redis_pool():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.ConnectionPool.from_url(
            get_redis_url(),
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
            socket_connect_timeout=3,
            socket_timeout=10,
            health_check_interval=30,
        )
    return _redis_pool


async def close_redis_pool():
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None


def get_redis_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=init_redis_pool())


def init_redis_pool_sync():
    global _redis_pool_sync
    if _redis_pool_sync is None:
        _redis_pool_sync = redis_sync.ConnectionPool.from_url(
            get_redis_url(),
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
            socket_connect_timeout=3,
            socket_timeout=10,
            health_check_interval=30,
        )
    return _redis_pool_sync


def get_redis_client_sync() -> redis_sync.Redis:
    return redis_sync.Redis(connection_pool=init_redis_pool_sync())


async def redis_healthcheck() -> bool:
    client = get_redis_client()
    try:
        return bool(await client.ping())
    finally:
        await client.close()
