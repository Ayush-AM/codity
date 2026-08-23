"""
Business logic service for Job submission, querying, and deduplication.
Integrates Redis Idempotency caching with 24-hour TTL and PostgreSQL fallback.
"""

from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.schemas.job import JobCreate
from app.services import idempotency_service


def create_job(
    queue: Queue,
    job_data: JobCreate,
    db: Session,
    idempotency_key: Optional[str] = None,
) -> Tuple[Job, bool]:
    """
    Create a new job under a queue.

    Returns:
    --------
    Tuple[Job, bool]:
        - The Job instance
        - Boolean `is_duplicate`: True if the job was retrieved via an existing Idempotency-Key
    """
    clean_key = idempotency_key.strip() if idempotency_key else None

    # 1. Check idempotency key in Redis cache first (blazing fast O(1))
    if clean_key:
        cached_job_id = idempotency_service.get_idempotency_key(clean_key)
        if cached_job_id:
            cached_job = db.query(Job).filter(Job.id == cached_job_id).first()
            if cached_job:
                return cached_job, True

        # Fallback check in DB
        existing_job = db.query(Job).filter(Job.idempotency_key == clean_key).first()
        if existing_job:
            idempotency_service.store_idempotency_key(clean_key, str(existing_job.id))
            return existing_job, True

    # 2. Inherit defaults from Queue if not overridden
    priority = job_data.priority if job_data.priority is not None else queue.priority

    retry_policy = queue.retry_policy or {}
    max_retries = (
        job_data.max_retries
        if job_data.max_retries is not None
        else retry_policy.get("max_retries", 3)
    )

    # 3. Determine initial status
    if job_data.cron_expression is not None:
        initial_status = JobStatus.scheduled
    elif job_data.scheduled_at is not None:
        initial_status = JobStatus.scheduled
    else:
        initial_status = JobStatus.queued

    # 4. Optional workflow DAG validation
    if job_data.depends_on_job_id:
        parent_job = db.query(Job).filter(Job.id == job_data.depends_on_job_id).first()
        if not parent_job:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parent job '{job_data.depends_on_job_id}' does not exist.",
            )

    # 5. Create Job
    job = Job(
        queue_id=queue.id,
        status=initial_status,
        payload=job_data.payload,
        priority=priority,
        scheduled_at=job_data.scheduled_at,
        cron_expression=job_data.cron_expression,
        retry_count=0,
        max_retries=max_retries,
        depends_on_job_id=job_data.depends_on_job_id,
        idempotency_key=clean_key,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 6. Cache idempotency key in Redis
    if clean_key:
        idempotency_service.store_idempotency_key(clean_key, str(job.id))

    return job, False


def get_job(job_id: UUID, db: Session) -> Optional[Job]:
    """Fetch job by ID."""
    return db.query(Job).filter(Job.id == job_id).first()


def get_jobs_by_queue(
    queue_id: UUID,
    db: Session,
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[JobStatus] = None,
) -> List[Job]:
    """Fetch paginated jobs for a queue with optional status filtering."""
    query = db.query(Job).filter(Job.queue_id == queue_id)
    if status_filter:
        query = query.filter(Job.status == status_filter)

    return (
        query.order_by(Job.priority.asc(), Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
