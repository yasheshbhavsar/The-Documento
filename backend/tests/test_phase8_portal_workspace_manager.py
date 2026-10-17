import io
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.domain.models import (
    ImmigrationCase,
    ClientProfile,
    ClientDependant,
    Document,
    DocumentRequest,
    CaseMilestone,
    CaseTask,
    CaseAIFinding,
    Invoice,
    MessageThread,
    Message,
    AuditEvent,
    User,
    Role,
    MembershipRole,
    OrganizationMembership,
    Organization,
)
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import create_access_token


@pytest.fixture
def test_org(db: Session) -> Organization:
    org = Organization(name="Phase 8 Test Org", slug=f"phase-8-{uuid.uuid4().hex[:6]}", status="active")
    db.add(org)
    db.flush()
    return org


def test_per_applicant_checklist_endpoint(client: TestClient, db: Session, test_org):
    """
    Tests GET /api/v1/portal/cases/{case_id}/applicant-checklist:
    - Primary applicant and dependants categorized into:
      required, received, accepted, rejected/correction-required, outstanding.
    """
    now = datetime.now(timezone.utc)
    
    # 1. Create client and case with dependants
    c_user = User(id=uuid.uuid4(), email=f"client_{uuid.uuid4().hex[:6]}@example.com", full_name="Dr. Alex Rivera", password_hash="hash", status="active")
    db.add(c_user)
    db.flush()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        user_id=c_user.id,
        first_name="Alex",
        last_name="Rivera",
        email=c_user.email,
        nationality="USA",
        created_at=now,
    )
    db.add(client_profile)
    db.flush()

    dep1 = ClientDependant(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        primary_client_id=client_profile.id,
        first_name="Maria",
        last_name="Rivera",
        relationship_type="spouse",
        nationality="USA",
        is_authorized_to_view_case=True,
    )
    db.add(dep1)

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_number=f"US-EB1A-{uuid.uuid4().hex[:4].upper()}",
        title="Alex Rivera - EB-1A Extraordinary Ability",
        client_id=client_profile.id,
        visa_category="EB-1A",
        jurisdiction="US",
        status="gathering",
        created_at=now,
    )
    db.add(case)
    db.flush()

    # 2. Add an accepted document for primary applicant
    doc_accepted = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Passport Biographical Page",
        filename="passport.pdf",
        storage_path="mock/passport.pdf",
        category="identity_passport",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        verification_notes="Verified against official records",
        is_assignment_confirmed=True,
        has_unresolved_anomaly=False,
        created_at=now,
    )
    db.add(doc_accepted)

    # 3. Add a rejected document for spouse
    doc_rejected = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        applicant_dependant_id=dep1.id,
        title="Marriage Certificate",
        filename="marriage_blur.jpg",
        storage_path="mock/marriage_blur.jpg",
        category="civil_status",
        sha256_hash="d3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=2048,
        mime_type="image/jpeg",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="rejected",
        verification_notes="[BLURRY_IMAGE] The official seals and registration numbers are illegible. Please scan directly under good lighting.",
        created_at=now,
    )
    db.add(doc_rejected)

    # 4. Add a requested document (outstanding)
    req = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        requested_from_client_id=client_profile.id,
        title="Peer-Reviewed Publications and Citation Index",
        description="Comprehensive list of articles and citations",
        rationale="EB-1A statutory criterion support",
        category="supporting_evidence",
        status="requested",
        created_at=now,
    )
    db.add(req)
    db.commit()

    # 5. Query checklist as case manager
    mgr_user = User(id=uuid.uuid4(), email=f"mgr_{uuid.uuid4().hex[:6]}@example.com", full_name="Manager Alex", password_hash="hash", status="active")
    db.add(mgr_user)
    db.flush()
    manager_token = create_access_token(data={"sub": str(mgr_user.id), "org_id": str(test_org.id), "roles": [RoleCode.CASE_MANAGER.value]})
    res = client.get(
        f"/api/v1/portal/cases/{case.id}/applicant-checklist",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["case_id"] == str(case.id)
    assert data["case_number"] == case.case_number
    assert len(data["applicants"]) == 2  # Primary + Spouse

    primary_sec = next(a for a in data["applicants"] if a["relationship"] == "primary_applicant")
    assert primary_sec["applicant_name"] == "Alex Rivera"
    assert primary_sec["accepted_count"] >= 1
    assert any(i["title"] == "Passport Biographical Page" for i in primary_sec["accepted_items"])
    assert any(i["title"] == "Peer-Reviewed Publications and Citation Index" for i in primary_sec["outstanding_items"])

    spouse_sec = next(a for a in data["applicants"] if a["relationship"] == "spouse")
    assert spouse_sec["applicant_name"] == "Maria Rivera"
    assert spouse_sec["rejected_count"] >= 1
    rejected_item = spouse_sec["rejected_items"][0]
    assert rejected_item["structured_reason_code"] == "BLURRY_IMAGE"
    assert "illegible" in rejected_item["client_explanation"].lower()


def test_document_rejection_requires_structured_reason_and_explanation(client: TestClient, db: Session, test_org):
    """
    Tests POST /api/v1/documents/{document_id}/reject:
    - Rejection requires structured reason code and client explanation.
    - Rejection updates document status, verification_notes, audit log, and notifies client.
    - Retained clients cannot reject documents.
    """
    now = datetime.now(timezone.utc)
    c_user = User(id=uuid.uuid4(), email=f"client_{uuid.uuid4().hex[:6]}@example.com", full_name="Siddharth Rao", password_hash="hash", status="active")
    db.add(c_user)
    db.flush()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        user_id=c_user.id,
        first_name="Siddharth",
        last_name="Rao",
        email=c_user.email,
        nationality="USA",
        created_at=now,
    )
    db.add(client_profile)

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_number=f"US-O1-{uuid.uuid4().hex[:4].upper()}",
        title="Siddharth Rao - O-1A",
        client_id=client_profile.id,
        visa_category="O-1A",
        jurisdiction="US",
        created_at=now,
    )
    db.add(case)

    doc = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        client_id=client_profile.id,
        uploaded_by_user_id=c_user.id,
        title="Prior Year Tax Summary (W-2)",
        filename="w2_expired.pdf",
        storage_path="mock/w2_expired.pdf",
        category="employment_records",
        sha256_hash="13b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=512,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="under_review",
        created_at=now,
    )
    db.add(doc)

    req = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        requested_from_client_id=client_profile.id,
        title="Prior Year Tax Summary (W-2)",
        description="Official W2 statement",
        rationale="Tax compliance evidence",
        category="employment_records",
        status="submitted",
        created_at=now,
    )
    db.add(req)
    db.commit()

    # Client tries to reject -> should be denied
    client_token = create_access_token(data={"sub": str(c_user.id), "org_id": str(test_org.id), "roles": [RoleCode.RETAINED_CLIENT.value]})
    bad_res = client.post(
        f"/api/v1/documents/{doc.id}/reject",
        json={"structured_reason_code": "EXPIRED_RECORD", "client_explanation": "Client cannot self-reject"},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert bad_res.status_code == 403

    # Officer rejects with structured code and customized plain language guidance
    officer_user = User(id=uuid.uuid4(), email=f"off_{uuid.uuid4().hex[:6]}@example.com", full_name="Officer Jane", password_hash="hash", status="active")
    db.add(officer_user)
    db.flush()
    officer_token = create_access_token(data={"sub": str(officer_user.id), "org_id": str(test_org.id), "roles": [RoleCode.CASE_MANAGER.value]})
    ok_res = client.post(
        f"/api/v1/documents/{doc.id}/reject",
        json={
            "structured_reason_code": "EXPIRED_RECORD",
            "client_explanation": "The uploaded W-2 tax statement is for tax year 2021. USCIS requires the most recent tax year (2025 or 2024). Please upload your latest IRS Form W-2.",
            "internal_notes": "Checked wage figures; client needs to obtain recent transcript from ADP portal.",
        },
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert ok_res.status_code == 200, ok_res.text
    detail = ok_res.json()
    assert detail["verification_status"] == "rejected"
    assert detail["lifecycle_state"] == "rejected"
    assert detail["structured_reason_code"] == "EXPIRED_RECORD"
    assert "latest IRS Form W-2" in detail["client_explanation"]

    # Verify linked DocumentRequest was updated to rejected
    db.refresh(req)
    assert req.status == "rejected"
    assert "latest IRS Form W-2" in req.rejection_reason

    # Verify audit event was logged
    audit = db.query(AuditEvent).filter(
        AuditEvent.action == "document.rejected",
        AuditEvent.object_id == str(doc.id),
    ).first()
    assert audit is not None
    assert audit.metadata_json["structured_reason_code"] == "EXPIRED_RECORD"


def test_document_lifecycle_states_distinction(client: TestClient, db: Session, test_org):
    """
    Tests the 4 lifecycle progression states:
    - 'uploaded' (received into system, pending review)
    - 'under_review' (officer or AI review in progress)
    - 'accepted' (officer verified)
    - 'package_ready' (verified, assigned to applicant/case, zero anomalies)
    """
    now = datetime.now(timezone.utc)
    c_user = User(id=uuid.uuid4(), email=f"client_life_{uuid.uuid4().hex[:6]}@example.com", full_name="Client Life", password_hash="hash", status="active")
    db.add(c_user)
    db.flush()
    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        user_id=c_user.id,
        first_name="Life",
        last_name="Client",
        email=c_user.email,
        nationality="USA",
        created_at=now,
    )
    db.add(client_profile)
    db.flush()
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        client_id=client_profile.id,
        case_number=f"US-EB2-{uuid.uuid4().hex[:4].upper()}",
        title="Life Case",
        visa_category="EB-2",
        jurisdiction="US",
        created_at=now,
    )
    db.add(case)
    db.flush()
    case_id = case.id

    # Doc 1: Just uploaded
    d_uploaded = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        title="Unverified Evidence",
        filename="notes.pdf",
        storage_path="mock/notes.pdf",
        category="supporting_evidence",
        sha256_hash="a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=100,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="pending",
        created_at=now,
    )
    db.add(d_uploaded)

    # Doc 2: Under review
    d_under_review = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        title="Passport In Review",
        filename="pass.pdf",
        storage_path="mock/pass.pdf",
        category="identity_passport",
        sha256_hash="b3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=200,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="under_review",
        created_at=now,
    )
    db.add(d_under_review)

    # Doc 3: Accepted but has unresolved anomaly (not package-ready)
    d_accepted = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case_id,
        title="Birth Certificate With Anomaly",
        filename="birth.pdf",
        storage_path="mock/birth.pdf",
        category="civil_status",
        sha256_hash="c3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=300,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        has_unresolved_anomaly=True,  # Blocks package-ready
        is_assignment_confirmed=True,
        created_at=now,
    )
    db.add(d_accepted)

    # Doc 4: Package-Ready (accepted, assigned, no anomalies)
    d_pkg_ready = Document(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case_id,
        title="Certified Clean Degree",
        filename="phd.pdf",
        storage_path="mock/phd.pdf",
        category="educational_records",
        sha256_hash="d3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=400,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        has_unresolved_anomaly=False,
        is_assignment_confirmed=True,
        created_at=now,
    )
    db.add(d_pkg_ready)
    db.commit()

    mgr_user = User(id=uuid.uuid4(), email=f"mgr_life_{uuid.uuid4().hex[:6]}@example.com", full_name="Mgr Life", password_hash="hash", status="active")
    db.add(mgr_user)
    db.flush()
    token = create_access_token(data={"sub": str(mgr_user.id), "org_id": str(test_org.id), "roles": [RoleCode.CASE_MANAGER.value]})
    res = client.get("/api/v1/documents", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    docs_map = {d["id"]: d["lifecycle_state"] for d in res.json()}

    assert docs_map[str(d_uploaded.id)] == "uploaded"
    assert docs_map[str(d_under_review.id)] == "under_review"
    assert docs_map[str(d_accepted.id)] == "accepted"
    assert docs_map[str(d_pkg_ready.id)] == "package_ready"


def test_manager_dashboard_priority_ranks_1_to_8(client: TestClient, db: Session, test_org):
    """
    Tests GET /api/v1/analytics/manager-priority-queue:
    - Confirms strict 1 to 8 rank order.
    - Validates authority requests, workload allocation, blocked cases, overdue responses,
      pending reviews, quality issues, payments, and quality-improvement performance.
    - Validates RBAC: Clients forbidden, Managers authorized.
    """
    now = datetime.now(timezone.utc)
    
    # Setup sample data for ranks
    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        first_name="Test",
        last_name="Petitioner",
        email="test_petitioner@example.com",
        nationality="USA",
        created_at=now,
    )
    db.add(client_profile)
    db.flush()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        client_id=client_profile.id,
        case_number="US-EB1A-TEST",
        title="Test Executive Petition",
        visa_category="EB-1A",
        jurisdiction="US",
        status="gathering",
        created_at=now,
    )
    db.add(case)
    db.flush()

    # Rank 1: Authority RFE deadline
    ms = CaseMilestone(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        title="USCIS RFE Response: Kazarian Extraordinary Criteria Evidence",
        stage="rfe_response",
        target_date=now - timedelta(days=2),  # Overdue
        status="in_progress",
        created_at=now,
    )
    db.add(ms)

    # Rank 3: Blocker finding
    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        finding_type="statutory_criteria",
        title="Statutory Ineligibility: Unlawful Presence Exceeds 180 Days",
        description="Candidate accumulated unlawful presence exceeding statutory waiver limits",
        recommended_action="File form I-601 waiver or review exceptions",
        uncertainty_limitations="Requires manual entry and exit record review",
        severity="blocker",
        status="flagged",
        created_at=now,
    )
    db.add(finding)

    # Rank 7: Invoice sample
    inv = Invoice(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        client_id=client_profile.id,
        invoice_number="INV-2026-001",
        total_amount=5000.0,
        paid_amount=2500.0,
        balance_due=2500.0,
        status="partially_paid",
        due_date=now + timedelta(days=15),
        created_at=now,
    )
    db.add(inv)
    db.commit()

    # Client is denied access
    c_user = User(id=uuid.uuid4(), email=f"client_dash_{uuid.uuid4().hex[:6]}@example.com", full_name="Client Dash", password_hash="hash", status="active")
    mgr_user = User(id=uuid.uuid4(), email=f"mgr_dash_{uuid.uuid4().hex[:6]}@example.com", full_name="Mgr Dash", password_hash="hash", status="active")
    db.add(c_user)
    db.add(mgr_user)
    db.flush()
    client_token = create_access_token(data={"sub": str(c_user.id), "org_id": str(test_org.id), "roles": [RoleCode.RETAINED_CLIENT.value]})
    denied_res = client.get("/api/v1/analytics/manager-priority-queue", headers={"Authorization": f"Bearer {client_token}"})
    assert denied_res.status_code == 403

    # Manager gets 8-rank board
    manager_token = create_access_token(data={"sub": str(mgr_user.id), "org_id": str(test_org.id), "roles": [RoleCode.CASE_MANAGER.value]})
    ok_res = client.get("/api/v1/analytics/manager-priority-queue", headers={"Authorization": f"Bearer {manager_token}"})
    assert ok_res.status_code == 200, ok_res.text
    data = ok_res.json()

    ranks = data["ranks"]
    assert len(ranks) == 8
    assert [r["rank"] for r in ranks] == [1, 2, 3, 4, 5, 6, 7, 8]

    # Rank 1: Authority requests identified
    r1 = ranks[0]
    assert r1["rank"] == 1
    assert "Critical/Overdue Deadlines" in r1["title"]
    assert r1["count"] >= 1
    assert any(item["is_authority_request"] for item in r1["items"])

    # Rank 2: Workload & allocation
    r2 = ranks[1]
    assert r2["rank"] == 2
    assert "Workload & Allocation" in r2["title"]
    assert "staff_allocation" in r2

    # Rank 3: Blocked cases
    r3 = ranks[2]
    assert r3["rank"] == 3
    assert r3["count"] >= 1

    # Rank 7: Payment status
    r7 = ranks[6]
    assert r7["rank"] == 7
    assert r7["partially_paid_count"] >= 1

    # Rank 8: Continuous quality improvement performance view
    r8 = ranks[7]
    assert r8["rank"] == 8
    assert "first_time_pass_rate_percent" in r8
    assert "blame-only" in r8["metrics"]["philosophy"].lower()


