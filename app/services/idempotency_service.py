"""
Redis Idempotency Cache Service with Graceful Fallback.

Ensures exact-once submission guarantees with 24-hour TTL caching.
If Redis is temporarily unavailable, gracefully degrades to PostgreSQL unique constraints.
"""

from __future__ import annotations

import logging
from typing import Optional
import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Redis client pool
try:
    redis_client = redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )
except Exception as e:
    logger.warning(f"Failed to initialize Redis connection pool: {e}")
    redis_client = None


def is_redis_available() -> bool:
    """Check if Redis connection is active and healthy."""
    if redis_client is None:
        return False
    try:
        return bool(redis_client.ping())
    except Exception:
        return False


def store_idempotency_key(
    key: str,
    job_id: str,
    ttl_seconds: int = settings.IDEMPOTENCY_TTL_SECONDS,
) -> bool:
    """
    Store an idempotency key mapped to a job ID with TTL.

    Returns:
    --------
    bool: True if key was set (new job), False if key already exists (duplicate).
    """
    redis_key = f"idempotency:{key}"
    try:
        if redis_client is not None:
            # set(nx=True, ex=ttl) sets only if key doesn't exist
            result = redis_client.set(redis_key, job_id, nx=True, ex=ttl_seconds)
            return bool(result)
    except Exception as err:
        logger.warning(f"Redis store_idempotency_key error: {err}")
    return True


def get_idempotency_key(key: str) -> Optional[str]:
    """
    Retrieve stored job ID for a given idempotency key.
    """
    redis_key = f"idempotency:{key}"
    try:
        if redis_client is not None:
            return redis_client.get(redis_key)
    except Exception as err:
        logger.warning(f"Redis get_idempotency_key error: {err}")
    return None
