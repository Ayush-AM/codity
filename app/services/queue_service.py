"""
Business logic service for Queue management.

Handles CRUD, status toggles (pause/resume), conflict detection,
and active job safety constraints on deletion.
"""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.schemas.queue import QueueCreate, QueueUpdate


def count_active_jobs(queue_id: UUID, db: Session) -> int:
    """Return count of active (pending, scheduled, claimed, or running) jobs in a queue."""
    active_statuses = [
        JobStatus.queued,
        JobStatus.scheduled,
        JobStatus.claimed,
        JobStatus.running,
    ]
    return (
        db.query(func.count(Job.id))
        .filter(Job.queue_id == queue_id, Job.status.in_(active_statuses))
        .scalar()
        or 0
    )


def create_queue(
    project_id: UUID,
    queue_data: QueueCreate,
    db: Session,
) -> Queue:
    """
    Create a new queue under a project.
    Raises 409 Conflict if a queue with the same name already exists in the project.
    """
    existing = (
        db.query(Queue)
        .filter(Queue.project_id == project_id, Queue.name == queue_data.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Queue with name '{queue_data.name}' already exists in this project.",
        )

    queue = Queue(
        project_id=project_id,
        name=queue_data.name,
        description=queue_data.description,
        priority=queue_data.priority,
        concurrency_limit=queue_data.concurrency_limit,
        retry_policy=queue_data.retry_policy.model_dump(),
        is_paused=False,
    )
    db.add(queue)
    try:
        db.commit()
        db.refresh(queue)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Queue with name '{queue_data.name}' already exists in this project.",
        )

    # Attach computed job count for response
    setattr(queue, "job_count", 0)
    return queue


def get_queue(queue_id: UUID, db: Session) -> Optional[Queue]:
    """Fetch a single queue by ID with its active job count."""
    queue = db.query(Queue).filter(Queue.id == queue_id).first()
    if queue:
        setattr(queue, "job_count", count_active_jobs(queue.id, db))
    return queue


def get_queues_by_project(
    project_id: UUID,
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> List[Queue]:
    """Return paginated queues for a given project."""
    queues = (
        db.query(Queue)
        .filter(Queue.project_id == project_id)
        .order_by(Queue.priority.asc(), Queue.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    for q in queues:
        setattr(q, "job_count", count_active_jobs(q.id, db))
    return queues


def update_queue(
    queue: Queue,
    update_data: QueueUpdate,
    db: Session,
) -> Queue:
    """
    Partially update a queue.
    Validates name uniqueness within project if name is being modified.
    """
    data = update_data.model_dump(exclude_unset=True)

    if "name" in data and data["name"] != queue.name:
        existing = (
            db.query(Queue)
            .filter(
                Queue.project_id == queue.project_id,
                Queue.name == data["name"],
                Queue.id != queue.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Queue with name '{data['name']}' already exists in this project.",
            )

    if "retry_policy" in data and data["retry_policy"] is not None:
        if hasattr(update_data.retry_policy, "model_dump"):
            data["retry_policy"] = update_data.retry_policy.model_dump()

    for key, value in data.items():
        setattr(queue, key, value)

    try:
        db.commit()
        db.refresh(queue)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error: Duplicate queue name in project.",
        )

    setattr(queue, "job_count", count_active_jobs(queue.id, db))
    return queue


def delete_queue(queue: Queue, db: Session, force: bool = False) -> None:
    """
    Delete a queue after checking for active jobs.
    Raises 400 Bad Request if queued, scheduled, claimed, or running jobs exist unless force=True.
    """
    active_count = count_active_jobs(queue.id, db)
    if active_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete queue with {active_count} active job(s). Please purge/complete active jobs or use Force Delete.",
        )

    db.query(Job).filter(Job.queue_id == queue.id).delete(synchronize_session=False)
    db.delete(queue)
    db.commit()


def pause_queue(queue: Queue, db: Session) -> Queue:
    """Pause a queue so workers will skip claiming from it."""
    queue.is_paused = True
    db.commit()
    db.refresh(queue)
    setattr(queue, "job_count", count_active_jobs(queue.id, db))
    return queue


def resume_queue(queue: Queue, db: Session) -> Queue:
    """Resume a paused queue so workers can claim jobs again."""
    queue.is_paused = False
    db.commit()
    db.refresh(queue)
    setattr(queue, "job_count", count_active_jobs(queue.id, db))
    return queue
