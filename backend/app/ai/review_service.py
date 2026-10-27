"""AI finding review service, task automation, and resolution lifecycle orchestrator.

Manages finding resolution, dismissal with structured reason, escalation,
and automated creation of casework tasks for critical/major findings.
"""
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import (
    ImmigrationCase,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    CaseTask,
    now_utc,
)
from backend.app.ai.comparators import FieldComparisonResult
from backend.app.ai.quality_detector import detect_document_quality_issues
from backend.app.ai.checklist_engine import audit_case_checklist
from backend.app.ai.form_evidence_detector import analyze_cross_document_consistency
from backend.app.ai.summarizer import generate_evidence_backed_case_summary


VALID_DISMISSAL_REASONS = [
    "acceptable_transliteration",
    "harmless_ocr_artifact",
    "waived_by_counsel",
    "superseded_by_primary_evidence",
    "dependant_or_derivative_document",
    "duplicate_finding",
    "other_documented_rationale",
]


def run_case_ai_analysis(db: Session, case_id: uuid.UUID, organization_id: uuid.UUID) -> List[CaseAIFinding]:
    """Orchestrates comprehensive AI document analysis and discrepancy detection for a case."""
    # 1. Fetch case and client profile
    case_stmt = select(ImmigrationCase).where(
        ImmigrationCase.id == case_id,
        ImmigrationCase.organization_id == organization_id,
    )
    case = db.scalar(case_stmt)
    if not case:
        raise ValueError(f"Case {case_id} not found in organization.")

    client = case.client

    # 2. Fetch all current documents for case
    doc_stmt = select(Document).where(
        Document.case_id == case_id,
        Document.organization_id == organization_id,
        Document.is_current_version == True,
    )
    docs = db.scalars(doc_stmt).all()

    # Prepare document dictionaries with extracted fields
    doc_dicts: List[Dict[str, Any]] = []
    for d in docs:
        fields = [
            {
                "id": str(f.id),
                "field_name": f.field_name,
                "field_label": f.field_label,
                "original_value": f.original_value,
                "normalized_value": f.corrected_value if f.is_manually_corrected else f.normalized_value,
                "source_page": f.source_page,
                "source_location": f.source_location,
                "ocr_confidence": f.ocr_confidence,
                "extraction_confidence": f.extraction_confidence,
                "validation_status": f.validation_status,
                "is_manually_corrected": f.is_manually_corrected,
            }
            for f in d.extracted_fields
        ]
        doc_dicts.append({
            "id": str(d.id),
            "title": d.title,
            "filename": d.filename,
            "category": d.category,
            "page_count": d.page_count,
            "ocr_applied": d.ocr_applied,
            "extracted_text": d.extracted_text,
            "processing_status": d.processing_status,
            "verification_status": d.verification_status,
            "version": d.version,
            "extracted_fields": fields,
        })

    client_dict = {
        "id": str(client.id) if client else "",
        "first_name": client.first_name if client else "",
        "last_name": client.last_name if client else "",
        "nationality": client.nationality if client else "",
        "date_of_birth": client.date_of_birth.isoformat() if client and client.date_of_birth else None,
    }

    case_dict = {
        "id": str(case.id),
        "case_number": case.case_number,
        "jurisdiction": case.jurisdiction,
        "visa_category": case.visa_category,
    }

    # 3. Existing findings to avoid duplicate re-creation of resolved/dismissed items
    existing_findings_stmt = select(CaseAIFinding).where(
        CaseAIFinding.case_id == case_id,
        CaseAIFinding.organization_id == organization_id,
    )
    existing_findings = db.scalars(existing_findings_stmt).all()
    existing_map = {f.title: f for f in existing_findings}

    created_or_updated: List[CaseAIFinding] = []

    # 4. Run Cross-Document & Form Consistency Engine
    discrepancy_results = analyze_cross_document_consistency(client_dict, case_dict, doc_dicts)
    for d in discrepancy_results:
        if d.title in existing_map:
            ex = existing_map[d.title]
            # Preserve reviewer's resolution or dismissal
            if ex.status in ["resolved", "dismissed"]:
                continue
            ex.description = d.description
            ex.severity = d.severity
            ex.uncertainty_limitations = d.uncertainty_limitations
            created_or_updated.append(ex)
            continue

        doc_ref_id = None
        if d.related_documents and len(d.related_documents) > 0:
            try:
                doc_ref_id = uuid.UUID(d.related_documents[0]["id"])
            except Exception:
                pass

        now = now_utc()
        target_due = now + timedelta(days=3 if d.severity == "critical" else 7)
        ev_ref = d.source_location or ({"document_id": str(doc_ref_id), "evidence_text": d.evidence_text} if doc_ref_id else None)
        client_tmpl = d.clarification_question or f"Please verify the evidentiary details for '{d.title}'."
        int_notes = f"[INTERNAL STAFF AUDIT] Compliance review for '{d.title}'. Assess under firm policy before client contact. Never declare statutory ineligibility or guarantee refusal."

        new_finding = CaseAIFinding(
            organization_id=organization_id,
            case_id=case_id,
            document_id=doc_ref_id,
            finding_type=d.finding_type,
            severity=d.severity,
            status="needs_review",
            title=d.title,
            description=d.description,
            evidence_text=d.evidence_text,
            source_location=d.source_location,
            evidence_reference=ev_ref,
            client_facing_template=client_tmpl,
            internal_risk_notes=int_notes,
            due_date=target_due,
            related_documents=d.related_documents,
            related_fields=d.related_fields,
            relevant_requirement=d.relevant_requirement,
            recommended_action=d.recommended_action,
            clarification_question=d.clarification_question,
            uncertainty_limitations=d.uncertainty_limitations,
            is_confirmed_contradiction=d.is_confirmed_contradiction,
            confidence_score=d.confidence_score,
            resolution_history=[],
        )
        db.add(new_finding)
        db.flush()

        # If critical or major, auto-create a linked casework task
        if d.severity in ["critical", "major"]:
            task = CaseTask(
                organization_id=organization_id,
                case_id=case_id,
                title=f"Review Finding: {d.title[:150]}",
                description=f"{d.description}\n\nRecommended Action: {d.recommended_action}",
                priority=d.severity,
                status="pending",
                is_completed=False,
                due_date=target_due,
            )
            db.add(task)
            db.flush()
            new_finding.linked_task_id = task.id

        created_or_updated.append(new_finding)

    # 5. Run Document Quality Detector across each document
    for d in doc_dicts:
        doc_uuid = uuid.UUID(d["id"])
        quality_results = detect_document_quality_issues(
            document_id=d["id"],
            title=d["title"],
            category=d["category"],
            page_count=d["page_count"],
            extracted_text=d["extracted_text"],
            extracted_fields=d["extracted_fields"],
            ocr_applied=d["ocr_applied"],
        )
        for q in quality_results:
            if q.title in existing_map:
                ex = existing_map[q.title]
                if ex.status in ["resolved", "dismissed"]:
                    continue
                ex.description = q.description
                ex.severity = q.severity
                created_or_updated.append(ex)
                continue

            now_q_time = now_utc()
            target_q_due = now_q_time + timedelta(days=3 if q.severity == "critical" else 7)
            q_ev_ref = {"document_id": d["id"], "page": q.page_number, "evidence_text": q.evidence_text}
            q_client_tmpl = q.suggested_clarification or f"Please provide an updated, uncropped replacement document for '{d['title']}'."
            q_int_notes = f"[INTERNAL STAFF AUDIT] Scan quality inspection for '{d['title']}'. Review under 8 CFR § 103.2(b)(1) legibility standards. Resolve before final filing."

            new_q = CaseAIFinding(
                organization_id=organization_id,
                case_id=case_id,
                document_id=doc_uuid,
                finding_type=q.finding_type,
                severity=q.severity,
                status="needs_review",
                title=q.title,
                description=q.description,
                evidence_text=q.evidence_text,
                source_location={"document_id": d["id"], "page": q.page_number},
                evidence_reference=q_ev_ref,
                client_facing_template=q_client_tmpl,
                internal_risk_notes=q_int_notes,
                due_date=target_q_due,
                related_documents=[{"id": d["id"], "title": d["title"], "version": d.get("version", 1)}],
                related_fields=[],
                relevant_requirement="8 CFR § 103.2(b)(1) - Document Legibility & Completeness",
                recommended_action=q.recommended_action,
                clarification_question=q.suggested_clarification,
                uncertainty_limitations=q.uncertainty_limitations,
                is_confirmed_contradiction=False,
                confidence_score=0.95,
                resolution_history=[],
            )
            db.add(new_q)
            db.flush()

            if q.severity in ["critical", "major"]:
                task = CaseTask(
                    organization_id=organization_id,
                    case_id=case_id,
                    title=f"Resolve Quality Issue: {q.title[:150]}",
                    description=f"{q.description}\n\nRecommended Action: {q.recommended_action}",
                    priority=q.severity,
                    status="pending",
                    is_completed=False,
                    due_date=target_q_due,
                )
                db.add(task)
                db.flush()
                new_q.linked_task_id = task.id

            created_or_updated.append(new_q)

    # 6. Run Pathway Checklist Gap Analysis
    checklist_audit = audit_case_checklist(
        case.jurisdiction,
        case.visa_category,
        doc_dicts,
        checklist_snapshot=case.pinned_checklist_snapshot if getattr(case, "pinned_checklist_snapshot", None) else None,
    )
    for missing in checklist_audit.missing_items:
        if not missing.is_mandatory:
            continue  # Only flag missing mandatory checklist evidence as action items

        check_title = f"Missing Required Checklist Evidence: {missing.label}"
        if check_title in existing_map:
            ex = existing_map[check_title]
            if ex.status in ["resolved", "dismissed"]:
                continue
            created_or_updated.append(ex)
            continue

        chk_finding = CaseAIFinding(
            organization_id=organization_id,
            case_id=case_id,
            finding_type="missing_checklist_evidence",
            severity="major",
            status="needs_review",
            title=check_title,
            description=f"Statutory requirement '{missing.label}' ({missing.requirement_citation}) has not been evidenced by any uploaded, verified document.",
            evidence_text=None,
            source_location=None,
            related_documents=[],
            related_fields=[],
            relevant_requirement=missing.requirement_citation,
            recommended_action=f"Request client upload official documentation evidencing '{missing.label}'.",
            clarification_question=f"Please provide your official document for '{missing.label}' to fulfill {missing.requirement_citation}.",
            uncertainty_limitations="Automated checklist evaluation verifies presence of accepted category documents. It does not judge legal sufficiency.",
            is_confirmed_contradiction=False,
            confidence_score=1.0,
            resolution_history=[],
        )
        db.add(chk_finding)
        db.flush()

        task = CaseTask(
            organization_id=organization_id,
            case_id=case_id,
            title=f"Request Missing Evidence: {missing.label[:150]}",
            description=f"Evidence missing for {missing.requirement_citation}. Request documentation from client.",
            priority="medium",
            status="pending",
            is_completed=False,
            due_date=now_utc() + timedelta(days=10),
        )
        db.add(task)
        db.flush()
        chk_finding.linked_task_id = task.id

        created_or_updated.append(chk_finding)

    db.commit()
    return created_or_updated


