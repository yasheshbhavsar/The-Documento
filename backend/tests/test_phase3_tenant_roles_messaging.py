import uuid
from datetime import datetime, timezone
import pytest

from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseMilestone,
    CaseNote,
    ClientProfile,
    Document,
    ImmigrationCase,
    MembershipRole,
    Message,
    MessageThread,
    Notification,
    Organization,
    OrganizationMembership,
    Role,
    Session as UserSession,
    User,
    now_utc,
)
from backend.app.domain.case_lifecycle import PreparationStatus, OperationalState
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


def _create_org(db, name: str, slug: str) -> Organization:
    org = Organization(name=name, slug=slug)
    db.add(org)
    db.commit()
    return org


def _create_user(db, org: Organization, email: str, full_name: str, role_code: RoleCode, password: str = "SecurePass123!") -> tuple[User, OrganizationMembership, Role]:
    now = now_utc()
    user = User(
        email=email.lower().strip(),
        full_name=full_name,
        password_hash=hash_password(password),
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=user.id,
        status="active",
        created_at=now,
    )
    db.add(membership)
    db.flush()

    role = db.query(Role).filter(Role.code == role_code.value).first()
    if not role:
        role = Role(code=role_code.value, name=role_code.value.replace("_", " ").title())
        db.add(role)
        db.flush()

    mr = MembershipRole(membership_id=membership.id, role_id=role.id, assigned_at=now)
    db.add(mr)
    db.commit()
    return user, membership, role


def _create_client_with_case(db, org: Organization, assigned_officer: User | None = None) -> tuple[User, ClientProfile, ImmigrationCase]:
    now = now_utc()
    client_user, _, _ = _create_user(db, org, f"client_{uuid.uuid4().hex[:6]}@domain.com", "Client Applicant", RoleCode.RETAINED_CLIENT)
    
    profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Elena",
        last_name="Rostova",
        email=client_user.email,
        nationality="CAN",
    )
    db.add(profile)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=profile.id,
        case_number=f"CASE-{uuid.uuid4().hex[:6].upper()}",
        title="O-1A Extraordinary Ability Petition",
        jurisdiction="US",
        visa_category="O-1A",
        status="processing",
        preparation_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
        operational_state=OperationalState.ACTIVE.value,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush()

    if assigned_officer:
        assignment = CaseAssignment(
            case_id=case.id,
            user_id=assigned_officer.id,
            role_in_case="case_manager",
            assigned_at=now,
        )
        db.add(assignment)

    db.commit()
    return client_user, profile, case


# ==============================================================================
# TEST 1: Firm A requests Firm B case/document -> Denied without metadata leakage
# ==============================================================================

