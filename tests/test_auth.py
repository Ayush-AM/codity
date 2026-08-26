"""
Authentication & Multi-Tenant Authorization Tests.
"""

import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User


def test_register_new_tenant(client: TestClient):
    """Test registering a brand new organization and root admin user."""
    email = f"lead_{uuid.uuid4().hex[:6]}@enterprise.com"
    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Lead Architect",
        "organization_name": f"Acme Global {uuid.uuid4().hex[:4]}",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "admin"


def test_login_success(client: TestClient, sample_user: User):
    """Test login with valid email and password."""
    payload = {
        "email": sample_user.email,
        "password": "TestPass123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client: TestClient, sample_user: User):
    """Test login with incorrect password returns 401."""
    payload = {
        "email": sample_user.email,
        "password": "WrongPassword!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_protected_route_with_and_without_token(client: TestClient, auth_headers: dict):
    """Test access control on protected routes."""
    # Unauthenticated -> 401
    res_unauth = client.get("/api/v1/protected")
    assert res_unauth.status_code == 401

    # Authenticated -> 200
    res_auth = client.get("/api/v1/protected", headers=auth_headers)
    assert res_auth.status_code == 200
    assert "email" in res_auth.json()


def test_get_oauth_url(client: TestClient):
    """Test retrieving OAuth authorization URLs for Google and GitHub."""
    res_google = client.get("/api/v1/auth/oauth/url/google")
    assert res_google.status_code == 200
    data_google = res_google.json()
    assert data_google["provider"] == "google"
    assert "authorize_url" in data_google

    res_github = client.get("/api/v1/auth/oauth/url/github")
    assert res_github.status_code == 200
    data_github = res_github.json()
    assert data_github["provider"] == "github"
    assert "authorize_url" in data_github


def test_oauth_login_new_user(client: TestClient):
    """Test OAuth login auto-registering new organization and admin user."""
    oauth_email = f"oauth_new_{uuid.uuid4().hex[:6]}@google.com"
    payload = {
        "provider": "google",
        "email": oauth_email,
        "full_name": "OAuth Google User",
        "code": f"code_new_{uuid.uuid4().hex[:6]}",
    }
    response = client.post("/api/v1/auth/oauth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == oauth_email
    assert data["user"]["role"] == "admin"
    assert data["user"]["oauth_provider"] == "google"


def test_oauth_login_existing_user(client: TestClient, sample_user: User):
    """Test OAuth login linking and logging in an existing user by email."""
    payload = {
        "provider": "github",
        "email": sample_user.email,
        "full_name": sample_user.full_name,
        "code": f"code_exist_{uuid.uuid4().hex[:6]}",
    }
    response = client.post("/api/v1/auth/oauth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == sample_user.email
    assert data["user"]["oauth_provider"] == "github"


def test_oauth_login_invalid_provider(client: TestClient):
    """Test OAuth login with unsupported provider returns 400."""
    payload = {
        "provider": "unsupported_provider",
        "email": "test@example.com",
    }
    response = client.post("/api/v1/auth/oauth/login", json=payload)
    assert response.status_code == 400
    assert "Unsupported OAuth provider" in response.json()["detail"]


def test_oauth_user_password_login_returns_401(client: TestClient):
    """Test that a user registered via OAuth attempting password login receives a 401 instead of 500 error."""
    oauth_email = f"oauth_pwd_check_{uuid.uuid4().hex[:6]}@google.com"
    oauth_payload = {
        "provider": "google",
        "email": oauth_email,
        "full_name": "OAuth User",
        "code": "sample_oauth_code",
    }
    res_oauth = client.post("/api/v1/auth/oauth/login", json=oauth_payload)
    assert res_oauth.status_code == 200

    # Attempt regular password login on the OAuth account
    pwd_login_payload = {
        "email": oauth_email,
        "password": "SomeRandomPassword123!",
    }
    res_login = client.post("/api/v1/auth/login", json=pwd_login_payload)
    assert res_login.status_code == 401
    assert "registered via Google" in res_login.json()["detail"]


