"""
Job Submission, Idempotency & Query Tests.
"""

import uuid
from fastapi.testclient import TestClient
from app.models.queue import Queue


def test_submit_immediate_job(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test submitting an immediate job into a queue."""
    payload = {
        "payload": {"action": "send_email", "to": "user@example.com"},
        "priority": 1,
    }
    response = client.post(
        f"/api/v1/queues/{sample_queue.id}/jobs",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert data["queue_id"] == str(sample_queue.id)
    assert data["payload"]["action"] == "send_email"


def test_submit_cron_job(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test submitting a recurring cron template job."""
    payload = {
        "payload": {"task": "generate_daily_report"},
        "cron_expression": "0 9 * * *",
    }
    response = client.post(
        f"/api/v1/queues/{sample_queue.id}/jobs",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "scheduled"
    assert data["cron_expression"] == "0 9 * * *"


def test_job_submission_idempotency(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test that submitting duplicate requests with the same Idempotency-Key returns the identical job."""
    idempotency_key = f"idem-test-{uuid.uuid4().hex}"
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    payload = {
        "payload": {"transaction_id": "tx_998811", "amount": 250},
        "priority": 2,
    }

    # 1. First submission -> Created (201)
    res1 = client.post(
        f"/api/v1/queues/{sample_queue.id}/jobs",
        json=payload,
        headers=headers,
    )
    assert res1.status_code == 201
    job1 = res1.json()

    # 2. Second submission with exact same key -> Deduplicated (200)
    res2 = client.post(
        f"/api/v1/queues/{sample_queue.id}/jobs",
        json=payload,
        headers=headers,
    )
    assert res2.status_code == 200
    job2 = res2.json()

    # Must be the exact same job ID and payload
    assert job1["id"] == job2["id"]
    assert job2["idempotency_key"] == idempotency_key


def test_job_explorer_filtering(client: TestClient, auth_headers: dict, sample_queue: Queue):
    """Test querying and filtering jobs via the explorer API."""
    response = client.get(
        f"/api/v1/jobs/?queue_id={sample_queue.id}&limit=10",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
