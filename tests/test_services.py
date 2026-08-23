"""
Unit Tests for Pure Logic Services (Retry Math, Cron Parsing, Health & Locks).
"""

from datetime import datetime, timezone
from croniter import croniter
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.queue import Queue
from app.models.user import User
from app.services import lock_service, metrics_service
from app.services.retry_service import calculate_retry_delay, calculate_next_retry_delay


def test_calculate_retry_delay_fixed():
    """Verify fixed retry strategy returns base_delay constantly."""
    policy = {"strategy": "fixed", "base_delay": 45, "max_retries": 5}
    assert calculate_retry_delay(0, policy) == 45
    assert calculate_retry_delay(1, policy) == 45
    assert calculate_retry_delay(2, policy) == 45


def test_calculate_retry_delay_linear():
    """Verify linear retry strategy returns base_delay * (retry_count + 1)."""
    policy = {"strategy": "linear", "base_delay": 10, "max_retries": 5}
    assert calculate_retry_delay(0, policy) == 10
    assert calculate_retry_delay(1, policy) == 20
    assert calculate_retry_delay(2, policy) == 30


def test_calculate_retry_delay_exponential():
    """Verify exponential retry strategy scales with powers of 2."""
    policy = {"strategy": "exponential", "base_delay": 5, "multiplier": 2.0, "jitter": False, "max_retries": 5}
    assert calculate_retry_delay(0, policy) == 5
    assert calculate_retry_delay(1, policy) == 10
    assert calculate_retry_delay(2, policy) == 20
    assert calculate_retry_delay(3, policy) == 40


def test_calculate_retry_delay_maxed():
    """Verify calculate_retry_delay returns None when retry limit is reached or exceeded."""
    policy = {"strategy": "exponential", "base_delay": 5, "max_retries": 3}
    assert calculate_retry_delay(3, policy) is None
    assert calculate_retry_delay(4, policy) is None


def test_cron_parsing():
    """Verify standard 5-field cron parsing with croniter."""
    cron_expr = "0 9 * * *"  # Every day at 09:00 UTC
    base_time = datetime(2026, 8, 21, 8, 0, 0, tzinfo=timezone.utc)
    
    iter_obj = croniter(cron_expr, base_time)
    next_run = iter_obj.get_next(datetime)
    
    assert next_run == datetime(2026, 8, 21, 9, 0, 0, tzinfo=timezone.utc)
    
    # Next day at 09:00
    next_next_run = iter_obj.get_next(datetime)
    assert next_next_run == datetime(2026, 8, 22, 9, 0, 0, tzinfo=timezone.utc)


def test_health_endpoints(client: TestClient):
    """Test /health liveness and /health/ready deep readiness probes."""
    res_live = client.get("/health")
    assert res_live.status_code == 200
    assert res_live.json()["status"] == "ok"

    res_ready = client.get("/health/ready")
    assert res_ready.status_code == 200
    data = res_ready.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


def test_postgresql_advisory_locks(db: Session):
    """Test acquiring and releasing PostgreSQL session advisory locks."""
    lock_id = 987654
    acquired = lock_service.acquire_advisory_lock(lock_id=lock_id, db=db)
    assert acquired is True

    released = lock_service.release_advisory_lock(lock_id=lock_id, db=db)
    assert released is True


def test_queue_and_system_metrics(db: Session, sample_queue: Queue, sample_user: User):
    """Test SQL aggregation metrics."""
    stats = metrics_service.get_queue_stats(queue_id=sample_queue.id, current_user=sample_user, db=db)
    assert stats.pending >= 0
    assert stats.running >= 0
    assert stats.completed_24h >= 0

    sys_metrics = metrics_service.get_system_metrics(current_user=sample_user, db=db)
    assert sys_metrics.total_jobs >= 0
    assert sys_metrics.total_queues >= 1
