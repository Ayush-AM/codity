"""
Pydantic schemas for Observability, System Health & Queue Telemetry.
"""

from __future__ import annotations

import uuid
from pydantic import BaseModel


class QueueStatsResponse(BaseModel):
    """Real-time statistical breakdown and throughput for a specific queue."""

    queue_id: uuid.UUID
    name: str
    pending: int
    running: int
    completed_24h: int
    failed_24h: int
    dead: int
    throughput_per_hour: float


class SystemMetricsResponse(BaseModel):
    """Organization-wide health metrics and aggregated counters."""

    total_jobs: int
    active_workers: int
    total_queues: int
    jobs_completed_24h: int
    jobs_failed_24h: int
    overall_failure_rate_24h: float
