import uuid
from datetime import datetime, timezone
import pytest
from backend.app.domain.case_service import CaseStage
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseMilestone,
    CaseNote,
    CaseTask,
    ClientConsent,
    ClientDependant,
    ClientProfile,
    ImmigrationCase,
    Organization,
    User,
)
from backend.app.security.rbac import RoleCode


def test_client_registration_with_dependants_and_consents(client, db):
    org = Organization(name="Pacific Immigration Law", slug="pacific-law")
    db.add(org)
    db.flush()

    user_admin = User(email="attorney@pacific.com", full_name="Attorney Chen", status="active")
    db.add(user_admin)
    db.flush()

    headers_admin = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user_admin.id),
        "X-User-Role": RoleCode.COMPANY_ADMIN.value,
    }

    # 1. Create client profile with dependants and consents in initial registration
    payload = {
        "first_name": "Devin",
        "last_name": "Kowalski",
        "email": "devin.kowalski@example.com",
        "phone": "+1 (555) 234-5678",
        "nationality": "POL",
        "passport_number": "POL-998822",
        "dependants": [
            {
                "relationship_type": "spouse",
                "first_name": "Anna",
                "last_name": "Kowalski",
                "email": "anna.kowalski@example.com",
                "nationality": "POL",
                "passport_number": "POL-998823",
                "is_authorized_to_view_case": True,
            },
            {
                "relationship_type": "child",
                "first_name": "Marek",
                "last_name": "Kowalski",
                "nationality": "POL",
                "is_authorized_to_view_case": False,
            },
        ],
        "consents": [
            {
                "consent_type": "representation_g28",
                "granted": True,
                "notes": "Signed Form G-28 for Notice of Entry of Appearance",
            },
            {
                "consent_type": "data_processing_gdpr",
                "granted": True,
                "ip_address": "192.168.1.15",
            },
        ],
    }

    resp = client.post("/api/v1/clients", json=payload, headers=headers_admin)
    assert resp.status_code == 201
    data = resp.json()
    client_id = data["id"]
    assert data["first_name"] == "Devin"
    assert data["dependants_count"] == 2

    # Verify passport is hashed, never stored in plain text
    client_db = db.query(ClientProfile).filter(ClientProfile.id == uuid.UUID(client_id)).first()
    assert client_db.passport_number_hash is not None
    assert "POL-998822" not in client_db.passport_number_hash

    # 2. Check dependants list endpoint
    dep_resp = client.get(f"/api/v1/clients/{client_id}/dependants", headers=headers_admin)
    assert dep_resp.status_code == 200
    deps = dep_resp.json()
    assert len(deps) == 2
    spouse = next(d for d in deps if d["relationship_type"] == "spouse")
    assert spouse["first_name"] == "Anna"
    assert spouse["is_authorized_to_view_case"] is True

    # 3. Check consents list endpoint
    consent_resp = client.get(f"/api/v1/clients/{client_id}/consents", headers=headers_admin)
    assert consent_resp.status_code == 200
    consents = consent_resp.json()
    assert len(consents) == 2
    types = {c["consent_type"] for c in consents}
    assert "representation_g28" in types
    assert "data_processing_gdpr" in types


def test_duplicate_record_detection_suggestions(client, db):
    org = Organization(name="Beacon Global Immigration", slug="beacon-global")
    db.add(org)
    db.flush()

    user_staff = User(email="intake@beacon.com", full_name="Intake Specialist", status="active")
    db.add(user_staff)
    db.flush()

    headers_staff = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user_staff.id),
        "X-User-Role": RoleCode.CASE_MANAGER.value,
    }

    # Register an existing client
    create_payload = {
        "first_name": "Tariq",
        "last_name": "Al-Fassi",
        "email": "tariq.alfassi@morocco-ai.org",
        "phone": "+212-6-12345678",
        "nationality": "MAR",
        "passport_number": "MAR-771122",
    }
    create_resp = client.post("/api/v1/clients", json=create_payload, headers=headers_staff)
    assert create_resp.status_code == 201

    # 1. Check duplicate detection with identical email -> High confidence match
    check_email = client.post(
        "/api/v1/clients/check-duplicates",
        json={"email": "tariq.alfassi@morocco-ai.org"},
        headers=headers_staff,
    )
    assert check_email.status_code == 200
    email_data = check_email.json()
    assert email_data["has_duplicates"] is True
    assert email_data["matches"][0]["match_type"] == "email"
    assert email_data["matches"][0]["score"] == 1.0

    # 2. Check duplicate detection with identical passport number
    check_passport = client.post(
        "/api/v1/clients/check-duplicates",
        json={"passport_number": "MAR-771122", "email": "different@example.com"},
        headers=headers_staff,
    )
    assert check_passport.status_code == 200
    passport_data = check_passport.json()
    assert passport_data["has_duplicates"] is True
    assert any(m["match_type"] == "passport_hash" for m in passport_data["matches"])

    # 3. Check duplicate detection with matching phone number
    check_phone = client.post(
        "/api/v1/clients/check-duplicates",
        json={"phone": "+212 6 12345678", "first_name": "New Person"},
        headers=headers_staff,
    )
    assert check_phone.status_code == 200
    phone_data = check_phone.json()
    assert phone_data["has_duplicates"] is True
    assert any(m["match_type"] == "phone" for m in phone_data["matches"])

    # 4. Check unique fresh applicant -> No duplicates
    check_unique = client.post(
        "/api/v1/clients/check-duplicates",
        json={"email": "unique.applicant@finland.fi", "passport_number": "FIN-001122"},
        headers=headers_staff,
    )
    assert check_unique.status_code == 200
    assert check_unique.json()["has_duplicates"] is False
    assert len(check_unique.json()["matches"]) == 0


