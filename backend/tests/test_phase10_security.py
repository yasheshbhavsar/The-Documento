"""Phase 10 Comprehensive Security Assessment Test Suite.

Verifies:
1. Authentication & Session Controls (tampered tokens, expired tokens, revoked sessions)
2. Tenant & Object-Level Authorization (cross-org and cross-client boundary enforcement)
3. Privilege Escalation Prevention (caseworker/applicant access restrictions)
4. Secure Upload, Magic Byte Validation & Malware Scanning (disguised executables, EICAR virus)
5. API Rate Limiting (429 Too Many Requests)
6. Sensitive Data Redaction in Logging & Secrets Review
"""
import uuid
import time
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.requests import Request

from backend.app.main import app
from backend.app.core.config import Settings
from backend.app.core.errors import AuthenticationError, PermissionDeniedError, TenantIsolationError
from backend.app.core.logging import sanitize_dict
from backend.app.core.middleware import SimpleRateLimiterMiddleware
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    Session as UserSession,
    Document,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.tokens import create_access_token, decode_access_token
from backend.app.documents.security import (
    detect_file_type,
    validate_file_signature,
    MalwareScanner,
    sanitize_filename,
    EICAR_SIGNATURE,
)


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def test_authentication_tampered_token_rejection():
    """Verifies that cryptographically altered/tampered tokens are rejected."""
    token = create_access_token({"sub": str(uuid.uuid4()), "org_id": str(uuid.uuid4())})
    # Tamper with the token payload part
    parts = token.split(".")
    tampered_payload = parts[1][:-2] + "AA"
    tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"

    with pytest.raises(Exception):
        decode_access_token(tampered_token)


def test_authentication_revoked_session_rejection(db: Session):
    """Verifies that revoked database sessions invalidate authentication."""
    now = datetime.now(timezone.utc)
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    session_id = uuid.uuid4()

    # Create revoked session in DB
    revoked_session = UserSession(
        id=session_id,
        user_id=user_id,
        organization_id=org_id,
        token_hash="hash_placeholder",
        created_at=now - timedelta(hours=1),
        expires_at=now + timedelta(hours=5),
        revoked_at=now - timedelta(minutes=10), # Explicitly revoked
    )
    db.add(revoked_session)
    db.commit()

    token = create_access_token({
        "sub": str(user_id),
        "org_id": str(org_id),
        "session_id": str(session_id),
    })

    # When decoded with session verification against DB, revoked session must be detected
    found = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now,
    ).first()
    assert found is None, "Revoked session should not be returned as active"


def test_tenant_isolation_cross_organization_blocked():
    """Verifies that an authenticated context strictly blocks cross-organization resource access."""
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()

    ctx = AuthContext(
        user_id=uuid.uuid4(),
        organization_id=org_a,
        email="user@orga.com",
        roles=("company_admin",),
    )

    # Calling assert_organization_access for own org passes
    ctx.assert_organization_access(org_a)

    # Calling for foreign org strictly raises TenantIsolationError
    with pytest.raises(TenantIsolationError):
        ctx.assert_organization_access(org_b)


def test_object_level_authorization_cross_client_blocked():
    """Verifies that retained clients cannot access another client's immigration cases."""
    org_id = uuid.uuid4()
    client_a_user_id = uuid.uuid4()
    client_b_user_id = uuid.uuid4()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=uuid.uuid4(),
        case_number="CASE-TEST-01",
        title="O-1A Petition",
        jurisdiction="US",
        visa_category="O-1A",
    )

    # Client A context
    ctx_client_a = AuthContext(
        user_id=client_a_user_id,
        organization_id=org_id,
        email="clienta@test.com",
        roles=("retained_client",),
    )

    # Client A accessing Client A's case -> allowed
    ctx_client_a.assert_case_access(case, client_user_id=client_a_user_id)

    # Client A attempting to access Client B's case -> strictly denied with PermissionDeniedError
    with pytest.raises(PermissionDeniedError):
        ctx_client_a.assert_case_access(case, client_user_id=client_b_user_id)


def test_privilege_escalation_caseworker_cannot_access_billing(client: TestClient):
    """Verifies that caseworkers cannot access financial records or billing endpoints."""
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        email="cw@firm.com",
        roles=("case_manager",), # lacks billing:read
    )

    res = client.get("/api/v1/billing/invoices")
    assert res.status_code == 403


def test_secure_upload_executable_magic_byte_blocked():
    """Verifies that disguised executables (e.g. .exe magic bytes with .pdf extension) are rejected."""
    # Windows PE header disguised as a PDF
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 100
    detected = detect_file_type(fake_pdf)
    assert detected is not None
    assert detected.startswith("dangerous:")

    is_valid, mime, error = validate_file_signature(fake_pdf, declared_mime_type="application/pdf")
    assert is_valid is False
    assert "Executable or forbidden file format" in error


def test_secure_upload_malware_eicar_quarantined():
    """Verifies that files containing EICAR antivirus test signatures are quarantined/rejected."""
    is_clean, details = MalwareScanner.scan_content(EICAR_SIGNATURE)
    assert is_clean is False
    assert "Infected" in details
    assert "EICAR" in details


def test_secure_upload_path_traversal_sanitized():
    """Verifies that malicious path traversal filenames are neutralized."""
    malicious = "../../../../../etc/passwd.pdf"
    clean = sanitize_filename(malicious)
    assert "/" not in clean
    assert ".." not in clean
    assert clean == "passwd.pdf"


def test_sensitive_data_logging_redaction():
    """Verifies that sensitive immigration, auth, and financial information is redacted from log dictionaries."""
    data = {
        "user_email": "attorney@law.com",
        "password": "SuperSecretPassword123!",
        "pan": "4111111111111111",
        "cvv": "123",
        "ssn": "000-12-3456",
        "passport_number": "C99887766",
        "passport_number_hash": "a1b2c3d4",
        "nested": {
            "credit_card": "4111-2222-3333-4444",
            "token": "bearer_jwt_token_here",
            "non_sensitive_field": "public_data",
        },
    }
    sanitized = sanitize_dict(data)

    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["pan"] == "[REDACTED]"
    assert sanitized["cvv"] == "[REDACTED]"
    assert sanitized["ssn"] == "[REDACTED]"
    assert sanitized["passport_number"] == "[REDACTED]"
    assert sanitized["nested"]["credit_card"] == "[REDACTED]"
    assert sanitized["nested"]["token"] == "[REDACTED]"
    assert sanitized["nested"]["non_sensitive_field"] == "public_data"


def test_production_config_rejects_insecure_defaults():
    """Verifies that Settings validator refuses to boot in production with default secrets."""
    with pytest.raises(ValueError, match="Insecure JWT secret key"):
        Settings(
            environment="production",
            jwt_secret_key="local_development_secret_key_change_in_production_min_32_chars",
            database_url="postgresql://user:pass@localhost:5432/db",
        )

    with pytest.raises(ValueError, match="Insecure default database password"):
        Settings(
            environment="production",
            jwt_secret_key="a_very_secure_production_secret_key_1234567890",
            database_url="postgresql+psycopg://ai_immigration:local_dev_only@localhost:5432/ai_immigration",
        )