def resolve_finding(
    db: Session,
    finding_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    note: str,
) -> CaseAIFinding:
    """Marks a finding as resolved by an authorized reviewer, preserving complete resolution history."""
    finding = db.scalar(
        select(CaseAIFinding).where(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.organization_id == organization_id,
        )
    )
    if not finding:
        raise ValueError(f"Finding {finding_id} not found.")

    prior_status = finding.status
    finding.status = "resolved"
    finding.reviewer_id = user_id
    finding.resolved_at = now_utc()
    finding.resolution_action = "resolve"
    finding.resolution_reason = note

    history = list(finding.resolution_history or [])
    history.append({
        "timestamp": now_utc().isoformat(),
        "user_id": str(user_id),
        "action": "resolve",
        "prior_status": prior_status,
        "new_status": "resolved",
        "note": note,
    })
    finding.resolution_history = history

    # Complete linked task if exists
    if finding.linked_task_id:
        task = db.scalar(select(CaseTask).where(CaseTask.id == finding.linked_task_id))
        if task and not task.is_completed:
            task.is_completed = True
            task.status = "completed"
            task.completed_at = now_utc()
            task.completed_by_user_id = user_id

    # CRITICAL: Resolution does not automatically make the document package-eligible.
    # Mandatory checks (human verification, legal hold, malware scan, unexpired status) run again.
    if finding.document_id:
        doc = db.scalar(select(Document).where(Document.id == finding.document_id))
        if doc and doc.verification_status not in ("verified", "rejected"):
            # Ensure document requires separate authorized human caseworker verification
            doc.verification_status = "under_review" if doc.verification_status == "unverified" else doc.verification_status

    from backend.app.domain.models import AuditEvent
    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=user_id,
        action="ai_finding.resolved",
        object_type="case_ai_finding",
        object_id=str(finding.id),
        metadata_json={
            "finding_title": finding.title,
            "resolution_reason": note,
            "package_eligibility_automatic_grant": False,
            "mandatory_checks_rerun_required": True,
        },
    )
    db.add(audit)

    db.commit()
    db.refresh(finding)
    return finding


