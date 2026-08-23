"""
Pydantic schemas for Job submission and responses.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from cron_validator import CronValidator
from pydantic import BaseModel, Field, model_validator

from app.models.job import JobStatus


class JobCreate(BaseModel):
    """
    Job submission payload.
    Supports immediate, delayed, scheduled (cron), batch, and workflow-dependent jobs.
    """

    payload: Any = Field(
        ...,
        description="Arbitrary JSON payload for worker execution",
    )
    priority: Optional[int] = Field(
        None,
        ge=0,
        le=1000,
        description="Optional priority override (0-1000, lower integer = higher priority, defaults to queue default)",
    )
    scheduled_at: Optional[datetime] = Field(
        None,
        description="ISO-8601 timestamp for delayed jobs (must be in the future)",
    )
    cron_expression: Optional[str] = Field(
        None,
        max_length=120,
        description="Cron expression for recurring jobs (e.g., '0 9 * * *')",
    )
    max_retries: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Optional max retries override (0-100, defaults to queue retry policy)",
    )
    depends_on_job_id: Optional[uuid.UUID] = Field(
        None,
        description="Optional parent Job UUID this job depends on (workflow DAG)",
    )

    @model_validator(mode="after")
    def validate_scheduling_and_cron(self) -> "JobCreate":
        # 1. Mutually exclusive check
        if self.scheduled_at is not None and self.cron_expression is not None:
            raise ValueError("A job cannot have both 'scheduled_at' and 'cron_expression' set.")

        # 2. Future timestamp check for scheduled_at
        if self.scheduled_at is not None:
            now_utc = datetime.now(timezone.utc)
            # Ensure timezone awareness for comparison
            scheduled_utc = (
                self.scheduled_at
                if self.scheduled_at.tzinfo is not None
                else self.scheduled_at.replace(tzinfo=timezone.utc)
            )
            if scheduled_utc <= now_utc:
                raise ValueError("'scheduled_at' timestamp must be set in the future.")

        # 3. Cron expression validation
        if self.cron_expression is not None:
            try:
                CronValidator.parse(self.cron_expression.strip())
            except Exception:
                raise ValueError(f"Invalid cron expression: '{self.cron_expression}'. Expected standard 5-part cron syntax (e.g. '0 9 * * *').")

        return self


class JobResponse(BaseModel):
    """Public representation of a Job."""

    id: uuid.UUID
    queue_id: uuid.UUID
    status: JobStatus
    payload: Any
    priority: int
    scheduled_at: Optional[datetime] = None
    cron_expression: Optional[str] = None
    claimed_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    retry_count: int
    max_retries: int
    last_error: Optional[str] = None
    depends_on_job_id: Optional[uuid.UUID] = None
    parent_job_id: Optional[uuid.UUID] = None
    worker_id: Optional[uuid.UUID] = None
    idempotency_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    """Paginated list of jobs."""

    items: list[JobResponse]
    total: int
    skip: int
    limit: int

