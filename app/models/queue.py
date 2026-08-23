"""
Queue model – named work channel inside a project.

Queues define:
- Priority (lower integer = higher priority).
- Concurrency limits for workers.
- A JSONB retry policy (strategy, base_delay, max_retries).
- A pause toggle.

Deleting a project cascades to its queues.
Deleting a queue cascades to its jobs.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.project import Project
    from app.models.worker import Worker


class Queue(BaseModel, Base):
    __tablename__ = "queues"

    project_id: Mapped["PG_UUID"] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    concurrency_limit: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # JSONB example: {"strategy": "exponential", "base_delay": 60, "max_retries": 3}
    retry_policy: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: {"strategy": "fixed", "base_delay": 60, "max_retries": 3},
    )

    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="queues",
    )

    jobs: Mapped[List["Job"]] = relationship(
        "Job",
        back_populates="queue",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    workers: Mapped[List["Worker"]] = relationship(
        "Worker",
        back_populates="queue",
        passive_deletes=True,
    )

    # ------------------------------------------------------------------
    # Table-level constraints / indexes
    # ------------------------------------------------------------------
    __table_args__ = (
        # Unique queue name within a project
        Index("ix_queues_project_name", "project_id", "name", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Queue(id={self.id!r}, name={self.name!r})>"
