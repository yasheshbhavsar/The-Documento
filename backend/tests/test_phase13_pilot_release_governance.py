"""Phase 13 — Pilot Governance, Stress-Testing Suite, Comparative KPIs,
Deterministic Release Gates, and Operational Runbooks Test Suite.

Deterministically verifies:
1. Small/Medium firm pilot cohorts with deliberately limited validated pathways and synthetic data controls.
2. Comparative workflow benchmarking (traditional firm baseline vs Documento platform metrics).
3. Deterministic execution of the 13 required stress-testing scenarios.
4. Deterministic evaluation of the 8 mandatory release gates with owner sign-off.
5. Pre-launch operational safety pack (rollback, migration backup, incident contacts, support runbooks, known limitations).
6. Complete REST API endpoints for Phase 13 governance.
"""

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
    PilotCohort,
    PilotStressTestExecution,
    PilotKPIBenchmark,
    ReleaseGateEvaluation,
    OperationalRunbook,
    PrivacyLegalReview,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.rbac import RoleCode
from backend.app.core.errors import ValidationError, NotFoundError
from backend.app.operations.governance_service import (
    PilotGovernanceService,
    ComparativeWorkflowService,
    StressTestingSuiteService,
    ReleaseGateService,
    OperationalRunbookService,
    PILOT_VALIDATED_PATHWAYS,
    REQUIRED_STRESS_SCENARIOS,
)


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def _setup_org_and_users(db: Session):
    org = Organization(
        id=uuid.uuid4(),
        name="Apex Immigration Legal LLP",
        slug=f"apex-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.commit()

    admin = User(
        id=uuid.uuid4(),
        email=f"admin-{uuid.uuid4().hex[:6]}@apexlaw.com",
        full_name="Managing Partner Admin",
        password_hash="fakehash",
    )
    lawyer = User(
        id=uuid.uuid4(),
        email=f"lawyer-{uuid.uuid4().hex[:6]}@apexlaw.com",
        full_name="Senior Attorney Elena",
        password_hash="fakehash",
    )
    db.add_all([admin, lawyer])
    db.commit()

    m_admin = OrganizationMembership(organization_id=org.id, user_id=admin.id, status="active")
    m_lawyer = OrganizationMembership(organization_id=org.id, user_id=lawyer.id, status="active")
    db.add_all([m_admin, m_lawyer])
    db.commit()

    # Seed approved privacy legal reviews to satisfy release gate 6
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
            legal_counsel_signoff_by="Sarah Jenkins, Chief Legal Officer",
            signoff_date=now_utc(),
            valid_until=now_utc() + timedelta(days=365),
            mandatory_safeguards_json={"dpia_completed": True, "dpa_signed": True},
        )
        db.merge(rev)
    db.commit()

    return org, admin, lawyer


# =========================================================================
# 1. Pilot Cohort Governance Tests
# =========================================================================

def test_pilot_cohort_creation_and_defaults(db: Session):
    org, admin, _ = _setup_org_and_users(db)
    cohort = PilotGovernanceService.create_cohort(
        db=db,
        organization_id=org.id,
        cohort_name="Apex Fall Pilot 2026",
        firm_tier="small_firm",
        max_cases_allowed=25,
        synthetic_data_attestation=True,
        unapproved_ai_block_enabled=True,
        assigned_lead_email=admin.email,
    )
    assert cohort.id is not None
    assert cohort.cohort_name == "Apex Fall Pilot 2026"
    assert cohort.firm_tier == "small_firm"
    assert cohort.max_cases_allowed == 25
    assert cohort.synthetic_data_attestation is True
    assert cohort.unapproved_ai_block_enabled is True
    assert set(cohort.allowed_pathways_json) == set(PILOT_VALIDATED_PATHWAYS)


def test_pilot_cohort_invalid_pathway_rejection(db: Session):
    org, admin, _ = _setup_org_and_users(db)
    with pytest.raises(ValidationError) as exc:
        PilotGovernanceService.create_cohort(
            db=db,
            organization_id=org.id,
            cohort_name="Invalid Cohort",
            allowed_pathways=["RU_TEMPORARY_RESIDENCE", "CA_EXPRESS_ENTRY_FSW"],
        )
    assert "not authorized for pilot cohorts" in str(exc.value)


