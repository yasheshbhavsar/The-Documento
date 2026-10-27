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
    for f in findings:
        if f.get("uncertainty_limitations"):
            uncertainty_disclosures.append(f.get("uncertainty_limitations"))

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

    # Standard zero-privilege ethical / legal uncertainty disclosure
    uncertainty_disclosures.append(
        "Automated case extractions are advisory aids for legal staff only; USCIS adjudication requires physical proof under Kazarian two-part final merits review."
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


@dataclass
class AuthorityRequestItem:
    item_id: str
    authority_issue: str
    statutory_citation: Optional[str]
    supporting_evidence_found: List[Dict[str, Any]]
    is_addressed_by_case_record: bool
    unaddressed_deficiency_notes: Optional[str]


@dataclass
class AuthorityRequestSummary:
    case_number: str
    authority_name: str
    request_type: str  # RFE, NOID, PFL, 221(g), Section_56
    response_deadline: Optional[str]
    generated_at: str
    items_analyzed: List[AuthorityRequestItem]
    addressed_count: int
    unaddressed_count: int
    provenance: Dict[str, Any]
    summary_markdown: str
    legal_sufficiency_disclaimer: str


def summarize_authority_request(
    case_data: Dict[str, Any],
    authority_request_text: str,
    case_documents: List[Dict[str, Any]],
    extracted_fields: Optional[List[Dict[str, Any]]] = None,
    document_title: Optional[str] = None,
) -> AuthorityRequestSummary:
    """
    Summarizes an official government authority request (RFE, NOID, PFL, ADR, 221(g))
    with exact evidence citations and uncertainty disclosures.
    
    Strictly adheres to Phase 10 Guardrails:
    - Never declares fraud or statutory ineligibility.
    - Cites source document version, page, and exact field values.
    - Identifies gaps where case evidence does not yet answer the authority's request.
    """
    import re
    from backend.app.ai.provenance import (
        LEGAL_SUFFICIENCY_GUARDRAIL,
        HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE,
    )

    case_number = case_data.get("case_number", "CASE-UNKNOWN")
    jurisdiction = case_data.get("jurisdiction", "US")
    fields = extracted_fields or []

    # 1. Detect Authority Name & Request Type
    upper_text = (authority_request_text or "").upper()
    doc_title_upper = (document_title or "").upper()

    authority_name = "Government Immigration Authority"
    if "USCIS" in upper_text or "DEPARTMENT OF HOMELAND SECURITY" in upper_text or jurisdiction == "US":
        authority_name = "USCIS (U.S. Citizenship and Immigration Services)"
    elif "IRCC" in upper_text or "CITIZENSHIP AND IMMIGRATION CANADA" in upper_text or jurisdiction == "CA":
        authority_name = "IRCC (Immigration, Refugees and Citizenship Canada)"
    elif "HOME OFFICE" in upper_text or "UKVI" in upper_text or jurisdiction == "GB":
        authority_name = "UK Visas and Immigration (Home Office)"
    elif "HOME AFFAIRS" in upper_text or "DEPARTMENT OF HOME AFFAIRS" in upper_text or jurisdiction == "AU":
        authority_name = "Department of Home Affairs (Australia)"

    request_type = "Request for Evidence (RFE)"
    if "INTENT TO DENY" in upper_text or "NOID" in upper_text:
        request_type = "Notice of Intent to Deny (NOID)"
    elif "PROCEDURAL FAIRNESS" in upper_text or "PFL" in upper_text:
        request_type = "Procedural Fairness Letter (PFL)"
    elif "221(G)" in upper_text or "221G" in upper_text:
        request_type = "221(g) Administrative Processing Notice"
    elif "SECTION 56" in upper_text:
        request_type = "Section 56 Request for Information"

    # 2. Extract Response Deadline if stated
    deadline_match = re.search(
        r"(?:respond(?:ed)?\s+by|deadline|due\s+date|within\s+\d+\s+days\s+of|prior\s+to)[\s:]+([A-Za-z0-9,\s/-]{6,25})",
        authority_request_text,
        re.IGNORECASE,
    )
    response_deadline = deadline_match.group(1).strip() if deadline_match else None

    # 3. Parse specific evidentiary requests/issues from text
    lines = [line.strip() for line in authority_request_text.split("\n") if len(line.strip()) > 15]
    issue_candidates = []
    issue_indicators = (
        "please submit",
        "you must submit",
        "evidence is required",
        "provide evidence",
        "demonstrate that",
        "clarify",
        "insufficient",
        "lack of",
        "documentation establishing",
        "does not show",
        "missing",
    )

    for line in lines:
        lower_line = line.lower()
        if any(ind in lower_line for ind in issue_indicators):
            # Clean up bullet numbers or markers
            cleaned_issue = re.sub(r"^[\d\.\-\*\•\)]+\s*", "", line)
            if cleaned_issue and len(cleaned_issue) > 20 and cleaned_issue not in issue_candidates:
                issue_candidates.append(cleaned_issue)

    if not issue_candidates:
        issue_candidates = [
            "Evidentiary substantiation required for regulatory eligibility criteria as outlined in the official notice."
        ]

    # 4. Cross-reference each authority issue against verified case records
    items_analyzed: List[AuthorityRequestItem] = []
    for idx, issue in enumerate(issue_candidates[:6], 1):
        issue_tokens = set(re.findall(r"[a-z]{4,}", issue.lower()))
        supporting_evidence: List[Dict[str, Any]] = []

        # Check extracted fields for textual matches
        for f in fields:
            f_val = str(f.get("normalized_value") or f.get("original_value") or "").lower()
            f_name = f.get("field_name", "").lower()
            f_label = f.get("field_label", f_name)
            val_tokens = set(re.findall(r"[a-z]{4,}", f_val))

            if (issue_tokens.intersection(val_tokens) or f_name in issue.lower()) and f_val:
                supporting_evidence.append({
                    "evidence_type": "Extracted Field",
                    "field_label": f_label,
                    "value": f.get("normalized_value") or f.get("original_value"),
                    "source_page": f.get("source_page", 1),
                    "confidence": f.get("extraction_confidence", 0.95),
                    "validation_status": f.get("validation_status", "unvalidated"),
                })

        # Check documents by category and title
        for d in case_documents:
            d_title = d.get("title") or d.get("filename") or ""
            d_cat = d.get("category", "")
            d_tokens = set(re.findall(r"[a-z]{4,}", d_title.lower() + " " + d_cat.lower()))

            if len(issue_tokens.intersection(d_tokens)) >= 1:
                supporting_evidence.append({
                    "evidence_type": "Case Document",
                    "document_title": d_title,
                    "category": d_cat,
                    "page_count": d.get("page_count", 1),
                    "verification_status": d.get("verification_status", "unverified"),
                })

        # Deduplicate evidence references
        dedup_evidence = []
        seen = set()
        for ev in supporting_evidence:
            ident = ev.get("document_title") or ev.get("field_label")
            if ident and ident not in seen:
                seen.add(ident)
                dedup_evidence.append(ev)

        is_addressed = len(dedup_evidence) > 0
        deficiency_notes = None if is_addressed else "No primary evidence in case record directly addresses this authority request item."

        items_analyzed.append(
            AuthorityRequestItem(
                item_id=f"ITEM-{idx:02d}",
                authority_issue=issue,
                statutory_citation=None,
                supporting_evidence_found=dedup_evidence,
                is_addressed_by_case_record=is_addressed,
                unaddressed_deficiency_notes=deficiency_notes,
            )
        )

    addressed_count = sum(1 for item in items_analyzed if item.is_addressed_by_case_record)
    unaddressed_count = len(items_analyzed) - addressed_count

    # 5. Build Markdown Brief
    md_lines = [
        f"# Authority Request Evidentiary Analysis: {case_number}",
        f"**Issuing Authority:** {authority_name}",
        f"**Notice Classification:** {request_type}",
        f"**Response Deadline:** {response_deadline or 'Not specified in extracted text'}",
        f"**Analysis Timestamp:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "> [!IMPORTANT]",
        f"> {LEGAL_SUFFICIENCY_GUARDRAIL}",
        "",
        "## I. Executive Summary",
        f"- **Total Issues/Demands Analyzed:** {len(items_analyzed)}",
        f"- **Addressed by Case Records:** {addressed_count} of {len(items_analyzed)}",
        f"- **Outstanding / Unaddressed Deficiencies:** {unaddressed_count} of {len(items_analyzed)}",
        "",
        "## II. Itemized Analysis & Grounded Citations",
    ]

    for it in items_analyzed:
        status_badge = "✅ ADDRESSED BY CASE RECORD" if it.is_addressed_by_case_record else "⚠️ OUTSTANDING DEFICIENCY"
        md_lines.extend([
            f"### {it.item_id}: {status_badge}",
            f"> **Authority Demand:** *\"{it.authority_issue}\"*",
            "",
        ])
        if it.supporting_evidence_found:
            md_lines.append("**Supporting Evidence in Case:**")
            for ev in it.supporting_evidence_found:
                if ev.get("evidence_type") == "Extracted Field":
                    md_lines.append(f"- Field: **{ev['field_label']}** = `{ev['value']}` *(Page {ev.get('source_page', 1)}, Status: {ev.get('validation_status')})*")
                else:
                    md_lines.append(f"- Document: **{ev['document_title']}** `[{ev.get('category')}]` *(Verification: {ev.get('verification_status')})*")
        else:
            md_lines.append(f"- ⚠️ **Deficiency Note:** {it.unaddressed_deficiency_notes}")
            md_lines.append("- *Recommended Action:* Issue targeted document request to client or sponsor.")
        md_lines.append("")

    md_lines.extend([
        "## III. Ethical Guardrails & Legal Disclaimers",
        f"- {HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE}",
        "- This analysis separates extracted facts, model inference, and professional human decisions.",
        "- Final response legal drafting and submission authorization must be executed by supervising counsel.",
    ])

    summary_md = "\n".join(md_lines)

    return AuthorityRequestSummary(
        case_number=case_number,
        authority_name=authority_name,
        request_type=request_type,
        response_deadline=response_deadline,
        generated_at=datetime.now(timezone.utc).isoformat(),
        items_analyzed=items_analyzed,
        addressed_count=addressed_count,
        unaddressed_count=unaddressed_count,
        provenance={
            "provider": "mock_local",
            "model": "doc_intel_summarizer_v10.0",
            "pipeline_version": "v10.0",
            "prompt_version": "authority_request_audit_v1.0",
            "do_not_train": True,
        },
        summary_markdown=summary_md,
        legal_sufficiency_disclaimer=LEGAL_SUFFICIENCY_GUARDRAIL,
    )

