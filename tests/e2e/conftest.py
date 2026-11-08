import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Isolated temp storage for E2E tests
TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="documento_e2e_storage_")
os.environ["DOCUMENT_STORAGE_DIR"] = TEST_STORAGE_DIR
os.environ["USE_LOCAL_STORAGE"] = "true"

from backend.app.core.config import get_settings
get_settings.cache_clear()
settings = get_settings()
settings.document_storage_dir = TEST_STORAGE_DIR
settings.use_local_storage = True

from backend.app.main import app
from backend.app.db.base import Base
from backend.app.db.session import get_db
import backend.app.db.session as db_session_module
from backend.app.domain.models import (
    Organization,
    User,
    OrganizationMembership,
    Role,
    MembershipRole,
    Session as UserSession,
    ClientProfile,
    ImmigrationCase,
)
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import create_access_token

# Shared in-memory SQLite engine for all E2E tests
E2E_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
E2ESessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=E2E_ENGINE)
db_session_module.SessionLocal = E2ESessionLocal


@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    """Create all tables once for the E2E test session."""
    Base.metadata.create_all(bind=E2E_ENGINE)
    yield
    Base.metadata.drop_all(bind=E2E_ENGINE)
    if os.path.exists(TEST_STORAGE_DIR):
        shutil.rmtree(TEST_STORAGE_DIR, ignore_errors=True)


@pytest.fixture(autouse=True)
def clean_database():
    """Ensure database is pristine before each E2E test."""
    with E2E_ENGINE.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF;"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.execute(text("PRAGMA foreign_keys = ON;"))
    yield


@pytest.fixture
def db():
    """Provide a clean transactional session for an E2E test."""
    session = E2ESessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Provide a FastAPI TestClient with get_db overridden to use test session."""
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def auth_factory(db):
    """Factory fixture to create organizations, users, and generate valid Bearer tokens and headers."""
    def _create_user_and_auth(
        email: str,
        role_code: RoleCode | str = RoleCode.MASTER_ADMIN,
        org_name: str = "Test Firm",
        org_slug: str | None = None,
        existing_org: Organization | None = None,
        full_name: str = "Test User",
        password: str = "SecurePassword123!",
    ):
        if existing_org:
            org = existing_org
        else:
            slug = org_slug or f"firm-{uuid.uuid4().hex[:6]}"
            org = Organization(name=org_name, slug=slug, status="active")
            db.add(org)
            db.flush()

        role_str = role_code.value if hasattr(role_code, "value") else str(role_code)
        role = db.query(Role).filter(Role.code == role_str).first()
        if not role:
            role = Role(code=role_str, name=role_str.replace("_", " ").title())
            db.add(role)
            db.flush()

        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
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

        db.add(MembershipRole(
            membership_id=membership.id,
            role_id=role.id,
            assigned_at=datetime.now(timezone.utc),
        ))
        db.commit()

        # Generate standard access token
        token_payload = {
            "sub": str(user.id),
            "org_id": str(org.id),
            "email": user.email,
            "roles": [role_str],
            "membership_id": str(membership.id),
        }
        token = create_access_token(data=token_payload)
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": str(org.id),
            "X-User-Id": str(user.id),
            "X-User-Role": role_str,
        }
        return {
            "org": org,
            "user": user,
            "membership": membership,
            "role": role,
            "token": token,
            "headers": headers,
            "password": password,
        }

    return _create_user_and_auth


@pytest.fixture
def two_tenants(auth_factory, db):
    """Pre-provision two distinct tenants for boundary and multi-tenancy verification."""
    tenant_a = auth_factory(
        email="owner@apex-immigration.com",
        role_code=RoleCode.MASTER_ADMIN,
        org_name="Apex Immigration Legal",
        org_slug="apex-immigration",
        full_name="Apex Owner",
    )
    worker_a = auth_factory(
        email="worker@apex-immigration.com",
        role_code=RoleCode.CASE_WORKER,
        existing_org=tenant_a["org"],
        full_name="Apex Caseworker",
    )

    tenant_b = auth_factory(
        email="owner@beacon-visas.com",
        role_code=RoleCode.MASTER_ADMIN,
        org_name="Beacon Global Visas",
        org_slug="beacon-visas",
        full_name="Beacon Owner",
    )
    worker_b = auth_factory(
        email="worker@beacon-visas.com",
        role_code=RoleCode.CASE_WORKER,
        existing_org=tenant_b["org"],
        full_name="Beacon Caseworker",
    )

    # Add a sample client and case to Tenant A
    client_a = ClientProfile(
        organization_id=tenant_a["org"].id,
        first_name="John",
        last_name="Doe",
        email="johndoe@example.com",
        phone="+1-555-0199",
        nationality="CAN",
    )
    db.add(client_a)
    db.flush()

    case_a = ImmigrationCase(
        organization_id=tenant_a["org"].id,
        client_id=client_a.id,
        case_number="CASE-APEX-001",
        title="John Doe Express Entry PR",
        jurisdiction="CA",
        visa_category="Express Entry",
        status="intake",
    )
    db.add(case_a)

    # Add a sample client and case to Tenant B
    client_b = ClientProfile(
        organization_id=tenant_b["org"].id,
        first_name="Rajesh",
        last_name="Sharma",
        email="rajesh@example.in",
        phone="+91-9876543210",
        nationality="IND",
    )
    db.add(client_b)
    db.flush()

    case_b = ImmigrationCase(
        organization_id=tenant_b["org"].id,
        client_id=client_b.id,
        case_number="CASE-BCN-001",
        title="Rajesh Sharma UK Skilled Worker",
        jurisdiction="GB",
        visa_category="Skilled Worker",
        status="intake",
    )
    db.add(case_b)
    db.commit()

    return {
        "tenant_a": tenant_a,
        "worker_a": worker_a,
        "client_a": client_a,
        "case_a": case_a,
        "tenant_b": tenant_b,
        "worker_b": worker_b,
        "client_b": client_b,
        "case_b": case_b,
    }
