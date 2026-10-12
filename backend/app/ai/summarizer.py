"""Evidence-backed case briefing and clarification question generator.

Generates objective, factual evidentiary case summaries with explicit citations
and uncertainty disclosures. Enforces strict ethical and legal guardrails:
- Does NOT declare fraud.
- Does NOT predict visa approval as fact.
- Does NOT invent missing evidence.
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


@dataclass
class EvidenceCaseSummary:
    case_number: str
    jurisdiction: str
    visa_category: str
    generated_at: str
    verified_facts: List[Dict[str, Any]]
    potential_discrepancies: List[Dict[str, Any]]
    checklist_status: Dict[str, Any]
    uncertainty_disclosures: List[str]
    suggested_clarification_questions: List[Dict[str, Any]]
    summary_markdown: str


def generate_evidence_backed_case_summary(
    case_data: Dict[str, Any],
    client_data: Dict[str, Any],
    documents: List[Dict[str, Any]],
    findings: List[Dict[str, Any]],
    checklist_report: Optional[Dict[str, Any]] = None,
) -> EvidenceCaseSummary:
    """Generates an evidence-backed case summary strictly grounded in uploaded documents."""
    case_number = case_data.get("case_number", "CASE-UNKNOWN")
    jurisdiction = case_data.get("jurisdiction", "US")
    visa_category = case_data.get("visa_category", "Immigration Petition")

    verified_facts: List[Dict[str, Any]] = []
    uncertainty_disclosures: List[str] = []
    suggested_questions: List[Dict[str, Any]] = []

    # 1. Compile verified facts directly from documents
    for doc in documents:
        doc_title = doc.get("title") or doc.get("filename")
        doc_category = doc.get("category", "")
        doc_fields = doc.get("extracted_fields", [])

        for field in doc_fields:
            if field.get("validation_status") == "verified" or doc.get("verification_status") == "verified":
                verified_facts.append({
                    "field_label": field.get("field_label", field.get("field_name")),
                    "value": field.get("normalized_value") or field.get("original_value"),
                    "source_document": doc_title,
                    "source_page": field.get("source_page", 1),
                    "confidence": field.get("extraction_confidence", 0.95),
                })

    # 2. Extract potential discrepancies from findings
    potential_discrepancies: List[Dict[str, Any]] = []
    for f in findings:
        potential_discrepancies.append({
            "id": f.get("id"),
            "severity": f.get("severity"),
            "title": f.get("title"),
            "description": f.get("description"),
            "is_confirmed_contradiction": f.get("is_confirmed_contradiction", False),
            "status": f.get("status", "needs_review"),
        })

        if f.get("clarification_question"):
            suggested_questions.append({
                "finding_id": f.get("id"),
                "question": f.get("clarification_question"),
                "severity": f.get("severity"),
                "recommended_action": f.get("recommended_action"),
            })

    # 3. Formulate explicit uncertainty disclosures
    if not documents:
        uncertainty_disclosures.append("No primary evidence documents have been uploaded to this case yet. All case facts remain unevidenced.")

    unverified_docs = [d for d in documents if d.get("verification_status") != "verified"]
    if unverified_docs:
        uncertainty_disclosures.append(
            f"{len(unverified_docs)} document(s) have completed automated OCR/extraction but have NOT been certified by a human caseworker. Under decoupled legal policy, automated OCR results do not constitute verified facts."
        )

    degraded_docs = [d for d in documents if d.get("ocr_applied") and (d.get("page_count", 0) > 1)]
    if degraded_docs:
        uncertainty_disclosures.append(
            "Certain evidentiary records rely on optical character recognition rather than native digital vector text; character confidence scores are subject to optical scan clarity."
        )

    # 4. Generate Markdown Brief
    md_lines = [
        f"# Evidentiary Case Brief: {case_number}",
        f"**Jurisdiction / Pathway:** {jurisdiction} — {visa_category}",
        f"**Date Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## I. Grounded Evidentiary Facts (Primary Documents)",
    ]

    if verified_facts:
        for vf in verified_facts:
            md_lines.append(f"- **{vf['field_label']}:** {vf['value']} *(Source: `{vf['source_document']}`, Page {vf['source_page']})*")
    else:
        md_lines.append("- *No legally certified evidentiary facts recorded yet. Documents require caseworker verification.*")

    md_lines.extend([
        "",
        "## II. Checklist & Evidentiary Completeness",
    ])

    if checklist_report:
        md_lines.append(f"- **Checklist Fulfillment:** {checklist_report.get('fulfillment_percentage', 0)}% ({checklist_report.get('satisfied_mandatory', 0)}/{checklist_report.get('total_mandatory', 0)} mandatory statutory criteria satisfied)")
        missing = checklist_report.get("missing_items", [])
        if missing:
            md_lines.append("- **Pending Evidence Items:**")
            for m in missing:
                req_type = "Mandatory" if m.get("is_mandatory") else "Recommended"
                md_lines.append(f"  - [{req_type}] {m.get('label')} *({m.get('requirement_citation')})*")
    else:
        md_lines.append("- *Checklist report not yet compiled.*")

    md_lines.extend([
        "",
        "## III. Observed Discrepancies & Quality Notices",
    ])

    if potential_discrepancies:
        for d in potential_discrepancies:
            contradiction_tag = "[Confirmed Contradiction]" if d.get("is_confirmed_contradiction") else "[Potential Discrepancy / Variation]"
            md_lines.append(f"- **[{d['severity'].upper()}] {contradiction_tag} {d['title']}**")
            md_lines.append(f"  {d['description']}")
    else:
        md_lines.append("- No cross-document discrepancies or quality issues detected across current evidentiary corpus.")

    md_lines.extend([
        "",
        "## IV. Explicit Uncertainty Disclosures & Limitations",
    ])

    for ud in uncertainty_disclosures:
        md_lines.append(f"> [!NOTE]\n> {ud}")

    md_lines.extend([
        "",
        "## V. Suggested Clarification Questions for Client / Sponsor",
    ])

    if suggested_questions:
        for idx, sq in enumerate(suggested_questions, 1):
            md_lines.append(f"{idx}. *{sq['question']}*")
    else:
        md_lines.append("- No client clarifications required at this stage.")

    summary_md = "\n".join(md_lines)

    return EvidenceCaseSummary(
        case_number=case_number,
        jurisdiction=jurisdiction,
        visa_category=visa_category,
        generated_at=datetime.now(timezone.utc).isoformat(),
        verified_facts=verified_facts,
        potential_discrepancies=potential_discrepancies,
        checklist_status=checklist_report or {},
        uncertainty_disclosures=uncertainty_disclosures,
        suggested_clarification_questions=suggested_questions,
        summary_markdown=summary_md,
    )
