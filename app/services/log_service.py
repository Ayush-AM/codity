"""
Structured Job Log Query Service.
"""

from __future__ import annotations

from typing import List, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.job_log import JobLog
from app.models.user import User
from app.services import job_query_service


def get_logs(
    job_id: UUID,
    current_user: User,
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[JobLog], int]:
    """
    Fetch paginated structured logs for a job with tenant authorization.
    """
    # 1. Authorization check
    job_query_service.get_job_with_authorization(job_id=job_id, current_user=current_user, db=db)

    # 2. Query logs
    query = db.query(JobLog).filter(JobLog.job_id == job_id)
    total = query.count()
    items = query.order_by(JobLog.timestamp.asc()).offset(skip).limit(limit).all()

    return items, total
