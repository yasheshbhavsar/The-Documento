"""Comprehensive security hardening, RBAC, isolation, MFA, and runtime-crash regression tests.

Covers all Workstream 1 security & reliability remediations:
1. Cross-tenant account takeover & privilege escalation closures (rbac, organizations, auth, roles)
2. Real AES-256-GCM encryption + RFC 6238 TOTP MFA + login mfa_pending enforcement
3. Auth hardening, JWT fail-closed validation, client bcrypt login fix, multi-org deletion safety, agency provisioning
4. Runtime crash fixes (operations.py, requests.py route shadowing, analytics/service.py) + IDOR / RBAC closures
   across packages, forms, appointments, cases, messaging, findings, governance, foundation, firm_config, notifications
5. Rate limiter proxy/testclient hardening, security headers, error masking, PII log scrubbing, metrics & DB pooling
"""

import io
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pyotp
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.analytics.service import AnalyticsService, ExecutiveDashboardService
from backend.app.core.config import Settings, get_settings
from backend.app.core.logging import StructuredJsonFormatter, redact_pii_text
from backend.app.core.middleware import SimpleRateLimiterMiddleware
from backend.app.core.worker_health import WorkerHealthMonitor
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseTask,
    ClientProfile,
    Document,
    DocumentRequest,
    FilingPackage,
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    ImmigrationCase,
    MembershipRole,
    Message,
    MessageThread,
    Organization,
    OrganizationMembership,
    Role,
    Session as UserSession,
    User,
    VisaAppointment,
    now_utc,
)
from backend.app.main import app
from backend.app.observability.metrics import MetricsCollector, _escape_prom_label
from backend.app.security.crypto import (
    decrypt_secret,
    encrypt_secret,
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
)
from backend.app.security.tokens import create_access_token
from backend.app.security.passwords import hash_password, verify_password
from backend.app.security.rbac import ROLE_PERMISSIONS, RoleCode, can_assign_permission


def _reset_rate_limiter():
    """Clear in-memory middleware buckets so rate-limit tests don't bleed across tests."""
    stack = app.middleware_stack
    while stack is not None:
        if isinstance(stack, SimpleRateLimiterMiddleware):
            stack.request_counts.clear()
            stack.auth_request_counts.clear()
        stack = getattr(stack, "app", None)


@pytest.fixture(autouse=True)
def _clean_state():
    _reset_rate_limiter()
    yield
    _reset_rate_limiter()


def _create_org_and_user(
    db: Session,
    *,
    org_name: str,
    email: str,
    role_code: str,
    password: str = "StrongPass#2026!",
    full_name: str = "Test User",
) -> tuple[Organization, User, OrganizationMembership]:
    org = Organization(name=org_name, slug=f"org-{uuid.uuid4().hex[:8]}")
    db.add(org)
    db.flush()

    user = User(
        email=email.lower(),
        full_name=full_name,
        password_hash=hash_password(password),
        organization_id=org.id,
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

    role = db.query(Role).filter(Role.code == role_code).first()
    if not role:
        role = Role(code=role_code, name=role_code.replace("_", " ").title())
        db.add(role)
        db.flush()
    db.add(MembershipRole(membership_id=membership.id, role_id=role.id))
    db.commit()
    return org, user, membership


def _add_user_to_org(
    db: Session,
    org: Organization,
    *,
    email: str,
    role_code: str,
    password: str = "StrongPass#2026!",
    full_name: str = "Org User",
) -> tuple[User, OrganizationMembership]:
    user = User(
        email=email.lower(),
        full_name=full_name,
        password_hash=hash_password(password),
        organization_id=org.id,
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

    role = db.query(Role).filter(Role.code == role_code).first()
    if not role:
        role = Role(code=role_code, name=role_code.replace("_", " ").title())
        db.add(role)
        db.flush()
    db.add(MembershipRole(membership_id=membership.id, role_id=role.id))
    db.commit()
    return user, membership


def _make_client_and_case(
    db: Session,
    org: Organization,
    *,
    client_email: str,
    assigned_user: User | None = None,
) -> tuple[User, ClientProfile, ImmigrationCase]:
    client_user, _ = _add_user_to_org(
        db,
        org,
        email=client_email,
        role_code=RoleCode.RETAINED_CLIENT.value,
        full_name="Retained Client",
    )
    profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Client",
        last_name="Applicant",
        email=client_user.email,
        nationality="IND",
    )
    db.add(profile)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=profile.id,
        case_number=f"SEC-{uuid.uuid4().hex[:6].upper()}",
        title="Security Verification Case",
        jurisdiction="US",
        visa_category="H-1B",
        status="processing",
    )
    db.add(case)
    db.flush()

    if assigned_user is not None:
        db.add(CaseAssignment(case_id=case.id, user_id=assigned_user.id, role_in_case="case_worker"))
    db.commit()
    return client_user, profile, case


def _headers(org_id: uuid.UUID, user_id: uuid.UUID, role: str) -> dict[str, str]:
    return {
        "X-Organization-Id": str(org_id),
        "X-User-Id": str(user_id),
        "X-User-Role": role,
    }