def test_manager_overview_conversation_access(client: TestClient, db: Session, test_org):
    """
    Tests GET /api/v1/messaging/manager-overview:
    - Managers/owners can inspect conversations across all cases.
    - Retained clients are strictly forbidden.
    """
    now = datetime.now(timezone.utc)
    c_user = User(id=uuid.uuid4(), email=f"client_{uuid.uuid4().hex[:6]}@example.com", full_name="Aarav Mehta", password_hash="hash", status="active")
    db.add(c_user)
    db.flush()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        user_id=c_user.id,
        first_name="Aarav",
        last_name="Mehta",
        email=c_user.email,
        nationality="USA",
        created_at=now,
    )
    db.add(client_profile)
    db.flush()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_number="US-H1B-0091",
        title="Aarav Mehta - H-1B",
        client_id=client_profile.id,
        visa_category="H-1B",
        jurisdiction="US",
        created_at=now,
    )
    db.add(case)
    db.flush()

    thread = MessageThread(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        case_id=case.id,
        subject="Clarification regarding LCA prevailing wage",
        channel_category="client",
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.flush()

    msg = Message(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        thread_id=thread.id,
        sender_id=c_user.id,
        content="Hello, has the Department of Labor certified the LCA yet?",
        delivery_status="delivered",
        created_at=now,
    )
    db.add(msg)
    db.commit()

    # 1. Client denied
    client_token = create_access_token(data={"sub": str(c_user.id), "org_id": str(test_org.id), "roles": [RoleCode.RETAINED_CLIENT.value]})
    c_res = client.get("/api/v1/messaging/manager-overview", headers={"Authorization": f"Bearer {client_token}"})
    assert c_res.status_code == 403

    # 2. Manager authorized
    mgr_user = User(id=uuid.uuid4(), email=f"admin_msg_{uuid.uuid4().hex[:6]}@example.com", full_name="Admin Msg", password_hash="hash", status="active")
    db.add(mgr_user)
    db.flush()
    mgr_token = create_access_token(data={"sub": str(mgr_user.id), "org_id": str(test_org.id), "roles": [RoleCode.COMPANY_ADMIN.value]})
    m_res = client.get("/api/v1/messaging/manager-overview", headers={"Authorization": f"Bearer {mgr_token}"})
    assert m_res.status_code == 200, m_res.text
    threads = m_res.json()
    assert len(threads) >= 1
    th = next(t for t in threads if t["thread_id"] == str(thread.id))
    assert th["case_number"] == "US-H1B-0091"
    assert "Department of Labor" in th["last_message_preview"]
