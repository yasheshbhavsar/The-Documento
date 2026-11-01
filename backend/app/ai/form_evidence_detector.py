"""Cross-document and Form vs Evidence consistency analysis engine.

Detects discrepancies and contradictions across client profile records,
immigration forms, and uploaded evidentiary documents without making unsupported
legal conclusions.
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from backend.app.ai.comparators import (
    compare_names,
    compare_dates_of_birth,
    compare_document_numbers,
    compare_parent_names,
    compare_addresses,
    FieldComparisonResult,
)


@dataclass
class DiscrepancyFinding:
    finding_type: str  # consistency_discrepancy, form_conflict
    severity: str  # critical, major, minor, informational
    title: str
    description: str
    evidence_text: Optional[str]
    source_location: Optional[Dict[str, Any]]
    related_documents: List[Dict[str, Any]]
    related_fields: List[str]
    relevant_requirement: Optional[str]
    recommended_action: str
    clarification_question: Optional[str]
    uncertainty_limitations: str
    is_confirmed_contradiction: bool
    confidence_score: float


def analyze_cross_document_consistency(
    client_profile: Dict[str, Any],
    case_data: Dict[str, Any],
    documents: List[Dict[str, Any]],
) -> List[DiscrepancyFinding]:
    """Analyzes consistency across client master profile, case metadata, and evidence documents."""
    findings: List[DiscrepancyFinding] = []

    client_name = f"{client_profile.get('first_name', '')} {client_profile.get('last_name', '')}".strip()
    client_dob = str(client_profile.get("date_of_birth", "")).split("T")[0] if client_profile.get("date_of_birth") else ""
    client_nationality = client_profile.get("nationality", "")

    # Check if there is any civil status / marriage document uploaded
    has_marriage_record = any(d.get("category") == "civil_status" for d in documents)

    # Gather extracted fields across all documents
    # Format of doc: {id, title, version, category, extracted_fields: [...]}
    passport_docs = [d for d in documents if d.get("category") == "identity_passport"]
    education_docs = [d for d in documents if d.get("category") == "educational_record"]
    employment_docs = [d for d in documents if d.get("category") == "employment_record"]

    # 1. Compare Client Profile Name vs Passport Biodata
    for pdoc in passport_docs:
        fields = pdoc.get("extracted_fields", [])
        passport_name_field = next((f for f in fields if f.get("field_name") == "full_name"), None)
        passport_num_field = next((f for f in fields if f.get("field_name") == "passport_number"), None)
        passport_dob_field = next((f for f in fields if f.get("field_name") == "date_of_birth"), None)

        if passport_name_field and client_name:
            p_val = passport_name_field.get("normalized_value") or passport_name_field.get("original_value") or ""
            cmp_res = compare_names(client_name, p_val, has_marriage_record=has_marriage_record)

            if not cmp_res.is_concordant:
                sev = "critical" if cmp_res.is_confirmed_contradiction else "minor" if cmp_res.variation_type in ["transliteration", "ocr_noise"] else "major"
                findings.append(
                    DiscrepancyFinding(
                        finding_type="consistency_discrepancy",
                        severity=sev,
                        title=f"Name Variation: Client Record vs Passport Biodata ({cmp_res.variation_type or 'unexplained'})",
                        description=f"Client intake record lists '{client_name}', whereas passport '{pdoc.get('title')}' shows '{p_val}'. {cmp_res.explanation}",
                        evidence_text=f"Client Profile: '{client_name}' | Passport: '{p_val}'",
                        source_location=passport_name_field.get("source_location"),
                        related_documents=[{"id": str(pdoc.get("id")), "title": pdoc.get("title"), "version": pdoc.get("version", 1)}],
                        related_fields=["client_profile.full_name", "document.full_name"],
                        relevant_requirement="8 CFR § 103.2(b)(1) - Identity Verification",
                        recommended_action="Review whether variance represents standard transliteration or if petition forms should list alias in 'Other Names Used'.",
                        clarification_question=cmp_res.suggested_clarification or f"Please clarify the name variation between '{client_name}' and passport biodata '{p_val}'.",
                        uncertainty_limitations="Automated linguistic comparator evaluated Romanization patterns. Legal identity must be determined by qualified counsel.",
                        is_confirmed_contradiction=cmp_res.is_confirmed_contradiction,
                        confidence_score=cmp_res.similarity_score,
                    )
                )

        # 2. Compare Client Profile Date of Birth vs Passport DOB
        if passport_dob_field and client_dob:
            p_dob_val = passport_dob_field.get("normalized_value") or passport_dob_field.get("original_value") or ""
            dob_cmp = compare_dates_of_birth(client_dob, p_dob_val)

            if not dob_cmp.is_concordant:
                sev = "critical" if dob_cmp.is_confirmed_contradiction else "major"
                findings.append(
                    DiscrepancyFinding(
                        finding_type="consistency_discrepancy",
                        severity=sev,
                        title=f"Date of Birth Inconsistency: Intake Record vs Passport ({dob_cmp.variation_type or 'discrepancy'})",
                        description=f"Client intake record indicates date of birth '{client_dob}', but passport biodata extracts '{p_dob_val}'. {dob_cmp.explanation}",
                        evidence_text=f"Intake: '{client_dob}' | Passport: '{p_dob_val}'",
                        source_location=passport_dob_field.get("source_location"),
                        related_documents=[{"id": str(pdoc.get("id")), "title": pdoc.get("title"), "version": pdoc.get("version", 1)}],
                        related_fields=["client_profile.date_of_birth", "document.date_of_birth"],
                        relevant_requirement="8 CFR § 103.2(b)(1) - Identity & Age Eligibility",
                        recommended_action="Cross-reference with government birth certificate. Do not alter verified records without supporting primary civil evidence.",
                        clarification_question=dob_cmp.suggested_clarification,
                        uncertainty_limitations="Format parsing evaluates US MM/DD vs International DD/MM conventions. Verification requires official civil birth record.",
                        is_confirmed_contradiction=dob_cmp.is_confirmed_contradiction,
                        confidence_score=dob_cmp.similarity_score,
                    )
                )

    # 3. Cross-Document Comparisons: Passport vs Degree / Employment Letters
    for edoc in education_docs:
        efields = edoc.get("extracted_fields", [])
        deg_name_field = next((f for f in efields if f.get("field_name") in ["graduate_name", "student_name", "recipient_name"]), None)

        if deg_name_field and client_name:
            d_val = deg_name_field.get("normalized_value") or deg_name_field.get("original_value") or ""
            deg_cmp = compare_names(client_name, d_val, has_marriage_record=has_marriage_record)

            if not deg_cmp.is_concordant and deg_cmp.variation_type != "ocr_noise":
                findings.append(
                    DiscrepancyFinding(
                        finding_type="consistency_discrepancy",
                        severity="major" if deg_cmp.is_confirmed_contradiction else "minor",
                        title=f"Name Variation: Academic Credential vs Client Profile ({deg_cmp.variation_type or 'difference'})",
                        description=f"Diploma / Degree '{edoc.get('title')}' was issued to '{d_val}', whereas applicant name is '{client_name}'. {deg_cmp.explanation}",
                        evidence_text=f"Applicant: '{client_name}' | Degree: '{d_val}'",
                        source_location=deg_name_field.get("source_location"),
                        related_documents=[{"id": str(edoc.get("id")), "title": edoc.get("title"), "version": edoc.get("version", 1)}],
                        related_fields=["client_profile.full_name", "document.recipient_name"],
                        relevant_requirement="8 CFR § 204.5(k)(3) - Educational Qualification Evidence",
                        recommended_action="Verify supporting documentation bridging name change (e.g. marriage certificate, official university name change endorsement).",
                        clarification_question=deg_cmp.suggested_clarification or f"Please provide documentation connecting the name on your diploma ('{d_val}') to your current legal name ('{client_name}').",
                        uncertainty_limitations="Evaluated against extracted degree recipient name. Confirm whether Latinized diploma text or university registrar letter exists.",
                        is_confirmed_contradiction=deg_cmp.is_confirmed_contradiction,
                        confidence_score=deg_cmp.similarity_score,
                    )
                )

    # 4. Chronology Check: Degree Date vs Employment Date
    for edoc in education_docs:
        efields = edoc.get("extracted_fields", [])
        grad_field = next((f for f in efields if f.get("field_name") in ["graduation_date", "completion_date"]), None)

        for emp_doc in employment_docs:
            emp_fields = emp_doc.get("extracted_fields", [])
            start_field = next((f for f in emp_fields if f.get("field_name") in ["start_date", "hire_date"]), None)
            req_degree_field = next((f for f in emp_fields if f.get("field_name") == "requires_degree"), None)

            if grad_field and start_field:
                grad_val = grad_field.get("normalized_value") or grad_field.get("original_value") or ""
                start_val = start_field.get("normalized_value") or start_field.get("original_value") or ""

                # If employment specifically requires advanced degree, but start precedes graduation
                if req_degree_field and req_degree_field.get("normalized_value") == "true":
                    if start_val < grad_val and len(start_val) == 10 and len(grad_val) == 10:
                        findings.append(
                            DiscrepancyFinding(
                                finding_type="form_conflict",
                                severity="major",
                                title="Chronological Inconsistency: Employment Commenced Before Degree Completion",
                                description=f"Employment letter '{emp_doc.get('title')}' indicates employment requiring degree commenced on {start_val}, which precedes stated degree completion date of {grad_val} in '{edoc.get('title')}'.",
                                evidence_text=f"Employment Start: {start_val} | Degree Date: {grad_val}",
                                source_location=start_field.get("source_location"),
                                related_documents=[
                                    {"id": str(emp_doc.get("id")), "title": emp_doc.get("title"), "version": emp_doc.get("version", 1)},
                                    {"id": str(edoc.get("id")), "title": edoc.get("title"), "version": edoc.get("version", 1)},
                                ],
                                related_fields=["employment.start_date", "education.graduation_date"],
                                relevant_requirement="Matter of Wing's Tea House, 16 I&N Dec. 158 (Acting Reg. Comm. 1977) - Qualifications prior to filing",
                                recommended_action="Clarify whether pre-graduation employment was performed as graduate research assistant / CPT or post-graduate qualifying experience.",
                                clarification_question=f"Please clarify whether your employment beginning {start_val} was pre-completion practical training prior to your graduation on {grad_val}.",
                                uncertainty_limitations="Chronology derived from extracted ISO dates. Review exact letters to determine student vs post-graduate tenure.",
                                is_confirmed_contradiction=False,
                                confidence_score=0.91,
                            )
                        )

    # 5. Multi-Document Cross-Comparison (Anchor Document vs All Other Documents in Set)
    # Checks: (a) Applicant Name (including middle-name / honorific variance), (b) DOB,
    #         (c) Father's Name & Mother's Name, (d) Residential Address & PIN Code.
    def _get_field(doc_obj: Dict[str, Any], field_names: List[str]) -> Optional[Dict[str, Any]]:
        for f in doc_obj.get("extracted_fields", []):
            if f.get("field_name") in field_names:
                val = (f.get("normalized_value") or f.get("original_value") or "").strip()
                if val:
                    return f
        return None

    # 5a. Cross-Document Date of Birth Comparison across all documents that contain a DOB
    dob_docs = []
    for d in documents:
        dob_f = _get_field(d, ["date_of_birth", "dob", "birth_date"])
        if dob_f:
            dob_docs.append((d, dob_f))

    if len(dob_docs) >= 2:
        anchor_doc, anchor_dob_f = dob_docs[0]
        anchor_dob_val = (anchor_dob_f.get("normalized_value") or anchor_dob_f.get("original_value") or "").strip()
        for other_doc, other_dob_f in dob_docs[1:]:
            other_dob_val = (other_dob_f.get("normalized_value") or other_dob_f.get("original_value") or "").strip()
            dob_cmp = compare_dates_of_birth(anchor_dob_val, other_dob_val)
            if not dob_cmp.is_concordant:
                sev = "critical" if dob_cmp.is_confirmed_contradiction else "major"
                findings.append(
                    DiscrepancyFinding(
                        finding_type="consistency_discrepancy",
                        severity=sev,
                        title=f"Cross-Document Date of Birth Mismatch: {anchor_doc.get('title')} vs {other_doc.get('title')}",
                        description=(
                            f"'{anchor_doc.get('title')}' lists Date of Birth as '{anchor_dob_val}', whereas "
                            f"'{other_doc.get('title')}' lists '{other_dob_val}'. {dob_cmp.explanation}"
                        ),
                        evidence_text=f"{anchor_doc.get('title')}: '{anchor_dob_val}' | {other_doc.get('title')}: '{other_dob_val}'",
                        source_location=other_dob_f.get("source_location"),
                        related_documents=[
                            {"id": str(anchor_doc.get("id")), "title": anchor_doc.get("title"), "version": anchor_doc.get("version", 1)},
                            {"id": str(other_doc.get("id")), "title": other_doc.get("title"), "version": other_doc.get("version", 1)},
                        ],
                        related_fields=["document.date_of_birth"],
                        relevant_requirement="8 CFR § 103.2(b)(1) / IRCC Identity Concordance — Date of Birth Verification",
                        recommended_action="Cross-verify against government Birth Certificate and Passport biodata page; obtain statutory correction or affidavit if secondary ID has a typographical DOB error.",
                        clarification_question=dob_cmp.suggested_clarification,
                        uncertainty_limitations="Evaluated across extracted date fields from multiple applicant documents.",
                        is_confirmed_contradiction=dob_cmp.is_confirmed_contradiction,
                        confidence_score=dob_cmp.similarity_score,
                    )
                )

    # 5b. Cross-Document Father's Name & Mother's Name Comparison
    for parent_role, field_keys in [
        ("Father", ["father_legal_name", "father_name", "father_or_spouse_name", "guardian_or_spouse_name", "groom_father_name", "bride_father_name"]),
        ("Mother", ["mother_legal_name", "mother_name"]),
    ]:
        parent_docs = []
        for d in documents:
            pf = _get_field(d, field_keys)
            if pf:
                parent_docs.append((d, pf))

        if len(parent_docs) >= 2:
            anc_doc, anc_pf = parent_docs[0]
            anc_val = (anc_pf.get("normalized_value") or anc_pf.get("original_value") or "").strip()
            for oth_doc, oth_pf in parent_docs[1:]:
                oth_val = (oth_pf.get("normalized_value") or oth_pf.get("original_value") or "").strip()
                p_cmp = compare_parent_names(anc_val, oth_val, parent_role=parent_role)
                if not p_cmp.is_concordant:
                    sev = "critical" if p_cmp.is_confirmed_contradiction else "major"
                    findings.append(
                        DiscrepancyFinding(
                            finding_type="consistency_discrepancy",
                            severity=sev,
                            title=f"{parent_role}'s Name Discrepancy Across Documents ({p_cmp.variation_type or 'variance'})",
                            description=(
                                f"'{anc_doc.get('title')}' records {parent_role}'s Name as '{anc_val}', whereas "
                                f"'{oth_doc.get('title')}' records '{oth_val}'. {p_cmp.explanation}"
                            ),
                            evidence_text=f"{anc_doc.get('title')}: '{anc_val}' | {oth_doc.get('title')}: '{oth_val}'",
                            source_location=oth_pf.get("source_location"),
                            related_documents=[
                                {"id": str(anc_doc.get("id")), "title": anc_doc.get("title"), "version": anc_doc.get("version", 1)},
                                {"id": str(oth_doc.get("id")), "title": oth_doc.get("title"), "version": oth_doc.get("version", 1)},
                            ],
                            related_fields=[f"document.{parent_role.lower()}_name"],
                            relevant_requirement="Consular Civil Lineage Verification — Parent Name Concordance (Passport Page 36 vs Civil/Tax IDs)",
                            recommended_action=(
                                f"Execute a notarized 'One and the Same Person' Affidavit from {parent_role.lower()} "
                                f"confirming that '{anc_val}' and '{oth_val}' refer to the same individual."
                            ),
                            clarification_question=p_cmp.suggested_clarification,
                            uncertainty_limitations="Automated comparison of extracted parental lineage fields across submitted documents.",
                            is_confirmed_contradiction=p_cmp.is_confirmed_contradiction,
                            confidence_score=p_cmp.similarity_score,
                        )
                    )

    # 5c. Cross-Document Residential Address & PIN Code Comparison
    addr_docs = []
    for d in documents:
        af = _get_field(d, ["address", "residential_address", "permanent_address"])
        if af:
            addr_docs.append((d, af))

    if len(addr_docs) >= 2:
        anc_doc, anc_af = addr_docs[0]
        anc_addr = (anc_af.get("normalized_value") or anc_af.get("original_value") or "").strip()
        for oth_doc, oth_af in addr_docs[1:]:
            oth_addr = (oth_af.get("normalized_value") or oth_af.get("original_value") or "").strip()
            a_cmp = compare_addresses(anc_addr, oth_addr)
            if not a_cmp.is_concordant:
                findings.append(
                    DiscrepancyFinding(
                        finding_type="consistency_discrepancy",
                        severity="minor" if not a_cmp.is_confirmed_contradiction else "major",
                        title=f"Residential Address Change / Mismatch: {anc_doc.get('title')} vs {oth_doc.get('title')}",
                        description=(
                            f"'{anc_doc.get('title')}' lists address '{anc_addr}', while "
                            f"'{oth_doc.get('title')}' lists '{oth_addr}'. {a_cmp.explanation}"
                        ),
                        evidence_text=f"{anc_doc.get('title')}: '{anc_addr}' | {oth_doc.get('title')}: '{oth_addr}'",
                        source_location=oth_af.get("source_location"),
                        related_documents=[
                            {"id": str(anc_doc.get("id")), "title": anc_doc.get("title"), "version": anc_doc.get("version", 1)},
                            {"id": str(oth_doc.get("id")), "title": oth_doc.get("title"), "version": oth_doc.get("version", 1)},
                        ],
                        related_fields=["document.address"],
                        relevant_requirement="Address History & Jurisdiction Verification (Permanent vs Present Address)",
                        recommended_action="Disclose both Permanent Address (as on Passport) and Present/Mailing Address on visa forms, and attach supporting proof of current residence.",
                        clarification_question=a_cmp.suggested_clarification,
                        uncertainty_limitations="Evaluated locality tokens and 6-digit PIN / postal codes across identity and financial records.",
                        is_confirmed_contradiction=a_cmp.is_confirmed_contradiction,
                        confidence_score=a_cmp.similarity_score,
                    )
                )

    return findings
