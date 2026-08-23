"""
Health Check & Readiness Endpoints.

Provides /health for basic liveness probes and /health/ready for deep dependency readiness (PostgreSQL & Redis).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.services.idempotency_service import is_redis_available

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Basic Liveness Probe")
def liveness() -> Dict[str, Any]:
    """
    Lightweight probe returning HTTP 200 if the FastAPI application process is alive.
    """
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready", summary="Deep Readiness Probe (DB & Redis)")
def readiness(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Deep readiness check validating database and Redis connectivity.
    Returns HTTP 200 if critical backends are operational, else HTTP 503.
    """
    health_status: Dict[str, Any] = {
        "status": "ready",
        "database": "unknown",
        "redis": "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # 1. Database Check
    try:
        db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as db_err:
        health_status["status"] = "degraded"
        health_status["database"] = f"unreachable: {str(db_err)}"

    # 2. Redis Check
    if is_redis_available():
        health_status["redis"] = "connected"
    else:
        health_status["redis"] = "disconnected (graceful db fallback active)"

    # If DB is down, return 503 Service Unavailable
    if health_status["database"] != "connected":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_status,
        )

    return health_status
