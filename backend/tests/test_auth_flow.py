import uuid
import pytest
from datetime import datetime, timezone

from backend.app.domain.models import (
    Organization,
    User,
    OrganizationMembership,
    Role,
    MembershipRole,
    Session as UserSession,
    Invitation,
    PasswordResetToken,
)
from backend.app.security.passwords import hash_password, verify_password
from backend.app.security.tokens import decode_access_token, hash_opaque_token
from backend.app.security.rbac import RoleCode


def test_password_hashing():
    pwd = "SecureImmigrationPassword2026!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed)
    assert not verify_password("WrongPassword!", hashed)


def test_login_success_and_session_creation(client, db):
    org = Organization(name="Law Firm Alpha", slug="law-firm-alpha")
    db.add(org)
    db.flush()

    pwd = "AttorneyPassword123!"
    user = User(
        email="attorney@lawfirm-alpha.com",
        full_name="Sarah Jenkins",
        password_hash=hash_password(pwd),
        status="active",
    )
    db.add(user)
    db.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=user.id,
        status="active",
    )
    db.add(membership)
    db.flush()

    role = Role(code=RoleCode.CASE_MANAGER.value, name="Immigration Case Manager")
    db.add(role)
    db.flush()

    db.add(MembershipRole(membership_id=membership.id, role_id=role.id, assigned_at=datetime.now(timezone.utc)))
    db.commit()

    # Attempt login
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "attorney@lawfirm-alpha.com", "password": pwd},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["organization_id"] == str(org.id)
    assert RoleCode.CASE_MANAGER.value in data["roles"]

    # Verify session was created in DB
    sessions = db.query(UserSession).filter(UserSession.user_id == user.id).all()
    assert len(sessions) == 1
    assert sessions[0].revoked_at is None

    # Test /auth/me with Bearer token
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "attorney@lawfirm-alpha.com"
    assert me_data["experience"] == "case_manager"

    # Test logout revokes session
    logout_resp = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert logout_resp.status_code == 200

    # Session in DB is revoked
    db.refresh(sessions[0])
    assert sessions[0].revoked_at is not None


def test_login_failure_invalid_credentials(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@lawfirm.com", "password": "BadPassword123!"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["message"]


def test_password_reset_flow(client, db):
    org = Organization(name="Firm Beta", slug="firm-beta")
    db.add(org)
    db.flush()

    user = User(
        email="client@example.com",
        full_name="Elena Rostova",
        password_hash=hash_password("OldPassword123!"),
        status="active",
    )
    db.add(user)
    db.commit()

    # 1. Request password reset
    req_resp = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "client@example.com"},
    )
    assert req_resp.status_code == 200
    dev_token = req_resp.json().get("dev_reset_token")
    assert dev_token is not None

    # 2. Confirm password reset
    confirm_resp = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": dev_token, "new_password": "NewSecretPassword2026!"},
    )
    assert confirm_resp.status_code == 200

    # 3. Old password fails
    db.refresh(user)
    assert not verify_password("OldPassword123!", user.password_hash)

    # 4. New password succeeds
    assert verify_password("NewSecretPassword2026!", user.password_hash)


def test_invitation_acceptance_flow(client, db):
    org = Organization(name="Global Imm Firm", slug="global-imm-firm")
    db.add(org)
    db.flush()

    # Create invitation
    raw_token = "invitation_test_token_98765"
    invitation = Invitation(
        organization_id=org.id,
        email="new_case_worker@global-imm.com",
        role_code=RoleCode.CASE_MANAGER.value,
        token_hash=hash_opaque_token(raw_token),
        expires_at=datetime(2030, 1, 1, tzinfo=timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(invitation)
    db.commit()

    # Accept invitation
    resp = client.post(
        "/api/v1/auth/invitations/accept",
        json={
            "token": raw_token,
            "full_name": "Marcus Thorne",
            "password": "NewCaseworkerPassword2026!",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["organization_id"] == str(org.id)

    # User and membership exist in DB
    created_user = db.query(User).filter(User.email == "new_case_worker@global-imm.com").first()
    assert created_user is not None
    assert created_user.full_name == "Marcus Thorne"

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.user_id == created_user.id,
    ).first()
    assert membership is not None
    assert membership.status == "active"


def test_mfa_setup_and_verify(client, db):
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="mfa_user@firm.com",
        full_name="MFA Tester",
        status="active",
    )
    db.add(user)
    db.commit()

    headers = {
        "X-Organization-Id": str(org_id),
        "X-User-Id": str(user_id),
        "X-User-Role": "case_manager",
    }

    # Setup MFA
    setup_resp = client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup_resp.status_code == 200
    assert "secret" in setup_resp.json()

    # Verify MFA
    verify_resp = client.post(
        "/api/v1/auth/mfa/verify",
        headers=headers,
        json={"code": "123456"},
    )
    assert verify_resp.status_code == 200

    db.refresh(user)
    assert user.is_mfa_enabled is True
