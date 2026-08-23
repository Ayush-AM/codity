"""
Dead Letter Queue (DLQ) Service.

Handles permanent failure transitions, DLQ recording, and manual replay/retry.
"""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.dead_letter_entry import DeadLetterEntry
from app.models.job import Job, JobStatus
from app.models.job_log import JobLog, LogLevel
from app.models.project import Project
from app.models.queue import Queue


def move_to_dlq(
    job: Job,
    db: Session,
    reason: str,
) -> DeadLetterEntry:
    """
    Move a permanently failed job into the Dead Letter Queue.
    Updates job status to 'dead' and records a snapshot in dead_letter_entries.
    """
    entry = db.query(DeadLetterEntry).filter(DeadLetterEntry.job_id == job.id).first()
    if entry:
        entry.reason = reason
        entry.failed_at = func.now()
        entry.final_payload = job.payload
    else:
        entry = DeadLetterEntry(
            job_id=job.id,
            reason=reason,
            final_payload=job.payload,
        )
        db.add(entry)

    job.status = JobStatus.dead
    job.last_error = reason
    job.finished_at = func.now()

    dlq_log = JobLog(
        job_id=job.id,
        level=LogLevel.error,
        message=f"Job permanently failed and moved to Dead Letter Queue: {reason}",
        metadata_={"reason": reason, "final_payload": job.payload},
    )
    db.add(dlq_log)

    db.commit()
    db.refresh(entry)
    return entry


def get_dlq_entries(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    organization_id: Optional[UUID] = None,
) -> List[DeadLetterEntry]:
    """Retrieve paginated DLQ entries with optional multi-tenant organization filtering."""
    query = db.query(DeadLetterEntry)
    if organization_id:
        query = (
            query.join(Job, DeadLetterEntry.job_id == Job.id)
            .join(Queue, Job.queue_id == Queue.id)
            .join(Project, Queue.project_id == Project.id)
            .filter(Project.organization_id == organization_id)
        )
    return query.order_by(DeadLetterEntry.failed_at.desc()).offset(skip).limit(limit).all()


def retry_dead_job(
    job_id: UUID,
    organization_id: UUID,
    db: Session,
) -> Job:
    """
    Manually replay a dead job from DLQ:
    1. Validates the dead letter entry exists and belongs to the user's organization.
    2. Spawns a clean clone job with status='queued' and retry_count=0.
    3. Deletes the DLQ entry.
    """
    entry = db.query(DeadLetterEntry).filter(DeadLetterEntry.job_id == job_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dead letter entry not found for this job ID.",
        )

    orig_job = db.query(Job).filter(Job.id == job_id).first()
    if not orig_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original job record not found.",
        )

    # Multi-tenancy check
    if orig_job.queue.project.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Job belongs to another organization.",
        )

    # Create fresh clone
    new_job = Job(
        queue_id=orig_job.queue_id,
        status=JobStatus.queued,
        payload=entry.final_payload,
        priority=orig_job.priority,
        max_retries=orig_job.max_retries,
        retry_count=0,
        scheduled_at=None,
        cron_expression=None,
    )
    db.add(new_job)
    db.delete(entry)
    db.commit()
    db.refresh(new_job)

    return new_job