# ==============================================================================
# 1. CROSS-TENANT ACCOUNT TAKEOVER & ESCALATION
# ==============================================================================


def test_rbac_blocks_platform_permissions_for_non_super_admin():
    assert can_assign_permission({RoleCode.MASTER_ADMIN.value}, "case_worker", "platform:manage") is False
    assert can_assign_permission({RoleCode.MASTER_ADMIN.value}, "case_worker", "platform:read") is False
    assert can_assign_permission({RoleCode.MASTER_ADMIN.value}, "case_worker", "system:manage") is False
    assert can_assign_permission({RoleCode.MASTER_ADMIN.value}, "case_worker", "*") is False
    assert can_assign_permission({RoleCode.MASTER_ADMIN.value}, "platform_super_admin", "org:member") is False
    assert can_assign_permission({RoleCode.COMPANY_ADMIN.value}, "system_admin", "org:member") is False
    assert can_assign_permission({RoleCode.PLATFORM_SUPER_ADMIN.value}, "case_worker", "platform:manage") is True


def test_invitation_blocks_platform_roles_and_hides_token_in_production(client: TestClient, db: Session):
    org, admin, _ = _create_org_and_user(
        db,
        org_name="Tenant Alpha",
        email=f"admin-{uuid.uuid4().hex[:6]}@alpha.com",
        role_code=RoleCode.MASTER_ADMIN.value,
    )
    hdrs = _headers(org.id, admin.id, RoleCode.MASTER_ADMIN.value)

    for forbidden_role in ("platform_super_admin", "system_admin", "super_admin"):
        resp = client.post(
            "/api/v1/organizations/invitations",
            headers=hdrs,
            json={"email": f"attacker-{uuid.uuid4().hex[:4]}@evil.com", "role_code": forbidden_role},
        )
        assert resp.status_code == 403, f"Role {forbidden_role} should be forbidden"

    # In production, raw invitation_token must NOT be returned
    settings = get_settings()
    orig_env = settings.environment
    orig_bypass = settings.allow_dev_auth_bypass
    try:
        settings.environment = "production"
        settings.allow_dev_auth_bypass = False
        # Authenticate via signed JWT in production mode
        session_row = UserSession(
            user_id=admin.id,
            organization_id=org.id,
            token_hash=f"hash-{uuid.uuid4().hex}",
            expires_at=now_utc() + timedelta(hours=1),
        )
        db.add(session_row)
        db.commit()
        membership = db.query(OrganizationMembership).filter_by(user_id=admin.id, organization_id=org.id).first()
        token = create_access_token(
            {
                "sub": str(admin.id),
                "org_id": str(org.id),
                "email": admin.email,
                "roles": [RoleCode.MASTER_ADMIN.value],
                "membership_id": str(membership.id),
                "session_id": str(session_row.id),
            }
        )
        resp_prod = client.post(
            "/api/v1/organizations/invitations",
            headers={"Authorization": f"Bearer {token}"},
            json={"email": f"staff-{uuid.uuid4().hex[:6]}@alpha.com", "role_code": "case_worker"},
        )
        assert resp_prod.status_code == 201, resp_prod.text
        assert resp_prod.json()["invitation_token"] is None
    finally:
        settings.environment = orig_env
        settings.allow_dev_auth_bypass = orig_bypass


def test_accept_invitation_never_overwrites_existing_user_password(client: TestClient, db: Session):
    victim_password = "VictimRealPassword#99"
    victim_email = f"victim-{uuid.uuid4().hex[:6]}@firm-a.com"
    org_a, victim, _ = _create_org_and_user(
        db, org_name="Firm A", email=victim_email, role_code=RoleCode.MASTER_ADMIN.value, password=victim_password
    )
    org_b, attacker_admin, _ = _create_org_and_user(
        db, org_name="Firm B", email=f"admin-{uuid.uuid4().hex[:6]}@firm-b.com", role_code=RoleCode.MASTER_ADMIN.value
    )

    inv_resp = client.post(
        "/api/v1/organizations/invitations",
        headers=_headers(org_b.id, attacker_admin.id, RoleCode.MASTER_ADMIN.value),
        json={"email": victim_email, "role_code": "case_worker"},
    )
    assert inv_resp.status_code == 201
    inv_token = inv_resp.json()["invitation_token"]
    assert inv_token

    # Attacker tries to accept victim's invite with a chosen attacker password -> MUST BE REJECTED (401/409)
    hijack_resp = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv_token, "full_name": "Hijacked Name", "password": "AttackerNewPassword!1"},
    )
    assert hijack_resp.status_code in (401, 409)

    # Victim's original password hash MUST remain intact
    db.refresh(victim)
    assert verify_password(victim_password, victim.password_hash)
    assert not verify_password("AttackerNewPassword!1", victim.password_hash)

    # Accepting with the victim's actual existing password links the membership safely
    legit_resp = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv_token, "full_name": victim.full_name, "password": victim_password},
    )
    assert legit_resp.status_code == 200
    assert db.query(OrganizationMembership).filter_by(user_id=victim.id, organization_id=org_b.id).first() is not None


