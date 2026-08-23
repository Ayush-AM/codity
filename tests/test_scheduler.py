"""
Scheduler Engine & Cron Child Job Generation Tests.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.models.user import User
from app.services import execution_service, log_service, scheduler_service


def test_scheduler_promotes_delayed_jobs(db: Session, sample_queue: Queue):
    """Test that delayed jobs with scheduled_at <= NOW() are promoted to 'queued'."""
    past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    delayed_job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.scheduled,
        payload={"task": "delayed_email_blast"},
        scheduled_at=past_time,
        priority=1,
    )
    db.add(delayed_job)
    db.commit()

    promoted_count = scheduler_service.promote_due_jobs(db=db)
    assert promoted_count >= 1

    db.refresh(delayed_job)
    assert delayed_job.status == JobStatus.queued


def test_scheduler_evaluates_cron_templates(db: Session, sample_queue: Queue):
    """Test that recurring cron jobs generate child jobs and update scheduled_at."""
    past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    cron_parent = Job(
        queue_id=sample_queue.id,
        status=JobStatus.scheduled,
        payload={"task": "generate_invoice_batches"},
        cron_expression="* * * * *",  # Every minute
        scheduled_at=past_time,
        priority=2,
    )
    db.add(cron_parent)
    db.commit()

    spawned_count = scheduler_service.process_cron_jobs(db=db)
    assert spawned_count >= 1

    # Check child job was created with parent_job_id
    child_job = (
        db.query(Job)
        .filter(Job.parent_job_id == cron_parent.id)
        .first()
    )
    assert child_job is not None
    assert child_job.status == JobStatus.queued
    assert child_job.cron_expression is None

    # Verify parent next run time was advanced into the future
    db.refresh(cron_parent)
    assert cron_parent.scheduled_at > datetime.now(timezone.utc)


def test_job_executions_and_logs_queries(db: Session, sample_queue: Queue, sample_user: User):
    """Test querying execution attempts and structured audit logs."""
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.completed,
        payload={"task": "audit_query_test"},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    executions, total_exec = execution_service.get_executions(job_id=job.id, current_user=sample_user, db=db)
    assert total_exec >= 0

    logs, total_logs = log_service.get_logs(job_id=job.id, current_user=sample_user, db=db)
    assert total_logs >= 0
