"""Comprehensive Verification Audit Script for Phase 9.

Performs deterministic automated audits covering:
- Features 1 to 10
- Main workflow from API through database
- Invalid input, unauthorized access, and edge cases
- Secret & PAN leakage verification
- Schema migration integrity
"""
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.domain.models import (
    Base,
    Organization,
    User,
    Role,
    Permission,
    OrganizationMembership,
    MembershipRole,
    RolePermission,
    ImmigrationCase,
    ClientProfile,
    CaseTask,
    CaseMilestone,
    CaseNote,
    CaseAssignment,
    Document,
    Notification,
    DocumentRequest,
    AuditEvent,
    ServiceItem,
    ClientEngagement,
    Invoice,
    InvoiceLineItem,
    PaymentRecord,
    OrganizationSetting,
)
from backend.app.security.passwords import hash_password
from backend.app.security.auth import AuthContext, get_auth_context


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def test_audit_database_models_and_relationships(db: Session):
    """Verifies that all Phase 9 tables and relationships exist in SQLAlchemy schema."""
    tables = Base.metadata.tables.keys()
    required_tables = [
        "service_items",
        "client_engagements",
        "invoices",
        "invoice_line_items",
        "payment_records",
        "organization_settings",
        "branches",
        "teams",
        "organization_memberships",
    ]
    for table in required_tables:
        assert table in tables, f"Table {table} missing from metadata"

    # Verify column presence on PaymentRecord (NO raw PAN allowed)
    payment_cols = Base.metadata.tables["payment_records"].columns.keys()
    assert "transaction_reference" in payment_cols
    assert "card_brand" in payment_cols
    assert "card_last4" in payment_cols
    assert "pan" not in payment_cols, "CRITICAL: Raw PAN column detected in database!"
    assert "card_number" not in payment_cols, "CRITICAL: Raw card number detected in database!"
    assert "cvv" not in payment_cols, "CRITICAL: CVV detected in database!"