def test_cross_tenant_case_and_document_denied_without_metadata_leakage(client, db):
    org_a = _create_org(db, "Firm Alpha Law", "firm-alpha-law")
    org_b = _create_org(db, "Firm Beta Legal", "firm-beta-legal")

    officer_a, _, _ = _create_user(db, org_a, "officer_a@alpha.com", "Officer Alpha", RoleCode.CASE_WORKER)
    _, _, case_b = _create_client_with_case(db, org_b)

    # Document in Firm B
    doc_b = Document(
        organization_id=org_b.id,
        case_id=case_b.id,
        title="Beta Confidential Strategy.pdf",
        filename="strategy.pdf",
        storage_path="/secure/vault/b/strategy.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        category="supporting_evidence",
        processing_status="completed",
        verification_status="verified",
    )
    db.add(doc_b)
    db.commit()

    headers_a = {
        "X-Organization-Id": str(org_a.id),
        "X-User-Id": str(officer_a.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }

    # 1. Firm A officer requests Firm B's case
    case_resp = client.get(f"/api/v1/cases/{case_b.id}", headers=headers_a)
    assert case_resp.status_code == 403
    msg = case_resp.json()["message"]
    assert "Cross-tenant access forbidden" in msg
    # VERIFY NO METADATA LEAKAGE: Neither target org ID, title, or internal notes exposed
    assert str(org_b.id) not in msg
    assert case_b.title not in msg
    assert case_b.case_number not in msg

    # 2. Firm A officer requests Firm B's document
    doc_resp = client.get(f"/api/v1/documents/{doc_b.id}", headers=headers_a)
    assert doc_resp.status_code == 403
    doc_msg = doc_resp.json()["message"]
    assert "Cross-tenant access forbidden" in doc_msg
    assert str(org_b.id) not in doc_msg
    assert "Beta Confidential Strategy" not in doc_msg


# ==============================================================================
# TEST 2: Unassigned officer requests chat -> Denied unless explicitly authorized
# ==============================================================================

def test_unassigned_officer_chat_access_denied_unless_authorized(client, db):
    org = _create_org(db, "Global Migration Advocates", "global-migration-adv")

    officer_assigned, _, _ = _create_user(db, org, "assigned@global.com", "Officer Assigned", RoleCode.CASE_WORKER)
    officer_unassigned, _, _ = _create_user(db, org, "unassigned@global.com", "Officer Unassigned", RoleCode.CASE_WORKER)
    firm_manager, _, _ = _create_user(db, org, "manager@global.com", "Firm Manager", RoleCode.COMPANY_ADMIN)

    client_user, _, case = _create_client_with_case(db, org, assigned_officer=officer_assigned)

    # Create thread in case
    now = now_utc()
    thread = MessageThread(
        organization_id=org.id,
        case_id=case.id,
        subject="USCIS Request for Initial Evidence",
        thread_type="case_update",
        channel_category="client",
        status="open",
        created_by_user_id=officer_assigned.id,
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.commit()

    headers_unassigned = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(officer_unassigned.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }
    headers_assigned = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(officer_assigned.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }
    headers_manager = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(firm_manager.id),
        "X-User-Role": RoleCode.COMPANY_ADMIN.value,
    }

    # 1. Unassigned officer attempts to view chat messages -> 403 Forbidden!
    resp_unassigned = client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_unassigned)
    assert resp_unassigned.status_code == 403
    assert "Case access is restricted to assigned officers" in resp_unassigned.json()["message"]

    # 2. Unassigned officer attempts to post in thread -> 403 Forbidden!
    resp_post_unassigned = client.post(
        f"/api/v1/messaging/threads/{thread.id}/messages",
        json={"content": "Unauthorized caseworker comment"},
        headers=headers_unassigned,
    )
    assert resp_post_unassigned.status_code == 403

    # 3. Assigned officer requests chat messages -> 200 OK
    resp_assigned = client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_assigned)
    assert resp_assigned.status_code == 200

    # 4. Firm manager oversees all firm conversations -> 200 OK
    resp_mgr = client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_manager)
    assert resp_mgr.status_code == 200


# ==============================================================================
# TEST 3: Client requests team chat/internal note -> Denied; content never exposed
# ==============================================================================

