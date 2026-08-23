"""
Dead Letter Queue (DLQ) Management Endpoints.

Allows:
- Listing permanently failed jobs for the user's organization.
- Manually retrying/replaying a dead job (spawns a fresh queued job and purges the DLQ record).
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dlq import DeadLetterEntryResponse
from app.schemas.job import JobResponse
from app.services import dlq_service

router = APIRouter(prefix="/dlq", tags=["Dead Letter Queue"])


@router.get(
    "/",
    response_model=List[DeadLetterEntryResponse],
    summary="List all Dead Letter Queue entries",
)
def list_dlq_entries(
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    db: Session = Depends(get_db),
) -> List[DeadLetterEntryResponse]:
    """List all permanently failed jobs in DLQ belonging to the user's organization."""
    entries = dlq_service.get_dlq_entries(
        db=db,
        skip=skip,
        limit=limit,
        organization_id=current_user.organization_id,
    )
    return [DeadLetterEntryResponse.model_validate(e) for e in entries]


@router.post(
    "/{job_id}/retry",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually retry a dead job from DLQ",
)
def retry_dead_letter_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """
    Replay a dead job from the DLQ:
    - Verifies ownership within user's organization.
    - Clones the job payload into a new 'queued' job with retry_count=0.
    - Removes the tombstone from the Dead Letter Queue.
    """
    new_job = dlq_service.retry_dead_job(
        job_id=job_id,
        organization_id=current_user.organization_id,
        db=db,
    )
    return JobResponse.model_validate(new_job)
