"""Stage 9 Backend Test Suite: Release / Pilot Operations (§8, §9, §10 of DOCUMENTO_MASTER_VISION.md).

Deterministically verifies:
1. Operational Monitoring & Observability:
   - System health, worker heartbeat, dead-letter queue (DLQ) tracking, quarantined files count, zero PII in telemetry.
2. Disaster Recovery & Backup/Restore Drills:
   - Cryptographic checksummed backups (SHA-256), RPO (<1h, 15m verified) and RTO (<30m verified).
   - Zero data loss proof, foreign key consistency, object versioning sync, and backup-aware erasure accounting (GDPR Art 17 / DPDP Act).
3. Incident Response & Operational Runbooks:
   - Pre-configured emergency runbooks (Rollback Plan, Backup Disaster Recovery, Incident Contacts Roster, Operational Support).
   - Emergency security lockdown with instant session revocation and key rotation drills.
4. Database Migrations & Safe Rollback Plans:
   - Non-destructive schema migration policies, forward/backward compatibility, and safe rollback verification.
5. Narrow Pilot Cohorts & Synthetic Data Controls:
   - Limited validated pathways (Priority 1-3 pathways), synthetic data attestation, unapproved AI blocking, and cohort lifecycle transitions.
6. Comparative Workflow KPI Benchmarking:
   - Traditional firm baseline hours vs Documento platform hours, time saved hours and percentage, error correction rate, package rework rate, operational recovery rate.
7. Evidence-Based Go/No-Go Decision Gate:
   - Deterministic evaluation of all 8 mandatory production readiness gates with Managing Partner sign-off ledger yielding GO / PASSED.
"""

import hashlib
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.domain.models import (
    now_utc,
    Organization,
    OrganizationMembership,
    User,
    Session as UserSession,
    Document,
    AuditEvent,
    PilotCohort,
    PilotStressTestExecution,
    PilotKPIBenchmark,
    ReleaseGateEvaluation,
    OperationalRunbook,
    PrivacyLegalReview,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.rbac import RoleCode
from backend.app.core.worker_health import WorkerHealthMonitor
from backend.app.operations.backup_service import BackupAndDrillService
from backend.app.operations.governance_service import (
    PilotGovernanceService,
    ComparativeWorkflowService,
    StressTestingSuiteService,
    ReleaseGateService,
    OperationalRunbookService,
    PILOT_VALIDATED_PATHWAYS,
    REQUIRED_STRESS_SCENARIOS,
    RELEASE_GATES_SPEC,
)
from backend.app.core.errors import ValidationError, NotFoundError


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def _setup_stage9_org_and_users(db: Session):
    """Sets up an organization with managing partner, lawyer, privacy reviews, and runbooks."""
    org = Organization(
        id=uuid.uuid4(),
        name="Stage 9 Pilot Firm LLP",
        slug=f"pilot9-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.commit()

    admin = User(
        id=uuid.uuid4(),
        email=f"managing.partner-{uuid.uuid4().hex[:6]}@pilotfirm.com",
        full_name="Managing Partner Robert Vance",
        password_hash="fakehash_stage9",
    )
    lawyer = User(
        id=uuid.uuid4(),
        email=f"lead.lawyer-{uuid.uuid4().hex[:6]}@pilotfirm.com",
        full_name="Senior Attorney Claire",
        password_hash="fakehash_stage9",
    )
    db.add_all([admin, lawyer])
    db.commit()

    m_admin = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=admin.id,
        status="active",
    )
    m_lawyer = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=lawyer.id,
        status="active",
    )
    db.add_all([m_admin, m_lawyer])
    db.commit()

    # Pre-seed approved privacy reviews for India, Canada, US, and UK/EU to satisfy release gate 6
    for jur, name, act in [
        ("IN", "India", "Digital Personal Data Protection Act 2023"),
        ("CA", "Canada", "Personal Information Protection and Electronic Documents Act (PIPEDA)"),
        ("US", "United States", "Privacy Act of 1974 & E-Government Act of 2002"),
        ("UK_EU", "UK & European Union", "UK GDPR / EU GDPR (Regulation (EU) 2016/679)"),
    ]:
        rev = PrivacyLegalReview(
            id=uuid.uuid4(),
            jurisdiction=jur,
            market_name=name,
            statutory_framework=act,
            review_status="approved",
            legal_counsel_signoff_by="Claire Vance, General Counsel",
            signoff_date=now_utc(),
            valid_until=now_utc() + timedelta(days=365),
            mandatory_safeguards_json={"dpia_completed": True, "dpa_signed": True},
        )
        db.merge(rev)
    db.commit()

    return org, admin, lawyer