def test_roles_endpoint_blocks_platform_permissions_and_preserves_global_ram(client: TestClient, db: Session):
    org, admin, _ = _create_org_and_user(
        db, org_name="Role Firm", email=f"admin-{uuid.uuid4().hex[:6]}@role.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    hdrs = _headers(org.id, admin.id, RoleCode.MASTER_ADMIN.value)
    orig_case_worker_perms = set(ROLE_PERMISSIONS[RoleCode.CASE_WORKER])

    # Tenant admin cannot grant platform:* permissions
    bad_resp = client.post(
        "/api/v1/roles/case_worker/permissions",
        headers=hdrs,
        json={"permission": "platform:manage"},
    )
    assert bad_resp.status_code == 403

    # Tenant admin cannot mutate platform_super_admin role
    bad_role = client.post(
        "/api/v1/roles/platform_super_admin/permissions",
        headers=hdrs,
        json={"permission": "case:read"},
    )
    assert bad_role.status_code == 403

    # Non-super-admin updating case_worker persists to DB without mutating process-wide ROLE_PERMISSIONS RAM
    ok_resp = client.post(
        "/api/v1/roles/case_worker/permissions",
        headers=hdrs,
        json={"permission": "case:custom_test_perm"},
    )
    assert ok_resp.status_code == 200
    assert set(ROLE_PERMISSIONS[RoleCode.CASE_WORKER]) == orig_case_worker_perms


# ==============================================================================
# 2. REAL AES-256-GCM + RFC 6238 TOTP MFA + LOGIN ENFORCEMENT
# ==============================================================================


def test_crypto_aes_gcm_roundtrip_and_totp_column_fit():
    secret = generate_totp_secret()
    assert len(secret) == 32
    encrypted = encrypt_secret(secret)
    assert encrypted != secret
    assert len(encrypted) <= 64  # Must fit User.mfa_secret VARCHAR(64)
    assert decrypt_secret(encrypted) == secret

    # Arbitrary UTF-8 string roundtrip
    long_plain = "sensitive-webhook-api-secret-value-1234567890"
    enc_long = encrypt_secret(long_plain)
    assert enc_long.startswith("enc:v1:")
    assert decrypt_secret(enc_long) == long_plain

    # Real RFC 6238 TOTP verification
    uri = get_totp_uri(secret, "counsel@firm.com")
    assert uri.startswith("otpauth://totp/")
    real_code = pyotp.TOTP(secret).now()
    wrong_code = "000000" if real_code != "000000" else "999999"
    assert verify_totp_code(secret, real_code) is True
    assert verify_totp_code(secret, wrong_code) is False


def test_mfa_end_to_end_login_enforcement_and_mfa_pending_rejection(client: TestClient, db: Session):
    pwd = "MfaStrongPass#2026"
    email = f"mfa-e2e-{uuid.uuid4().hex[:6]}@firm.com"
    org, user, _ = _create_org_and_user(
        db, org_name="MFA Firm", email=email, role_code=RoleCode.MASTER_ADMIN.value, password=pwd
    )

    # 1. Login before MFA enabled -> gets full JWT
    login1 = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login1.status_code == 200
    full_token = login1.json()["access_token"]
    assert full_token

    # 2. Setup MFA -> encrypted at rest in DB
    setup = client.post("/api/v1/auth/mfa/setup", headers={"Authorization": f"Bearer {full_token}"})
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")
    db.refresh(user)
    assert user.mfa_secret != secret
    assert decrypt_secret(user.mfa_secret) == secret

    # 3. Verify with bogus code -> rejected
    real_code = pyotp.TOTP(secret).now()
    bogus = "123456" if real_code != "123456" else "654321"
    bad_ver = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {full_token}"},
        json={"code": bogus},
    )
    assert bad_ver.status_code == 401

    # 4. Verify with real TOTP code -> enables MFA
    ok_ver = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {full_token}"},
        json={"code": real_code},
    )
    assert ok_ver.status_code == 200
    db.refresh(user)
    assert user.is_mfa_enabled is True

    # 5. Subsequent login MUST require MFA and NOT return a full access_token or cookie
    client.cookies.clear()
    login2 = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login2.status_code == 200
    body2 = login2.json()
    assert body2["requires_mfa"] is True
    assert body2["access_token"] == ""
    challenge_token = body2["mfa_challenge_token"]
    assert challenge_token

    # 6. Using mfa_pending challenge token on normal endpoints MUST return 401
    me_rejected = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {challenge_token}"})
    assert me_rejected.status_code == 401
    cases_rejected = client.get("/api/v1/cases", headers={"Authorization": f"Bearer {challenge_token}"})
    assert cases_rejected.status_code == 401

    # 7. Promoting challenge token via /auth/mfa/verify with real TOTP code returns full session JWT
    promote = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {challenge_token}"},
        json={"code": pyotp.TOTP(secret).now()},
    )
    assert promote.status_code == 200
    promoted_token = promote.json()["access_token"]
    assert promoted_token

    # 8. Promoted JWT works on /auth/me
    me_ok = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {promoted_token}"})
    assert me_ok.status_code == 200
    assert me_ok.json()["email"] == email