def test_controlled_case_lifecycle_state_machine(client, db):
    org = Organization(name="Lex Immigration Partners", slug="lex-partners")
    db.add(org)
    db.flush()

    staff_user = User(email="manager@lex.com", full_name="Manager John", status="active")
    db.add(staff_user)
    db.flush()

    headers_staff = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(staff_user.id),
        "X-User-Role": RoleCode.CASE_MANAGER.value,
    }

    client_profile = ClientProfile(
        organization_id=org.id,
        first_name="Priya",
        last_name="Nair",
        email="priya.nair@biotech.in",
        nationality="IND",
    )
    db.add(client_profile)
    db.flush()

    # Create Case starting at inquiry
    case_payload = {
        "client_id": str(client_profile.id),
        "case_number": "CASE-US-9911",
        "title": "EB-1A Petition: Priya Nair",
        "jurisdiction": "US",
        "visa_category": "EB-1A",
        "status": CaseStage.INQUIRY.value,
    }
    case_resp = client.post("/api/v1/cases", json=case_payload, headers=headers_staff)
    assert case_resp.status_code == 201
    case_id = case_resp.json()["id"]
    assert case_resp.json()["status"] == "inquiry"

    # Step 1: Valid transition: inquiry -> intake
    s1 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "intake"}, headers=headers_staff)
    assert s1.status_code == 200
    assert s1.json()["status"] == "intake"

    # Step 2: Valid transition: intake -> awaiting_documents
    s2 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "awaiting_documents"}, headers=headers_staff)
    assert s2.status_code == 200
    assert s2.json()["status"] == "awaiting_documents"

    # Step 3: Valid transition: awaiting_documents -> processing
    s3 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "processing"}, headers=headers_staff)
    assert s3.status_code == 200
    assert s3.json()["status"] == "processing"

    # Step 4: Valid transition: processing -> internal_review
    s4 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "internal_review"}, headers=headers_staff)
    assert s4.status_code == 200
    assert s4.json()["status"] == "internal_review"

    # Step 5: Valid transition: internal_review -> ready_for_approval
    s5 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "ready_for_approval"}, headers=headers_staff)
    assert s5.status_code == 200
    assert s5.json()["status"] == "ready_for_approval"

    # Step 6: Valid transition: ready_for_approval -> approved_for_submission
    s6 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "approved_for_submission"}, headers=headers_staff)
    assert s6.status_code == 200
    assert s6.json()["status"] == "approved_for_submission"

    # Step 7: Valid transition: approved_for_submission -> submitted
    s7 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "submitted"}, headers=headers_staff)
    assert s7.status_code == 200
    assert s7.json()["status"] == "submitted"

    # Step 8: Valid transition: submitted -> decision_received
    s8 = client.put(f"/api/v1/cases/{case_id}/status", json={"status": "decision_received"}, headers=headers_staff)
    assert s8.status_code == 200
    assert s8.json()["status"] == "decision_received"

    # Invalid jump: Trying an arbitrary jump that violates the state machine without override -> 400
    invalid_jump = client.put(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "intake"},
        headers=headers_staff,
    )
    assert invalid_jump.status_code == 400
    assert "Invalid case workflow transition" in invalid_jump.json()["message"]