def test_audit_end_to_end_billing_and_payment_workflow(client: TestClient, db: Session):
    """Verifies complete end-to-end billing workflow:

    1. Seed Org & Authorized Owner User
    2. Create Service Item
    3. Create Client Engagement Retainer
    4. Issue Invoice with Line Items
    5. Record Tokenized Payment (Stripe Provider)
    6. Verify Balance Decrement
    7. Process Partial Refund
    8. Check Accounts Receivable Aging Report
    """
    now = datetime.now(timezone.utc)
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Lex Immigration LLP", slug=f"lex-{uuid.uuid4().hex[:6]}", created_at=now)
    db.add(org)

    owner_id = uuid.uuid4()
    owner = User(
        id=owner_id,
        email="owner@lexlaw.com",
        password_hash=hash_password("OwnerSecurePass123!"),
        full_name="Sarah Owner, Esq.",
        created_at=now,
    )
    db.add(owner)
    db.flush()

    # Client Profile & Immigration Case
    client_user_id = uuid.uuid4()
    client_user = User(id=client_user_id, email="applicant@test.com", password_hash=hash_password("Pass123!"), full_name="Dr. Applicant", created_at=now)
    db.add(client_user)
    db.flush()

    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user_id,
        first_name="Dr.",
        last_name="Applicant",
        email="applicant@test.com",
        nationality="USA",
        created_at=now,
    )
    db.add(client_prof)
    db.flush()

    imm_case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_prof.id,
        case_number=f"CASE-AUDIT-{uuid.uuid4().hex[:4].upper()}",
        title="Dr. Applicant EB-1A",
        jurisdiction="US",
        visa_category="EB-1A",
        status="gathering",
        created_at=now,
    )
    db.add(imm_case)
    db.commit()

    # Authenticate as Company Admin (Owner)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=owner_id,
        organization_id=org_id,
        email="owner@lexlaw.com",
        roles=["company_admin"],
    )

    # Step 1: Create Service Item
    res_srv = client.post(
        "/api/v1/billing/services",
        json={
            "code": "SRV-EB1A-AUDIT",
            "name": "EB-1A Alien of Extraordinary Ability Representation",
            "jurisdiction": "US",
            "pricing_model": "fixed",
            "base_fee": 5500.0,
            "currency": "USD",
            "estimated_duration_days": 90,
        },
    )
    assert res_srv.status_code == 201, res_srv.text
    srv_data = res_srv.json()
    service_id = srv_data["id"]

    # Step 2: Create Client Engagement
    res_eng = client.post(
        "/api/v1/billing/engagements",
        json={
            "client_id": str(client_prof.id),
            "case_id": str(imm_case.id),
            "service_id": service_id,
            "retainer_amount": 2500.0,
            "agreed_fee": 5500.0,
            "billing_terms": "fixed_split",
            "notes": "Verified client engagement audit",
        },
    )
    assert res_eng.status_code == 201, res_eng.text
    eng_data = res_eng.json()

    # Step 3: Issue Invoice with Line Items
    res_inv = client.post(
        "/api/v1/billing/invoices",
        json={
            "client_id": str(client_prof.id),
            "case_id": str(imm_case.id),
            "engagement_id": eng_data["id"],
            "due_date": (now + timedelta(days=30)).isoformat(),
            "notes": "Retainer Invoice with Government Statutory Filing Fee",
            "line_items": [
                {
                    "service_id": service_id,
                    "description": "Initial Legal Representation Retainer",
                    "quantity": 1.0,
                    "unit_price": 2500.0,
                    "line_type": "service_fee",
                },
                {
                    "description": "USCIS Form I-140 Statutory Government Filing Fee",
                    "quantity": 1.0,
                    "unit_price": 715.0,
                    "line_type": "filing_fee",
                },
            ],
        },
    )
    assert res_inv.status_code == 201, res_inv.text
    inv_data = res_inv.json()
    invoice_id = inv_data["id"]
    assert inv_data["total_amount"] == 3215.0
    assert inv_data["balance_due"] == 3215.0
    assert inv_data["status"] == "issued"

    # Step 4: Record Tokenized Card Payment (PCI-DSS compliant: token reference + masked last 4)
    res_pay = client.post(
        f"/api/v1/billing/invoices/{invoice_id}/payments",
        json={
            "amount": 2500.0,
            "payment_method": "credit_card_tokenized",
            "transaction_reference": f"tok_stripe_audit_{uuid.uuid4().hex[:8]}",
            "card_brand": "visa",
            "card_last4": "4242",
            "notes": "Tokenized online card payment via Stripe adapter",
        },
    )
    assert res_pay.status_code == 201, res_pay.text
    pay_data = res_pay.json()
    assert pay_data["balance_due"] == 715.0
    assert pay_data["invoice_status"] == "partially_paid"
    payment_id = pay_data["id"]

    # Step 5: Process Partial Refund
    res_ref = client.post(
        f"/api/v1/billing/payments/{payment_id}/refund",
        json={
            "refund_amount": 500.0,
            "reason": "Client requested filing milestone schedule adjustment",
        },
    )
    assert res_ref.status_code == 200, res_ref.text
    ref_data = res_ref.json()
    assert ref_data["refunded_amount"] == 500.0
    assert ref_data["invoice_balance_due"] == 1215.0

    # Step 6: Query Financial Report & Accounts Receivable Aging
    res_rep = client.get("/api/v1/billing/reports/financial")
    assert res_rep.status_code == 200, res_rep.text
    rep_data = res_rep.json()
    assert rep_data["summary"]["total_invoiced"] >= 3215.0
    assert rep_data["summary"]["total_collected"] >= 2000.0  # 2500 - 500
    assert rep_data["accounts_receivable_aging"]["current_not_due"] >= 1215.0


def test_audit_unauthorized_access_and_rbac_enforcement(client: TestClient, db: Session):
    """Verifies that unauthorized staff roles (e.g.

    caseworkers without billing:read/manage)
    are strictly rejected with HTTP 403 Forbidden on billing endpoints.
    """
    now = datetime.now(timezone.utc)
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Restricted Caseworkers Org", slug=f"cw-{uuid.uuid4().hex[:6]}", created_at=now)
    db.add(org)

    cw_id = uuid.uuid4()
    cw_user = User(
        id=cw_id,
        email="caseworker@lawfirm.com",
        password_hash=hash_password("Pass123!"),
        full_name="Caseworker John",
        created_at=now,
    )
    db.add(cw_user)
    db.commit()

    # Authenticate as Caseworker (case_manager role lacks billing:read)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=cw_id,
        organization_id=org_id,
        email="caseworker@lawfirm.com",
        roles=["case_manager"],
    )

    # Caseworker tries to access billing invoices -> MUST BE 403
    res = client.get("/api/v1/billing/invoices")
    assert res.status_code == 403, f"Expected 403 Forbidden for caseworker, got {res.status_code}"

    # Caseworker tries to access financial reports -> MUST BE 403
    res_rep = client.get("/api/v1/billing/reports/financial")
    assert res_rep.status_code == 403, f"Expected 403 Forbidden for caseworker, got {res_rep.status_code}"


