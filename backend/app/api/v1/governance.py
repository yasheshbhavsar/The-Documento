"""backend/app/api/v1/governance.py

Phase 13 API endpoints for Pilot Cohorts, Stress-Testing Suite,
Comparative Workflow KPIs, Deterministic Release Gates, and Operational Runbooks.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.models import User
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.rbac import RoleCode
from backend.app.operations.governance_service import (
    PilotGovernanceService,
    ComparativeWorkflowService,
    StressTestingSuiteService,
    ReleaseGateService,
    OperationalRunbookService,
    REQUIRED_STRESS_SCENARIOS,
    PILOT_VALIDATED_PATHWAYS,
)
from backend.app.core.errors import ValidationError, NotFoundError

router = APIRouter(prefix="/governance", tags=["governance"])


# --- Schemas ---

class PilotCohortCreateRequest(BaseModel):
    cohort_name: str = Field(..., min_length=2, max_length=100)
    firm_tier: str = Field("small_firm", description="small_firm, medium_firm, or boutique")
    max_cases_allowed: int = Field(25, ge=1, le=100)
    allowed_pathways: Optional[List[str]] = None
    synthetic_data_attestation: bool = True
    unapproved_ai_block_enabled: bool = True
    assigned_lead_email: str = "pilot-lead@lexfirm.com"
    notes: Optional[str] = None


class PilotCohortResponse(BaseModel):
    id: str
    organization_id: str
    cohort_name: str
    firm_tier: str
    status: str
    max_cases_allowed: int
    allowed_pathways: List[str]
    synthetic_data_attestation: bool
    unapproved_ai_block_enabled: bool
    assigned_lead_email: str
    start_date: datetime
    target_end_date: Optional[datetime]
    notes: Optional[str]
    created_at: datetime


class PilotCohortStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="active, graduated, suspended, completed, or paused")


class CompareWorkflowRequest(BaseModel):
    period_label: str = Field("Q4-Pilot-Evaluation", max_length=64)
    pathway_key: str = Field("CA_EXPRESS_ENTRY_FSW", max_length=64)
    baseline_workflow_hours: float = Field(..., gt=0)
    documento_workflow_hours: float = Field(..., ge=0)
    correction_rate_percentage: float = 3.5
    false_positive_flags_count: int = 1
    missed_exceptions_count: int = 0
    package_rework_rate_percentage: float = 2.0
    operational_failures_count: int = 0
    cohort_id: Optional[str] = None


class QuickCalcWorkflowRequest(BaseModel):
    baseline_workflow_hours: float = Field(..., gt=0)
    documento_workflow_hours: float = Field(..., ge=0)


class PilotKPIBenchmarkResponse(BaseModel):
    id: str
    period_label: str
    pathway_key: str
    baseline_workflow_hours: float
    documento_workflow_hours: float
    time_saved_hours: float
    time_saved_percentage: float
    correction_rate_percentage: float
    false_positive_flags_count: int
    missed_exceptions_count: int
    package_rework_rate_percentage: float
    operational_failures_count: int
    operational_recovery_rate_percentage: float
    created_at: datetime


class StressTestExecutionResponse(BaseModel):
    id: str
    scenario_key: str
    scenario_name: str
    status: str
    execution_notes: str
    metrics: Dict[str, Any]
    executed_at: datetime
    executed_by_name: str


class ReleaseGateSignoffRequest(BaseModel):
    signoff_notes: str = Field("Managing Partner sign-off for production deployment", min_length=5)


class ReleaseGateEvaluationResponse(BaseModel):
    id: str
    evaluation_version: str
    overall_status: str
    gates: List[Dict[str, Any]]
    evaluated_at: datetime
    evaluated_by_name: str
    signed_off_by_owner: bool
    signoff_notes: Optional[str]
    signed_off_at: Optional[datetime]


class OperationalRunbookResponse(BaseModel):
    id: str
    runbook_type: str
    title: str
    content_markdown: str
    metadata: Dict[str, Any]
    last_verified_at: datetime
    verified_by_name: str


# --- Endpoints ---

@router.get("/cohorts", response_model=List[PilotCohortResponse])
def get_pilot_cohorts(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve all pilot cohorts for the current organization."""
    cohorts = PilotGovernanceService.get_cohorts(db, auth.organization_id)
    return [
        PilotCohortResponse(
            id=str(c.id),
            organization_id=str(c.organization_id),
            cohort_name=c.cohort_name,
            firm_tier=c.firm_tier,
            status=c.status,
            max_cases_allowed=c.max_cases_allowed,
            allowed_pathways=c.allowed_pathways_json or [],
            synthetic_data_attestation=c.synthetic_data_attestation,
            unapproved_ai_block_enabled=c.unapproved_ai_block_enabled,
            assigned_lead_email=c.assigned_lead_email,
            start_date=c.start_date,
            target_end_date=c.target_end_date,
            notes=c.notes,
            created_at=c.created_at,
        )
        for c in cohorts
    ]