def test_client_cannot_access_team_chat_or_internal_notes(client, db):
    org = _create_org(db, "Apex Immigration Law", "apex-imm-law")
    officer, _, _ = _create_user(db, org, "officer@apex.com", "Lead Attorney", RoleCode.SENIOR_REVIEWER)
    client_user, profile, case = _create_client_with_case(db, org, assigned_officer=officer)

    now = now_utc()
    # 1. Client-facing thread with both client-visible message and internal staff note
    client_thread = MessageThread(
        organization_id=org.id,
        case_id=case.id,
        subject="Document Checklist Questions",
        thread_type="client_inquiry",
        channel_category="client",
        status="open",
        created_by_user_id=client_user.id,
        created_at=now,
        updated_at=now,
    )
    # 2. Staff-only internal team chat thread
    team_thread = MessageThread(
        organization_id=org.id,
        case_id=case.id,
        subject="Internal Legal Strategy & Weakness Evaluation",
        thread_type="team",
        channel_category="team",
        is_internal=True,
        status="open",
        created_by_user_id=officer.id,
        created_at=now,
        updated_at=now,
    )
    db.add_all([client_thread, team_thread])
    db.flush()

    # Messages in client thread
    msg_client = Message(
        organization_id=org.id,
        thread_id=client_thread.id,
        sender_id=client_user.id,
        content="I have uploaded my revised CV and diplomas.",
        is_internal=False,
        delivery_status="delivered",
        created_at=now,
    )
    msg_internal_note = Message(
        organization_id=org.id,
        thread_id=client_thread.id,
        sender_id=officer.id,
        content="CONFIDENTIAL STAFF NOTE: Citation count is low for EB-1A. Need 2 more reference letters.",
        is_internal=True,
        delivery_status="delivered",
        created_at=now,
    )
    # Message in team thread
    msg_team = Message(
        organization_id=org.id,
        thread_id=team_thread.id,
        sender_id=officer.id,
        content="TEAM DISCUSSION: Reviewing potential fallback to EB-2 NIW if Kazarian prong 2 fails.",
        is_internal=True,
        delivery_status="delivered",
        created_at=now,
    )
    # Case internal note
    internal_case_note = CaseNote(
        organization_id=org.id,
        case_id=case.id,
        author_id=officer.id,
        note_type="legal_strategy",
        content="Internal evaluation: client exhibits strong publication record but weak major media coverage.",
        is_client_visible=False,
        created_at=now,
        updated_at=now,
    )
    db.add_all([msg_client, msg_internal_note, msg_team, internal_case_note])
    db.commit()

    headers_client = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(client_user.id),
        "X-User-Role": RoleCode.RETAINED_CLIENT.value,
    }

    # 1. Client attempts to access team chat thread -> 403 Forbidden!
    resp_team = client.get(f"/api/v1/messaging/threads/{team_thread.id}/messages", headers=headers_client)
    assert resp_team.status_code == 403
    assert "Internal team chats and staff notes are strictly confidential" in resp_team.json()["message"]

    # 2. Client lists threads -> Team chat thread is COMPLETELY omitted
    resp_threads = client.get("/api/v1/messaging/threads", headers=headers_client)
    assert resp_threads.status_code == 200
    returned_thread_ids = [t["id"] for t in resp_threads.json()]
    assert str(client_thread.id) in returned_thread_ids
    assert str(team_thread.id) not in returned_thread_ids

    # 3. Client gets messages from client thread -> Internal note is COMPLETELY filtered out
    resp_msgs = client.get(f"/api/v1/messaging/threads/{client_thread.id}/messages", headers=headers_client)
    assert resp_msgs.status_code == 200
    msgs = resp_msgs.json()
    assert len(msgs) == 1
    assert msgs[0]["content"] == "I have uploaded my revised CV and diplomas."
    assert "CONFIDENTIAL STAFF NOTE" not in str(resp_msgs.json())

    # 4. Client lists case notes -> Internal staff note is COMPLETELY filtered out
    resp_notes = client.get(f"/api/v1/cases/{case.id}/notes", headers=headers_client)
    assert resp_notes.status_code == 200
    assert len(resp_notes.json()) == 0
    assert "Kazarian" not in str(resp_notes.json())

    # 5. Client attempts to initiate team thread -> 403 Forbidden!
    resp_create_team = client.post(
        "/api/v1/messaging/threads",
        json={
            "case_id": str(case.id),
            "subject": "Client attempting team chat creation",
            "channel_category": "team",
            "thread_type": "team",
        },
        headers=headers_client,
    )
    assert resp_create_team.status_code == 403


# ==============================================================================
# TEST 4: Former employee uses old token -> Denied after revocation
# ==============================================================================