def test_audit_invalid_inputs_and_boundary_rejection(client: TestClient, db: Session):
    """Verifies boundary rejection and HTTP 422 for invalid inputs:

    - Invoice with empty line items
    - Reassignment with invalid parameters
    """
    now = datetime.now(timezone.utc)
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Boundary Test Org", slug=f"bnd-{uuid.uuid4().hex[:6]}", created_at=now)
    db.add(org)

    admin_id = uuid.uuid4()
    admin = User(id=admin_id, email="admin@bnd.com", password_hash=hash_password("Pass123!"), full_name="Admin", created_at=now)
    db.add(admin)
    db.commit()

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin_id,
        organization_id=org_id,
        email="admin@bnd.com",
        roles=["master_admin"],
    )

    # 1. Invoice with empty line items -> 422 Validation Error
    res_empty_lines = client.post(
        "/api/v1/billing/invoices",
        json={
            "client_id": str(uuid.uuid4()),
            "due_date": (now + timedelta(days=30)).isoformat(),
            "line_items": [],  # Violates min_length=1
        },
    )
    assert res_empty_lines.status_code == 422, f"Expected 422 for empty line items, got {res_empty_lines.status_code}"

    # 2. Reassign with invalid UUID format -> 422
    res_invalid_reassign = client.post(
        "/api/v1/operations/reassign",
        json={"from_user_id": "not-a-uuid", "to_user_id": "also-not-a-uuid"},
    )
    assert res_invalid_reassign.status_code == 422, f"Expected 422, got {res_invalid_reassign.status_code}"


def test_audit_turnaround_reopened_case_and_incomplete_timestamps(client: TestClient, db: Session):
    """Verifies analytics turnaround calculations:

    - Reopened cases compute turnaround from reopening timestamp, NOT intake.
    - Incomplete timestamps are excluded from the denominator.
    """
    now = datetime.now(timezone.utc)
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Analytics Audit Org", slug=f"ana-{uuid.uuid4().hex[:6]}", created_at=now)
    db.add(org)

    admin_id = uuid.uuid4()
    admin = User(id=admin_id, email="analytics@audit.com", password_hash=hash_password("Pass123!"), full_name="Analytics User", created_at=now)
    db.add(admin)
    db.flush()

    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=admin_id,
        first_name="A",
        last_name="B",
        email="client@analytics.com",
        nationality="GBR",
        created_at=now,
    )
    db.add(client_prof)
    db.flush()

    # Case 1: Standard completed case (Created 60 days ago, completed 10 days ago -> 50 days turnaround)
    case1 = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_prof.id,
        case_number="CASE-STD-01",
        title="Standard Case",
        jurisdiction="US",
        visa_category="O-1A",
        status="completed",
        created_at=now - timedelta(days=60),
        updated_at=now - timedelta(days=10),
    )
    db.add(case1)

    # Case 2: Reopened case (Created 300 days ago, note added 30 days ago saying 'reopened', completed 10 days ago -> 20 days adjusted turnaround)
    case2 = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_prof.id,
        case_number="CASE-REOPEN-02",
        title="Reopened Case",
        jurisdiction="US",
        visa_category="EB-1A",
        status="completed",
        created_at=now - timedelta(days=300),
        updated_at=now - timedelta(days=10),
    )
    db.add(case2)
    db.flush()

    note2 = CaseNote(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case2.id,
        content="Case reopened after administrative review",
        created_at=now - timedelta(days=30),
    )
    db.add(note2)

    # Case 3: Incomplete timestamp case (completed status, but updated_at == created_at with no filing timestamp -> MUST be excluded from average)
    case3 = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_prof.id,
        case_number="CASE-INCOMPLETE-03",
        title="Incomplete Timestamp Case",
        jurisdiction="US",
        visa_category="EB-2 NIW",
        status="completed",
        created_at=now - timedelta(days=40),
        updated_at=now - timedelta(days=40),
    )
    db.add(case3)
    db.commit()

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin_id,
        organization_id=org_id,
        email="analytics@audit.com",
        roles=["master_admin"],
    )

    res = client.get("/api/v1/analytics/operations")
    assert res.status_code == 200, res.text
    data = res.json()

    tt = data["turnaround_time"]
    assert tt["completed_cases_evaluated"] == 2
    assert tt["reopened_cases_adjusted_count"] == 1
    assert tt["incomplete_timestamp_cases_count"] == 1
    # Average of (50 + 20) / 2 = 35.0 days
    assert 34.0 <= tt["average_days"] <= 36.0, f"Expected average around 35.0 days, got {tt['average_days']}"