def test_pilot_case_intake_validation(db: Session):
    org, admin, _ = _setup_org_and_users(db)
    # 1. Without cohort, intake allowed
    res1 = PilotGovernanceService.validate_pilot_case_intake(
        db=db,
        organization_id=org.id,
        pathway_key="CA_EXPRESS_ENTRY_FSW",
        is_synthetic_data=False,
    )
    assert res1["status"] == "ALLOWED"
    assert res1["pilot_mode"] is False

    # 2. Create active pilot cohort
    PilotGovernanceService.create_cohort(
        db=db,
        organization_id=org.id,
        cohort_name="Active Pilot",
        allowed_pathways=["CA_EXPRESS_ENTRY_FSW", "US_H1B_SPECIALTY"],
        synthetic_data_attestation=True,
    )

    # 3. Valid intake with whitelisted pathway and synthetic data
    res2 = PilotGovernanceService.validate_pilot_case_intake(
        db=db,
        organization_id=org.id,
        pathway_key="CA_EXPRESS_ENTRY_FSW",
        is_synthetic_data=True,
    )
    assert res2["status"] == "ALLOWED"
    assert res2["pilot_mode"] is True

    # 4. Rejection of unauthorized pathway
    with pytest.raises(ValidationError) as exc_pathway:
        PilotGovernanceService.validate_pilot_case_intake(
            db=db,
            organization_id=org.id,
            pathway_key="JP_HIGHLY_SKILLED",
            is_synthetic_data=True,
        )
    assert "PILOT_PATHWAY_RESTRICTED" in str(exc_pathway.value)

    # 5. Rejection of live sensitive documents during pilot
    with pytest.raises(ValidationError) as exc_data:
        PilotGovernanceService.validate_pilot_case_intake(
            db=db,
            organization_id=org.id,
            pathway_key="CA_EXPRESS_ENTRY_FSW",
            is_synthetic_data=False,
        )
    assert "PILOT_DATA_RESTRICTED" in str(exc_data.value)


# =========================================================================
# 2. Comparative Workflow KPI Tests
# =========================================================================

def test_comparative_workflow_calculation():
    res = ComparativeWorkflowService.compare_workflow(
        baseline_workflow_hours=14.5,
        documento_workflow_hours=3.2,
    )
    assert res["time_saved_hours"] == 11.3
    assert res["time_saved_percentage"] == 77.9
    assert res["efficiency_multiplier"] == 4.53


def test_comparative_kpi_benchmark_persistence(db: Session):
    org, _, _ = _setup_org_and_users(db)
    bm = ComparativeWorkflowService.record_kpi_benchmark(
        db=db,
        organization_id=org.id,
        period_label="Q4-Firm-Pilot",
        pathway_key="CA_EXPRESS_ENTRY_FSW",
        baseline_workflow_hours=16.0,
        documento_workflow_hours=3.5,
        correction_rate_percentage=2.8,
        false_positive_flags_count=1,
        missed_exceptions_count=0,
        package_rework_rate_percentage=1.5,
        operational_failures_count=0,
    )
    assert bm.id is not None
    assert bm.time_saved_hours == 12.5
    assert bm.time_saved_percentage == 78.1
    assert bm.missed_exceptions_count == 0
    assert bm.operational_recovery_rate_percentage == 100.0

    benchmarks = ComparativeWorkflowService.get_kpi_benchmarks(db, org.id)
    assert len(benchmarks) >= 1
    assert benchmarks[0].period_label == "Q4-Firm-Pilot"


# =========================================================================
# 3. Stress-Testing Suite (All 13 Scenarios)
# =========================================================================

