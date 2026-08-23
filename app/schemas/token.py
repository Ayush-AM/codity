"""
Pydantic schemas for JWT tokens.
"""

from __future__ import annotations

from pydantic import BaseModel


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until expiry


class TokenPayload(BaseModel):
    """Decoded JWT payload (internal use)."""

    sub: str  # user ID
    org: str  # organization ID
    exp: int  # expiry timestamp
