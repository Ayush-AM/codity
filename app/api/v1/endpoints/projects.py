"""
Project Management Endpoints.

Allows creating and listing projects under the current authenticated user's organization.
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_project, get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new project under the current user's organization."""
    project = Project(
        organization_id=current_user.organization_id,
        name=project_in.name,
        description=project_in.description,
        api_key=uuid.uuid4(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get(
    "/",
    response_model=List[ProjectResponse],
    summary="List all projects in organization",
)
def list_projects(
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """List all projects belonging to the current user's organization."""
    projects = (
        db.query(Project)
        .filter(Project.organization_id == current_user.organization_id)
        .order_by(Project.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project by ID",
)
def get_project(
    project: Project = Depends(get_current_project),
) -> ProjectResponse:
    """Get project details by ID (verifies tenant organization)."""
    return ProjectResponse.model_validate(project)
