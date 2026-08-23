"""
Job Query Service with multi-tenant isolation, structured filtering, and full-text JSON searching.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.project import Project
from app.models.queue import Queue
from app.models.user import User


def get_job_with_authorization(job_id: UUID, current_user: User, db: Session) -> Job:
    """
    Fetch a job by ID, verifying that its parent project belongs to the user's organization.
    Raises 404 if not found, 403 if belonging to a different tenant.
    """
    job = (
        db.query(Job)
        .join(Queue, Job.queue_id == Queue.id)
        .join(Project, Queue.project_id == Project.id)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    if job.queue.project.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Job belongs to another organization",
        )

    return job


def get_jobs(
    organization_id: UUID,
    db: Session,
    queue_id: Optional[UUID] = None,
    status_list: Optional[List[JobStatus]] = None,
    created_at_gte: Optional[datetime] = None,
    created_at_lte: Optional[datetime] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Job], int]:
    """
    Search and filter jobs across queues within the authenticated organization.
    """
    query = (
        db.query(Job)
        .join(Queue, Job.queue_id == Queue.id)
        .join(Project, Queue.project_id == Project.id)
        .filter(Project.organization_id == organization_id)
    )

    # 1. Queue filter
    if queue_id is not None:
        query = query.filter(Job.queue_id == queue_id)

    # 2. Status filter
    if status_list:
        query = query.filter(Job.status.in_(status_list))

    # 3. Date range filters
    if created_at_gte is not None:
        query = query.filter(Job.created_at >= created_at_gte)
    if created_at_lte is not None:
        query = query.filter(Job.created_at <= created_at_lte)

    # 4. Search on payload::text, last_error, and id::text
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            cast(Job.id, String).ilike(term)
            | cast(Job.payload, String).ilike(term)
            | Job.last_error.ilike(term)
        )

    # Total count before pagination
    total = query.count()

    # 5. Sorting
    sort_col = Job.created_at
    if sort_by == "priority":
        sort_col = Job.priority
    elif sort_by == "scheduled_at":
        sort_col = Job.scheduled_at

    order_clause = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    items = query.order_by(order_clause).offset(skip).limit(limit).all()

    return items, total
