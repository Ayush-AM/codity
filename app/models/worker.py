"""
Worker model – represents a consumer process that pulls and executes jobs.

Workers register themselves with a hostname and PID and maintain a heartbeat.
A sweeper process marks workers whose ``last_heartbeat_at`` exceeds a threshold
as ``dead`` and re-enqueues their claimed jobs.

The ``ix_workers_heartbeat`` index supports efficient heartbeat-sweep queries:
    SELECT * FROM workers
    WHERE status = 'active' AND last_heartbeat_at < now() - interval '60 seconds';
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.job_execution import JobExecution
    from app.models.queue import Queue


class WorkerStatus(str, enum.Enum):
    """Worker lifecycle states."""

    active = "active"
    dead = "dead"


class Worker(BaseModel, Base):
    __tablename__ = "workers"

    queue_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("queues.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    pid: Mapped[int] = mapped_column(Integer, nullable=False)

    last_heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    status: Mapped[WorkerStatus] = mapped_column(
        Enum(WorkerStatus, name="worker_status", create_constraint=True),
        default=WorkerStatus.active,
        nullable=False,
    )

    concurrent_tasks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    queue: Mapped["Queue | None"] = relationship(
        "Queue",
        back_populates="workers",
    )

    executions: Mapped[List["JobExecution"]] = relationship(
        "JobExecution",
        back_populates="worker",
        passive_deletes=True,
    )

    jobs: Mapped[List["Job"]] = relationship(
        "Job",
        back_populates="worker",
        passive_deletes=True,
    )

    # ------------------------------------------------------------------
    # Performance indexes
    # ------------------------------------------------------------------
    __table_args__ = (
        Index("ix_workers_heartbeat", "last_heartbeat_at", "status"),
    )

    def __repr__(self) -> str:
        return f"<Worker(id={self.id!r}, hostname={self.hostname!r}, pid={self.pid!r})>"
