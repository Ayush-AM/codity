"""
Job model – the fundamental unit of work in the scheduler.

Key design decisions:
- ``status`` uses a PostgreSQL enum to enforce valid transitions at DB level.
- ``priority`` can override the queue-level default (lower = higher priority).
- ``scheduled_at`` enables delayed / deferred jobs.
- ``cron_expression`` enables recurring jobs (e.g. ``"*/5 * * * *"``).
- ``depends_on_job_id`` is a self-referential FK for simple DAG-style workflows.
- ``max_retries`` is **copied** from the queue's retry_policy at job creation time
  so it remains immutable even if the queue policy is later updated.

The composite polling index ``ix_jobs_polling`` supports atomic claiming via:
    SELECT … FROM jobs
    WHERE queue_id = :qid AND status = 'queued' AND scheduled_at <= now()
    ORDER BY priority ASC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT :batch;
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.dead_letter_entry import DeadLetterEntry
    from app.models.job_execution import JobExecution
    from app.models.job_log import JobLog
    from app.models.queue import Queue


class JobStatus(str, enum.Enum):
    """Lifecycle states of a job."""

    queued = "queued"
    scheduled = "scheduled"
    claimed = "claimed"
    running = "running"
    completed = "completed"
    failed = "failed"
    dead = "dead"


class Job(BaseModel, Base):
    __tablename__ = "jobs"

    # ------------------------------------------------------------------
    # Core fields
    # ------------------------------------------------------------------
    queue_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("queues.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", create_constraint=True),
        default=JobStatus.queued,
        nullable=False,
        index=True,
    )

    payload: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ------------------------------------------------------------------
    # Scheduling
    # ------------------------------------------------------------------
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    cron_expression: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Execution timestamps
    # ------------------------------------------------------------------
    claimed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ------------------------------------------------------------------
    # Retry
    # ------------------------------------------------------------------
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Workflow (DAG dependencies) – self-referential FK
    # ------------------------------------------------------------------
    depends_on_job_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # Idempotency & Deduplication
    # ------------------------------------------------------------------
    idempotency_key: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # Cron Parent/Child Hierarchy
    # ------------------------------------------------------------------
    parent_job_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # Worker Assignment (for Reaper & Observability)
    # ------------------------------------------------------------------
    worker_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    queue: Mapped["Queue"] = relationship(
        "Queue",
        back_populates="jobs",
    )

    worker: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        back_populates="jobs",
    )

    executions: Mapped[List["JobExecution"]] = relationship(
        "JobExecution",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    logs: Mapped[List["JobLog"]] = relationship(
        "JobLog",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    dead_letter_entry: Mapped[Optional["DeadLetterEntry"]] = relationship(
        "DeadLetterEntry",
        back_populates="job",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Self-referential DAG dependency relationship
    depends_on: Mapped[Optional["Job"]] = relationship(
        "Job",
        remote_side="Job.id",
        foreign_keys=[depends_on_job_id],
    )

    # Self-referential Cron parent/child relationship
    parent_job: Mapped[Optional["Job"]] = relationship(
        "Job",
        remote_side="Job.id",
        foreign_keys=[parent_job_id],
        backref="child_jobs",
    )

    # ------------------------------------------------------------------
    # Performance indexes
    # ------------------------------------------------------------------
    __table_args__ = (
        # Primary polling index – used by SELECT … FOR UPDATE SKIP LOCKED
        Index(
            "ix_jobs_polling",
            "queue_id",
            "status",
            "priority",
            "scheduled_at",
        ),
        # Fast lookup for scheduler sweeps on delayed/cron jobs
        Index("ix_jobs_scheduled_at", "scheduled_at"),
    )

    def __repr__(self) -> str:
        return f"<Job(id={self.id!r}, status={self.status!r})>"
