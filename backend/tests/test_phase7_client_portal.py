import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.domain.models import (
    ClientConsent,
    ClientDependant,
    ClientProfile,
    ClientQuestionnaire,
    Document,
    DocumentRequest,
    ImmigrationCase,
    Message,
    MessageThread,
    Notification,
    Organization,
    OrganizationMembership,
    Role,
    MembershipRole,
    User,
)
from backend.app.notifications.service import NotificationService, sanitize_notification_preview
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


def create_mock_org(db: Session, name: str, slug: str) -> Organization:
    org = Organization(name=name, slug=slug, status="active")
    db.add(org)
    db.flush()
    return org


def create_mock_case(db: Session, org_id: uuid.UUID, client_id: uuid.UUID, case_number: str) -> ImmigrationCase:
    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client_id,
        case_number=case_number,
        title=f"Petition {case_number}",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
    )
    db.add(case)
    db.flush()
    return case


def test_sanitize_notification_preview():
    """Verifies notification sanitizer strips sensitive PII from alerts."""
    raw = "Client uploaded passport US98765432 and SSN 123-45-6789 with A-Number A12345678 regarding asylum claim."
    sanitized = sanitize_notification_preview(raw)
    assert "US98765432" not in sanitized
    assert "123-45-6789" not in sanitized
    assert "A12345678" not in sanitized
    assert "asylum" not in sanitized
    assert "[REDACTED_DOC_ID]" in sanitized or "[REDACTED_SSN]" in sanitized