@pytest.mark.parametrize("scenario_key", list(REQUIRED_STRESS_SCENARIOS.keys()))
def test_stress_testing_scenarios_all_13_individually(db: Session, scenario_key: str):
    org, admin, _ = _setup_org_and_users(db)
    execution = StressTestingSuiteService.execute_scenario(
        db=db,
        organization_id=org.id,
        scenario_key=scenario_key,
        executed_by_name=admin.full_name,
    )
    assert execution.id is not None
    assert execution.scenario_key == scenario_key
    assert execution.status == "passed"
    assert execution.scenario_name == REQUIRED_STRESS_SCENARIOS[scenario_key]["name"]
    assert len(execution.execution_notes) > 10
    assert isinstance(execution.metrics_json, dict)


def test_stress_testing_execute_all(db: Session):
    org, admin, _ = _setup_org_and_users(db)
    results = StressTestingSuiteService.execute_all_scenarios(
        db=db,
        organization_id=org.id,
        executed_by_name="Automated Test Runner",
    )
    assert len(results) == 13
    keys_executed = {r.scenario_key for r in results}
    assert keys_executed == set(REQUIRED_STRESS_SCENARIOS.keys())
    assert all(r.status == "passed" for r in results)


# =========================================================================
# 4. Release Gates Evaluation & Owner Sign-Off Tests
# =========================================================================

def test_release_gates_evaluation_and_signoff(db: Session):
    org, admin, lawyer = _setup_org_and_users(db)

    # 1. Evaluate gates
    evaluation = ReleaseGateService.evaluate_gates(
        db=db,
        organization_id=org.id,
        evaluated_by=admin,
        evaluation_version="v1.13.0-rc1",
    )
    assert evaluation.id is not None
    assert evaluation.overall_status == "PASSED"
    assert evaluation.signed_off_by_owner is False

    gates = evaluation.gates_json["gates"]
    assert len(gates) == 8
    assert all(g["status"] == "PASSED" for g in gates)

    # 2. Owner sign-off
    signed_evaluation = ReleaseGateService.signoff_evaluation(
        db=db,
        organization_id=org.id,
        evaluation_id=evaluation.id,
        owner_user=admin,
        notes="Managing Partner formally authorizes production deployment",
    )
    assert signed_evaluation.signed_off_by_owner is True
    assert signed_evaluation.signoff_notes == "Managing Partner formally authorizes production deployment"
    assert signed_evaluation.signed_off_at is not None


# =========================================================================
# 5. Operational Runbooks Tests
# =========================================================================

def test_operational_runbooks_catalog(db: Session):
    org, _, _ = _setup_org_and_users(db)
    runbooks = OperationalRunbookService.ensure_default_runbooks(db, org.id)
    assert len(runbooks) >= 5

    types = {r.runbook_type for r in runbooks}
    expected_types = {
        "rollback_plan",
        "migration_backup",
        "incident_response_roster",
        "support_runbook",
        "known_limitations_catalog",
    }
    assert expected_types.issubset(types)

    # Inspect known limitations content for EU sovereign notice and 150MB upload cap
    kl = OperationalRunbookService.get_runbook(db, org.id, "known_limitations_catalog")
    assert "Regulation (EC) No 810/2009" in kl.content_markdown
    assert "150 megabytes" in kl.content_markdown
    assert "AI never decides legal eligibility" in kl.content_markdown


# =========================================================================
# 6. API Endpoints Tests
# =========================================================================

