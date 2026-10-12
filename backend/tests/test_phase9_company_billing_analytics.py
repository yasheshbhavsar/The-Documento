import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.domain.models import (
    Organization,
    OrganizationMembership,
    Role,
    MembershipRole,
    User,
    ClientProfile,
    ImmigrationCase,
    CaseAssignment,
    CaseTask,
    CaseMilestone,
    CaseAIFinding,
    Document,
    DocumentRequest,
    FilingPackage,
    ServiceItem,
    ClientEngagement,
    Invoice,
    InvoiceLineItem,
    PaymentRecord,
    AuditEvent,
    now_utc,
)
from backend.app.analytics.service import ExecutiveDashboardService, AnalyticsService
from backend.app.billing.service import BillingService
from backend.app.operations.service import CompanyOperationsService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def create_mock_user(db: Session, email: str, full_name: str) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password123"),
        status="active",
    )
    db.add(user)
    db.flush()
    return user


def setup_phase9_fixtures(db: Session):
    org = Organization(name="Lex Immigration Global", slug=f"lex-ops-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    # Roles
    admin_role = db.query(Role).filter(Role.code == RoleCode.COMPANY_ADMIN).first()
    if not admin_role:
        admin_role = Role(code=RoleCode.COMPANY_ADMIN, name="Company Admin")
        db.add(admin_role)

    manager_role = db.query(Role).filter(Role.code == RoleCode.CASE_MANAGER).first()
    if not manager_role:
        manager_role = Role(code=RoleCode.CASE_MANAGER, name="Case Manager")
        db.add(manager_role)

    client_role = db.query(Role).filter(Role.code == RoleCode.RETAINED_CLIENT).first()
    if not client_role:
        client_role = Role(code=RoleCode.RETAINED_CLIENT, name="Retained Client")
        db.add(client_role)
    db.flush()

    admin_user = create_mock_user(db, f"owner-{uuid.uuid4().hex[:6]}@lex.com", "Elena Vance, Owner")
    m_admin = OrganizationMembership(organization_id=org.id, user_id=admin_user.id, status="active")
    db.add(m_admin)
    db.flush()
    db.add(MembershipRole(membership_id=m_admin.id, role_id=admin_role.id))

    manager_user = create_mock_user(db, f"manager-{uuid.uuid4().hex[:6]}@lex.com", "Marcus Reed, Case Manager")
    m_manager = OrganizationMembership(organization_id=org.id, user_id=manager_user.id, status="active")
    db.add(m_manager)
    db.flush()
    db.add(MembershipRole(membership_id=m_manager.id, role_id=manager_role.id))

    other_user = create_mock_user(db, f"other-{uuid.uuid4().hex[:6]}@lex.com", "Sophia Sterling, Associate")
    m_other = OrganizationMembership(organization_id=org.id, user_id=other_user.id, status="active")
    db.add(m_other)
    db.flush()
    db.add(MembershipRole(membership_id=m_other.id, role_id=manager_role.id))

    client_user = create_mock_user(db, f"client-{uuid.uuid4().hex[:6]}@example.com", "Dr. Sarah Chen")
    client_profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Sarah",
        last_name="Chen",
        email=client_user.email,
        nationality="TWN",
    )
    db.add(client_profile)
    db.flush()

    # Active Case
    case1 = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-US-{uuid.uuid4().hex[:6].upper()}",
        title="Dr. Sarah Chen EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
    )
    db.add(case1)
    db.flush()

    # Assign case1 to manager_user
    db.add(CaseAssignment(case_id=case1.id, user_id=manager_user.id, role_in_case="case_manager"))

    # Case 2: Unassigned case
    case2 = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-CA-{uuid.uuid4().hex[:6].upper()}",
        title="Express Entry Federal Skilled Worker",
        jurisdiction="CA",
        visa_category="Express Entry",
        status="gathering",
    )
    db.add(case2)

    # Case 3: Completed Case
    case3 = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-UK-{uuid.uuid4().hex[:6].upper()}",
        title="Global Talent UK Petition",
        jurisdiction="GB",
        visa_category="Global Talent",
        status="approved",
    )
    db.add(case3)
    db.flush()

    # Milestone (overdue)
    now = datetime.now(timezone.utc)
    db.add(CaseMilestone(
        organization_id=org.id,
        case_id=case1.id,
        title="Initial Document Collection Due",
        stage="intake",
        target_date=now - timedelta(days=5),
        status="pending",
    ))

    # Task (assigned to manager)
    db.add(CaseTask(
        organization_id=org.id,
        case_id=case1.id,
        assigned_to_user_id=manager_user.id,
        title="Draft Evidence Index",
        due_date=now - timedelta(days=2),
        status="pending",
    ))

    # AI Finding (Flagged)
    db.add(CaseAIFinding(
        organization_id=org.id,
        case_id=case1.id,
        document_id=None,
        finding_type="statutory_evidence_gap",
        title="Scholarly Citations Gap",
        description="Citation count below 75th percentile for EB-1A computer science benchmarks.",
        severity="major",
        status="needs_review",
        recommended_action="Request Google Scholar citation profile export.",
        uncertainty_limitations="Evaluated against standard database benchmarks without full contextual field analysis.",
    ))

    db.commit()

    return {
        "org": org,
        "admin_user": admin_user,
        "manager_user": manager_user,
        "other_user": other_user,
        "client_user": client_user,
        "client_profile": client_profile,
        "case1": case1,
        "case2": case2,
        "case3": case3,
    }


