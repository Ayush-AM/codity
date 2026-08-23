"""
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload
"""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.v1 import v1_router
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

app = FastAPI(
    title=settings.APP_NAME,
    description="A production-grade distributed job scheduling platform.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend clients
origins = settings.cors_origins
allow_all = "*" in origins or not origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root_redirect():
    """Redirect root access to Swagger interactive documentation."""
    return RedirectResponse(url="/docs")


# Include API v1 routes
app.include_router(v1_router, prefix="/api/v1")
app.include_router(v1_router)  # Also available at root for /health and /health/ready


@app.get(
    "/api/v1/protected",
    response_model=UserResponse,
    tags=["Authentication"],
    summary="Protected endpoint testing JWT authentication",
)
def protected_test(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Protected endpoint — returns current user details if valid Bearer token provided."""
    return UserResponse.model_validate(current_user)