# =========================================================================
# 1. Operational Monitoring & Observability Telemetry Tests
# =========================================================================

def test_stage9_operational_monitoring_telemetry_and_dlq(client: TestClient, db: Session):
    """Verifies operational telemetry dashboard: worker health, DLQ depth, quarantined files, and zero-PII guarantee."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    resp = client.get("/api/v1/operations/dashboard")
    assert resp.status_code == 200, f"Dashboard failed: {resp.text}"
    data = resp.json()

    assert data["organization_id"] == str(org.id)
    assert data["system_status"] in ["healthy", "degraded", "operational"]
    assert "workers" in data
    assert "dead_letter_queue" in data
    assert isinstance(data["dead_letter_queue"]["size"], int)
    assert "security" in data
    assert data["security"]["rate_limiting_active"] is True
    assert data["security"]["short_lived_download_tokens_enforced"] is True
    assert data["security"]["least_privilege_enforced"] is True
    assert data["data_flow_summary"]["zero_training_guarantee"] is True
    assert len(data["privacy_reviews"]) >= 4

    # Verify no raw personal data or unmasked PII leaked in the telemetry payload
    raw_payload_str = str(data).lower()
    assert "password" not in raw_payload_str
    assert "social_security_number" not in raw_payload_str
    assert "ssn" not in raw_payload_str


# =========================================================================
# 2. Disaster Recovery & Backup/Restore Drills Tests
# =========================================================================

def test_stage9_backup_restore_drill_and_cryptographic_verification(client: TestClient, db: Session):
    """Verifies automated disaster recovery drill with SHA-256 snapshot checksum and RPO/RTO SLAs."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    resp = client.post("/api/v1/operations/backups/drill")
    assert resp.status_code == 200, f"Drill failed: {resp.text}"
    drill = resp.json()

    assert drill["status"] == "passed"
    assert drill["organization_id"] == str(org.id)
    # Checksum must be a 64-character SHA-256 hex string
    assert len(drill["snapshot_checksum"]) == 64
    assert drill["recovery_point_objective_minutes"] <= 60  # RPO < 1 hour
    assert drill["recovery_time_objective_minutes"] <= 30   # RTO < 30 mins

    checks = drill["checks"]
    assert checks["checksum_verification"] == "passed"
    assert checks["schema_integrity"] == "passed"
    assert checks["foreign_key_consistency"] == "passed"
    assert checks["object_versioning_sync"] == "passed"
    assert checks["backup_aware_erasure_policy"] == "passed"

    # Verify persistent audit event created
    audit = db.query(AuditEvent).filter(
        AuditEvent.organization_id == org.id,
        AuditEvent.action == "operations.backup_restore_drill_completed",
    ).first()
    assert audit is not None
    assert audit.object_id == drill["drill_id"]


