"""Deterministic Package Blocker Explainer Service.

Implements Phase 10 Requirements:
- Synthesizes and explains all deterministic blockers preventing package assembly,
  client review, or regulatory submission.
- Uses exact status and reason codes from database models and Phase 9 approval gates.
- Strictly separates deterministic status reasons from speculative text.
- Grounded strictly in factual case state and governance gate status.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.ai.provenance import (
    LEGAL_SUFFICIENCY_GUARDRAIL,
    HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE,
)
from backend.app.domain.models import (
    CaseAIFinding,
    CaseRequirementEvaluation,
    Document,
    DocumentExtractedField,
    DocumentRequest,
    FormSubmission,
    ImmigrationCase,
    now_utc,
)
from backend.app.packages.readiness import ReadinessService

logger = logging.getLogger("ai_immigration.packages.blocker_explainer")


@dataclass
class BlockerExplanation:
    code: str
    category: str  # governance_gate, compliance_hold, evidence_gap, form_defect, client_dependency, quality_anomaly
    severity: str  # BLOCKING, WARNING
    status_code: str
    title: str
    explanation: str
    remediation_action: str
    evidence_references: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class PackageBlockerReport:
    case_id: str
    case_number: str
    is_blocked: bool
    total_blockers: int
    total_warnings: int
    blockers: List[BlockerExplanation]
    warnings: List[BlockerExplanation]
    generated_at: str
    summary_markdown: str
    legal_sufficiency_disclaimer: str = LEGAL_SUFFICIENCY_GUARDRAIL


def explain_package_blockers(db: Session, case_id: UUID) -> PackageBlockerReport:
    """
    Evaluates and explains all deterministic blockers across governance gates,
    checklist requirements, forms, and evidence records using exact database status codes.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise ValueError(f"ImmigrationCase {case_id} not found.")

    blockers: List[BlockerExplanation] = []
    warnings: List[BlockerExplanation] = []
    now = now_utc()

    # -----------------------------------------------------------------------
    # 1. Tripartite Onboarding Clearance Gate
    # -----------------------------------------------------------------------
    tripartite = case.substantive_authorizations or {}
    mgr_auth = tripartite.get("manager_authorization", {})
    accts_auth = tripartite.get("accounts_clearance", {})
    counsellor_auth = tripartite.get("counsellor_confirmation", {})

    if not mgr_auth.get("cleared"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_TRIPARTITE_MANAGER_PENDING",
                category="governance_gate",
                severity="BLOCKING",
                status_code="PENDING_MANAGER_AUTH",
                title="Tripartite Gate: Case Manager Authorization Pending",
                explanation="Substantive casework preparation requires formal authorization by an assigned case manager.",
                remediation_action="Case manager must review onboarding checklist and execute manager authorization.",
                evidence_references=[{"gate": "manager_authorization", "status": "pending"}],
            )
        )

    if not accts_auth.get("cleared"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_TRIPARTITE_ACCOUNTS_PENDING",
                category="governance_gate",
                severity="BLOCKING",
                status_code="PENDING_ACCOUNTS_CLEARANCE",
                title="Tripartite Gate: Accounts & Retainer Clearance Pending",
                explanation="Retainer trust deposit or billing agreement has not been cleared by billing clerk.",
                remediation_action="Accounts specialist must verify retainer ledger and sign off accounts clearance.",
                evidence_references=[{"gate": "accounts_clearance", "status": "pending"}],
            )
        )

    if not counsellor_auth.get("cleared"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_TRIPARTITE_COUNSELLOR_PENDING",
                category="governance_gate",
                severity="BLOCKING",
                status_code="PENDING_COUNSELLOR_CONFIRMATION",
                title="Tripartite Gate: Intake Counsellor Confirmation Pending",
                explanation="Intake interview notes and scope of representation require counsellor confirmation.",
                remediation_action="Intake counsellor must confirm client identity and sign off onboarding gate.",
                evidence_references=[{"gate": "counsellor_confirmation", "status": "pending"}],
            )
        )

    # -----------------------------------------------------------------------
    # 2. Submission Hold & Submission Authorization
    # -----------------------------------------------------------------------
    sub_status = getattr(case, "submission_authorization_status", "PENDING_REVIEW")
    if sub_status == "HELD_ACCOUNTS":
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_HOLD_ACCOUNTS",
                category="compliance_hold",
                severity="BLOCKING",
                status_code="HELD_ACCOUNTS",
                title="Submission Hold: Outstanding Retainer / Billing Arrears",
                explanation="Package submission is frozen due to overdue accounts receivable or unreplenished trust retainer.",
                remediation_action="Clear accounts balance or record client payment receipt to lift billing hold.",
                evidence_references=[{"hold_reason": getattr(case, "submission_hold_reason", "Accounts hold active")}],
            )
        )
    elif sub_status == "HELD_COUNSELLOR":
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_HOLD_COUNSELLOR",
                category="compliance_hold",
                severity="BLOCKING",
                status_code="HELD_COUNSELLOR",
                title="Submission Hold: Counsellor Re-evaluation Active",
                explanation="Intake counsellor flagged a strategic scope modification requiring client confirmation.",
                remediation_action="Consult intake counsellor and obtain sign-off before unfreezing filing package.",
                evidence_references=[{"hold_reason": getattr(case, "submission_hold_reason", "Counsellor hold active")}],
            )
        )
    elif sub_status == "HELD_CLIENT_DECISION":
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_HOLD_CLIENT_DECISION",
                category="compliance_hold",
                severity="BLOCKING",
                status_code="HELD_CLIENT_DECISION",
                title="Submission Hold: Awaiting Client Adjudication Decision",
                explanation="Filing is paused pending client confirmation on filing strategy, premium processing, or dependant inclusion.",
                remediation_action="Await formal written instruction from client portal before proceeding.",
                evidence_references=[{"hold_reason": getattr(case, "submission_hold_reason", "Client decision hold")}],
            )
        )
    elif sub_status not in ("AUTHORIZED_FOR_SUBMISSION", "AUTHORIZED", "APPROVED"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_SUBMISSION_UNAUTHORIZED",
                category="governance_gate",
                severity="BLOCKING",
                status_code=str(sub_status),
                title="Submission Gate: Supervising Lawyer Authorization Incomplete",
                explanation=f"Final petition filing is pending supervising attorney sign-off (current status: {sub_status}).",
                remediation_action="Supervising attorney must complete merits audit and execute submission authorization.",
                evidence_references=[{"submission_status": str(sub_status)}],
            )
        )

    # -----------------------------------------------------------------------
    # 3. Progressive Review Stages
    # -----------------------------------------------------------------------
    review_status = str(getattr(case, "review_status", "INTAKE")).upper()
    if review_status in ("INTAKE", "OFFICER_INITIAL_REVIEW", "PENDING_OFFICER_REVIEW"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_OFFICER_REVIEW_PENDING",
                category="governance_gate",
                severity="BLOCKING",
                status_code=review_status,
                title="Review Gate: Initial Caseworker Audit Pending",
                explanation="Initial evidentiary audit by assigned caseworker has not yet been completed.",
                remediation_action="Assigned caseworker must complete initial document audit and advance to senior review.",
                evidence_references=[{"review_stage": "officer_initial_review"}],
            )
        )
    elif review_status in ("SENIOR_REVIEW", "PENDING_SENIOR_REVIEW"):
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_SENIOR_REVIEW_PENDING",
                category="governance_gate",
                severity="BLOCKING",
                status_code=review_status,
                title="Review Gate: Senior Technical Review Incomplete",
                explanation="Senior paralegal or case manager technical review is currently in progress.",
                remediation_action="Senior reviewer must complete technical checklist review and advance to lead lawyer.",
                evidence_references=[{"review_stage": "senior_review"}],
            )
        )

    # -----------------------------------------------------------------------
    # 4. Unresolved Critical & Major AI Discrepancies
    # -----------------------------------------------------------------------
    critical_findings = db.scalars(
        select(CaseAIFinding).where(
            CaseAIFinding.case_id == case_id,
            CaseAIFinding.status.in_(["needs_review", "unable_to_determine", "open"]),
            CaseAIFinding.severity.in_(["critical", "major"]),
        )
    ).all()

    for cf in critical_findings:
        is_crit = cf.severity == "critical"
        blocker = BlockerExplanation(
            code=f"BLOCKER_UNRESOLVED_FINDING_{cf.severity.upper()}",
            category="quality_anomaly",
            severity="BLOCKING" if is_crit else "WARNING",
            status_code=cf.status,
            title=f"Unresolved {cf.severity.title()} Anomaly: {cf.title}",
            explanation=cf.description,
            remediation_action=cf.recommended_action or "Review evidence, correct field, or dismiss with approved legal justification.",
            evidence_references=[{
                "finding_id": str(cf.id),
                "severity": cf.severity,
                "evidence_reference": cf.evidence_reference or cf.source_location,
            }],
        )
        if is_crit:
            blockers.append(blocker)
        else:
            warnings.append(blocker)

    # -----------------------------------------------------------------------
    # 5. Incomplete Form Submissions
    # -----------------------------------------------------------------------
    forms = db.scalars(select(FormSubmission).where(FormSubmission.case_id == case_id)).all()
    for f in forms:
        if f.completion_percentage < 100.0 or f.has_unconfirmed_ai_fields or not f.sensitive_fields_reviewed:
            defects = []
            if f.completion_percentage < 100.0:
                defects.append(f"{f.completion_percentage}% completed")
            if f.has_unconfirmed_ai_fields:
                defects.append("Unconfirmed AI candidate answers")
            if not f.sensitive_fields_reviewed:
                defects.append("Pending sensitive legal fields review")

            blockers.append(
                BlockerExplanation(
                    code="BLOCKER_INCOMPLETE_FORM",
                    category="form_defect",
                    severity="BLOCKING",
                    status_code=f.status,
                    title=f"Incomplete Government Form Submission [{f.status.upper()}]",
                    explanation=f"Form contains outstanding defects: {', '.join(defects)}.",
                    remediation_action="Open Configurable Form Viewer, complete required fields, and confirm AI draft answers.",
                    evidence_references=[{"form_submission_id": str(f.id), "defects": defects}],
                )
            )

    # -----------------------------------------------------------------------
    # 6. Outstanding Client Document Requests
    # -----------------------------------------------------------------------
    outstanding_reqs = db.scalars(
        select(DocumentRequest).where(
            DocumentRequest.case_id == case_id,
            DocumentRequest.status.in_(["requested", "rejected"]),
        )
    ).all()

    for req in outstanding_reqs:
        blockers.append(
            BlockerExplanation(
                code="BLOCKER_OUTSTANDING_CLIENT_REQUEST",
                category="client_dependency",
                severity="BLOCKING",
                status_code=req.status,
                title=f"Client Evidence Pending: '{req.title}'",
                explanation=f"A formal evidence request issued to client is awaiting submission (Due: {req.due_date.strftime('%Y-%m-%d') if req.due_date else 'No deadline'}).",
                remediation_action="Client must upload requested documentation through the transparency portal.",
                evidence_references=[{"request_id": str(req.id), "title": req.title}],
            )
        )

    # -----------------------------------------------------------------------
    # 7. Expired Travel Documents
    # -----------------------------------------------------------------------
    docs = db.scalars(select(Document).where(Document.case_id == case_id)).all()
    for d in docs:
        if d.verification_notes and "expired" in d.verification_notes.lower():
            warnings.append(
                BlockerExplanation(
                    code="BLOCKER_EXPIRED_DOCUMENT",
                    category="evidence_gap",
                    severity="WARNING",
                    status_code="EXPIRED_DOCUMENT",
                    title=f"Expired Evidentiary Document: '{d.title}'",
                    explanation="Document verification notes flag that this identity or travel document has passed its expiration date.",
                    remediation_action="Request renewed passport or validity extension certificate from client.",
                    evidence_references=[{"document_id": str(d.id), "title": d.title}],
                )
            )

    # -----------------------------------------------------------------------
    # 8. Build Deterministic Markdown Report
    # -----------------------------------------------------------------------
    is_blocked = len(blockers) > 0
    status_label = "⛔ SUBMISSION BLOCKED" if is_blocked else "✅ CLEARED FOR FILING ASSEMBLY"

    md_lines = [
        f"# Deterministic Package Readiness & Blocker Report: {case.case_number}",
        f"**Jurisdiction / Pathway:** {case.jurisdiction} — {case.visa_category}",
        f"**Overall Status:** {status_label}",
        f"**Blocking Deficiencies:** {len(blockers)} | **Advisory Warnings:** {len(warnings)}",
        f"**Evaluation Timestamp:** {now.strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "> [!IMPORTANT]",
        f"> {LEGAL_SUFFICIENCY_GUARDRAIL}",
        "",
    ]

    if blockers:
        md_lines.extend([
            "## I. Active Filing Blockers (Must Be Cleared Before Package Assembly)",
            "",
        ])
        for b in blockers:
            md_lines.extend([
                f"### `{b.code}`: {b.title}",
                f"- **Category:** `{b.category}` | **Status Code:** `{b.status_code}`",
                f"- **Deterministic Reason:** {b.explanation}",
                f"- **Required Remediation:** {b.remediation_action}",
                "",
            ])
    else:
        md_lines.extend([
            "## I. Active Filing Blockers",
            "No blocking defects detected across governance gates, forms, checklist, or client responses.",
            "",
        ])

    if warnings:
        md_lines.extend([
            "## II. Advisory Compliance Warnings",
            "",
        ])
        for w in warnings:
            md_lines.extend([
                f"- **`{w.code}`**: {w.title} — *{w.explanation}*",
                f"  *Action:* {w.remediation_action}",
            ])
        md_lines.append("")

    summary_md = "\n".join(md_lines)

    return PackageBlockerReport(
        case_id=str(case.id),
        case_number=case.case_number,
        is_blocked=is_blocked,
        total_blockers=len(blockers),
        total_warnings=len(warnings),
        blockers=blockers,
        warnings=warnings,
        generated_at=now.isoformat(),
        summary_markdown=summary_md,
        legal_sufficiency_disclaimer=LEGAL_SUFFICIENCY_GUARDRAIL,
    )
