"""
Job Execution History Service.
"""

from __future__ import annotations

from typing import List, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.job_execution import JobExecution
from app.models.user import User
from app.services import job_query_service


def get_executions(
    job_id: UUID,
    current_user: User,
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[JobExecution], int]:
    """
    Fetch paginated execution history for a job with tenant authorization.
    """
    # 1. Authorization check
    job_query_service.get_job_with_authorization(job_id=job_id, current_user=current_user, db=db)

    # 2. Query executions
    query = db.query(JobExecution).filter(JobExecution.job_id == job_id)
    total = query.count()
    items = query.order_by(JobExecution.started_at.desc()).offset(skip).limit(limit).all()

    return items, total