def test_executive_dashboard_metrics(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    response = client.get("/api/v1/analytics/dashboard/executive?window_days=30")
    assert response.status_code == 200
    data = response.json()

    assert "metrics" in data
    metrics = data["metrics"]

    # 1. Active cases
    assert metrics["active_cases"]["value"] >= 2
    assert "calculation_method" in metrics["active_cases"]
    assert metrics["active_cases"]["drill_down_path"] == "/cases?status=active"

    # 2. New retained clients
    assert metrics["new_retained_clients"]["value"] >= 1
    assert "calculation_method" in metrics["new_retained_clients"]

    # 3. Cases by country and pathway
    assert "US" in metrics["cases_by_country_and_pathway"]["by_country"]
    assert "EB-1A" in metrics["cases_by_country_and_pathway"]["by_pathway"]

    # 4. Cases by workflow stage
    assert "intake" in metrics["cases_by_workflow_stage"]["stages"]

    # 5. Cases needing attention
    assert metrics["cases_needing_attention"]["value"] >= 1
    assert len(metrics["cases_needing_attention"]["items"]) >= 1

    # 6. Deadlines
    assert metrics["deadlines"]["overdue_milestones"] >= 1
    assert metrics["deadlines"]["total_overdue"] >= 1

    # 7. Unassigned cases
    assert metrics["unassigned_cases"]["value"] >= 1

    # 8. Staff workload and capacity
    assert len(metrics["staff_workload_and_capacity"]["staff_members"]) >= 2
    manager_load = next(
        m for m in metrics["staff_workload_and_capacity"]["staff_members"]
        if m["user_id"] == str(fixtures["manager_user"].id)
    )
    assert manager_load["assigned_cases"] >= 1
    assert manager_load["pending_tasks"] >= 1

    # 9. Applications prepared, reviewed, submitted
    assert "prepared" in metrics["applications_prepared_reviewed_submitted"]

    # 10. Outstanding client requests
    assert "value" in metrics["outstanding_client_requests"]

    # 11. Processing failures
    assert "failed_documents" in metrics["processing_failures"]

    # 12. Recent company activity
    assert "items" in metrics["recent_company_activity"]


def test_operations_analytics_turnaround_and_overdue(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    response = client.get("/api/v1/analytics/operations?jurisdiction=all&pathway=all")
    assert response.status_code == 200
    data = response.json()

    assert "turnaround_time" in data
    assert "reopened_cases_adjusted_count" in data["turnaround_time"]
    assert "incomplete_timestamp_cases_count" in data["turnaround_time"]
    assert "overdue_work" in data
    assert data["overdue_work"]["overdue_less_than_7_days"] >= 1
    assert "client_response_time" in data


def test_service_catalog_and_client_engagements(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # 1. List services (seeds default services)
    resp = client.get("/api/v1/billing/services")
    assert resp.status_code == 200
    services = resp.json()
    assert len(services) >= 4
    eb1a_srv = next(s for s in services if s["code"] == "EB1A_PETITION")
    assert eb1a_srv["base_fee"] == 8500.0

    # 2. Create custom service
    resp_create = client.post("/api/v1/billing/services", json={
        "code": "CONSULTATION_EXPEDITED",
        "name": "Expedited 24h Attorney Strategy Consultation",
        "jurisdiction": "US",
        "base_fee": 650.0,
        "currency": "USD",
        "pricing_model": "fixed",
    })
    assert resp_create.status_code == 201

    # 3. Create client engagement
    resp_eng = client.post("/api/v1/billing/engagements", json={
        "client_id": str(fixtures["client_profile"].id),
        "case_id": str(fixtures["case1"].id),
        "service_id": eb1a_srv["id"],
        "retainer_amount": 4250.0,
        "agreed_fee": 8500.0,
        "billing_terms": "fixed_split",
        "is_signed": True,
        "notes": "50% retainer due on signing, 50% upon final filing package lock.",
    })
    assert resp_eng.status_code == 201
    eng_data = resp_eng.json()
    assert eng_data["engagement_number"].startswith("ENG-")
    assert eng_data["agreed_fee"] == 8500.0


def test_invoices_line_items_and_automated_numbering(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # Create Invoice with line items
    resp = client.post("/api/v1/billing/invoices", json={
        "client_id": str(fixtures["client_profile"].id),
        "case_id": str(fixtures["case1"].id),
        "line_items": [
            {
                "description": "EB-1A Extraordinary Ability Legal Representation Retainer (Phase 1)",
                "quantity": 1.0,
                "unit_price": 4250.0,
                "line_type": "service_fee",
            },
            {
                "description": "USCIS Form I-140 Statutory Government Filing Fee",
                "quantity": 1.0,
                "unit_price": 715.0,
                "line_type": "filing_fee",
            },
        ],
        "tax_amount": 0.0,
        "discount_amount": 250.0,
        "notes": "Payment due within 14 days of retainer signing.",
        "auto_issue": True,
    })
    assert resp.status_code == 201
    inv = resp.json()
    assert inv["invoice_number"].startswith("INV-")
    expected_total = (4250.0 + 715.0) - 250.0
    assert inv["total_amount"] == expected_total
    assert inv["balance_due"] == expected_total
    assert inv["status"] == "issued"


def test_payment_processing_tokenized_no_raw_card(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # 1. Create Invoice
    inv_resp = client.post("/api/v1/billing/invoices", json={
        "client_id": str(fixtures["client_profile"].id),
        "case_id": str(fixtures["case1"].id),
        "line_items": [
            {
                "description": "Legal Consultation Assessment",
                "quantity": 1.0,
                "unit_price": 350.0,
                "line_type": "service_fee",
            }
        ],
    })
    inv_id = inv_resp.json()["id"]

    # 2. Record Tokenized Payment (No raw card PAN stored!)
    pay_resp = client.post(f"/api/v1/billing/invoices/{inv_id}/payments", json={
        "amount": 350.0,
        "payment_method": "credit_card_tokenized",
        "card_brand": "visa",
        "card_last4": "4242",
        "provider_charge_id": "ch_mock_stripe_987654321",
        "notes": "Verified client online checkout",
    })
    assert pay_resp.status_code == 201
    pay_data = pay_resp.json()
    assert pay_data["card_brand"] == "visa"
    assert pay_data["card_last4"] == "4242"
    assert pay_data["status"] == "succeeded"
    assert pay_data["invoice_status"] == "paid"
    assert pay_data["balance_due"] == 0.0

    # 3. Verify Database Record has NO raw credit card data
    payment_rec = db.query(PaymentRecord).filter(PaymentRecord.id == uuid.UUID(pay_data["id"])).first()
    assert payment_rec is not None
    assert payment_rec.card_last4 == "4242"
    assert not hasattr(payment_rec, "pan")
    assert not hasattr(payment_rec, "cvv")


def test_refund_processing_and_balance_reversal(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # Create Invoice and pay
    inv_resp = client.post("/api/v1/billing/invoices", json={
        "client_id": str(fixtures["client_profile"].id),
        "line_items": [{"description": "Service Fee", "quantity": 1.0, "unit_price": 500.0}],
    })
    inv_id = inv_resp.json()["id"]

    pay_resp = client.post(f"/api/v1/billing/invoices/{inv_id}/payments", json={
        "amount": 500.0,
        "card_last4": "1111",
    })
    pay_id = pay_resp.json()["id"]

    # Process partial refund ($200)
    ref_resp = client.post(f"/api/v1/billing/payments/{pay_id}/refund", json={
        "refund_amount": 200.0,
        "reason": "Client requested adjustment prior to brief drafting",
    })
    assert ref_resp.status_code == 200
    ref_data = ref_resp.json()
    assert ref_data["refunded_amount"] == 200.0
    assert ref_data["status"] == "partially_refunded"
    assert ref_data["invoice_status"] == "partially_paid"
    assert ref_data["invoice_balance_due"] == 200.0


def test_company_operations_work_reassignment(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # Reassign work from manager_user to other_user
    resp = client.post("/api/v1/operations/reassign", json={
        "from_user_id": str(fixtures["manager_user"].id),
        "to_user_id": str(fixtures["other_user"].id),
        "reassign_cases": True,
        "reassign_tasks": True,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["cases_reassigned"] >= 1
    assert data["tasks_reassigned"] >= 1

    # Verify audit event generated
    audit = db.query(AuditEvent).filter(
        AuditEvent.organization_id == fixtures["org"].id,
        AuditEvent.action == "operations.work_reassigned",
    ).first()
    assert audit is not None


def test_rbac_financial_records_protection(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    # Case manager does NOT have billing:read or billing:manage permissions
    manager_auth = AuthContext(
        user_id=fixtures["manager_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["manager_user"].email,
        roles=("case_manager",),
    )
    app.dependency_overrides[get_auth_context] = lambda: manager_auth

    resp_invoices = client.get("/api/v1/billing/invoices")
    assert resp_invoices.status_code == 403

    resp_reports = client.get("/api/v1/billing/reports/financial")
    assert resp_reports.status_code == 403


def test_governance_report_export_audit(client: TestClient, db: Session):
    fixtures = setup_phase9_fixtures(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["admin_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["admin_user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # Export analytics
    resp = client.get("/api/v1/analytics/export?report_type=executive_summary")
    assert resp.status_code == 200
    export_data = resp.json()
    assert "export_id" in export_data

    # Verify audit trail
    audit = db.query(AuditEvent).filter(
        AuditEvent.organization_id == fixtures["org"].id,
        AuditEvent.action == "governance.analytics_exported",
    ).first()
    assert audit is not None
    assert audit.metadata_json["report_type"] == "executive_summary"