@router.post("/cohorts", response_model=PilotCohortResponse, status_code=status.HTTP_201_CREATED)
def create_pilot_cohort(
    payload: PilotCohortCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Create a new pilot cohort with limited validated pathways and synthetic data controls."""
    try:
        cohort = PilotGovernanceService.create_cohort(
            db=db,
            organization_id=auth.organization_id,
            cohort_name=payload.cohort_name,
            firm_tier=payload.firm_tier,
            max_cases_allowed=payload.max_cases_allowed,
            allowed_pathways=payload.allowed_pathways,
            synthetic_data_attestation=payload.synthetic_data_attestation,
            unapproved_ai_block_enabled=payload.unapproved_ai_block_enabled,
            assigned_lead_email=payload.assigned_lead_email,
            notes=payload.notes,
        )
        db.commit()
        db.refresh(cohort)
        return PilotCohortResponse(
            id=str(cohort.id),
            organization_id=str(cohort.organization_id),
            cohort_name=cohort.cohort_name,
            firm_tier=cohort.firm_tier,
            status=cohort.status,
            max_cases_allowed=cohort.max_cases_allowed,
            allowed_pathways=cohort.allowed_pathways_json or [],
            synthetic_data_attestation=cohort.synthetic_data_attestation,
            unapproved_ai_block_enabled=cohort.unapproved_ai_block_enabled,
            assigned_lead_email=cohort.assigned_lead_email,
            start_date=cohort.start_date,
            target_end_date=cohort.target_end_date,
            notes=cohort.notes,
            created_at=cohort.created_at,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cohorts/{cohort_id}", response_model=PilotCohortResponse)
def get_pilot_cohort_by_id(
    cohort_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve a single pilot cohort by ID."""
    try:
        cohort_uuid = uuid.UUID(cohort_id)
        cohort = PilotGovernanceService.get_cohort_by_id(db, auth.organization_id, cohort_uuid)
        return PilotCohortResponse(
            id=str(cohort.id),
            organization_id=str(cohort.organization_id),
            cohort_name=cohort.cohort_name,
            firm_tier=cohort.firm_tier,
            status=cohort.status,
            max_cases_allowed=cohort.max_cases_allowed,
            allowed_pathways=cohort.allowed_pathways_json or [],
            synthetic_data_attestation=cohort.synthetic_data_attestation,
            unapproved_ai_block_enabled=cohort.unapproved_ai_block_enabled,
            assigned_lead_email=cohort.assigned_lead_email,
            start_date=cohort.start_date,
            target_end_date=cohort.target_end_date,
            notes=cohort.notes,
            created_at=cohort.created_at,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cohort ID format.")


@router.patch("/cohorts/{cohort_id}/status", response_model=PilotCohortResponse)
@router.post("/cohorts/{cohort_id}/status", response_model=PilotCohortResponse)
def update_pilot_cohort_status(
    cohort_id: str,
    payload: PilotCohortStatusUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Update a pilot cohort's lifecycle status (e.g. active, graduated, suspended)."""
    try:
        cohort_uuid = uuid.UUID(cohort_id)
        cohort = PilotGovernanceService.update_cohort_status(
            db=db,
            organization_id=auth.organization_id,
            cohort_id=cohort_uuid,
            status=payload.status,
        )
        db.commit()
        db.refresh(cohort)
        return PilotCohortResponse(
            id=str(cohort.id),
            organization_id=str(cohort.organization_id),
            cohort_name=cohort.cohort_name,
            firm_tier=cohort.firm_tier,
            status=cohort.status,
            max_cases_allowed=cohort.max_cases_allowed,
            allowed_pathways=cohort.allowed_pathways_json or [],
            synthetic_data_attestation=cohort.synthetic_data_attestation,
            unapproved_ai_block_enabled=cohort.unapproved_ai_block_enabled,
            assigned_lead_email=cohort.assigned_lead_email,
            start_date=cohort.start_date,
            target_end_date=cohort.target_end_date,
            notes=cohort.notes,
            created_at=cohort.created_at,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid cohort ID format.")


@router.get("/kpis", response_model=List[PilotKPIBenchmarkResponse])
def get_kpis(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve comparative workflow KPI benchmarks."""
    benchmarks = ComparativeWorkflowService.get_kpi_benchmarks(db, auth.organization_id)
    return [
        PilotKPIBenchmarkResponse(
            id=str(b.id),
            period_label=b.period_label,
            pathway_key=b.pathway_key,
            baseline_workflow_hours=b.baseline_workflow_hours,
            documento_workflow_hours=b.documento_workflow_hours,
            time_saved_hours=b.time_saved_hours,
            time_saved_percentage=b.time_saved_percentage,
            correction_rate_percentage=b.correction_rate_percentage,
            false_positive_flags_count=b.false_positive_flags_count,
            missed_exceptions_count=b.missed_exceptions_count,
            package_rework_rate_percentage=b.package_rework_rate_percentage,
            operational_failures_count=b.operational_failures_count,
            operational_recovery_rate_percentage=b.operational_recovery_rate_percentage,
            created_at=b.created_at,
        )
        for b in benchmarks
    ]


@router.post("/kpis/compare", response_model=PilotKPIBenchmarkResponse, status_code=status.HTTP_201_CREATED)
def record_kpi_comparison(
    payload: CompareWorkflowRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Record comparative workflow benchmark comparing firm baseline vs Documento platform."""
    try:
        cohort_uuid = uuid.UUID(payload.cohort_id) if payload.cohort_id else None
        bm = ComparativeWorkflowService.record_kpi_benchmark(
            db=db,
            organization_id=auth.organization_id,
            period_label=payload.period_label,
            pathway_key=payload.pathway_key,
            baseline_workflow_hours=payload.baseline_workflow_hours,
            documento_workflow_hours=payload.documento_workflow_hours,
            correction_rate_percentage=payload.correction_rate_percentage,
            false_positive_flags_count=payload.false_positive_flags_count,
            missed_exceptions_count=payload.missed_exceptions_count,
            package_rework_rate_percentage=payload.package_rework_rate_percentage,
            operational_failures_count=payload.operational_failures_count,
            cohort_id=cohort_uuid,
        )
        db.commit()
        db.refresh(bm)
        return PilotKPIBenchmarkResponse(
            id=str(bm.id),
            period_label=bm.period_label,
            pathway_key=bm.pathway_key,
            baseline_workflow_hours=bm.baseline_workflow_hours,
            documento_workflow_hours=bm.documento_workflow_hours,
            time_saved_hours=bm.time_saved_hours,
            time_saved_percentage=bm.time_saved_percentage,
            correction_rate_percentage=bm.correction_rate_percentage,
            false_positive_flags_count=bm.false_positive_flags_count,
            missed_exceptions_count=bm.missed_exceptions_count,
            package_rework_rate_percentage=bm.package_rework_rate_percentage,
            operational_failures_count=bm.operational_failures_count,
            operational_recovery_rate_percentage=bm.operational_recovery_rate_percentage,
            created_at=bm.created_at,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/kpis/quick-calc")
def quick_calculate_workflow(payload: QuickCalcWorkflowRequest):
    """Calculates efficiency metrics on the fly without database persistence."""
    try:
        return ComparativeWorkflowService.compare_workflow(
            baseline_workflow_hours=payload.baseline_workflow_hours,
            documento_workflow_hours=payload.documento_workflow_hours,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stress-tests", response_model=List[StressTestExecutionResponse])
def get_stress_test_executions(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve history of stress-testing executions across the 13 required scenarios."""
    executions = StressTestingSuiteService.get_executions(db, auth.organization_id)
    return [
        StressTestExecutionResponse(
            id=str(e.id),
            scenario_key=e.scenario_key,
            scenario_name=e.scenario_name,
            status=e.status,
            execution_notes=e.execution_notes,
            metrics=e.metrics_json or {},
            executed_at=e.executed_at,
            executed_by_name=e.executed_by_name,
        )
        for e in executions
    ]


@router.post("/stress-tests/{scenario_key}/execute", response_model=StressTestExecutionResponse)
def execute_single_stress_test(
    scenario_key: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Execute a single scenario from the 13 required stress-testing scenarios."""
    try:
        execution = StressTestingSuiteService.execute_scenario(
            db=db,
            organization_id=auth.organization_id,
            scenario_key=scenario_key,
            executed_by_name=f"{auth.email}",
        )
        db.commit()
        db.refresh(execution)
        return StressTestExecutionResponse(
            id=str(execution.id),
            scenario_key=execution.scenario_key,
            scenario_name=execution.scenario_name,
            status=execution.status,
            execution_notes=execution.execution_notes,
            metrics=execution.metrics_json or {},
            executed_at=execution.executed_at,
            executed_by_name=execution.executed_by_name,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stress-tests/execute-all", response_model=List[StressTestExecutionResponse])
def execute_all_stress_tests(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Execute all 13 stress scenarios in a single comprehensive evaluation pass."""
    try:
        executions = StressTestingSuiteService.execute_all_scenarios(
            db=db,
            organization_id=auth.organization_id,
            executed_by_name=f"{auth.email} (Stress Suite)",
        )
        db.commit()
        for e in executions:
            db.refresh(e)
        return [
            StressTestExecutionResponse(
                id=str(e.id),
                scenario_key=e.scenario_key,
                scenario_name=e.scenario_name,
                status=e.status,
                execution_notes=e.execution_notes,
                metrics=e.metrics_json or {},
                executed_at=e.executed_at,
                executed_by_name=e.executed_by_name,
            )
            for e in executions
        ]
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/release-gates", response_model=ReleaseGateEvaluationResponse)
def get_latest_release_gates(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve or dynamically evaluate the 8 mandatory release gates."""
    user = db.query(User).filter(User.id == auth.user_id).first()
    evaluation = ReleaseGateService.evaluate_gates(
        db=db,
        organization_id=auth.organization_id,
        evaluated_by=user,
        evaluation_version="v1.13.0-rc1",
    )
    db.commit()
    db.refresh(evaluation)
    gates_data = evaluation.gates_json.get("gates", [])
    return ReleaseGateEvaluationResponse(
        id=str(evaluation.id),
        evaluation_version=evaluation.evaluation_version,
        overall_status=evaluation.overall_status,
        gates=gates_data,
        evaluated_at=evaluation.evaluated_at,
        evaluated_by_name=evaluation.evaluated_by_name,
        signed_off_by_owner=evaluation.signed_off_by_owner,
        signoff_notes=evaluation.signoff_notes,
        signed_off_at=evaluation.signed_off_at,
    )


@router.post("/release-gates/evaluate", response_model=ReleaseGateEvaluationResponse)
def evaluate_release_gates_endpoint(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Trigger on-demand deterministic evaluation of all 8 release gates."""
    user = db.query(User).filter(User.id == auth.user_id).first()
    evaluation = ReleaseGateService.evaluate_gates(
        db=db,
        organization_id=auth.organization_id,
        evaluated_by=user,
        evaluation_version="v1.13.0-rc1",
    )
    db.commit()
    db.refresh(evaluation)
    gates_data = evaluation.gates_json.get("gates", [])
    return ReleaseGateEvaluationResponse(
        id=str(evaluation.id),
        evaluation_version=evaluation.evaluation_version,
        overall_status=evaluation.overall_status,
        gates=gates_data,
        evaluated_at=evaluation.evaluated_at,
        evaluated_by_name=evaluation.evaluated_by_name,
        signed_off_by_owner=evaluation.signed_off_by_owner,
        signoff_notes=evaluation.signoff_notes,
        signed_off_at=evaluation.signed_off_at,
    )


@router.post("/release-gates/{evaluation_id}/signoff", response_model=ReleaseGateEvaluationResponse)
def signoff_release_gates(
    evaluation_id: str,
    payload: ReleaseGateSignoffRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Owner / Managing Partner authorization for production release."""
    user = db.query(User).filter(User.id == auth.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    try:
        eval_uuid = uuid.UUID(evaluation_id)
        evaluation = ReleaseGateService.signoff_evaluation(
            db=db,
            organization_id=auth.organization_id,
            evaluation_id=eval_uuid,
            owner_user=user,
            notes=payload.signoff_notes,
        )
        db.commit()
        db.refresh(evaluation)
        gates_data = evaluation.gates_json.get("gates", [])
        return ReleaseGateEvaluationResponse(
            id=str(evaluation.id),
            evaluation_version=evaluation.evaluation_version,
            overall_status=evaluation.overall_status,
            gates=gates_data,
            evaluated_at=evaluation.evaluated_at,
            evaluated_by_name=evaluation.evaluated_by_name,
            signed_off_by_owner=evaluation.signed_off_by_owner,
            signoff_notes=evaluation.signoff_notes,
            signed_off_at=evaluation.signed_off_at,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/runbooks", response_model=List[OperationalRunbookResponse])
def get_operational_runbooks(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve pre-launch operational safety pack runbooks (rollback, backup, incident roster, support)."""
    runbooks = OperationalRunbookService.ensure_default_runbooks(db, auth.organization_id)
    db.commit()
    return [
        OperationalRunbookResponse(
            id=str(r.id),
            runbook_type=r.runbook_type,
            title=r.title,
            content_markdown=r.content_markdown,
            metadata=r.metadata_json or {},
            last_verified_at=r.last_verified_at,
            verified_by_name=r.verified_by_name,
        )
        for r in runbooks
    ]


@router.get("/runbooks/{runbook_type}", response_model=OperationalRunbookResponse)
def get_specific_runbook(
    runbook_type: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieve a specific operational runbook by type."""
    try:
        runbook = OperationalRunbookService.get_runbook(db, auth.organization_id, runbook_type)
        return OperationalRunbookResponse(
            id=str(runbook.id),
            runbook_type=runbook.runbook_type,
            title=runbook.title,
            content_markdown=runbook.content_markdown,
            metadata=runbook.metadata_json or {},
            last_verified_at=runbook.last_verified_at,
            verified_by_name=runbook.verified_by_name,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