def test_former_employee_token_denied_after_revocation(client, db):
    org = _create_org(db, "Beacon Immigration Partners", "beacon-imm-partners")
    admin, _, _ = _create_user(db, org, "admin@beacon.com", "Partner Admin", RoleCode.COMPANY_ADMIN)

    pwd = "EmployeePassword2026!"
    employee, membership, _ = _create_user(
        db, org, "former_employee@beacon.com", "Departed Caseworker", RoleCode.CASE_WORKER, password=pwd
    )

    # 1. Employee logs in and obtains active access token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "former_employee@beacon.com", "password": pwd},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # 2. Token works while employee is active
    me_resp = client.get("/api/v1/auth/me", headers=auth_header)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "former_employee@beacon.com"

    # 3. Manager offboards employee
    client.cookies.clear()
    headers_admin = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(admin.id),
        "X-User-Role": RoleCode.COMPANY_ADMIN.value,
    }
    offboard_resp = client.post(
        f"/api/v1/organizations/members/{employee.id}/offboard",
        json={"reason": "Voluntary departure; transitioned to corporate sector."},
        headers=headers_admin,
    )
    assert offboard_resp.status_code == 200
    assert offboard_resp.json()["membership_status"] == "inactive"
    assert offboard_resp.json()["sessions_revoked_count"] >= 1

    # 4. Former employee attempts to use old token -> STRICTLY DENIED (401 Unauthorized)!
    denied_resp = client.get("/api/v1/auth/me", headers=auth_header)
    assert denied_resp.status_code == 401
    assert "revoked" in denied_resp.json()["message"].lower() or "inactive" in denied_resp.json()["message"].lower()


# ==============================================================================
# TEST 5: Unauthorized withdrawal attempt -> Denied and audited
# ==============================================================================

def test_unauthorized_withdrawal_attempt_denied_and_audited(client, db):
    org = _create_org(db, "Vanguard Legal Group", "vanguard-legal")
    caseworker, _, _ = _create_user(db, org, "worker@vanguard.com", "Junior Caseworker", RoleCode.CASE_WORKER)
    _, _, case = _create_client_with_case(db, org, assigned_officer=caseworker)

    headers_worker = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(caseworker.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }

    # Caseworker attempts to withdraw representation
    resp = client.post(
        f"/api/v1/cases/{case.id}/lifecycle/withdraw",
        json={"reason": "Unauthorized caseworker attempting representation withdrawal"},
        headers=headers_worker,
    )
    assert resp.status_code == 403
    assert "Only owner or firm manager can execute representation withdrawal" in resp.json()["message"]

    # Verify audit event was recorded for security inspection
    audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.case_id if hasattr(AuditEvent, "case_id") else AuditEvent.object_id == str(case.id),
            AuditEvent.action == "case.withdrawal.unauthorized_attempt",
        )
        .first()
    )
    assert audit is not None
    assert audit.actor_id == caseworker.id
    assert "Only owner or firm manager" in audit.metadata_json["denial_reason"]


# ==============================================================================
# TEST 6: Client message edit/delete attempted -> Unsupported/denied; message remains immutable
# ==============================================================================

def test_client_message_edit_delete_strictly_denied(client, db):
    org = _create_org(db, "Sovereign Immigration Law", "sovereign-imm")
    officer, _, _ = _create_user(db, org, "counsel@sovereign.com", "Immigration Counsel", RoleCode.SENIOR_REVIEWER)
    client_user, _, case = _create_client_with_case(db, org, assigned_officer=officer)

    now = now_utc()
    thread = MessageThread(
        organization_id=org.id,
        case_id=case.id,
        subject="Statutory Filing Timeline",
        thread_type="client_inquiry",
        channel_category="client",
        status="open",
        created_by_user_id=client_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.flush()

    message = Message(
        organization_id=org.id,
        thread_id=thread.id,
        sender_id=client_user.id,
        content="I previously stated my arrival was in June, but it was May.",
        is_internal=False,
        delivery_status="delivered",
        created_at=now,
    )
    db.add(message)
    db.commit()

    headers_client = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(client_user.id),
        "X-User-Role": RoleCode.RETAINED_CLIENT.value,
    }

    # 1. Attempt PUT edit -> 405 Method Not Allowed
    put_resp = client.put(
        f"/api/v1/messaging/messages/{message.id}",
        json={"content": "Tampered altered message content"},
        headers=headers_client,
    )
    assert put_resp.status_code == 405
    assert "strictly immutable" in put_resp.json()["detail"]

    # 2. Attempt DELETE -> 405 Method Not Allowed
    del_resp = client.delete(
        f"/api/v1/messaging/messages/{message.id}",
        headers=headers_client,
    )
    assert del_resp.status_code == 405
    assert "strictly immutable" in del_resp.json()["detail"]

    # 3. Verify message in database is 100% unchanged
    db.refresh(message)
    assert message.content == "I previously stated my arrival was in June, but it was May."


