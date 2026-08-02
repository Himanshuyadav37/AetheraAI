import logging
import redis as redis_sync
import redis.asyncio as aioredis
from config import settings

logger = logging.getLogger(__name__)

# Global connection pools
_redis_pool = None
_redis_pool_sync = None

def get_redis_url() -> str:
    return f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"

def init_redis_pool():
    global _redis_pool
    if _redis_pool is None:
        url = get_redis_url()
        logger.info(f"Initializing Redis connection pool to {url}")
        _redis_pool = aioredis.ConnectionPool.from_url(
            url, 
            encoding="utf-8", 
            decode_responses=True,
            max_connections=20
        )
    return _redis_pool

async def close_redis_pool():
    global _redis_pool
    if _redis_pool is not None:
        logger.info("Closing Redis connection pool")
        await _redis_pool.disconnect()
        _redis_pool = None

def get_redis_client() -> aioredis.Redis:
    pool = init_redis_pool()
    return aioredis.Redis(connection_pool=pool)

def init_redis_pool_sync():
    global _redis_pool_sync
    if _redis_pool_sync is None:
        url = get_redis_url()
        logger.info(f"Initializing synchronous Redis connection pool to {url}")
        _redis_pool_sync = redis_sync.ConnectionPool.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20
        )
    return _redis_pool_sync

def get_redis_client_sync() -> redis_sync.Redis:
    pool = init_redis_pool_sync()
    return redis_sync.Redis(connection_pool=pool)
