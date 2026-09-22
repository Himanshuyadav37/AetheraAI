"""Redis-backed durable execution job queue for Aethera AI.

API processes enqueue jobs; dedicated workers consume and acknowledge them.
Redis Streams + consumer groups provide durable delivery and worker recovery.

When Redis is unavailable, jobs fall back to in-process immediate execution
so the system remains usable for development/single-node scenarios.
"""

import json
import logging
import os
import socket
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Optional

import redis as redis_sync
import redis.asyncio as aioredis

from core.redis_client import get_redis_client_sync

logger = logging.getLogger("aethera.job_queue")

STREAM_NAME = os.getenv("AETHERA_EXECUTION_STREAM", "aethera:execution_jobs")
GROUP_NAME = os.getenv("AETHERA_EXECUTION_GROUP", "aethera-execution-workers")
DLQ_STREAM = os.getenv("AETHERA_EXECUTION_DLQ", "aethera:execution_jobs:dlq")
MAX_ATTEMPTS = max(1, int(os.getenv("AETHERA_JOB_MAX_ATTEMPTS", "3")))

_redis_available: Optional[bool] = None
_redis_last_check: float = 0.0
_REDIS_CACHE_TTL = 10.0


def _redis_is_available() -> bool:
    """Cache Redis availability to avoid repeated connection storms."""
    global _redis_available, _redis_last_check
    now = time.time()
    if _redis_available is not None and (now - _redis_last_check) < _REDIS_CACHE_TTL:
        return _redis_available
    try:
        client = get_redis_client_sync()
        client.ping()
        _redis_available = True
    except Exception as exc:
        logger.warning("Redis unavailable: %s; falling back to direct execution.", exc)
        _redis_available = False
    _redis_last_check = now
    return _redis_available


def _encode(value: Any) -> str:
    return json.dumps(value, default=str, separators=(",", ":"))


def ensure_consumer_group() -> None:
    if not _redis_is_available():
        return
    redis = get_redis_client_sync()
    try:
        redis.xgroup_create(
            name=STREAM_NAME,
            groupname=GROUP_NAME,
            id="0",
            mkstream=True,
        )
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            raise


_DIRECT_HANDLERS: dict[str, Callable[[dict], None]] = {}


def register_direct_handler(job_type: str, handler: Callable[[dict], None]) -> None:
    """Register an in-process handler for running jobs when Redis is down."""
    _DIRECT_HANDLERS[job_type] = handler


def _run_job_directly(job_type: str, payload: dict) -> None:
    """Execute a job synchronously via the in-process handler registry."""
    handler = _DIRECT_HANDLERS.get(job_type)
    if handler is None:
        logger.error(
            "No direct handler registered for job_type=%s; cannot execute without Redis.",
            job_type,
        )
        return
    try:
        handler(payload)
    except Exception as exc:
        logger.exception("Direct execution handler failed for job_type=%s: %s", job_type, exc)


def enqueue_job(
    job_type: str,
    payload: dict,
    *,
    job_id: str | None = None,
    max_attempts: int = MAX_ATTEMPTS,
) -> str:
    if not job_type:
        raise ValueError("job_type is required")
    if not isinstance(payload, dict):
        raise ValueError("payload must be a dict")

    job_id = job_id or str(uuid.uuid4())
    document = {
        "job_id": job_id,
        "job_type": job_type,
        "payload": _encode(payload),
        "attempt": "0",
        "max_attempts": str(max(1, int(max_attempts))),
        "enqueued_at": datetime.utcnow().isoformat(),
        "producer": socket.gethostname(),
    }

    if _redis_is_available():
        try:
            redis = get_redis_client_sync()
            ensure_consumer_group()
            redis.xadd(STREAM_NAME, document, maxlen=10000, approximate=True)
            return job_id
        except Exception as exc:
            logger.warning(
                "Redis enqueue failed for job_type=%s job_id=%s: %s; "
                "falling back to direct in-process execution.",
                job_type, job_id, exc,
            )
            global _redis_available
            _redis_available = False
            _redis_last_check = time.time()

    thread = threading.Thread(
        target=_run_job_directly,
        args=(job_type, payload),
        name=f"job-{job_type}-{job_id[:8]}",
        daemon=True,
    )
    thread.start()
    logger.info(
        "Dispatched job_type=%s job_id=%s via direct in-process thread (Redis unavailable).",
        job_type, job_id,
    )
    return job_id


def decode_job(fields: dict) -> dict:
    payload = fields.get("payload", "{}")
    if isinstance(payload, bytes):
        payload = payload.decode("utf-8")
    try:
        payload_obj = json.loads(payload)
    except Exception:
        payload_obj = {}

    def _int(name, default):
        try:
            return int(fields.get(name, default))
        except Exception:
            return default

    return {
        "job_id": fields.get("job_id") or str(uuid.uuid4()),
        "job_type": fields.get("job_type", ""),
        "payload": payload_obj if isinstance(payload_obj, dict) else {},
        "attempt": _int("attempt", 0),
        "max_attempts": _int("max_attempts", MAX_ATTEMPTS),
        "enqueued_at": fields.get("enqueued_at"),
    }


def ack_job(redis, message_id: str) -> None:
    redis.xack(STREAM_NAME, GROUP_NAME, message_id)


def move_to_dead_letter(redis, message_id: str, job: dict, error: Exception) -> None:
    redis.xadd(
        DLQ_STREAM,
        {
            "message_id": message_id,
            "job_id": job["job_id"],
            "job_type": job["job_type"],
            "payload": _encode(job["payload"]),
            "attempt": str(job.get("attempt", 0)),
            "error_type": type(error).__name__,
            "error": str(error)[:4000],
            "failed_at": datetime.utcnow().isoformat(),
        },
        maxlen=10000,
        approximate=True,
    )
    ack_job(redis, message_id)


def requeue_job(redis, job: dict, error: Exception) -> None:
    attempt = int(job.get("attempt", 0)) + 1
    delay = min(2 ** max(0, attempt - 1), 30)
    time.sleep(delay)
    redis.xadd(
        STREAM_NAME,
        {
            "job_id": job["job_id"],
            "job_type": job["job_type"],
            "payload": _encode(job["payload"]),
            "attempt": str(attempt),
            "max_attempts": str(job.get("max_attempts", MAX_ATTEMPTS)),
            "enqueued_at": job.get("enqueued_at") or datetime.utcnow().isoformat(),
            "last_error": str(error)[:4000],
        },
        maxlen=10000,
        approximate=True,
    )


def claim_stale_jobs(redis, consumer: str, min_idle_ms: int = 120000):
    """Claim jobs abandoned by a dead worker."""
    try:
        result = redis.xautoclaim(
            STREAM_NAME,
            GROUP_NAME,
            consumer,
            min_idle_ms,
            start_id="0-0",
            count=10,
        )
        # redis-py returns (next_id, messages, deleted_ids) on newer versions.
        messages = result[1] if len(result) > 1 else []
        return messages or []
    except Exception as exc:
        logger.warning("Unable to reclaim stale jobs: %s", exc)
        return []
