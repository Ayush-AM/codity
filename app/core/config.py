"""
Centralized application settings loaded from environment variables.

Uses pydantic-settings to provide validated, type-safe configuration.
All values are read from ``.env`` or the system environment.
"""

from __future__ import annotations

import json
import socket

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ─── Database ───────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/scheduler_db"

    # ─── Redis (Idempotency Cache & Distributed Semaphores) ────
    REDIS_URL: str = "redis://localhost:6379/0"
    IDEMPOTENCY_TTL_SECONDS: int = 86400  # 24 hours

    # ─── Auth / JWT & OAuth ──────────────────────────────────────
    JWT_SECRET_KEY: str = "super-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # OAuth Providers Config
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_URI: str = "http://localhost:5173/auth/callback"

    # ─── Worker Configuration ───────────────────────────────────
    POLL_INTERVAL_SECONDS: int = 2
    HEARTBEAT_INTERVAL_SECONDS: int = 5
    JOB_TIMEOUT_SECONDS: int = 300
    WORKER_HOSTNAME: str = Field(default_factory=socket.gethostname)

    # ─── Scheduler Configuration ────────────────────────────────
    SCHEDULER_INTERVAL_SECONDS: int = 10
    ADVISORY_LOCK_ID: int = 12345

    # ─── Reaper Configuration ───────────────────────────────────
    REAPER_INTERVAL_SECONDS: int = 30
    STALE_WORKER_THRESHOLD_SECONDS: int = 15

    # ─── App ────────────────────────────────────────────────────
    APP_NAME: str = "Distributed Job Scheduler"
    APP_ENV: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins(self) -> list[str]:
        raw_value = self.CORS_ORIGINS.strip()
        if not raw_value:
            return []
        if raw_value.startswith("["):
            parsed = json.loads(raw_value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


# Singleton – import this everywhere
settings = Settings()