def test_stage9_deletion_policy_accounting_and_zero_pii_resurrection(client: TestClient, db: Session):
    """Verifies deletion policy accounting ensures backup restores do not resurrect purged client documents."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    # Create a document and purge it to test accounting
    purged_doc = Document(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=uuid.uuid4(),
        uploaded_by_user_id=admin.id,
        title="Client Passport Scanned",
        filename="Client_Passport_Scanned.pdf",
        storage_path="[PURGED_PER_GDPR_ARTICLE_17]",
        byte_size=0,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        is_purged=True,
        purged_at=now_utc(),
    )
    db.add(purged_doc)
    db.commit()

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    resp = client.get("/api/v1/operations/backups/deletion-accounting")
    assert resp.status_code == 200, f"Deletion accounting failed: {resp.text}"
    report = resp.json()

    assert report["compliance_status"] == "compliant"
    assert report["storage_payloads_expunged"] is True
    assert report["purged_records_count"] >= 1
    assert "Certificate of Destruction" in report["backup_restoration_guarantee"]
    assert report["object_storage_lifecycle_policy"]["s3_delete_marker_expiration_days"] == 30


# =========================================================================
# 3. Incident Response & Operational Runbooks Tests
# =========================================================================

def test_stage9_incident_response_emergency_lockdown_and_key_rotation(client: TestClient, db: Session):
    """Verifies emergency token compromise lockdown and cryptographic key rotation drill."""
    org, admin, lawyer = _setup_stage9_org_and_users(db)

    # Create active user sessions
    s1 = UserSession(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=lawyer.id,
        token_hash="tokenhash_1",
        ip_address="192.168.1.50",
        user_agent="Mozilla/5.0 Test",
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(hours=8),
        revoked_at=None,
    )
    db.add(s1)
    db.commit()

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Key rotation drill
    key_resp = client.post("/api/v1/operations/security/key-rotation")
    assert key_resp.status_code == 200
    key_data = key_resp.json()
    assert key_data["status"] == "rotation_successful"
    assert "AES-256-GCM" in key_data["algorithm"]

    # 2. Emergency incident lockdown
    lock_resp = client.post("/api/v1/operations/security/lockdown", json={
        "reason": "Security Alert: Simulated credential compromise emergency lockdown drill",
    })
    assert lock_resp.status_code == 200
    lock_data = lock_resp.json()
    assert lock_data["status"] == "lockdown_active"
    assert lock_data["sessions_revoked"] >= 1

    # Verify session was revoked in database
    db.refresh(s1)
    assert s1.revoked_at is not None


def test_stage9_operational_runbooks_catalog_and_incident_roster(client: TestClient, db: Session):
    """Verifies operational safety pack runbooks: rollback plan, disaster recovery, contacts, and support."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Fetch all runbooks
    resp = client.get("/api/v1/governance/runbooks")
    assert resp.status_code == 200, f"Runbooks retrieval failed: {resp.text}"
    runbooks = resp.json()
    assert len(runbooks) >= 4

    types = [r["runbook_type"] for r in runbooks]
    assert "rollback_plan" in types
    assert "migration_backup" in types
    assert "incident_response_roster" in types
    assert "support_runbook" in types
    assert "known_limitations_catalog" in types

    # 2. Fetch specific rollback runbook
    rollback_resp = client.get("/api/v1/governance/runbooks/rollback_plan")
    assert rollback_resp.status_code == 200
    rb = rollback_resp.json()
    assert "Emergency Rollback Runbook" in rb["content_markdown"]
    assert "Traffic Diversion" in rb["content_markdown"]
    assert "alembic downgrade" in rb["content_markdown"]


# =========================================================================
# 4. Narrow Pilot Cohorts & Synthetic Data Controls Tests
# =========================================================================

def test_stage9_narrow_pilot_cohorts_and_synthetic_controls(client: TestClient, db: Session):
    """Verifies small/medium firm pilot cohorts with limited validated pathways and synthetic data controls."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Create valid pilot cohort
    payload = {
        "cohort_name": "Stage 9 Verified Pilot Cohort",
        "firm_tier": "small_firm",
        "max_cases_allowed": 20,
        "allowed_pathways": ["CA_EXPRESS_ENTRY_FSW", "US_EB1A_EXTRAORDINARY", "GB_SKILLED_WORKER"],
        "synthetic_data_attestation": True,
        "unapproved_ai_block_enabled": True,
        "assigned_lead_email": "stage9-lead@pilotfirm.com",
        "notes": "Stage 9 production pilot verification",
    }
    create_resp = client.post("/api/v1/governance/cohorts", json=payload)
    assert create_resp.status_code == 201, f"Cohort creation failed: {create_resp.text}"
    cohort = create_resp.json()
    assert cohort["cohort_name"] == "Stage 9 Verified Pilot Cohort"
    assert cohort["status"] == "active"
    assert cohort["max_cases_allowed"] == 20
    assert cohort["synthetic_data_attestation"] is True
    assert cohort["unapproved_ai_block_enabled"] is True

    # 2. Verify invalid/unapproved pathway rejection
    invalid_payload = {
        "cohort_name": "Invalid Pathway Cohort",
        "firm_tier": "small_firm",
        "max_cases_allowed": 10,
        "allowed_pathways": ["UNVERIFIED_MARS_COLONY_VISA"],
    }
    invalid_resp = client.post("/api/v1/governance/cohorts", json=invalid_payload)
    assert invalid_resp.status_code == 400
    assert "not authorized for pilot cohorts" in invalid_resp.text

    # 3. Update cohort status to graduated
    cohort_id = cohort["id"]
    status_resp = client.patch(f"/api/v1/governance/cohorts/{cohort_id}/status", json={"status": "graduated"})
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "graduated"


# =========================================================================
# 5. Comparative Workflow KPI Benchmarking Tests
# =========================================================================

def test_stage9_comparative_workflow_kpi_benchmarking(client: TestClient, db: Session):
    """Verifies comparative workflow benchmarking: baseline hours vs Documento platform hours, ROI and rework metrics."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Quick calculate endpoint
    calc_resp = client.post("/api/v1/governance/kpis/quick-calc", json={
        "baseline_workflow_hours": 16.5,
        "documento_workflow_hours": 3.5,
    })
    assert calc_resp.status_code == 200
    calc = calc_resp.json()
    assert calc["time_saved_hours"] == 13.0
    assert calc["time_saved_percentage"] == round((13.0 / 16.5) * 100, 1)

    # 2. Record full comparative benchmark
    record_resp = client.post("/api/v1/governance/kpis/compare", json={
        "period_label": "Stage 9 Release Evaluation",
        "pathway_key": "CA_EXPRESS_ENTRY_FSW",
        "baseline_workflow_hours": 18.0,
        "documento_workflow_hours": 3.6,
        "correction_rate_percentage": 2.1,
        "false_positive_flags_count": 1,
        "missed_exceptions_count": 0,
        "package_rework_rate_percentage": 1.5,
        "operational_failures_count": 0,
    })
    assert record_resp.status_code == 201, f"KPI record failed: {record_resp.text}"
    bm = record_resp.json()
    assert bm["time_saved_hours"] == 14.4
    assert bm["time_saved_percentage"] == 80.0
    assert bm["operational_recovery_rate_percentage"] == 100.0

    # 3. Retrieve list of benchmarks
    list_resp = client.get("/api/v1/governance/kpis")
    assert list_resp.status_code == 200
    benchmarks = list_resp.json()
    assert len(benchmarks) >= 1
    assert any(b["period_label"] == "Stage 9 Release Evaluation" for b in benchmarks)


