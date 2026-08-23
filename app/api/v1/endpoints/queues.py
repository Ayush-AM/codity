"""
Queue Management Endpoints.

Supports:
- Project-nested routes: `/api/v1/projects/{project_id}/queues`
- Standalone queue routes: `/api/v1/queues/{queue_id}`
- Strict multi-tenancy isolation via `get_current_project` and `get_current_queue`.
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_project, get_current_queue, get_current_user
from app.models.project import Project
from app.models.queue import Queue
from app.models.user import User
from app.schemas.queue import QueueCreate, QueueResponse, QueueUpdate
from app.services import queue_service

# ---------------------------------------------------------------------------
# Project-scoped Queues Router: /api/v1/projects/{project_id}/queues
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/projects/{project_id}/queues", tags=["Queues"])


def _verify_queue_in_project(queue_id: UUID, project_id: UUID, db: Session) -> Queue:
    """Helper to verify queue exists and belongs to the requested project."""
    queue = queue_service.get_queue(queue_id, db)
    if not queue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue not found",
        )
    if queue.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Queue does not belong to the specified project",
        )
    return queue


@router.post(
    "/",
    response_model=QueueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new queue in project",
)
def create_queue_in_project(
    queue_in: QueueCreate,
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Create a new queue under the specified project."""
    queue = queue_service.create_queue(project.id, queue_in, db)
    return QueueResponse.model_validate(queue)


@router.get(
    "/",
    response_model=List[QueueResponse],
    summary="List all queues for project",
)
def list_queues_in_project(
    project: Project = Depends(get_current_project),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    db: Session = Depends(get_db),
) -> List[QueueResponse]:
    """List paginated queues belonging to the specified project."""
    queues = queue_service.get_queues_by_project(project.id, db, skip=skip, limit=limit)
    return [QueueResponse.model_validate(q) for q in queues]


@router.get(
    "/{queue_id}",
    response_model=QueueResponse,
    summary="Get queue by ID within project",
)
def get_queue_in_project(
    queue_id: UUID,
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Fetch queue details by ID within project."""
    queue = _verify_queue_in_project(queue_id, project.id, db)
    return QueueResponse.model_validate(queue)


@router.put(
    "/{queue_id}",
    response_model=QueueResponse,
    summary="Update queue configuration",
)
def update_queue_in_project(
    queue_id: UUID,
    queue_in: QueueUpdate,
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Update an existing queue's configuration (name, concurrency, retry policy)."""
    queue = _verify_queue_in_project(queue_id, project.id, db)
    updated_queue = queue_service.update_queue(queue, queue_in, db)
    return QueueResponse.model_validate(updated_queue)


@router.delete(
    "/{queue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete queue",
)
def delete_queue_in_project(
    queue_id: UUID,
    force: bool = Query(False, description="Force delete queue and purge all active/completed jobs"),
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> Response:
    """
    Delete a queue.
    Fails with 400 Bad Request if there are active jobs unless force=True.
    """
    queue = _verify_queue_in_project(queue_id, project.id, db)
    queue_service.delete_queue(queue, db, force=force)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{queue_id}/pause",
    response_model=QueueResponse,
    summary="Pause queue",
)
def pause_queue_in_project(
    queue_id: UUID,
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Pause queue so workers will stop claiming jobs from it."""
    queue = _verify_queue_in_project(queue_id, project.id, db)
    paused_queue = queue_service.pause_queue(queue, db)
    return QueueResponse.model_validate(paused_queue)


@router.post(
    "/{queue_id}/resume",
    response_model=QueueResponse,
    summary="Resume queue",
)
def resume_queue_in_project(
    queue_id: UUID,
    project: Project = Depends(get_current_project),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Resume a paused queue so workers can claim jobs again."""
    queue = _verify_queue_in_project(queue_id, project.id, db)
    resumed_queue = queue_service.resume_queue(queue, db)
    return QueueResponse.model_validate(resumed_queue)


# ---------------------------------------------------------------------------
# Direct Queues Router: /api/v1/queues/{queue_id} (Convenience endpoints)
# ---------------------------------------------------------------------------
direct_queue_router = APIRouter(prefix="/queues", tags=["Queues"])


@direct_queue_router.get(
    "/{queue_id}",
    response_model=QueueResponse,
    summary="Get single queue by ID",
)
def get_queue_direct(
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Get queue details directly by queue_id (with tenant isolation)."""
    setattr(queue, "job_count", queue_service.count_active_jobs(queue.id, db))
    return QueueResponse.model_validate(queue)


@direct_queue_router.put(
    "/{queue_id}",
    response_model=QueueResponse,
    summary="Update queue by ID",
)
def update_queue_direct(
    queue_in: QueueUpdate,
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Update queue directly by queue_id."""
    updated = queue_service.update_queue(queue, queue_in, db)
    return QueueResponse.model_validate(updated)


@direct_queue_router.delete(
    "/{queue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete queue by ID",
)
def delete_queue_direct(
    force: bool = Query(False, description="Force delete queue and purge all active/completed jobs"),
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> Response:
    """Delete queue directly by queue_id (supports force purge)."""
    queue_service.delete_queue(queue, db, force=force)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@direct_queue_router.post(
    "/{queue_id}/pause",
    response_model=QueueResponse,
    summary="Pause queue by ID",
)
def pause_queue_direct(
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Pause queue directly by queue_id."""
    paused = queue_service.pause_queue(queue, db)
    return QueueResponse.model_validate(paused)


@direct_queue_router.post(
    "/{queue_id}/resume",
    response_model=QueueResponse,
    summary="Resume queue by ID",
)
def resume_queue_direct(
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> QueueResponse:
    """Resume queue directly by queue_id."""
    resumed = queue_service.resume_queue(queue, db)
    return QueueResponse.model_validate(resumed)
