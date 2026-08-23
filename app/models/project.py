"""
Project model – logical grouping of queues under an organization.

Each project gets an auto-generated ``api_key`` (UUID) for programmatic access.
Deleting a project cascades to its queues (and transitively to jobs).
Deleting an organization is *restricted* while projects still exist.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.queue import Queue


class Project(BaseModel, Base):
    __tablename__ = "projects"

    organization_id: Mapped["PG_UUID"] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        default=uuid.uuid4,
        unique=True,
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="projects",
    )

    queues: Mapped[List["Queue"]] = relationship(
        "Queue",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id!r}, name={self.name!r})>"