# ==============================================================================
# TEST 7: Manager reassigns case -> Authorized change, preserved history, access updated, event logged
# ==============================================================================

def test_manager_reassigns_case_preserves_history_and_updates_access(client, db):
    org = _create_org(db, "Consortium Legal Services", "consortium-legal")
    manager, _, _ = _create_user(db, org, "partner@consortium.com", "Partner Manager", RoleCode.COMPANY_ADMIN)
    officer_1, _, _ = _create_user(db, org, "officer1@consortium.com", "Primary Officer", RoleCode.CASE_WORKER)
    officer_2, _, _ = _create_user(db, org, "officer2@consortium.com", "Successor Officer", RoleCode.CASE_WORKER)

    client_user, profile, case = _create_client_with_case(db, org, assigned_officer=officer_1)

    now = now_utc()
    target_deadline = now + pytest.importorskip("datetime").timedelta(days=45)
    milestone = CaseMilestone(
        organization_id=org.id,
        case_id=case.id,
        title="Statutory Evidence Submission Window",
        stage="processing",
        target_date=target_deadline,
        status="pending",
        created_at=now,
    )
    thread = MessageThread(
        organization_id=org.id,
        case_id=case.id,
        subject="Case Representation Chat",
        thread_type="client_inquiry",
        channel_category="client",
        status="open",
        created_by_user_id=client_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add_all([milestone, thread])
    db.commit()

    headers_manager = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(manager.id),
        "X-User-Role": RoleCode.COMPANY_ADMIN.value,
    }
    headers_officer_1 = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(officer_1.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }
    headers_officer_2 = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(officer_2.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }

    # Pre-condition: Officer 1 has chat access, Officer 2 is denied
    assert client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_officer_1).status_code == 200
    assert client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_officer_2).status_code == 403

    # Manager executes reassignment
    reassign_resp = client.post(
        f"/api/v1/cases/{case.id}/lifecycle/reassign",
        json={
            "new_user_id": str(officer_2.id),
            "role_in_case": "case_manager",
            "notify_client": True,
        },
        headers=headers_manager,
    )
    assert reassign_resp.status_code == 200

    # 1. Verify history and milestones preserved
    db.refresh(case)
    db.refresh(milestone)
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS.value
    assert milestone.target_date.replace(tzinfo=None) == target_deadline.replace(tzinfo=None)

    # 2. Access updated: Officer 2 now HAS access, Officer 1 is DENIED
    assert client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_officer_2).status_code == 200
    assert client.get(f"/api/v1/messaging/threads/{thread.id}/messages", headers=headers_officer_1).status_code == 403

    # 3. Audit event logged
    audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.object_id == str(case.id),
            AuditEvent.action == "case.owner_reassigned",
        )
        .first()
    )
    assert audit is not None
    assert audit.metadata_json["previous_user_id"] == str(officer_1.id)
    assert audit.metadata_json["new_user_id"] == str(officer_2.id)

    # 4. Client notified
    notification = (
        db.query(Notification)
        .filter(
            Notification.user_id == client_user.id,
            Notification.type == "case_update",
        )
        .first()
    )
    assert notification is not None
    assert "Officer Assigned" in notification.title
    assert "Successor Officer" in notification.body
