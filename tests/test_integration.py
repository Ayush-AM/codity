"""
Comprehensive End-to-End Integration Test Suite.

Covers full lifecycle: Auth, Job Creation, Atomic Claiming, Execution, Retries, Reaper Recovery, and DLQ Replays.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.models.worker import Worker, WorkerStatus
from app.services import claim_service, dlq_service, executor_service, heartbeat_service, reaper_service, scheduler_service


def test_register_login(client: TestClient):
    """Test user registration and subsequent login."""
    email = f"lead_{uuid.uuid4().hex[:6]}@domain.com"
    reg_payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Senior SDE",
        "organization_name": f"Enterprise Org {uuid.uuid4().hex[:4]}",
    }
    res_reg = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201
    assert "access_token" in res_reg.json()

    # Login
    login_payload = {"email": email, "password": "SecurePassword123!"}
    res_login = client.post("/api/v1/auth/login", json=login_payload)
    assert res_login.status_code == 200
    assert "access_token" in res_login.json()


def test_create_immediate_job(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test submitting an immediate job into a queue."""
    payload = {"payload": {"task": "send_alert", "channel": "slack", "sleep": 0}, "priority": 1}
    res = client.post(f"/api/v1/queues/{sample_queue.id}/jobs", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "queued"
    assert data["queue_id"] == str(sample_queue.id)


def test_create_delayed_job(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test submitting a future delayed job."""
    future_time = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    payload = {
        "payload": {"task": "delayed_sync", "sleep": 0},
        "scheduled_at": future_time,
    }
    res = client.post(f"/api/v1/queues/{sample_queue.id}/jobs", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "scheduled"
    assert data["scheduled_at"] is not None


def test_create_cron_job(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test submitting a recurring cron template job."""
    payload = {
        "payload": {"task": "nightly_db_vacuum", "sleep": 0},
        "cron_expression": "0 0 * * *",
    }
    res = client.post(f"/api/v1/queues/{sample_queue.id}/jobs", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "scheduled"
    assert data["cron_expression"] == "0 0 * * *"


def test_job_lifecycle(db: Session, sample_queue: Queue):
    """Test full job lifecycle: queued -> claimed -> running -> completed."""
    # 1. Enqueue job
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.queued,
        payload={"action": "compress_video", "target": "h264", "sleep": 0},
        priority=1,
        retry_count=0,
        max_retries=3,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 2. Worker registers and claims job
    worker = heartbeat_service.register_worker(queue_id=sample_queue.id, db=db)
    claimed_jobs = claim_service.claim_jobs(
        queue_id=sample_queue.id,
        limit=1,
        db=db,
        worker_id=worker.id,
    )
    assert len(claimed_jobs) == 1
    db.refresh(job)
    assert job.status == JobStatus.claimed

    # 3. Execute job successfully
    executor_service.run_job(
        job_id=job.id,
        worker_id=worker.id,
        session_factory=SessionLocal,
    )

    db.refresh(job)
    assert job.status == JobStatus.completed
    assert job.finished_at is not None


def test_job_failure_and_retry(db: Session, sample_queue: Queue):
    """Test job failure, retry scheduling, and DLQ escalation on max retries."""
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.queued,
        payload={"fail": True, "error_message": "Network dropped", "sleep": 0},
        priority=1,
        retry_count=0,
        max_retries=2,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    worker = heartbeat_service.register_worker(queue_id=sample_queue.id, db=db)

    # Attempt 1: Claim and fail -> Status moves to scheduled with retry_count=1
    claim_service.claim_jobs(queue_id=sample_queue.id, limit=1, db=db, worker_id=worker.id)
    executor_service.run_job(job_id=job.id, worker_id=worker.id, session_factory=SessionLocal)
    
    db.refresh(job)
    assert job.status == JobStatus.scheduled
    assert job.retry_count == 1

    # Simulate scheduler promoting due job
    job.scheduled_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    scheduler_service.promote_due_jobs(db=db)

    # Attempt 2: Claim and fail -> Max retries (2) reached -> Status moves to dead (DLQ)
    claim_service.claim_jobs(queue_id=sample_queue.id, limit=1, db=db, worker_id=worker.id)
    executor_service.run_job(job_id=job.id, worker_id=worker.id, session_factory=SessionLocal)

    db.refresh(job)
    assert job.status == JobStatus.dead
    assert job.retry_count == 2


def test_reaper_recovery(db: Session, sample_queue: Queue):
    """Test Reaper sweeper detects dead worker and resets stranded in-flight job."""
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    worker = Worker(
        queue_id=sample_queue.id,
        hostname="worker-crashed-node",
        pid=1234,
        status=WorkerStatus.active,
        last_heartbeat_at=stale_time,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)

    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.running,
        worker_id=worker.id,
        payload={"task": "crashed_worker_recovery", "sleep": 0},
        retry_count=0,
        max_retries=3,
        claimed_at=stale_time,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Run Reaper cycle
    summary = reaper_service.run_reaper_cycle(db=db, threshold_seconds=15)
    assert summary["dead_workers"] >= 1
    assert summary["recovered_jobs"] >= 1

    db.refresh(worker)
    assert worker.status == WorkerStatus.dead

    db.refresh(job)
    assert job.status == JobStatus.queued
    assert job.worker_id is None
    assert job.retry_count == 1


def test_dlq_manual_retry(client: TestClient, auth_headers: dict, db: Session, sample_queue: Queue):
    """Test manual DLQ replay endpoint."""
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.running,
        payload={"charge_id": "ch_99212", "sleep": 0},
        retry_count=3,
        max_retries=3,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    dlq_service.move_to_dlq(job=job, reason="Payment gateway timeout", db=db)
    assert job.status == JobStatus.dead

    # Replay job via API
    res = client.post(f"/api/v1/dlq/{job.id}/retry", headers=auth_headers)
    assert res.status_code == 201
    replayed = res.json()
    assert replayed["status"] == "queued"
    assert replayed["retry_count"] == 0