# ==============================================================================
# 3. AUTH HARDENING, CLIENT BCRYPT LOGIN FIX & MULTI-ORG SAFETY
# ==============================================================================


def test_production_config_validator_rejects_insecure_defaults():
    base_safe = dict(
        environment="production",
        jwt_secret_key="a" * 48,
        database_url="postgresql+psycopg://app:SuperStrongProdPass99@db.internal:5432/doc",
        cors_origins="https://app.documento.io",
        use_local_storage=False,
        object_storage_access_key="prod-access-key-xyz",
        object_storage_secret_key="prod-secret-key-xyz",
        allow_dev_auth_bypass=False,
    )
    # Valid config passes
    Settings(**base_safe)

    # Wildcard CORS rejected
    with pytest.raises(ValueError, match="CORS"):
        Settings(**{**base_safe, "cors_origins": "*"})

    # Local storage rejected
    with pytest.raises(ValueError, match="use_local_storage"):
        Settings(**{**base_safe, "use_local_storage": True})

    # Default MinIO credentials rejected
    with pytest.raises(ValueError, match="MinIO"):
        Settings(**{**base_safe, "object_storage_access_key": "minioadmin"})

    # Dev auth bypass rejected
    with pytest.raises(ValueError, match="allow_dev_auth_bypass"):
        Settings(**{**base_safe, "allow_dev_auth_bypass": True})


def test_jwt_validation_fails_closed_on_missing_roles_org_or_revoked_session(client: TestClient, db: Session):
    org, user, membership = _create_org_and_user(
        db, org_name="JWT Firm", email=f"jwt-{uuid.uuid4().hex[:6]}@firm.com", role_code=RoleCode.CASE_MANAGER.value
    )
    # JWT missing roles -> 401 (never fail open to MASTER_ADMIN)
    token_no_roles = create_access_token(
        {"sub": str(user.id), "org_id": str(org.id), "email": user.email, "roles": []}
    )
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_no_roles}"}).status_code == 401

    # JWT with wrong user's session_id -> 401
    other_user, _ = _add_user_to_org(
        db, org, email=f"other-{uuid.uuid4().hex[:6]}@firm.com", role_code=RoleCode.CASE_WORKER.value
    )
    other_sess = UserSession(
        user_id=other_user.id,
        organization_id=org.id,
        token_hash=f"r-{uuid.uuid4().hex}",
        expires_at=now_utc() + timedelta(hours=1),
    )
    db.add(other_sess)
    db.commit()
    token_mismatched_sess = create_access_token(
        {
            "sub": str(user.id),
            "org_id": str(org.id),
            "email": user.email,
            "roles": [RoleCode.CASE_MANAGER.value],
            "membership_id": str(membership.id),
            "session_id": str(other_sess.id),
        }
    )
    assert (
        client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_mismatched_sess}"}).status_code == 401
    )

    # User with 0 MembershipRole rows cannot log in (403, not fail-open CASE_MANAGER)
    no_role_pwd = "NoRolePass#2026"
    no_role_user = User(
        email=f"norole-{uuid.uuid4().hex[:6]}@firm.com",
        full_name="Zero Role User",
        password_hash=hash_password(no_role_pwd),
        organization_id=org.id,
        status="active",
    )
    db.add(no_role_user)
    db.flush()
    db.add(OrganizationMembership(organization_id=org.id, user_id=no_role_user.id, status="active"))
    db.commit()
    login_zero = client.post("/api/v1/auth/login", json={"email": no_role_user.email, "password": no_role_pwd})
    assert login_zero.status_code == 403


