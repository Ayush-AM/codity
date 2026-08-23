"""
API v1 Router aggregation.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import auth, dlq, health, jobs, metrics, projects, queues, workers

v1_router = APIRouter()
v1_router.include_router(health.router)
v1_router.include_router(auth.router)
v1_router.include_router(projects.router)
v1_router.include_router(queues.router)
v1_router.include_router(queues.direct_queue_router)
v1_router.include_router(jobs.queue_jobs_router)
v1_router.include_router(jobs.jobs_router)
v1_router.include_router(workers.router)
v1_router.include_router(dlq.router)
v1_router.include_router(metrics.router)