def test_client_onboarding_activation_and_profile(client: TestClient, db: Session):
    """
    Tests staff issuing invitation, client activation, biodata completion,
    and dependant registration with authorization flags.
    """
    org = create_mock_org(db, "LexImmigration Global", "lex-imm-portal")
    staff_user = create_mock_user(db, "case.manager@lex.com", "Sarah Jenkins")
    
    # 1. Setup staff auth context
    staff_ctx = AuthContext(
        user_id=staff_user.id,
        organization_id=org.id,
        email=staff_user.email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    from backend.app.main import app
    app.dependency_overrides[get_auth_context] = lambda: staff_ctx

    # Create dummy client profile & case
    c_prof = ClientProfile(
        organization_id=org.id,
        first_name="Elena",
        last_name="Rostova",
        email="elena.rostova@example.com",
        nationality="UKR",
    )
    db.add(c_prof)
    db.flush()
    case = create_mock_case(db, org.id, c_prof.id, "CASE-US-8841")
    db.commit()

    # 2. Staff invites client
    invite_res = client.post(
        "/api/v1/portal/invite",
        json={
            "case_id": str(case.id),
            "email": "elena.rostova@example.com",
            "full_name": "Dr. Elena Rostova",
            "relationship_type": "primary_applicant",
            "is_authorized_to_view_case": True,
        },
    )
    assert invite_res.status_code == 201
    token = invite_res.json()["invitation_token"]

    # 3. Client activates account
    activate_res = client.post(
        "/api/v1/portal/activate",
        json={
            "invitation_token": token,
            "password": "SecurePassword123!",
            "agreed_to_privacy": True,
        },
    )
    assert activate_res.status_code == 200
    activated_user_id = uuid.UUID(activate_res.json()["user_id"])

    # 4. Switch auth context to client
    client_ctx = AuthContext(
        user_id=activated_user_id,
        organization_id=org.id,
        email="elena.rostova@example.com",
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: client_ctx

    # 5. Client views and updates profile
    prof_res = client.get("/api/v1/portal/profile")
    assert prof_res.status_code == 200
    assert prof_res.json()["first_name"] == "Elena"

    update_res = client.put(
        "/api/v1/portal/profile",
        json={
            "phone": "+1-555-0199",
            "nationality": "UKR",
            "passport_number": "EP1234567",
        },
    )
    assert update_res.status_code == 200

    # 6. Client adds a dependant spouse
    dep_res = client.post(
        "/api/v1/portal/dependants",
        json={
            "first_name": "Alexander",
            "last_name": "Rostov",
            "relationship_type": "spouse",
            "email": "alex.rostov@example.com",
            "nationality": "UKR",
            "is_authorized_to_view_case": True,
        },
    )
    assert dep_res.status_code == 200
    assert dep_res.json()["first_name"] == "Alexander"
    assert dep_res.json()["is_authorized_to_view_case"] is True


def test_document_request_full_lifecycle(client: TestClient, db: Session):
    """
    Verifies full document request lifecycle:
    Staff creates request -> Client uploads evidence -> Staff rejects with feedback ->
    Client replaces document -> Staff approves.
    """
    org = create_mock_org(db, "Test Law Group", "test-law-req")
    staff = create_mock_user(db, "lawyer@testlaw.com", "David Attorney")
    client_user = create_mock_user(db, "applicant@test.com", "Maria Applicant")

    c_prof = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Maria",
        last_name="Applicant",
        email=client_user.email,
        nationality="FRA",
    )
    db.add(c_prof)
    db.flush()
    case = create_mock_case(db, org.id, c_prof.id, "CASE-REQ-101")
    db.commit()

    # 1. Staff creates request
    from backend.app.main import app
    staff_ctx = AuthContext(
        user_id=staff.id,
        organization_id=org.id,
        email=staff.email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: staff_ctx

    create_res = client.post(
        "/api/v1/requests",
        json={
            "case_id": str(case.id),
            "requested_from_client_id": str(c_prof.id),
            "title": "IEEE Senior Membership Certificate",
            "description": "Official confirmation of IEEE Senior Member grade",
            "category": "supporting_evidence",
            "rationale": "Required under 8 CFR § 204.5(h)(3)(ii) for association membership",
            "statutory_requirement_code": "EB1A-CRIT-MEMBERSHIP",
            "accepted_formats": ["application/pdf", "image/png"],
            "translation_guidance": "If certificate is in French, provide certified English translation.",
        },
    )
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # 2. Switch to client - view request
    client_ctx = AuthContext(
        user_id=client_user.id,
        organization_id=org.id,
        email=client_user.email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: client_ctx

    list_res = client.get(f"/api/v1/requests?case_id={case.id}")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["title"] == "IEEE Senior Membership Certificate"

    # Create dummy uploaded document 1
    doc1 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=c_prof.id,
        title="ieee_cert_v1.pdf",
        filename="ieee_cert_v1.pdf",
        storage_path="/storage/ieee_cert_v1.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
    )
    db.add(doc1)
    db.commit()

    # 3. Client responds with doc1
    resp_res = client.post(
        f"/api/v1/requests/{req_id}/respond",
        json={"document_id": str(doc1.id), "response_notes": "Uploaded 2026 certificate"},
    )
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "submitted"

    # 4. Staff reviews and rejects (e.g. unreadable scan)
    app.dependency_overrides[get_auth_context] = lambda: staff_ctx
    reject_res = client.patch(
        f"/api/v1/requests/{req_id}/review",
        json={
            "decision": "rejected",
            "rejection_reason": "Scan resolution is too low; member grade watermark is cut off.",
            "review_notes": "Requested high-resolution color scan.",
        },
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert "watermark is cut off" in reject_res.json()["rejection_reason"]

    # 5. Client replaces document with high-res scan
    app.dependency_overrides[get_auth_context] = lambda: client_ctx
    doc2 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=c_prof.id,
        title="ieee_cert_hires_v2.pdf",
        filename="ieee_cert_hires_v2.pdf",
        storage_path="/storage/ieee_cert_hires_v2.pdf",
        sha256_hash="a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=4096,
        mime_type="application/pdf",
        version=2,
    )
    db.add(doc2)
    db.commit()

    replace_res = client.post(
        f"/api/v1/requests/{req_id}/replace",
        json={
            "replacement_document_id": str(doc2.id),
            "explanation": "Uploaded 300 DPI full color scan from IEEE membership portal.",
        },
    )
    assert replace_res.status_code == 200
    assert replace_res.json()["status"] == "submitted"
    assert replace_res.json()["rejection_reason"] is None

    # 6. Staff approves replacement
    app.dependency_overrides[get_auth_context] = lambda: staff_ctx
    approve_res = client.patch(
        f"/api/v1/requests/{req_id}/review",
        json={"decision": "approved", "review_notes": "High resolution scan verified and accepted."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"


def test_secure_messaging_internal_note_isolation(client: TestClient, db: Session):
    """
    CRITICAL SECURITY TEST:
    Verifies that staff internal notes are NEVER visible to clients,
    even in the same case thread.
    """
    org = create_mock_org(db, "Messaging Law Firm", "msg-law")
    staff = create_mock_user(db, "staff@msglaw.com", "Senior Lawyer")
    client_user = create_mock_user(db, "client@msglaw.com", "Valerie Client")

    c_prof = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Valerie",
        last_name="Client",
        email=client_user.email,
        nationality="CAN",
    )
    db.add(c_prof)
    db.flush()
    case = create_mock_case(db, org.id, c_prof.id, "CASE-MSG-999")
    db.commit()

    from backend.app.main import app
    staff_ctx = AuthContext(
        user_id=staff.id,
        organization_id=org.id,
        email=staff.email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    client_ctx = AuthContext(
        user_id=client_user.id,
        organization_id=org.id,
        email=client_user.email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )

    # 1. Staff creates thread with client-visible initial message
    app.dependency_overrides[get_auth_context] = lambda: staff_ctx
    thread_res = client.post(
        "/api/v1/messaging/threads",
        json={
            "case_id": str(case.id),
            "subject": "Case Strategy and Evidence Roadmap",
            "thread_type": "case_update",
            "initial_message": "Hello Valerie, welcome to your case messaging thread.",
            "is_internal": False,
        },
    )
    assert thread_res.status_code == 201
    thread_id = thread_res.json()["id"]

    # 2. Staff posts an internal note (is_internal = True)
    staff_note_res = client.post(
        f"/api/v1/messaging/threads/{thread_id}/messages",
        json={
            "content": "INTERNAL ATTORNEY NOTE: Assess whether client meets Kazarian threshold before filing.",
            "is_internal": True,
        },
    )
    assert staff_note_res.status_code == 201
    assert staff_note_res.json()["is_internal"] is True

    # 3. Staff can see both messages (client-visible + internal note)
    staff_view = client.get(f"/api/v1/messaging/threads/{thread_id}/messages")
    assert staff_view.status_code == 200
    assert len(staff_view.json()) == 2

    # 4. Switch to client auth context
    app.dependency_overrides[get_auth_context] = lambda: client_ctx
    client_view = client.get(f"/api/v1/messaging/threads/{thread_id}/messages")
    assert client_view.status_code == 200
    # Must only see 1 message! Internal note must be strictly excluded!
    assert len(client_view.json()) == 1
    assert "INTERNAL ATTORNEY NOTE" not in client_view.json()[0]["content"]

    # 5. Client replies
    reply_res = client.post(
        f"/api/v1/messaging/threads/{thread_id}/messages",
        json={"content": "Thank you! I have uploaded my recommendation letters.", "is_internal": True},
    )
    assert reply_res.status_code == 201
    # is_internal must be forced to False for client messages
    assert reply_res.json()["is_internal"] is False


def test_cross_client_isolation(client: TestClient, db: Session):
    """
    CRITICAL MULTI-TENANT & CLIENT ISOLATION:
    Client A cannot read Client B's document requests, messages, or cases.
    """
    org = create_mock_org(db, "Multi Client Firm", "multi-client-firm")
    client_a_user = create_mock_user(db, "client.a@test.com", "Client A")
    client_b_user = create_mock_user(db, "client.b@test.com", "Client B")

    prof_a = ClientProfile(organization_id=org.id, user_id=client_a_user.id, first_name="A", last_name="User", email=client_a_user.email, nationality="DEU")
    prof_b = ClientProfile(organization_id=org.id, user_id=client_b_user.id, first_name="B", last_name="User", email=client_b_user.email, nationality="BRA")
    db.add_all([prof_a, prof_b])
    db.flush()

    case_b = create_mock_case(db, org.id, prof_b.id, "CASE-B-777")
    
    # Request belonging to Client B
    req_b = DocumentRequest(
        organization_id=org.id,
        case_id=case_b.id,
        requested_from_client_id=prof_b.id,
        title="Client B Private Tax Records",
        description="Confidential tax filings",
        category="tax_record",
        rationale="Proof of high remuneration",
        status="requested",
        status_history=[],
    )
    db.add(req_b)
    db.commit()

    # Client A attempts to access Client B's request
    from backend.app.main import app
    client_a_ctx = AuthContext(
        user_id=client_a_user.id,
        organization_id=org.id,
        email=client_a_user.email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: client_a_ctx

    # Attempt direct get
    access_res = client.get(f"/api/v1/requests/{req_b.id}")
    assert access_res.status_code in (403, 404)

    # Attempt to list requests (Client A must get empty list)
    list_res = client.get("/api/v1/requests")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0


def test_notification_delivery_confirmation_and_retries(client: TestClient, db: Session):
    """
    Tests email delivery confirmation state machine:
    Starts as queued/sent, provider failure records 'failed' with retry count,
    and webhook callback confirms 'delivered'.
    """
    org = create_mock_org(db, "Notify Firm", "notify-firm")
    user = create_mock_user(db, "user.notify@test.com", "Notify User")

    from backend.app.main import app
    ctx = AuthContext(
        user_id=user.id,
        organization_id=org.id,
        email=user.email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: ctx

    # Create email notification
    notif = NotificationService.create_notification(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        title="Upcoming Filing Deadline Alert",
        body="Your response is due within 7 days.",
        notification_type="upcoming_deadline",
        channel="email",
    )
    assert notif.channel == "email"
    assert notif.delivery_status == "sent"

    # 1. Simulate provider delivery failure (e.g. bounce)
    fail_res = client.post(
        f"/api/v1/notifications/{notif.id}/delivery-webhook",
        json={"delivery_status": "failed", "error_message": "SMTP connection timeout"},
    )
    assert fail_res.status_code == 200
    assert fail_res.json()["delivery_status"] == "failed"
    assert fail_res.json()["retry_count"] == 1

    # 2. Retry notification
    retry_res = client.post(f"/api/v1/notifications/{notif.id}/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["delivery_status"] == "sent"
    assert retry_res.json()["retry_count"] == 2

    # 3. Provider confirms successful delivery
    confirm_res = client.post(
        f"/api/v1/notifications/{notif.id}/delivery-webhook",
        json={"delivery_status": "delivered", "provider_receipt_id": "ses-msg-998877"},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["delivery_status"] == "delivered"
    assert confirm_res.json()["delivered_at"] is not None


def test_questionnaire_and_waiting_state(client: TestClient, db: Session):
    """
    Tests guided questionnaire saving/submission and waiting-state calculation
    (waiting on client vs waiting on firm).
    """
    org = create_mock_org(db, "Waiting State Firm", "wait-firm")
    client_user = create_mock_user(db, "applicant.wait@test.com", "Arthur Pendelton")

    c_prof = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Arthur",
        last_name="Pendelton",
        email=client_user.email,
        nationality="GBR",
    )
    db.add(c_prof)
    db.flush()
    case = create_mock_case(db, org.id, c_prof.id, "CASE-WAIT-01")
    db.commit()

    from backend.app.main import app
    client_ctx = AuthContext(
        user_id=client_user.id,
        organization_id=org.id,
        email=client_user.email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: client_ctx

    # 1. Fetch questionnaire
    q_res = client.get(f"/api/v1/portal/questionnaires?case_id={case.id}")
    assert q_res.status_code == 200
    assert len(q_res.json()) >= 1
    q_id = q_res.json()[0]["id"]

    # 2. Save questionnaire responses
    save_res = client.put(
        f"/api/v1/portal/questionnaires/{q_id}",
        json={
            "responses": {
                "current_employer": "Oxford University",
                "job_title": "Principal Investigator",
                "field_of_expertise": "Quantum Materials",
            },
            "submit_for_review": False,
        },
    )
    assert save_res.status_code == 200
    assert save_res.json()["completion_percentage"] > 0

    # 3. Check waiting state
    wait_res = client.get(f"/api/v1/portal/waiting-state?case_id={case.id}")
    assert wait_res.status_code == 200
    data = wait_res.json()
    assert "waiting_on_client" in data
    assert "waiting_on_firm" in data
    assert data["waiting_on_firm_count"] >= 1
    assert data["primary_next_action"] is not None
