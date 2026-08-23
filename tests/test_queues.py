"""
Queue Management & Partition Isolation Tests.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.queue import Queue
from app.services import queue_service


def test_create_and_manage_queues(client: TestClient, auth_headers: dict, sample_project: Project, db: Session):
    """Test creating, listing, pausing, and resuming queues via API and service."""
    # 1. Create Queue via API
    payload = {
        "name": "priority-ingest-queue",
        "description": "High priority data pipeline",
        "concurrency_limit": 10,
        "priority": 1,
        "retry_policy": {
            "strategy": "exponential",
            "max_retries": 4,
            "initial_delay": 2,
            "max_delay": 120,
            "multiplier": 2.0,
            "jitter": True,
        },
    }
    res_create = client.post(
        f"/api/v1/projects/{sample_project.id}/queues",
        json=payload,
        headers=auth_headers,
    )
    assert res_create.status_code == 201
    q_data = res_create.json()
    q_id = q_data["id"]
    assert q_data["name"] == "priority-ingest-queue"
    assert q_data["concurrency_limit"] == 10

    # 2. List queues for project
    res_list = client.get(f"/api/v1/projects/{sample_project.id}/queues", headers=auth_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    # 3. Get single queue
    res_get = client.get(f"/api/v1/queues/{q_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == q_id

    # 4. Pause Queue
    res_pause = client.post(f"/api/v1/queues/{q_id}/pause", headers=auth_headers)
    assert res_pause.status_code == 200
    assert res_pause.json()["is_paused"] is True

    # 5. Resume Queue
    res_resume = client.post(f"/api/v1/queues/{q_id}/resume", headers=auth_headers)
    assert res_resume.status_code == 200
    assert res_resume.json()["is_paused"] is False

    # 6. Update Queue
    update_payload = {"concurrency_limit": 25}
    res_update = client.put(f"/api/v1/queues/{q_id}", json=update_payload, headers=auth_headers)
    assert res_update.status_code == 200
    assert res_update.json()["concurrency_limit"] == 25
