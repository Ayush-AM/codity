"""
Job Submission, Global Explorer, Execution History, and Structured Log Endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_queue, get_current_user
from app.models.job import JobStatus
from app.models.queue import Queue
from app.models.user import User
from app.schemas.execution import ExecutionListResponse, ExecutionResponse
from app.schemas.job import JobCreate, JobListResponse, JobResponse
from app.schemas.log import LogListResponse, LogResponse
from app.services import execution_service, job_query_service, job_service, log_service

queue_jobs_router = APIRouter(prefix="/queues/{queue_id}/jobs", tags=["Jobs"])
jobs_router = APIRouter(prefix="/jobs", tags=["Jobs"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Queue-scoped Job Submission & Inspection
# ─────────────────────────────────────────────────────────────────────────────

@queue_jobs_router.post(
    "/",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a job to queue",
)
def submit_job(
    job_in: JobCreate,
    response: Response,
    queue: Queue = Depends(get_current_queue),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Submit a new background job to the specified queue."""
    job, is_duplicate = job_service.create_job(
        queue=queue,
        job_data=job_in,
        db=db,
        idempotency_key=idempotency_key,
    )
    if is_duplicate:
        response.status_code = status.HTTP_200_OK

    return JobResponse.model_validate(job)


@queue_jobs_router.get(
    "/",
    response_model=List[JobResponse],
    summary="List jobs in queue",
)
def list_queue_jobs(
    queue: Queue = Depends(get_current_queue),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    status_filter: Optional[JobStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> List[JobResponse]:
    """List paginated jobs in a queue with optional status filtering."""
    jobs = job_service.get_jobs_by_queue(
        queue_id=queue.id,
        db=db,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
    )
    return [JobResponse.model_validate(j) for j in jobs]


@queue_jobs_router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job details by ID in queue",
)
def get_queue_job_details(
    job_id: UUID,
    queue: Queue = Depends(get_current_queue),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Fetch single job details within queue scope."""
    job = job_service.get_job(job_id=job_id, db=db)
    if not job or job.queue_id != queue.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found in this queue",
        )
    return JobResponse.model_validate(job)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Global Multi-Tenant Job Explorer & Telemetry Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@jobs_router.get(
    "/",
    response_model=JobListResponse,
    summary="Global job search and explorer",
)
def search_jobs(
    status: Optional[List[JobStatus]] = Query(None, description="Filter by one or more statuses"),
    queue_id: Optional[UUID] = Query(None, description="Filter by specific queue ID"),
    created_at_gte: Optional[datetime] = Query(None, description="Created at start ISO timestamp"),
    created_at_lte: Optional[datetime] = Query(None, description="Created at end ISO timestamp"),
    search: Optional[str] = Query(None, description="Search term across payload text and error message"),
    sort_by: Literal["created_at", "priority", "scheduled_at"] = Query("created_at"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobListResponse:
    """
    Search and filter jobs across the organization with pagination and sorting.
    """
    items, total = job_query_service.get_jobs(
        organization_id=current_user.organization_id,
        db=db,
        queue_id=queue_id,
        status_list=status,
        created_at_gte=created_at_gte,
        created_at_lte=created_at_lte,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    return JobListResponse(
        items=[JobResponse.model_validate(j) for j in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@jobs_router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get single job details",
)
def get_job_by_id(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Fetch complete job metadata with tenant authorization."""
    job = job_query_service.get_job_with_authorization(
        job_id=job_id,
        current_user=current_user,
        db=db,
    )
    return JobResponse.model_validate(job)


@jobs_router.get(
    "/{job_id}/executions",
    response_model=ExecutionListResponse,
    summary="Get execution history for a job",
)
def get_job_execution_history(
    job_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExecutionListResponse:
    """Fetch paginated execution attempts for a job."""
    items, total = execution_service.get_executions(
        job_id=job_id,
        current_user=current_user,
        db=db,
        skip=skip,
        limit=limit,
    )
    return ExecutionListResponse(
        items=[ExecutionResponse.model_validate(e) for e in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@jobs_router.get(
    "/{job_id}/logs",
    response_model=LogListResponse,
    summary="Get structured logs for a job",
)
def get_job_logs(
    job_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogListResponse:
    """Fetch structured execution logs and audit entries for a job."""
    items, total = log_service.get_logs(
        job_id=job_id,
        current_user=current_user,
        db=db,
        skip=skip,
        limit=limit,
    )
    return LogListResponse(
        items=[LogResponse.model_validate(l) for l in items],
        total=total,
        skip=skip,
        limit=limit,
    )