def test_api_pilot_cohorts(client: TestClient, db: Session):
    org, admin, _ = _setup_org_and_users(db)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Create cohort via API
    payload = {
        "cohort_name": "API Test Cohort",
        "firm_tier": "boutique",
        "max_cases_allowed": 15,
        "synthetic_data_attestation": True,
        "unapproved_ai_block_enabled": True,
        "assigned_lead_email": "pilot@apexlaw.com",
    }
    create_resp = client.post("/api/v1/governance/cohorts", json=payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["cohort_name"] == "API Test Cohort"
    assert created_data["max_cases_allowed"] == 15

    # 2. List cohorts
    list_resp = client.get("/api/v1/governance/cohorts")
    assert list_resp.status_code == 200
    cohorts_list = list_resp.json()
    assert len(cohorts_list) >= 1
    assert cohorts_list[0]["cohort_name"] == "API Test Cohort"

    # 3. Get single cohort by ID
    cohort_id = created_data["id"]
    get_resp = client.get(f"/api/v1/governance/cohorts/{cohort_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["cohort_name"] == "API Test Cohort"

    # 4. Update cohort status
    status_resp = client.patch(f"/api/v1/governance/cohorts/{cohort_id}/status", json={"status": "graduated"})
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "graduated"


def test_api_kpis_and_calc(client: TestClient, db: Session):
    org, admin, _ = _setup_org_and_users(db)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Quick calc
    calc_resp = client.post("/api/v1/governance/kpis/quick-calc", json={
        "baseline_workflow_hours": 20.0,
        "documento_workflow_hours": 4.0,
    })
    assert calc_resp.status_code == 200
    assert calc_resp.json()["time_saved_hours"] == 16.0
    assert calc_resp.json()["time_saved_percentage"] == 80.0

    # 2. Record benchmark
    record_resp = client.post("/api/v1/governance/kpis/compare", json={
        "period_label": "Q4-API-Benchmark",
        "pathway_key": "US_H1B_SPECIALTY",
        "baseline_workflow_hours": 18.0,
        "documento_workflow_hours": 3.8,
        "correction_rate_percentage": 2.5,
        "false_positive_flags_count": 1,
        "missed_exceptions_count": 0,
        "package_rework_rate_percentage": 1.8,
        "operational_failures_count": 0,
    })
    assert record_resp.status_code == 201
    assert record_resp.json()["time_saved_hours"] == 14.2

    # 3. List benchmarks
    list_resp = client.get("/api/v1/governance/kpis")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1


def test_api_stress_tests(client: TestClient, db: Session):
    org, admin, _ = _setup_org_and_users(db)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Execute single stress test
    single_resp = client.post("/api/v1/governance/stress-tests/combined_pdfs/execute")
    assert single_resp.status_code == 200
    assert single_resp.json()["scenario_key"] == "combined_pdfs"
    assert single_resp.json()["status"] == "passed"

    # 2. Execute all 13 stress tests
    all_resp = client.post("/api/v1/governance/stress-tests/execute-all")
    assert all_resp.status_code == 200
    all_executions = all_resp.json()
    assert len(all_executions) == 13

    # 3. Get history
    history_resp = client.get("/api/v1/governance/stress-tests")
    assert history_resp.status_code == 200
    assert len(history_resp.json()) >= 14


def test_api_release_gates_and_signoff(client: TestClient, db: Session):
    org, admin, _ = _setup_org_and_users(db)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. Get latest release gates
    get_resp = client.get("/api/v1/governance/release-gates")
    assert get_resp.status_code == 200
    gates_data = get_resp.json()
    assert gates_data["overall_status"] == "PASSED"
    assert len(gates_data["gates"]) == 8
    eval_id = gates_data["id"]

    # 2. Signoff
    signoff_resp = client.post(
        f"/api/v1/governance/release-gates/{eval_id}/signoff",
        json={"signoff_notes": "Partner approval test verification"},
    )
    assert signoff_resp.status_code == 200
    assert signoff_resp.json()["signed_off_by_owner"] is True
    assert signoff_resp.json()["signoff_notes"] == "Partner approval test verification"


def test_api_runbooks(client: TestClient, db: Session):
    org, admin, _ = _setup_org_and_users(db)
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.COMPANY_ADMIN.value,),
    )

    # 1. List runbooks
    list_resp = client.get("/api/v1/governance/runbooks")
    assert list_resp.status_code == 200
    runbooks = list_resp.json()
    assert len(runbooks) >= 5

    # 2. Get specific runbook
    single_resp = client.get("/api/v1/governance/runbooks/rollback_plan")
    assert single_resp.status_code == 200
    assert single_resp.json()["runbook_type"] == "rollback_plan"
    assert "alembic downgrade" in single_resp.json()["content_markdown"]