def route_finding(
    db: Session,
    finding_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    target_owner_user_id: uuid.UUID,
    note: str,
    due_date: Optional[datetime] = None,
    client_facing_template: Optional[str] = None,
) -> CaseAIFinding:
    """Routes an issue to an authorized officer, manager, or lawyer under firm policy."""
    finding = db.scalar(
        select(CaseAIFinding).where(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.organization_id == organization_id,
        )
    )
    if not finding:
        raise ValueError(f"Finding {finding_id} not found.")

    finding.owner_user_id = target_owner_user_id
    if due_date is not None:
        finding.due_date = due_date
    if client_facing_template is not None:
        finding.client_facing_template = client_facing_template

    history = list(finding.resolution_history or [])
    history.append({
        "timestamp": now_utc().isoformat(),
        "user_id": str(user_id),
        "action": "route",
        "target_owner_user_id": str(target_owner_user_id),
        "note": note,
    })
    finding.resolution_history = history

    if finding.linked_task_id:
        task = db.scalar(select(CaseTask).where(CaseTask.id == finding.linked_task_id))
        if task:
            task.assigned_to_user_id = target_owner_user_id
            if due_date is not None:
                task.due_date = due_date

    db.commit()
    db.refresh(finding)
    return finding


def dismiss_finding(
    db: Session,
    finding_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    reason: str,
    note: Optional[str] = None,
) -> CaseAIFinding:
    """Dismisses a finding with a required structured reason and full audit logging."""
    if reason not in VALID_DISMISSAL_REASONS:
        raise ValueError(f"Invalid dismissal reason '{reason}'. Must be one of: {VALID_DISMISSAL_REASONS}")

    finding = db.scalar(
        select(CaseAIFinding).where(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.organization_id == organization_id,
        )
    )
    if not finding:
        raise ValueError(f"Finding {finding_id} not found.")

    prior_status = finding.status
    finding.status = "dismissed"
    finding.reviewer_id = user_id
    finding.resolved_at = now_utc()
    finding.resolution_action = "dismiss"
    finding.resolution_reason = f"[{reason}] {note or ''}".strip()

    history = list(finding.resolution_history or [])
    history.append({
        "timestamp": now_utc().isoformat(),
        "user_id": str(user_id),
        "action": "dismiss",
        "dismissal_reason": reason,
        "prior_status": prior_status,
        "new_status": "dismissed",
        "note": note or "",
    })
    finding.resolution_history = history

    # Cancel linked task if exists
    if finding.linked_task_id:
        task = db.scalar(select(CaseTask).where(CaseTask.id == finding.linked_task_id))
        if task and not task.is_completed:
            task.status = "cancelled"

    db.commit()
    db.refresh(finding)
    return finding


def escalate_finding(
    db: Session,
    finding_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    note: str,
) -> CaseAIFinding:
    """Escalates a finding to senior counsel or owner review."""
    finding = db.scalar(
        select(CaseAIFinding).where(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.organization_id == organization_id,
        )
    )
    if not finding:
        raise ValueError(f"Finding {finding_id} not found.")

    prior_status = finding.status
    finding.status = "needs_review"
    finding.severity = "critical"  # Escalate severity to critical for owner / partner attention
    finding.resolution_action = "escalate"

    history = list(finding.resolution_history or [])
    history.append({
        "timestamp": now_utc().isoformat(),
        "user_id": str(user_id),
        "action": "escalate",
        "prior_status": prior_status,
        "new_status": "needs_review (escalated)",
        "note": note,
    })
    finding.resolution_history = history

    # Escalate linked task priority
    if finding.linked_task_id:
        task = db.scalar(select(CaseTask).where(CaseTask.id == finding.linked_task_id))
        if task:
            task.priority = "critical"

    db.commit()
    db.refresh(finding)
    return finding