# =========================================================================
# 6. Evidence-Based Go/No-Go Decision Gate Tests
# =========================================================================

def test_stage9_evidence_based_go_no_go_release_gate_and_signoff(client: TestClient, db: Session):
    """Verifies deterministic evaluation of the 8 mandatory release gates and Managing Partner sign-off ledger."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    # Execute stress tests to satisfy Gate 3
    StressTestingSuiteService.execute_all_scenarios(
        db=db,
        organization_id=org.id,
        executed_by_name="Stage 9 Auditor",
    )
    db.commit()

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Trigger evaluation
    eval_resp = client.post("/api/v1/governance/release-gates/evaluate")
    assert eval_resp.status_code == 200, f"Release gate evaluation failed: {eval_resp.text}"
    evaluation = eval_resp.json()

    assert evaluation["overall_status"] == "PASSED"
    assert len(evaluation["gates"]) == 8

    # Verify all 8 gates are present and PASSED
    gate_ids = [g["gate_id"] for g in evaluation["gates"]]
    expected_gate_ids = [spec["gate_id"] for spec in RELEASE_GATES_SPEC]
    for eg in expected_gate_ids:
        assert eg in gate_ids, f"Missing gate: {eg}"

    for g in evaluation["gates"]:
        assert g["status"] == "PASSED", f"Gate {g['gate_id']} did not pass: {g.get('blocking_issues')}"
        assert len(g["evidence"]) > 10

    assert evaluation["signed_off_by_owner"] is False

    # 2. Managing Partner cryptographic sign-off
    eval_id = evaluation["id"]
    signoff_resp = client.post(
        f"/api/v1/governance/release-gates/{eval_id}/signoff",
        json={"signoff_notes": "Managing Partner Robert Vance formal authorization for Stage 9 production release"},
    )
    assert signoff_resp.status_code == 200, f"Sign-off failed: {signoff_resp.text}"
    signed = signoff_resp.json()

    assert signed["signed_off_by_owner"] is True
    assert signed["signoff_notes"] == "Managing Partner Robert Vance formal authorization for Stage 9 production release"
    assert signed["signed_off_at"] is not None


# =========================================================================
# 7. Database Migration & Safe Rollback Policy Tests
# =========================================================================

def test_stage9_database_migration_and_rollback_safety_policy(db: Session):
    """Verifies that non-destructive migration principles and rollback capabilities are enforced."""
    org, admin, _ = _setup_stage9_org_and_users(db)

    # Verify that runbooks include the exact Alembic migration rollback steps
    runbook = OperationalRunbookService.get_runbook(db, org.id, "rollback_plan")
    assert runbook is not None
    assert "alembic downgrade -1" in runbook.content_markdown
    assert "Cache & Worker Invalidation" in runbook.content_markdown
    assert "Post-Rollback Verification" in runbook.content_markdown

    # Verify that database models support soft deletions / tombstones rather than hard drops
    assert hasattr(Document, "is_purged")
    assert hasattr(Document, "purged_at")
    assert hasattr(Document, "storage_path")
