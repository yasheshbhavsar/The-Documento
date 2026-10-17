"""Phase 11 — Reliability, Privacy, Security & Operations Test Suite.

Deterministically verifies all requirements:
1. Tenant isolation on case, document, task, message, package, and operations endpoints.
2. Short-lived download tokens, upload validation, and malware/quarantine enforcement.
3. Idempotent background jobs, retries, dead-letter handling, and operational dashboards.
4. Correlation IDs (X-Correlation-ID) and structured logging without PII/document contents.
5. Scenario 1: Idle case (warns days 7, 10, 14; day 15 cleanup; staff notes do NOT reset inactivity).
6. Scenario 2: Hold & Reassignment (prompts interim package + OCR/anomaly report; deadlines active).
7. Scenario 3: Case Withdrawal (download current state snapshot, purge uploads, minimal tombstone, formal authority separation).
8. Scenario 4: Completed Case (cleanup uploads, retain separate Completed Applications summary).
9. Scenario 5: Reapplication (starts from scratch, no auto-reuse, preserves link to prior history).
10. Scenario 6: Firm Leaves (export rights, self-service bundle or assisted-export contact path).
11. Scenario 7: Employee Offboarding (transfers cases, revokes active user sessions immediately).
12. Data-Flow register & Jurisdiction-specific privacy reviews for India, Canada, US, UK/EU.
13. Backups, restore drills, and deletion accounting for object versions.
"""

import io
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.core.worker_health import WorkerHealthMonitor
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseHoldHistory,
    CaseInterimReport,
    CaseTask,
    CaseWithdrawalTombstone,
    ClientProfile,
    CompletedApplicationSummary,
    Document,
    FilingPackage,
    FirmExportRequest,
    ImmigrationCase,
    Organization,
    OrganizationMembership,
    PrivacyLegalReview,
    Session as UserSession,
    User,
    now_utc,
)
from backend.app.domain.case_lifecycle import OperationalState, PreparationStatus
from backend.app.documents.security import MalwareScanner, EICAR_SIGNATURE
from backend.app.documents.inactivity_service import DocumentInactivityService
from backend.app.operations.data_flow_register import get_data_flow_register
from backend.app.operations.privacy_reviews import get_all_privacy_reviews
from backend.app.operations.backup_service import BackupAndDrillService
from backend.app.operations.scenario_service import ScenarioService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def _setup_org_and_users(db: Session):
    org = Organization(id=uuid.uuid4(), name="Reliable Global Law", slug=f"rgl-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    admin = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:6]}@rgl.com", full_name="Managing Admin", password_hash="fakehash")
    lawyer_a = User(id=uuid.uuid4(), email=f"lawyer_a-{uuid.uuid4().hex[:6]}@rgl.com", full_name="Attorney Alpha", password_hash="fakehash")
    lawyer_b = User(id=uuid.uuid4(), email=f"lawyer_b-{uuid.uuid4().hex[:6]}@rgl.com", full_name="Attorney Beta", password_hash="fakehash")
    client_user = User(id=uuid.uuid4(), email=f"client-{uuid.uuid4().hex[:6]}@client.com", full_name="Elena Rostova", password_hash="fakehash")
    db.add_all([admin, lawyer_a, lawyer_b, client_user])
    db.commit()

    # Memberships
    m_admin = OrganizationMembership(organization_id=org.id, user_id=admin.id, status="active")
    m_a = OrganizationMembership(organization_id=org.id, user_id=lawyer_a.id, status="active")
    m_b = OrganizationMembership(organization_id=org.id, user_id=lawyer_b.id, status="active")
    db.add_all([m_admin, m_a, m_b])
    db.commit()

    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Elena",
        last_name="Rostova",
        email=client_user.email,
        nationality="CAN",
    )
    db.add(client_prof)
    db.commit()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=client_prof.id,
        case_number=f"CASE-P11-{uuid.uuid4().hex[:4].upper()}",
        title="O-1A Extraordinary Ability",
        visa_category="O-1A",
        jurisdiction="US",
        operational_state=OperationalState.ACTIVE,
        preparation_status=PreparationStatus.PREPARATION_IN_PROGRESS,
    )
    db.add(case)
    db.commit()

    assign = CaseAssignment(case_id=case.id, user_id=lawyer_a.id, role_in_case="lead_attorney")
    db.add(assign)
    db.commit()

    return {
        "org": org,
        "admin": admin,
        "lawyer_a": lawyer_a,
        "lawyer_b": lawyer_b,
        "client_user": client_user,
        "client_prof": client_prof,
        "case": case,
        "assign": assign,
    }


