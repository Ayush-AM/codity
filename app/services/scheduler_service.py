"""
Scheduler Service for Delayed Job Promotion and Recurring Cron Orchestration.

Responsibilities:
1. Promote delayed jobs: status='scheduled' -> status='queued' when scheduled_at <= NOW().
2. Recurring cron handler: Computes occurrences, spawns clean child jobs (status='queued'),
   and advances the parent template's scheduled_at timestamp to the next trigger interval.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from croniter import croniter
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.job_log import JobLog, LogLevel


def promote_due_jobs(db: Session, queue_id: UUID | None = None, batch_size: int = 100) -> int:
    """
    Find delayed jobs whose scheduled execution time has arrived and promote them to 'queued'.
    Only processes non-cron jobs (cron templates remain 'scheduled').
    """
    now_dt = func.now()
    query = (
        db.query(Job)
        .filter(
            Job.status == JobStatus.scheduled,
            Job.cron_expression.is_(None),
            (Job.scheduled_at.is_(None) | (Job.scheduled_at <= now_dt)),
        )
    )
    if queue_id is not None:
        query = query.filter(Job.queue_id == queue_id)

    due_jobs: List[Job] = query.order_by(Job.priority.asc(), Job.scheduled_at.asc()).limit(batch_size).all()

    if not due_jobs:
        return 0

    promoted_count = len(due_jobs)
    for job in due_jobs:
        job.status = JobStatus.queued
        job.scheduled_at = None
        job.updated_at = now_dt

        log = JobLog(
            job_id=job.id,
            level=LogLevel.info,
            message="Promoted from 'scheduled' to 'queued' by Scheduler",
        )
        db.add(log)

    db.commit()
    return promoted_count


def process_cron_jobs(db: Session, queue_id: UUID | None = None, batch_size: int = 100) -> int:
    """
    Inspect active recurring cron template jobs.
    When a cron interval arrives:
    1. Spawns an executable child job (status='queued', parent_job_id=template.id).
    2. Advances the parent's `scheduled_at` to the next cron interval.
    """
    query = (
        db.query(Job)
        .filter(
            Job.status == JobStatus.scheduled,
            Job.cron_expression.isnot(None),
        )
    )
    if queue_id is not None:
        query = query.filter(Job.queue_id == queue_id)

    cron_jobs: List[Job] = query.limit(batch_size).all()

    if not cron_jobs:
        return 0

    now_utc = datetime.now(timezone.utc)
    now_naive = now_utc.replace(tzinfo=None)
    spawned_count = 0

    for parent in cron_jobs:
        try:
            expr = parent.cron_expression.strip()

            # Initialize scheduled_at if missing
            if parent.scheduled_at is None:
                itr = croniter(expr, now_naive)
                next_dt = itr.get_next(datetime)
                parent.scheduled_at = next_dt.replace(tzinfo=timezone.utc)
                db.commit()
                continue

            # Check if scheduled trigger time has arrived
            sched_dt = parent.scheduled_at
            if sched_dt.tzinfo is None:
                sched_dt = sched_dt.replace(tzinfo=timezone.utc)

            if sched_dt <= now_utc:
                # 1. Spawn clean executable child job
                child = Job(
                    queue_id=parent.queue_id,
                    status=JobStatus.queued,
                    payload=parent.payload,
                    priority=parent.priority,
                    max_retries=parent.max_retries,
                    retry_count=0,
                    cron_expression=None,
                    parent_job_id=parent.id,
                )
                db.add(child)
                db.flush()  # Populates child.id

                # 2. Advance parent's scheduled_at to next cron time
                base_time = sched_dt.replace(tzinfo=None)
                itr = croniter(expr, base_time)
                next_run = itr.get_next(datetime)
                while next_run <= now_naive:
                    next_run = itr.get_next(datetime)

                parent.scheduled_at = next_run.replace(tzinfo=timezone.utc)
                parent.updated_at = func.now()

                parent_log = JobLog(
                    job_id=parent.id,
                    level=LogLevel.info,
                    message=f"Cron trigger fired. Spawned child job {child.id}. Next run: {parent.scheduled_at.isoformat()}",
                    metadata_={
                        "child_job_id": str(child.id),
                        "next_scheduled_at": parent.scheduled_at.isoformat(),
                    },
                )
                db.add(parent_log)
                spawned_count += 1

        except Exception as e:
            print(f"[Scheduler] Error processing cron job {parent.id}: {e}")

    db.commit()
    return spawned_count
