"""
JobExecution model – an immutable record of every single job attempt.

Each time a worker picks up a job (even retries), a new ``JobExecution`` row
is created. This gives full audit-trail visibility into execution history
including timing and error messages per attempt.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.worker import Worker


class ExecutionStatus(str, enum.Enum):
    """Possible outcomes of a single execution attempt."""

    running = "running"
    completed = "completed"
    failed = "failed"


class JobExecution(BaseModel, Base):
    __tablename__ = "job_executions"

    job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    worker_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus, name="execution_status", create_constraint=True),
        default=ExecutionStatus.running,
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    job: Mapped["Job"] = relationship(
        "Job",
        back_populates="executions",
    )

    worker: Mapped["Worker | None"] = relationship(
        "Worker",
        back_populates="executions",
    )

    # ------------------------------------------------------------------
    # Performance indexes
    # ------------------------------------------------------------------
    __table_args__ = (
        Index("ix_job_executions_job_started", "job_id", "started_at"),
    )

    def __repr__(self) -> str:
        return f"<JobExecution(id={self.id!r}, job_id={self.job_id!r}, status={self.status!r})>"