def test_client_creation_uses_bcrypt_and_allows_real_login_and_multi_org_delete_safe(client: TestClient, db: Session):
    org_a, admin_a, _ = _create_org_and_user(
        db, org_name="Client Firm A", email=f"admin-a-{uuid.uuid4().hex[:6]}@firma.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    org_b, _, _ = _create_org_and_user(
        db, org_name="Client Firm B", email=f"admin-b-{uuid.uuid4().hex[:6]}@firmb.com", role_code=RoleCode.MASTER_ADMIN.value
    )

    client_email = f"portal-client-{uuid.uuid4().hex[:6]}@example.com"
    client_pw = "MyTempPortalPass#88"
    create_resp = client.post(
        "/api/v1/clients",
        headers=_headers(org_a.id, admin_a.id, RoleCode.MASTER_ADMIN.value),
        json={
            "first_name": "Aarav",
            "last_name": "Patel",
            "email": client_email,
            "nationality": "IND",
            "create_portal_account": True,
            "temporary_password": client_pw,
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    client_id = create_resp.json()["id"]

    # Client MUST be able to log in via /api/v1/auth/login (was previously broken by SHA-256 hash_opaque_token!)
    login_resp = client.post("/api/v1/auth/login", json={"email": client_email, "password": client_pw})
    assert login_resp.status_code == 200, login_resp.text
    assert login_resp.json()["access_token"]

    # Link same global User to Org B before deleting client in Org A -> global User MUST survive!
    created_user = db.query(User).filter(User.email == client_email).first()
    assert created_user is not None
    db.add(OrganizationMembership(organization_id=org_b.id, user_id=created_user.id, status="active"))
    db.commit()

    del_resp = client.delete(
        f"/api/v1/clients/{client_id}",
        headers=_headers(org_a.id, admin_a.id, RoleCode.MASTER_ADMIN.value),
    )
    assert del_resp.status_code == 200
    assert db.query(User).filter(User.id == created_user.id).first() is not None


# ==============================================================================
# 4. RUNTIME CRASH FIXES + IDOR / RBAC CLOSURES
# ==============================================================================


def test_operations_staff_provision_update_dlq_and_rbac_fixes(client: TestClient, db: Session):
    org_a, admin_a, _ = _create_org_and_user(
        db, org_name="Ops Firm A", email=f"ops-a-{uuid.uuid4().hex[:6]}@ops.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    org_b, admin_b, _ = _create_org_and_user(
        db, org_name="Ops Firm B", email=f"ops-b-{uuid.uuid4().hex[:6]}@ops.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    auditor_a, _ = _add_user_to_org(
        db, org_a, email=f"auditor-{uuid.uuid4().hex[:6]}@ops.com", role_code=RoleCode.AUDITOR.value
    )
    worker_a, _ = _add_user_to_org(
        db, org_a, email=f"worker-{uuid.uuid4().hex[:6]}@ops.com", role_code=RoleCode.CASE_WORKER.value
    )
    hdr_admin_a = _headers(org_a.id, admin_a.id, RoleCode.MASTER_ADMIN.value)
    hdr_auditor_a = _headers(org_a.id, auditor_a.id, RoleCode.AUDITOR.value)
    hdr_worker_a = _headers(org_a.id, worker_a.id, RoleCode.CASE_WORKER.value)

    # 1. Provision staff (previously crashed with AttributeError on User.hashed_password / AuditEvent.actor_user_id)
    staff_email = f"newstaff-{uuid.uuid4().hex[:6]}@ops.com"
    prov_resp = client.post(
        "/api/v1/operations/staff",
        headers=hdr_admin_a,
        json={"full_name": "New Counsel", "email": staff_email, "role_code": "case_manager", "password": "InitPassword#2026"},
    )
    assert prov_resp.status_code == 201, prov_resp.text
    staff_id = prov_resp.json()["id"]

    # Create active session for staff, then reset password via PATCH -> must revoke session & not crash on is_active
    staff_sess = UserSession(
        user_id=uuid.UUID(staff_id),
        organization_id=org_a.id,
        token_hash=f"staff-sess-{uuid.uuid4().hex}",
        expires_at=now_utc() + timedelta(hours=1),
    )
    db.add(staff_sess)
    db.commit()

    upd_resp = client.patch(
        f"/api/v1/operations/staff/{staff_id}",
        headers=hdr_admin_a,
        json={"login_enabled": True, "password": "ResetPassword#2026"},
    )
    assert upd_resp.status_code == 200, upd_resp.text
    db.refresh(staff_sess)
    assert staff_sess.revoked_at is not None

    # 2. Auditor (has security:read, NOT security:manage) blocked from backup drills, key rotation, and DLQ reprocess
    assert client.post("/api/v1/operations/backups/drill", headers=hdr_auditor_a, json={}).status_code == 403
    assert client.post("/api/v1/operations/security/key-rotation", headers=hdr_auditor_a, json={}).status_code == 403

    # 3. Cross-tenant DLQ isolation
    dlq_job_id = f"dlq-{uuid.uuid4().hex[:8]}"
    WorkerHealthMonitor.push_to_dead_letter_queue(
        job_id=dlq_job_id,
        task_name="ocr_extract",
        organization_id=str(org_b.id),
        payload={"doc": "secret"},
        error_message="timeout",
    )
    try:
        health_a = WorkerHealthMonitor.get_system_health(organization_id=str(org_a.id))
        assert health_a["dlq_size"] == 0
        assert client.post(f"/api/v1/operations/dlq/{dlq_job_id}/reprocess", headers=hdr_admin_a).status_code == 404
        assert WorkerHealthMonitor.reprocess_dlq_job(dlq_job_id, organization_id=str(org_a.id)) is None
        assert WorkerHealthMonitor.reprocess_dlq_job(dlq_job_id, organization_id=str(org_b.id)) is not None
    finally:
        WorkerHealthMonitor._dlq.pop(dlq_job_id, None)

    # 4. Case worker blocked from executing case withdrawal / completed-case cleanup
    _, _, case_a = _make_client_and_case(db, org_a, client_email=f"c-{uuid.uuid4().hex[:6]}@ops.com", assigned_user=worker_a)
    assert (
        client.post(
            "/api/v1/operations/scenarios/withdrawal",
            headers=hdr_worker_a,
            json={"case_id": str(case_a.id), "reason": "Unauthorized attempt"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/operations/scenarios/completed-cleanup",
            headers=hdr_worker_a,
            json={"case_id": str(case_a.id)},
        ).status_code
        == 403
    )


def test_requests_templates_route_not_shadowed_and_client_draft_isolation(client: TestClient, db: Session):
    org, admin, _ = _create_org_and_user(
        db, org_name="Req Firm", email=f"req-admin-{uuid.uuid4().hex[:6]}@firm.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    client_user, _, case = _make_client_and_case(db, org, client_email=f"req-c-{uuid.uuid4().hex[:6]}@firm.com")

    # GET /requests/templates MUST return 200 (not 422 UUID parse error from /{request_id})
    tpl_resp = client.get("/api/v1/requests/templates", headers=_headers(org.id, admin.id, RoleCode.MASTER_ADMIN.value))
    assert tpl_resp.status_code == 200, tpl_resp.text
    assert isinstance(tpl_resp.json(), list)

    # Draft document request MUST NOT be readable by retained client
    draft_req = DocumentRequest(
        organization_id=org.id,
        case_id=case.id,
        requested_from_client_id=case.client_id,
        requested_by_user_id=admin.id,
        title="Internal Draft Request",
        description="Draft description",
        rationale="Internal rationale",
        status="draft",
    )
    db.add(draft_req)
    db.commit()

    client_get = client.get(
        f"/api/v1/requests/{draft_req.id}",
        headers=_headers(org.id, client_user.id, RoleCode.RETAINED_CLIENT.value),
    )
    assert client_get.status_code == 403


def test_analytics_service_tenant_scoping_and_no_attribute_error(db: Session):
    org_a, admin_a, _ = _create_org_and_user(
        db, org_name="Analytics A", email=f"an-a-{uuid.uuid4().hex[:6]}@a.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    org_b, admin_b, _ = _create_org_and_user(
        db, org_name="Analytics B", email=f"an-b-{uuid.uuid4().hex[:6]}@b.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    _, _, case_a = _make_client_and_case(db, org_a, client_email=f"ca-{uuid.uuid4().hex[:6]}@a.com", assigned_user=admin_a)
    _, _, case_b = _make_client_and_case(db, org_b, client_email=f"cb-{uuid.uuid4().hex[:6]}@b.com", assigned_user=admin_b)

    # Add CaseTask in Org B and verify Org A workload doesn't leak Org B's staff/tasks
    db.add(CaseTask(organization_id=org_b.id, case_id=case_b.id, title="Secret B Task", assigned_to_user_id=admin_b.id))
    # Add FormSubmission + FilingPackage in Org A to verify no AttributeError on f.form_code / p.version
    schema = FormSchema(
        organization_id=org_a.id,
        form_code="IMM0008",
        name="Generic Application",
        jurisdiction="CA",
        pathway="Express Entry",
    )
    db.add(schema)
    db.flush()
    schema_ver = FormSchemaVersion(schema_id=schema.id, version_number="v1", schema_json={})
    db.add(schema_ver)
    db.flush()
    db.add(
        FormSubmission(
            organization_id=org_a.id,
            case_id=case_a.id,
            form_schema_version_id=schema_ver.id,
            status="pending_review",
        )
    )
    db.add(
        FilingPackage(
            organization_id=org_a.id,
            case_id=case_a.id,
            name="Binder v1",
            version_number="v1.0.0",
            package_hash="abc123",
            status="in_review",
        )
    )
    db.commit()

    # Dashboard metrics must strictly scope CaseAssignment & CaseTask to org_a (zero leak from org_b)
    dash_a = ExecutiveDashboardService.get_dashboard_metrics(db, org_a.id)
    assert all(w["user_id"] != str(admin_b.id) for w in dash_a.get("staff_workload", []))

    # Priority queue exercises FormSubmission.schema_version.schema.form_code, FilingPackage.version_number,
    # org-scoped Rank 2 staff allocation, and DB-backed Rank 8 turnaround metrics without crashing
    queue_a = ExecutiveDashboardService.get_manager_priority_queue(db, org_a.id)
    ranks_by_num = {r["rank"]: r for r in queue_a["ranks"]}
    assert all(s["user_id"] != str(admin_b.id) for s in ranks_by_num[2]["staff_allocation"])
    pending_titles = [item["title"] for item in ranks_by_num[5]["items"]]
    assert any("IMM0008" in t for t in pending_titles)
    assert any("v1.0.0" in t for t in pending_titles)
    perf_a = ranks_by_num[8]["metrics"]
    assert perf_a["median_turnaround_hours"] != 18.5


def test_idor_and_rbac_closures_across_packages_forms_appointments_cases_messaging_governance_foundation_firm_config_notifications(
    client: TestClient, db: Session
):
    org_a, admin_a, _ = _create_org_and_user(
        db, org_name="Guard Firm A", email=f"ga-{uuid.uuid4().hex[:6]}@a.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    org_b, admin_b, _ = _create_org_and_user(
        db, org_name="Guard Firm B", email=f"gb-{uuid.uuid4().hex[:6]}@b.com", role_code=RoleCode.MASTER_ADMIN.value
    )
    worker_a, _ = _add_user_to_org(
        db, org_a, email=f"wk-{uuid.uuid4().hex[:6]}@a.com", role_code=RoleCode.CASE_WORKER.value
    )
    client1, _, case1 = _make_client_and_case(db, org_a, client_email=f"c1-{uuid.uuid4().hex[:6]}@a.com", assigned_user=worker_a)
    client2, _, case2 = _make_client_and_case(db, org_a, client_email=f"c2-{uuid.uuid4().hex[:6]}@a.com")

    hdr_c1 = _headers(org_a.id, client1.id, RoleCode.RETAINED_CLIENT.value)
    hdr_c2 = _headers(org_a.id, client2.id, RoleCode.RETAINED_CLIENT.value)
    hdr_worker = _headers(org_a.id, worker_a.id, RoleCode.CASE_WORKER.value)
    hdr_admin_a = _headers(org_a.id, admin_a.id, RoleCode.MASTER_ADMIN.value)

    # 1. Packages: Client 2 cannot access Client 1's package; Client 1 cannot approve legal stages 1-7
    pkg = FilingPackage(
        organization_id=org_a.id,
        case_id=case1.id,
        name="Case 1 Package",
        version_number="v1.0.0",
        package_hash="hash1",
        status="pending_approval",
        manifest_json={"items": [], "excluded_items": [], "folders": []},
        approval_chain_json=[{"stage": "authorized_staff_review", "status": "pending"}],
    )
    db.add(pkg)
    db.commit()

    assert client.get(f"/api/v1/packages/{pkg.id}", headers=hdr_c2).status_code == 403
    assert client.get(f"/api/v1/packages/{pkg.id}/manifest", headers=hdr_c2).status_code == 403
    assert client.get(f"/api/v1/packages/{pkg.id}/report", headers=hdr_c2).status_code == 403
    assert client.get(f"/api/v1/packages/cases/{case1.id}/interim-report", headers=hdr_c2).status_code == 403
    assert (
        client.post(
            f"/api/v1/packages/{pkg.id}/approval",
            headers=hdr_c1,
            json={"stage": "authorized_staff_review", "decision": "approved"},
        ).status_code
        == 403
    )

    # 2. Forms: Client 2 cannot read Client 1's form submissions
    assert client.get(f"/api/v1/forms/cases/{case1.id}/submissions", headers=hdr_c2).status_code == 403

    # 3. Appointments & Sponsors & Reassign & Lifecycle Gates in cases.py / appointments.py
    appt = VisaAppointment(
        organization_id=org_a.id,
        case_id=case1.id,
        client_id=case1.client_id,
        vac_center="Mumbai VAC",
        consular_post="US Consulate Mumbai",
    )
    db.add(appt)
    db.commit()

    assert client.get(f"/api/v1/appointments/{appt.id}", headers=hdr_c2).status_code == 403
    assert client.get(f"/api/v1/cases/{case1.id}/appointments", headers=hdr_c2).status_code == 403
    assert client.get(f"/api/v1/cases/{case1.id}/sponsors", headers=hdr_c2).status_code == 403

    # Reassigning Org A case to Org B user MUST fail (404)
    assert (
        client.post(
            f"/api/v1/cases/{case1.id}/lifecycle/reassign",
            headers=hdr_admin_a,
            json={"new_user_id": str(admin_b.id), "role_in_case": "case_manager"},
        ).status_code
        == 404
    )
    # Case worker cannot clear payment or sign lawyer review or approve submission
    assert (
        client.put(
            f"/api/v1/cases/{case1.id}/lifecycle/payment-clearance",
            headers=hdr_worker,
            json={"payment_status": "PAID"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/cases/{case1.id}/progressive-review",
            headers=hdr_worker,
            json={"stage": "lawyer_review", "outcome": "APPROVED"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/cases/{case1.id}/submission-authorization",
            headers=hdr_worker,
            json={"action": "APPROVE"},
        ).status_code
        == 403
    )

    # 4. Messaging: Retained client cannot mark internal note read OR call delivery webhook
    thread = MessageThread(
        organization_id=org_a.id, case_id=case1.id, subject="Chat", channel_category="client", status="open"
    )
    db.add(thread)
    db.flush()
    internal_msg = Message(
        organization_id=org_a.id,
        thread_id=thread.id,
        sender_id=admin_a.id,
        content="Internal attorney warning",
        is_internal=True,
    )
    db.add(internal_msg)
    db.commit()

    assert client.patch(f"/api/v1/messaging/messages/{internal_msg.id}/read", headers=hdr_c1).status_code == 403
    assert (
        client.post(
            f"/api/v1/messaging/messages/{internal_msg.id}/delivery-webhook",
            headers=hdr_c1,
            json={"delivery_status": "delivered"},
        ).status_code
        == 403
    )

    # 5. Governance, Foundation audit-events, Firm Config, and Notifications cross-org target
    assert client.get("/api/v1/governance/cohorts", headers=hdr_c1).status_code == 403
    assert (
        client.post(
            "/api/v1/governance/kpis/quick-calc",
            headers=hdr_c1,
            json={"baseline_workflow_hours": 10.0, "documento_workflow_hours": 2.0},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/foundation/audit-events",
            headers=hdr_c1,
            json={"action": "forged.event", "object_type": "case", "object_id": str(case1.id)},
        ).status_code
        == 403
    )
    assert client.get("/api/v1/firm-config", headers=hdr_c1).status_code == 403
    assert client.get("/api/v1/firm-config/audit-log", headers=hdr_c1).status_code == 403
    assert client.get("/api/v1/firm-config/audit-log", headers=hdr_worker).status_code == 403
    # Notifications: cannot target user from Org B; retained client cannot create notification
    assert (
        client.post(
            "/api/v1/notifications",
            headers=hdr_admin_a,
            json={"user_id": str(admin_b.id), "title": "Cross Org", "body": "Cross org spam"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/notifications",
            headers=hdr_c1,
            json={"user_id": str(admin_a.id), "title": "Client Spam", "body": "Client spam body"},
        ).status_code
        == 403
    )


# ==============================================================================
# 5. RATE LIMITER, SECURITY HEADERS, LOGGING, METRICS, HEALTH, DB POOL
# ==============================================================================


def test_security_headers_csp_permissions_and_health_exemptions(client: TestClient):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert "content-security-policy" in resp.headers
    assert "permissions-policy" in resp.headers


def test_rate_limiter_enforced_in_non_test_and_ignores_spoofed_xff(client: TestClient):
    settings = get_settings()
    orig_env = settings.environment
    orig_proxies = settings.trusted_proxy_ips
    try:
        settings.environment = "production"
        settings.trusted_proxy_ips = ""
        _reset_rate_limiter()

        # Auth rate limit is 20/min; spoofing X-Forwarded-For (or testclient) MUST NOT bypass it in production
        hit_429 = False
        for i in range(25):
            spoofed = "testclient" if i == 21 else f"203.0.113.{i}"
            r = client.post(
                "/api/v1/auth/login",
                headers={"X-Forwarded-For": spoofed},
                json={"email": "nobody@example.com", "password": "wrong"},
            )
            if r.status_code == 429:
                hit_429 = True
                break
        assert hit_429, "Spoofed X-Forwarded-For must not bypass auth rate limit"

        # Health liveness/readiness probes must remain exempt even when IP is rate limited
        assert client.get("/api/v1/health/live").status_code == 200
    finally:
        settings.environment = orig_env
        settings.trusted_proxy_ips = orig_proxies
        _reset_rate_limiter()


def test_logging_pii_scrubber_and_non_serializable_objects():
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="security.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Failed login for alice@example.com SSN 123-45-6789 PAN ABCDE1234F",
        args=(),
        exc_info=None,
    )
    record.custom_uuid = uuid.uuid4()
    record.secret_note = "Passport Z9876543 email bob@firm.org"
    formatted = formatter.format(record)
    parsed = json.loads(formatted)
    assert "alice@example.com" not in parsed["message"]
    assert "123-45-6789" not in parsed["message"]
    assert "ABCDE1234F" not in parsed["message"]
    assert "bob@firm.org" not in parsed["secret_note"]
    assert "[REDACTED" in redact_pii_text("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature123456")


def test_metrics_label_escaping_unmatched_collapse_and_prod_guard(client: TestClient):
    assert _escape_prom_label('bad"label\n\\x') == 'bad\\"label\\n\\\\x'

    reg = MetricsCollector()
    reg.record_http_request("GET", "/__unmatched__", 404, 0.005)
    prom = reg.generate_prometheus_text()
    assert 'endpoint="/__unmatched__"' in prom
    assert "documento_active_db_connections 0" in prom

    settings = get_settings()
    orig_env = settings.environment
    orig_tok = settings.metrics_bearer_token
    try:
        settings.environment = "production"
        settings.metrics_bearer_token = "super-secret-scrape-token"
        assert client.get("/metrics").status_code == 401
        ok = client.get("/metrics", headers={"Authorization": "Bearer super-secret-scrape-token"})
        assert ok.status_code == 200
        assert "http_requests_total" in ok.text
    finally:
        settings.environment = orig_env
        settings.metrics_bearer_token = orig_tok


def test_health_ready_masks_internal_db_error(client: TestClient):
    from backend.app.db.session import get_db

    class _FailingSession:
        def execute(self, *_args, **_kwargs):
            raise RuntimeError("password=TopSecretDbCreds")

    orig = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = lambda: _FailingSession()
    try:
        resp = client.get("/api/v1/health/ready")
        assert resp.status_code == 503
        assert "TopSecretDbCreds" not in resp.text
    finally:
        if orig is not None:
            app.dependency_overrides[get_db] = orig
        else:
            app.dependency_overrides.pop(get_db, None)


def test_sqlite_foreign_keys_pragma_enabled():
    from backend.app.db.session import _create_configured_engine

    eng = _create_configured_engine("sqlite:///:memory:")
    try:
        with eng.connect() as conn:
            fk_on = conn.execute(text("PRAGMA foreign_keys")).scalar()
            assert fk_on == 1
    finally:
        eng.dispose()
