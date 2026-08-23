"""
Atomic Job Claiming Service using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.

Ensures zero-contention, lock-free distributed concurrency across multiple workers.
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue


def claim_jobs(
    queue_id: UUID | None,
    limit: int,
    db: Session,
    worker_id: UUID | None = None,
) -> List[Job]:
    """
    Atomically claims up to `limit` jobs from `queue_id` (or all unpaused queues) using `FOR UPDATE SKIP LOCKED`.
    """
    if limit <= 0:
        return []

    if queue_id is not None:
        stmt = text(
            """
            WITH candidate_jobs AS (
                SELECT j.id FROM jobs j
                LEFT JOIN queues q ON j.queue_id = q.id
                WHERE j.queue_id = :queue_id
                  AND COALESCE(q.is_paused, FALSE) = FALSE
                  AND j.status = 'queued'
                  AND (j.scheduled_at IS NULL OR j.scheduled_at <= NOW())
                ORDER BY j.priority ASC, j.created_at ASC
                LIMIT :limit
                FOR UPDATE OF j SKIP LOCKED
            )
            UPDATE jobs
            SET status = 'claimed',
                claimed_at = NOW(),
                worker_id = :worker_id,
                updated_at = NOW()
            WHERE id IN (SELECT id FROM candidate_jobs)
            RETURNING id;
            """
        )
        params = {"queue_id": queue_id, "limit": limit, "worker_id": worker_id}
    else:
        stmt = text(
            """
            WITH candidate_jobs AS (
                SELECT j.id FROM jobs j
                LEFT JOIN queues q ON j.queue_id = q.id
                WHERE COALESCE(q.is_paused, FALSE) = FALSE
                  AND j.status = 'queued'
                  AND (j.scheduled_at IS NULL OR j.scheduled_at <= NOW())
                ORDER BY j.priority ASC, j.created_at ASC
                LIMIT :limit
                FOR UPDATE OF j SKIP LOCKED
            )
            UPDATE jobs
            SET status = 'claimed',
                claimed_at = NOW(),
                worker_id = :worker_id,
                updated_at = NOW()
            WHERE id IN (SELECT id FROM candidate_jobs)
            RETURNING id;
            """
        )
        params = {"limit": limit, "worker_id": worker_id}

    result = db.execute(stmt, params)
    claimed_ids = [row[0] for row in result.fetchall()]

    if not claimed_ids:
        return []

    db.commit()

    # Retrieve ORM objects
    jobs = db.query(Job).filter(Job.id.in_(claimed_ids)).all()
    return jobs


def get_queue_concurrency(queue_id: UUID, db: Session) -> int:
    """Fetch the concurrency_limit configured for a queue."""
    res = db.query(Queue.concurrency_limit).filter(Queue.id == queue_id).scalar()
    return res if res is not None else 5


def is_queue_paused(queue_id: UUID, db: Session) -> bool:
    """Check if the queue is paused."""
    res = db.query(Queue.is_paused).filter(Queue.id == queue_id).scalar()
    return bool(res)


def get_running_jobs_count(queue_id: UUID, db: Session) -> int:
    """Get the current number of jobs in 'claimed' or 'running' status for this queue."""
    return (
        db.query(func.count(Job.id))
        .filter(
            Job.queue_id == queue_id,
            Job.status.in_([JobStatus.claimed, JobStatus.running]),
        )
        .scalar()
        or 0
    )
