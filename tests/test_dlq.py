"""
Dead Letter Queue (DLQ) Integration & Replay Tests.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.services import dlq_service


def test_move_exhausted_job_to_dlq_and_replay(
    client: TestClient,
    auth_headers: dict,
    db: Session,
    sample_queue: Queue,
):
    """Test transitioning a permanently failed job to DLQ and replaying it via API."""
    # 1. Create a failed job with max_retries exhausted
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.running,
        payload={"invoice_id": "INV-2026-999"},
        retry_count=3,
        max_retries=3,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 2. Move to DLQ
    entry = dlq_service.move_to_dlq(
        job=job,
        reason="Network gateway timed out after 3 retries",
        db=db,
    )
    assert entry.job_id == job.id
    assert job.status == JobStatus.dead

    # 3. Query DLQ via API
    res_list = client.get("/api/v1/dlq/", headers=auth_headers)
    assert res_list.status_code == 200
    entries = res_list.json()
    assert any(e["job_id"] == str(job.id) for e in entries)

    # 4. Replay dead job via API (returns 201 Created for re-enqueued job)
    res_retry = client.post(f"/api/v1/dlq/{job.id}/retry", headers=auth_headers)
    assert res_retry.status_code == 201
    replayed = res_retry.json()
    assert replayed["status"] == "queued"
    assert replayed["retry_count"] == 0