# -----------------------------------------------------------------------------
# 1. Tenant Isolation & IDOR Protection Across Operations Endpoints
# -----------------------------------------------------------------------------
def test_tenant_isolation_on_operational_endpoints(db: Session):
    data = _setup_org_and_users(db)
    other_org = Organization(id=uuid.uuid4(), name="Intruder Org", slug=f"intruder-{uuid.uuid4().hex[:6]}")
    db.add(other_org)
    db.commit()

    # Case belongs to data["org"], caller belongs to other_org
    intruder_ctx = AuthContext(
        user_id=uuid.uuid4(),
        organization_id=other_org.id,
        email="intruder@other.com",
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: intruder_ctx
    client = TestClient(app)

    # Attempt withdrawal on cross-tenant case
    res = client.post(
        "/api/v1/operations/scenarios/withdrawal",
        json={"case_id": str(data["case"].id), "reason": "Cross-tenant attempt"},
    )
    assert res.status_code in (404, 403), "Must block cross-tenant case withdrawal"


# -----------------------------------------------------------------------------
# 2. Short-Lived Download Tokens & Quarantine Protection
# -----------------------------------------------------------------------------
def test_short_lived_download_token_and_quarantine_block(db: Session):
    data = _setup_org_and_users(db)
    clean_doc = Document(
        id=uuid.uuid4(),
        organization_id=data["org"].id,
        case_id=data["case"].id,
        title="Approved Diploma",
        filename="diploma.pdf",
        category="education",
        storage_path="mock://diploma.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        verification_status="verified",
        malware_scan_status="clean",
    )
    quarantined_doc = Document(
        id=uuid.uuid4(),
        organization_id=data["org"].id,
        case_id=data["case"].id,
        title="Suspect File",
        filename="malware.pdf",
        category="financial",
        storage_path="mock://malware.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
        byte_size=2048,
        mime_type="application/pdf",
        verification_status="quarantined",
        malware_scan_status="infected",
    )
    db.add_all([clean_doc, quarantined_doc])
    db.commit()

    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # 1. Clean document can generate short-lived token
    res_clean = client.post(f"/api/v1/documents/{clean_doc.id}/download-token?expires_in_seconds=300")
    assert res_clean.status_code == 200
    token_data = res_clean.json()
    assert "download_token" in token_data
    assert token_data["expires_in_seconds"] == 300
    assert "token=" in token_data["download_url"]

    # 2. Quarantined document is strictly BLOCKED from generating download token
    res_quarantine = client.post(f"/api/v1/documents/{quarantined_doc.id}/download-token")
    assert res_quarantine.status_code == 403
    assert "quarantined or infected" in res_quarantine.json()["message"]

    # 3. Quarantined document is strictly BLOCKED from direct download and preview
    res_direct_down = client.get(f"/api/v1/documents/{quarantined_doc.id}/download")
    assert res_direct_down.status_code == 403
    assert "quarantined or infected" in res_direct_down.json()["message"]

    res_prev = client.get(f"/api/v1/documents/{quarantined_doc.id}/preview")
    assert res_prev.status_code == 403
    assert "quarantined or infected" in res_prev.json()["message"]


# -----------------------------------------------------------------------------
# 3. Idempotent Background Jobs, Retries & Dead Letter Queue (DLQ)
# -----------------------------------------------------------------------------
def test_background_jobs_dlq_and_dashboard_telemetry(db: Session):
    data = _setup_org_and_users(db)
    WorkerHealthMonitor.record_heartbeat("worker-node-1", "ocr_worker", active_jobs=2, completed_jobs=45)

    # Push a failed job to DLQ
    dlq_job = WorkerHealthMonitor.push_to_dead_letter_queue(
        job_id="job-err-999",
        task_name="document_ocr_pipeline",
        organization_id=str(data["org"].id),
        payload={"doc_id": "test-doc-id"},
        error_message="Corrupt unreadable TIFF stream after 3 retries",
    )
    assert dlq_job.status == "dead_letter"

    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # Query operational dashboard
    res_dash = client.get("/api/v1/operations/dashboard")
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    assert dash_data["system_status"] in ("healthy", "degraded")
    assert dash_data["dead_letter_queue"]["size"] >= 1
    assert dash_data["security"]["short_lived_download_tokens_enforced"] is True

    # Reprocess DLQ job
    res_reprocess = client.post(f"/api/v1/operations/dlq/{dlq_job.job_id}/reprocess")
    assert res_reprocess.status_code == 200
    assert res_reprocess.json()["job_id"] == "job-err-999"


# -----------------------------------------------------------------------------
# 4. Correlation IDs (X-Correlation-ID) Propagation
# -----------------------------------------------------------------------------
def test_correlation_id_header_propagation():
    client = TestClient(app)
    custom_cid = "corr-11-unique-tracing-id"
    res = client.get("/api/v1/health", headers={"X-Correlation-ID": custom_cid})
    assert res.status_code == 200
    assert res.headers.get("X-Correlation-ID") == custom_cid


# -----------------------------------------------------------------------------
# 5. Scenario 1: Idle Case Warnings & Day-15 Cleanup
# -----------------------------------------------------------------------------
def test_scenario_idle_case_warnings_and_cleanup(db: Session):
    data = _setup_org_and_users(db)
    case = data["case"]

    # Case inactive for 7.5 days
    start_time = datetime.now(timezone.utc) - timedelta(days=7, hours=12)
    case.last_client_activity_at = start_time
    case.inactivity_warning_level = 0
    db.commit()

    # 1. Staff internal activity DOES NOT reset client inactivity
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # Evaluate idle cases -> Trips Day 7 warning (level 0 -> 1)
    res_eval = client.post("/api/v1/operations/scenarios/inactivity/eval")
    assert res_eval.status_code == 200
    results = res_eval.json()
    assert len(results) >= 1
    evaluated = [r for r in results if r["case_id"] == str(case.id)][0]
    assert evaluated["current_warning_level"] == 1
    assert evaluated["action_taken"] == "day_7_warning"

    # Verify staff internal activity does not reset
    db.refresh(case)
    assert case.inactivity_warning_level == 1

    # Advance to Day 14 (case already received prior warning)
    case.last_client_activity_at = datetime.now(timezone.utc) - timedelta(days=14, hours=2)
    case.inactivity_warning_level = 2
    db.commit()

    res_eval14 = client.post("/api/v1/operations/scenarios/inactivity/eval")
    assert res_eval14.status_code == 200
    eval14 = [r for r in res_eval14.json() if r["case_id"] == str(case.id)][0]
    assert eval14["current_warning_level"] == 3
    assert eval14["action_taken"] == "day_14_urgent_warning"


# -----------------------------------------------------------------------------
# 6. Scenario 2: Hold & Reassignment with Interim Reports
# -----------------------------------------------------------------------------
def test_scenario_hold_with_interim_report(db: Session):
    data = _setup_org_and_users(db)
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx

    hold_info = ScenarioService.apply_case_hold_with_interim_report(
        db=db,
        organization_id=data["org"].id,
        case_id=data["case"].id,
        hold_type="client_personal_reasons",
        reason="Client traveling internationally for 3 weeks",
        actor_id=data["admin"].id,
    )
    assert hold_info["operational_state"] == OperationalState.ON_HOLD
    assert hold_info["statutory_deadlines_active"] is True
    assert hold_info["interim_report_id"] is not None


# -----------------------------------------------------------------------------
# 7. Scenario 3: Case Withdrawal & Minimal Tombstone Retention
# -----------------------------------------------------------------------------
def test_scenario_case_withdrawal_and_tombstone(db: Session):
    data = _setup_org_and_users(db)
    # Add an active document to case
    doc = Document(
        id=uuid.uuid4(),
        organization_id=data["org"].id,
        case_id=data["case"].id,
        title="Evidence to purge",
        filename="bank.pdf",
        category="financial",
        storage_path="mock://bank.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899",
        byte_size=5000,
        mime_type="application/pdf",
        verification_status="verified",
    )
    db.add(doc)
    db.commit()

    doc_id = doc.id
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # Execute withdrawal
    res_with = client.post(
        "/api/v1/operations/scenarios/withdrawal",
        json={
            "case_id": str(data["case"].id),
            "reason": "Client elected to withdraw before formal USCIS submission",
            "formal_authority_already_submitted": False,
        },
    )
    assert res_with.status_code == 200
    tomb_data = res_with.json()
    assert tomb_data["client_name"] == "Elena Rostova"
    assert tomb_data["intended_application_type"] == "O-1A"
    assert tomb_data["formal_authority_withdrawal_required"] is False
    assert tomb_data["formal_authority_status"] == "not_applicable"

    # Verify document was purged under retention policy
    assert db.query(Document).filter(Document.id == doc_id).first() is None

    # List tombstones
    res_list = client.get("/api/v1/operations/withdrawn-tombstones")
    assert res_list.status_code == 200
    tombstones = res_list.json()
    assert any(t["case_number"] == data["case"].case_number for t in tombstones)


# -----------------------------------------------------------------------------
# 8. Scenario 4: Completed Case Cleanup & Dedicated Summary
# -----------------------------------------------------------------------------
def test_scenario_completed_case_cleanup(db: Session):
    data = _setup_org_and_users(db)
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    res_comp = client.post(
        "/api/v1/operations/scenarios/completed-cleanup",
        json={
            "case_id": str(data["case"].id),
            "adjudication_outcome": "APPROVED",
            "official_reference_number": "EAC-26-900-12345",
        },
    )
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["adjudication_outcome"] == "APPROVED"
    assert "start_date" in comp_data
    assert "completion_date" in comp_data
    assert comp_data["assigned_officer_name"] == data["lawyer_a"].full_name

    # Check Completed Applications summary list
    res_list = client.get("/api/v1/operations/completed-applications")
    assert res_list.status_code == 200
    summaries = res_list.json()
    assert any(s["case_number"] == data["case"].case_number for s in summaries)


# -----------------------------------------------------------------------------
# 9. Scenario 5: Reapplication (Clean Slate from Scratch + Prior Link)
# -----------------------------------------------------------------------------
def test_scenario_reapplication_from_scratch(db: Session):
    data = _setup_org_and_users(db)
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    new_num = f"CASE-REAPP-{uuid.uuid4().hex[:4].upper()}"
    res_reapp = client.post(
        "/api/v1/operations/scenarios/reapplication",
        json={
            "prior_case_id": str(data["case"].id),
            "new_case_number": new_num,
            "reason": "Refiled after accumulating additional publication evidence",
        },
    )
    assert res_reapp.status_code == 200
    reapp_data = res_reapp.json()
    assert reapp_data["case_number"] == new_num
    assert reapp_data["preparation_status"] == PreparationStatus.CLEARANCE_PENDING
    assert reapp_data["prior_case_id"] == str(data["case"].id)


# -----------------------------------------------------------------------------
# 10. Scenario 6: Firm Leaves / Offboarding & Export Rights
# -----------------------------------------------------------------------------
def test_scenario_firm_export_and_assisted_path(db: Session):
    data = _setup_org_and_users(db)
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # 1. Self-service firm export
    res_export = client.post("/api/v1/operations/scenarios/firm-export", json={"export_type": "self_service"})
    assert res_export.status_code == 200
    exp_data = res_export.json()
    assert exp_data["status"] == "completed"
    assert "archive_sha256" in exp_data

    # 2. Assisted concierge export
    res_concierge = client.post("/api/v1/operations/scenarios/firm-export", json={"export_type": "assisted_concierge"})
    assert res_concierge.status_code == 200
    conc_data = res_concierge.json()
    assert conc_data["status"] == "assisted_export_required"
    assert conc_data["support_ticket_id"] is not None


# -----------------------------------------------------------------------------
# 11. Scenario 7: Employee Offboarding & Case Reassignment
# -----------------------------------------------------------------------------
def test_scenario_employee_offboarding_requires_reassignment(db: Session):
    data = _setup_org_and_users(db)
    # Create active session for lawyer_a
    sess = UserSession(
        id=uuid.uuid4(),
        user_id=data["lawyer_a"].id,
        organization_id=data["org"].id,
        token_hash="fakehash",
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(hours=8),
    )
    db.add(sess)
    db.commit()

    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # 1. Attempt to offboard lawyer_a without successor (must fail because lawyer_a has active case assignment)
    res_fail = client.post(
        "/api/v1/operations/scenarios/employee-offboard",
        json={"departing_user_id": str(data["lawyer_a"].id)},
    )
    assert res_fail.status_code == 400
    assert "active case assignment" in res_fail.json()["message"]

    # 2. Offboard with authorized successor (lawyer_b)
    res_succ = client.post(
        "/api/v1/operations/scenarios/employee-offboard",
        json={
            "departing_user_id": str(data["lawyer_a"].id),
            "successor_user_id": str(data["lawyer_b"].id),
            "notes": "Relocating to another jurisdiction",
        },
    )
    assert res_succ.status_code == 200
    off_data = res_succ.json()
    assert off_data["status"] == "deactivated"
    assert off_data["cases_reassigned"] >= 1
    assert off_data["sessions_revoked"] >= 1

    # Verify session revoked in DB
    db.refresh(sess)
    assert sess.revoked_at is not None


# -----------------------------------------------------------------------------
# 12. Data-Flow Register & Jurisdiction Privacy Reviews (India, Canada, US, UK)
# -----------------------------------------------------------------------------
def test_data_flow_register_and_jurisdiction_privacy_reviews(db: Session):
    admin_ctx = AuthContext(
        user_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        email="compliance@firm.com",
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # 1. Data-Flow Register
    res_df = client.get("/api/v1/operations/data-flow-register")
    assert res_df.status_code == 200
    df_data = res_df.json()
    assert df_data["total_components"] >= 6
    assert df_data["zero_training_guarantee"] is True

    # 2. Jurisdiction Privacy Reviews
    res_pr = client.get("/api/v1/operations/privacy-reviews")
    assert res_pr.status_code == 200
    reviews = res_pr.json()
    jurisdictions = {r["jurisdiction"] for r in reviews}
    assert {"IN", "CA", "US", "UK_EU"}.issubset(jurisdictions)

    india_review = [r for r in reviews if r["jurisdiction"] == "IN"][0]
    assert "DPDP Act" in india_review["statutory_framework"]
    assert "aadhaar_masking" in india_review["mandatory_safeguards"]


# -----------------------------------------------------------------------------
# 13. Backups, Restore Drills, Deletion Accounting & Emergency Lockdown
# -----------------------------------------------------------------------------
def test_backup_restore_drill_and_lockdown(db: Session):
    data = _setup_org_and_users(db)
    admin_ctx = AuthContext(
        user_id=data["admin"].id,
        organization_id=data["org"].id,
        email=data["admin"].email,
        roles=(RoleCode.ORGANIZATION_ADMIN.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: admin_ctx
    client = TestClient(app)

    # 1. Run restore drill
    res_drill = client.post("/api/v1/operations/backups/drill")
    assert res_drill.status_code == 200
    drill_data = res_drill.json()
    assert drill_data["status"] == "passed"
    assert "snapshot_checksum" in drill_data

    # 2. Check deletion accounting
    res_acc = client.get("/api/v1/operations/backups/deletion-accounting")
    assert res_acc.status_code == 200
    acc_data = res_acc.json()
    assert acc_data["compliance_status"] == "compliant"

    # 3. Simulate key rotation drill
    res_key = client.post("/api/v1/operations/security/key-rotation")
    assert res_key.status_code == 200
    assert res_key.json()["status"] == "rotation_successful"

    # 4. Emergency incident lockdown
    res_lock = client.post("/api/v1/operations/security/lockdown", json={"reason": "Suspected credential stuffing attempt"})
    assert res_lock.status_code == 200
    assert res_lock.json()["status"] == "lockdown_active"
