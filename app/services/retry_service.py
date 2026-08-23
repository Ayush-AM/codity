"""
Retry Engine Service.

Supports:
- Three backoff strategies: Fixed, Linear, Exponential (with jitter).
- Automatic retry scheduling into `scheduled` status with future `scheduled_at`.
- Dead Letter Queue escalation when `retry_count >= max_retries`.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.job_log import JobLog, LogLevel
from app.services import dlq_service


def calculate_retry_delay(
    retry_count: int,
    policy: Dict[str, Any],
) -> Optional[int]:
    """
    Computes the delay in seconds for the next retry attempt based on the queue's policy.

    Parameters:
    -----------
    retry_count : int
        Number of previous failed attempts (0-indexed).
    policy : dict
        Contains 'strategy' ('fixed' | 'linear' | 'exponential'), 'base_delay'/'initial_delay', 'max_delay', and 'max_retries'.

    Returns:
    --------
    Optional[int]:
        Delay in seconds, or None if retry limit is reached.
    """
    strategy = policy.get("strategy", "fixed")
    base_delay = float(policy.get("base_delay", policy.get("initial_delay", 60)))
    max_delay = float(policy.get("max_delay", 86400))
    max_retries = int(policy.get("max_retries", 3))

    if retry_count >= max_retries:
        return None

    if strategy == "linear":
        delay = base_delay * (retry_count + 1)
    elif strategy == "exponential":
        multiplier = float(policy.get("multiplier", 2.0))
        use_jitter = policy.get("jitter", True)
        raw_delay = base_delay * (multiplier ** retry_count)
        if use_jitter:
            delay = random.uniform(0, min(max_delay, raw_delay))
        else:
            delay = raw_delay
    else:
        # Fixed
        delay = base_delay

    delay = min(delay, max_delay)
    return max(1, int(delay))


def calculate_next_retry_delay(
    policy: Dict[str, Any],
    attempt: int = 1,
) -> float:
    """
    Calculate the next retry delay given an attempt index (1-based attempt).
    Convenience helper for unit testing and deterministic verification.
    """
    retry_count = max(0, attempt - 1)
    strategy = policy.get("strategy", "fixed")
    base_delay = float(policy.get("base_delay", policy.get("initial_delay", 60)))
    max_delay = float(policy.get("max_delay", 86400))

    if strategy == "linear":
        delay = base_delay * attempt
    elif strategy == "exponential":
        multiplier = float(policy.get("multiplier", 2.0))
        use_jitter = policy.get("jitter", False)
        raw_delay = base_delay * (multiplier ** retry_count)
        if use_jitter:
            delay = random.uniform(0, min(max_delay, raw_delay))
        else:
            delay = raw_delay
    else:
        delay = base_delay

    return min(delay, max_delay)


def schedule_retry(
    job: Job,
    db: Session,
    error_message: str,
) -> Optional[Job]:
    """
    Evaluate job retry eligibility and either schedule the next attempt or move to DLQ.

    Actions:
    - If retry_count < max_retries:
      Calculates delay, sets status='scheduled', scheduled_at=NOW + delay.
    - If retry_count >= max_retries:
      Escalates to DLQ with status='dead' and creates a DeadLetterEntry.
    """
    queue = job.queue
    policy: Dict[str, Any] = (
        queue.retry_policy.copy()
        if queue and queue.retry_policy
        else {"strategy": "fixed", "base_delay": 60, "max_retries": 3}
    )

    if job.max_retries is not None:
        policy["max_retries"] = job.max_retries

    delay = calculate_retry_delay(job.retry_count, policy)

    if delay is None:
        # Max retries exhausted -> Move to DLQ
        dlq_service.move_to_dlq(
            job=job,
            db=db,
            reason=f"Max retries ({job.max_retries}) exceeded. Last error: {error_message}",
        )
        return None

    # Schedule next retry attempt
    now_utc = datetime.now(timezone.utc)
    job.status = JobStatus.scheduled
    job.scheduled_at = now_utc + timedelta(seconds=delay)
    job.last_error = error_message
    job.finished_at = now_utc

    retry_log = JobLog(
        job_id=job.id,
        level=LogLevel.warning,
        message=f"Job attempt failed ({error_message}). Retry #{job.retry_count} scheduled in {delay}s.",
        metadata_={
            "retry_count": job.retry_count,
            "delay_seconds": delay,
            "scheduled_at": job.scheduled_at.isoformat(),
        },
    )
    db.add(retry_log)

    db.commit()
    db.refresh(job)
    return job
