"""
Organization model – top-level tenant boundary.

Every user and project belongs to exactly one organization.
Deleting an organization is restricted while projects still reference it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Organization(BaseModel, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="organization",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="organization",
        # Restrict org deletion when projects exist (enforced at DB level).
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Organization(id={self.id!r}, slug={self.slug!r})>"
