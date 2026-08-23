"""
Pydantic schemas for Job Execution records.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.job_execution import ExecutionStatus


class ExecutionResponse(BaseModel):
    """Public representation of a single job execution attempt."""

    id: uuid.UUID
    job_id: uuid.UUID
    worker_id: uuid.UUID
    status: ExecutionStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExecutionListResponse(BaseModel):
    """Paginated list of execution attempts for a job."""

    items: List[ExecutionResponse]
    total: int
    skip: int
    limit: int