def test_closing_reopening_and_archiving_permissions(client, db):
    org = Organization(name="Summit Immigration Law", slug="summit-law")
    db.add(org)
    db.flush()

    owner_user = User(email="owner@summit.com", full_name="Owner Alice", status="active")
    manager_user = User(email="manager@summit.com", full_name="Manager Bob", status="active")
    client_user = User(email="client@summit.com", full_name="Client Charlie", status="active")
    db.add_all([owner_user, manager_user, client_user])
    db.flush()

    headers_owner = {"X-Organization-Id": str(org.id), "X-User-Id": str(owner_user.id), "X-User-Role": RoleCode.COMPANY_ADMIN.value}
    headers_manager = {"X-Organization-Id": str(org.id), "X-User-Id": str(manager_user.id), "X-User-Role": RoleCode.CASE_MANAGER.value}
    headers_client = {"X-Organization-Id": str(org.id), "X-User-Id": str(client_user.id), "X-User-Role": RoleCode.RETAINED_CLIENT.value}

    profile = ClientProfile(organization_id=org.id, user_id=client_user.id, first_name="Charlie", last_name="Sims", email=client_user.email, nationality="CAN")
    db.add(profile)
    db.flush()

    case = ImmigrationCase(organization_id=org.id, client_id=profile.id, case_number="CASE-CA-1001", title="Express Entry", jurisdiction="CA", visa_category="FSW", status="processing")
    db.add(case)
    db.commit()

    # 1. Retained client CANNOT close the case -> 403 Forbidden
    close_attempt = client.post(
        f"/api/v1/cases/{case.id}/close",
        json={"reason": "I want to close"},
        headers=headers_client,
    )
    assert close_attempt.status_code == 403

    # 2. Case manager CAN close the case
    close_resp = client.post(
        f"/api/v1/cases/{case.id}/close",
        json={"reason": "Visa successfully approved and landing completed", "notes": "File archived with confirmation"},
        headers=headers_manager,
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "closed"

    # 3. Regular manager CANNOT archive (requires elevated admin role)
    archive_attempt = client.post(
        f"/api/v1/cases/{case.id}/archive",
        json={"reason": "Retention limit reached"},
        headers=headers_manager,
    )
    assert archive_attempt.status_code == 403

    # 4. Company admin CAN archive the closed case
    archive_resp = client.post(
        f"/api/v1/cases/{case.id}/archive",
        json={"reason": "Closed file retention compliance"},
        headers=headers_owner,
    )
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    # 5. Case manager CAN reopen the archived case
    reopen_resp = client.post(
        f"/api/v1/cases/{case.id}/reopen",
        json={"reason": "Client requested follow-on PR card renewal", "notes": "Reopened per new agreement"},
        headers=headers_manager,
    )
    assert reopen_resp.status_code == 200
    assert reopen_resp.json()["status"] == "reopened"


def test_case_milestones_and_tasks(client, db):
    org = Organization(name="Global Immigration Group", slug="global-imm")
    db.add(org)
    db.flush()

    staff_user = User(email="attorney@global.com", full_name="Sarah Jenkins", status="active")
    db.add(staff_user)
    db.flush()

    headers_staff = {"X-Organization-Id": str(org.id), "X-User-Id": str(staff_user.id), "X-User-Role": RoleCode.CASE_MANAGER.value}

    profile = ClientProfile(organization_id=org.id, first_name="Kenji", last_name="Sato", email="kenji@corp.jp", nationality="JPN")
    db.add(profile)
    db.flush()

    case = ImmigrationCase(organization_id=org.id, client_id=profile.id, case_number="CASE-US-5501", title="L-1A Transfer", jurisdiction="US", visa_category="L-1A", status="intake")
    db.add(case)
    db.commit()

    # 1. Create milestones
    m1 = client.post(
        f"/api/v1/cases/{case.id}/milestones",
        json={"title": "Foreign Subsidiary Corporate Org Chart Verified", "stage": "intake", "target_date": "2026-11-01T00:00:00Z"},
        headers=headers_staff,
    )
    assert m1.status_code == 201
    m1_id = m1.json()["id"]

    # 2. Update and complete milestone
    m1_update = client.put(
        f"/api/v1/cases/{case.id}/milestones/{m1_id}",
        json={"status": "completed"},
        headers=headers_staff,
    )
    assert m1_update.status_code == 200
    assert m1_update.json()["status"] == "completed"
    assert m1_update.json()["completed_at"] is not None

    # 3. Create task
    task_resp = client.post(
        f"/api/v1/cases/{case.id}/tasks",
        json={
            "title": "Review certified translations of Japanese commercial registry",
            "description": "Ensure official sworn translator seal is affixed",
            "assigned_to_user_id": str(staff_user.id),
            "priority": "high",
            "due_date": "2026-10-25T17:00:00Z",
        },
        headers=headers_staff,
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]
    assert task_resp.json()["is_completed"] is False

    # 4. Complete task
    complete_resp = client.put(
        f"/api/v1/cases/{case.id}/tasks/{task_id}",
        json={"is_completed": True},
        headers=headers_staff,
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["is_completed"] is True
    assert complete_resp.json()["completed_by_user_id"] == str(staff_user.id)


def test_notes_internal_privacy_boundary(client, db):
    org = Organization(name="Apex Legal", slug="apex-legal")
    db.add(org)
    db.flush()

    staff_user = User(email="attorney@apex.com", full_name="Lead Attorney", status="active")
    client_user = User(email="applicant@apex.com", full_name="Client Applicant", status="active")
    db.add_all([staff_user, client_user])
    db.flush()

    headers_staff = {"X-Organization-Id": str(org.id), "X-User-Id": str(staff_user.id), "X-User-Role": RoleCode.CASE_MANAGER.value}
    headers_client = {"X-Organization-Id": str(org.id), "X-User-Id": str(client_user.id), "X-User-Role": RoleCode.RETAINED_CLIENT.value}

    profile = ClientProfile(organization_id=org.id, user_id=client_user.id, first_name="Amina", last_name="Mansoor", email=client_user.email, nationality="EGY")
    db.add(profile)
    db.flush()

    case = ImmigrationCase(organization_id=org.id, client_id=profile.id, case_number="CASE-US-7788", title="O-1A Case", jurisdiction="US", visa_category="O-1A", status="processing")
    db.add(case)
    db.commit()

    # 1. Staff creates confidential internal legal strategy note (NOT visible to client)
    n_internal = client.post(
        f"/api/v1/cases/{case.id}/notes",
        json={"note_type": "legal_strategy", "content": "Confidential legal memo on prong 3 argumentation", "is_client_visible": False},
        headers=headers_staff,
    )
    assert n_internal.status_code == 201

    # 2. Staff creates client-visible communication note
    n_client = client.post(
        f"/api/v1/cases/{case.id}/notes",
        json={"note_type": "client_communication", "content": "Please review and sign draft exhibit index", "is_client_visible": True},
        headers=headers_staff,
    )
    assert n_client.status_code == 201

    # 3. Staff reads notes -> Sees BOTH notes (2 notes)
    staff_view = client.get(f"/api/v1/cases/{case.id}/notes", headers=headers_staff)
    assert staff_view.status_code == 200
    assert len(staff_view.json()) == 2

    # 4. Client reads notes -> Sees ONLY 1 client-visible note! Internal strategy note is strictly filtered
    client_view = client.get(f"/api/v1/cases/{case.id}/notes", headers=headers_client)
    assert client_view.status_code == 200
    client_notes = client_view.json()
    assert len(client_notes) == 1
    assert "draft exhibit index" in client_notes[0]["content"]
    assert "Confidential legal memo" not in client_notes[0]["content"]


def test_authorized_dependant_case_access_control(client, db):
    org = Organization(name="Horizon Legal", slug="horizon-legal")
    db.add(org)
    db.flush()

    primary_user = User(email="primary@horizon.com", full_name="Primary Client", status="active")
    auth_dep_user = User(email="spouse@horizon.com", full_name="Spouse Dependant", status="active")
    unauth_dep_user = User(email="child@horizon.com", full_name="Child Dependant", status="active")
    stranger_user = User(email="stranger@other.com", full_name="Stranger Client", status="active")
    db.add_all([primary_user, auth_dep_user, unauth_dep_user, stranger_user])
    db.flush()

    headers_auth_dep = {"X-Organization-Id": str(org.id), "X-User-Id": str(auth_dep_user.id), "X-User-Role": RoleCode.RETAINED_CLIENT.value}
    headers_unauth_dep = {"X-Organization-Id": str(org.id), "X-User-Id": str(unauth_dep_user.id), "X-User-Role": RoleCode.RETAINED_CLIENT.value}
    headers_stranger = {"X-Organization-Id": str(org.id), "X-User-Id": str(stranger_user.id), "X-User-Role": RoleCode.RETAINED_CLIENT.value}

    profile = ClientProfile(organization_id=org.id, user_id=primary_user.id, first_name="John", last_name="Doe", email=primary_user.email, nationality="AUS")
    db.add(profile)
    db.flush()

    # Dependant 1: Authorized
    dep_auth = ClientDependant(
        organization_id=org.id,
        primary_client_id=profile.id,
        user_id=auth_dep_user.id,
        relationship_type="spouse",
        first_name="Jane",
        last_name="Doe",
        nationality="AUS",
        is_authorized_to_view_case=True,
    )
    # Dependant 2: Unauthorized
    dep_unauth = ClientDependant(
        organization_id=org.id,
        primary_client_id=profile.id,
        user_id=unauth_dep_user.id,
        relationship_type="child",
        first_name="Timmy",
        last_name="Doe",
        nationality="AUS",
        is_authorized_to_view_case=False,
    )
    db.add_all([dep_auth, dep_unauth])
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=profile.id,
        case_number="CASE-AU-2211",
        title="Australian Partner Migration",
        jurisdiction="AU",
        visa_category="Subclass 820",
        status="processing",
    )
    db.add(case)
    db.commit()

    # 1. Authorized dependant CAN list and view the case!
    list_auth = client.get("/api/v1/cases", headers=headers_auth_dep)
    assert list_auth.status_code == 200
    assert len(list_auth.json()) == 1
    assert list_auth.json()[0]["case_number"] == "CASE-AU-2211"

    get_auth = client.get(f"/api/v1/cases/{case.id}", headers=headers_auth_dep)
    assert get_auth.status_code == 200
    assert get_auth.json()["case_number"] == "CASE-AU-2211"

    # 2. Unauthorized dependant CANNOT view the case -> 403 Forbidden!
    list_unauth = client.get("/api/v1/cases", headers=headers_unauth_dep)
    assert list_unauth.status_code == 200
    assert len(list_unauth.json()) == 0

    get_unauth = client.get(f"/api/v1/cases/{case.id}", headers=headers_unauth_dep)
    assert get_unauth.status_code == 403

    # 3. Stranger client cannot view the case -> 403 Forbidden!
    get_stranger = client.get(f"/api/v1/cases/{case.id}", headers=headers_stranger)
    assert get_stranger.status_code == 403


def test_case_list_filtering_sorting_and_pagination(client, db):
    org = Organization(name="Metro Legal Firm", slug="metro-legal")
    db.add(org)
    db.flush()

    staff_user = User(email="lead@metro.com", full_name="Lead Attorney", status="active")
    db.add(staff_user)
    db.flush()

    headers_staff = {"X-Organization-Id": str(org.id), "X-User-Id": str(staff_user.id), "X-User-Role": RoleCode.CASE_MANAGER.value}

    c1 = ClientProfile(organization_id=org.id, first_name="Alice", last_name="Smith", email="alice@corp.com", nationality="GBR")
    c2 = ClientProfile(organization_id=org.id, first_name="Bob", last_name="Jones", email="bob@tech.com", nationality="CAN")
    db.add_all([c1, c2])
    db.flush()

    case_1 = ImmigrationCase(organization_id=org.id, client_id=c1.id, case_number="CASE-US-101", title="EB-1A Alice", jurisdiction="US", visa_category="EB-1A", status="intake")
    case_2 = ImmigrationCase(organization_id=org.id, client_id=c1.id, case_number="CASE-US-102", title="O-1A Alice", jurisdiction="US", visa_category="O-1A", status="processing")
    case_3 = ImmigrationCase(organization_id=org.id, client_id=c2.id, case_number="CASE-GB-103", title="Global Talent Bob", jurisdiction="GB", visa_category="Global Talent", status="processing")
    db.add_all([case_1, case_2, case_3])
    db.commit()

    # 1. Filter by jurisdiction "GB"
    r_gb = client.get("/api/v1/cases?jurisdiction=GB", headers=headers_staff)
    assert r_gb.status_code == 200
    cases_gb = r_gb.json()
    assert len(cases_gb) == 1
    assert cases_gb[0]["case_number"] == "CASE-GB-103"

    # 2. Filter by status "processing"
    r_proc = client.get("/api/v1/cases?status=processing", headers=headers_staff)
    assert r_proc.status_code == 200
    assert len(r_proc.json()) == 2

    # 3. Search query "Alice"
    r_search = client.get("/api/v1/cases?search=Alice", headers=headers_staff)
    assert r_search.status_code == 200
    assert len(r_search.json()) == 2

    # 4. Check paginated endpoint
    r_page = client.get("/api/v1/cases/paginated?limit=2&offset=0", headers=headers_staff)
    assert r_page.status_code == 200
    page_data = r_page.json()
    assert len(page_data["items"]) == 2
    assert page_data["total"] == 3
    assert page_data["limit"] == 2
    assert page_data["offset"] == 0
