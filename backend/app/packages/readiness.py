import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import (
    ImmigrationCase,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    CaseRequirementEvaluation,
    DocumentRequest,
    FormSubmission,
    now_utc,
)


class ReadinessService:
    @staticmethod
    def evaluate_case_readiness(
        db: Session,
        case_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Evaluates a 10-point deterministic readiness checklist for an immigration case.
        Strict regulatory guarantee: This checklist reports internal statutory compliance
        and evidence sufficiency ONLY. It does NOT calculate or display any probability
        or chance of government approval.
        """
        case = db.execute(
            select(ImmigrationCase).where(ImmigrationCase.id == case_id)
        ).scalar_one_or_none()
        if not case:
            raise ValueError("ImmigrationCase not found")

        # 1. Applicable requirements & Missing Evidence (from latest CaseRequirementEvaluation)
        latest_eval = db.execute(
            select(CaseRequirementEvaluation)
            .where(
                CaseRequirementEvaluation.case_id == case_id,
                CaseRequirementEvaluation.is_superseded == False,
            )
            .order_by(CaseRequirementEvaluation.evaluated_at.desc())
        ).scalars().first()

        applicable_requirements: List[Dict[str, Any]] = []
        missing_evidence: List[Dict[str, Any]] = []
        pending_reviewer_decisions: List[Dict[str, Any]] = []

        if latest_eval and latest_eval.results:
            reqs = latest_eval.results.get("requirements", [])
            for r in reqs:
                if r.get("is_applicable", True):
                    applicable_requirements.append({
                        "code": r.get("code"),
                        "title": r.get("title"),
                        "category": r.get("category"),
                        "statutory_citation": r.get("statutory_citation"),
                        "status": r.get("status"),
                        "is_mandatory": r.get("is_mandatory", True),
                    })
                    if r.get("status") in ["missing", "blocked"]:
                        missing_evidence.append({
                            "code": r.get("code"),
                            "title": r.get("title"),
                            "category": r.get("category"),
                            "blocking_reasons": r.get("blocking_reasons", []),
                        })
                    if r.get("requires_human_signoff") and not r.get("human_signoff_completed"):
                        pending_reviewer_decisions.append({
                            "code": r.get("code"),
                            "title": r.get("title"),
                            "reason": "Requires Legal Specialist / Attorney Adjudication Sign-Off",
                        })

        # 2. Evidence received (Verified documents attached to case)
        docs_stmt = select(Document).where(Document.case_id == case_id)
        docs = db.execute(docs_stmt).scalars().all()

        evidence_received: List[Dict[str, Any]] = []
        expired_documents: List[Dict[str, Any]] = []
        now = now_utc()
        threshold_date = now + timedelta(days=180)  # 6-month validity window for travel docs

        for d in docs:
            evidence_received.append({
                "document_id": str(d.id),
                "title": d.title,
                "category": d.category,
                "verification_status": d.verification_status,
                "uploaded_at": d.created_at.isoformat() if d.created_at else None,
            })

            # Check expiration if document has expiration metadata or extracted fields
            if d.verification_notes and "expired" in d.verification_notes.lower():
                expired_documents.append({
                    "document_id": str(d.id),
                    "title": d.title,
                    "reason": "Document flagged as expired in verification notes",
                })

        # 3. Unresolved AI findings
        findings_stmt = select(CaseAIFinding).where(
            CaseAIFinding.case_id == case_id,
            CaseAIFinding.status.in_(["open", "investigating", "needs_action"]),
        )
        unresolved_findings_records = db.execute(findings_stmt).scalars().all()
        unresolved_findings: List[Dict[str, Any]] = [
            {
                "finding_id": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "status": f.status,
                "citation": getattr(f, "citation", None) or getattr(f, "relevant_requirement", None) or getattr(f, "rule_id", None),
            }
            for f in unresolved_findings_records
        ]

        # 4. Unverified extracted fields
        unverified_fields_stmt = (
            select(DocumentExtractedField, Document)
            .join(Document, DocumentExtractedField.document_id == Document.id)
            .where(
                Document.case_id == case_id,
                DocumentExtractedField.validation_status.in_(["pending", "flagged"]),
            )
        )
        unverified_field_records = db.execute(unverified_fields_stmt).all()
        unverified_extracted_fields: List[Dict[str, Any]] = [
            {
                "field_id": str(field.id),
                "document_title": doc.title,
                "field_name": field.field_name,
                "original_value": field.original_value,
                "validation_status": field.validation_status,
            }
            for field, doc in unverified_field_records
        ]

        # 5. Incomplete forms
        forms_stmt = select(FormSubmission).where(FormSubmission.case_id == case_id)
        form_submissions = db.execute(forms_stmt).scalars().all()
        incomplete_forms: List[Dict[str, Any]] = []

        for f in form_submissions:
            defects = []
            if f.status not in ("confirmed", "approved"):
                if f.completion_percentage < 100.0:
                    defects.append(f"Incomplete answers ({f.completion_percentage}% completed)")
                if f.has_unconfirmed_ai_fields:
                    defects.append("Contains unconfirmed AI draft answers")
                if not f.sensitive_fields_reviewed:
                    defects.append("Pending designated sensitive fields review")
                conflicted_fields = [k for k, ans in (f.answers_json or {}).items() if ans.get("has_conflict")]
                if conflicted_fields:
                    defects.append(f"Contains unresolved multi-document conflicts: {', '.join(conflicted_fields)}")

            if defects:
                incomplete_forms.append({
                    "submission_id": str(f.id),
                    "status": f.status,
                    "completion_percentage": f.completion_percentage,
                    "defects": defects,
                })

        # 6. Outstanding client responses
        reqs_stmt = select(DocumentRequest).where(
            DocumentRequest.case_id == case_id,
            DocumentRequest.status.in_(["requested", "rejected"]),
        )
        outstanding_reqs = db.execute(reqs_stmt).scalars().all()
        outstanding_client_responses: List[Dict[str, Any]] = [
            {
                "request_id": str(r.id),
                "title": r.title,
                "status": r.status,
                "due_date": r.due_date.isoformat() if r.due_date else None,
                "rejection_reason": r.rejection_reason,
            }
            for r in outstanding_reqs
        ]

        # 7. Unmet package validation criteria (pathway-aware)
        unmet_criteria: List[Dict[str, Any]] = []
        # Form G-28 is strictly a US-specific representation notice; never universally require it for other pathways
        if case.jurisdiction == "US":
            has_g28 = any(
                "g-28" in (d.title or "").lower() or "g28" in (d.title or "").lower()
                for d in docs
            )
            if not has_g28:
                unmet_criteria.append({
                    "rule": "MANDATORY_G28",
                    "description": "Form G-28 Notice of Attorney Representation must be attached and signed for US petitions.",
                    "severity": "blocking",
                })

        # Calculate blocking vs warning counts
        blocking_count = (
            len(missing_evidence)
            + len(unresolved_findings)
            + len(unverified_extracted_fields)
            + len(incomplete_forms)
            + len(outstanding_client_responses)
            + len(pending_reviewer_decisions)
            + sum(1 for c in unmet_criteria if c["severity"] == "blocking")
        )
        warning_count = len(expired_documents)

        is_ready = blocking_count == 0

        return {
            "case_id": str(case_id),
            "case_number": case.case_number,
            "evaluated_at": now.isoformat(),
            "is_ready_for_package_assembly": is_ready,
            "blocking_items_count": blocking_count,
            "warnings_count": warning_count,
            "checklist": {
                "applicable_requirements": {
                    "count": len(applicable_requirements),
                    "items": applicable_requirements,
                },
                "evidence_received": {
                    "count": len(evidence_received),
                    "items": evidence_received,
                },
                "missing_evidence": {
                    "count": len(missing_evidence),
                    "items": missing_evidence,
                },
                "unresolved_findings": {
                    "count": len(unresolved_findings),
                    "items": unresolved_findings,
                },
                "unverified_extracted_fields": {
                    "count": len(unverified_extracted_fields),
                    "items": unverified_extracted_fields,
                },
                "expired_documents": {
                    "count": len(expired_documents),
                    "items": expired_documents,
                },
                "incomplete_forms": {
                    "count": len(incomplete_forms),
                    "items": incomplete_forms,
                },
                "outstanding_client_responses": {
                    "count": len(outstanding_client_responses),
                    "items": outstanding_client_responses,
                },
                "pending_reviewer_decisions": {
                    "count": len(pending_reviewer_decisions),
                    "items": pending_reviewer_decisions,
                },
                "unmet_package_validation_criteria": {
                    "count": len(unmet_criteria),
                    "items": unmet_criteria,
                },
            },
            "compliance_notice": "Evaluation performed strictly against internal statutory and quality criteria. Probability of approval is never generated or displayed. No legal advice is provided or implied.",
        }
