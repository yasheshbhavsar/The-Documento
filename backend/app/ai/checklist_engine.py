"""Pathway-specific evidentiary checklist engine.

Evaluates uploaded and verified case documents against configurable jurisdiction
and visa category statutory requirements. Identifies evidentiary gaps without making
unsupported legal determinations.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class ChecklistItem:
    item_id: str
    label: str
    requirement_citation: str
    is_mandatory: bool
    acceptable_categories: List[str]
    is_satisfied: bool = False
    matching_document_id: Optional[str] = None
    matching_document_title: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ChecklistAuditReport:
    jurisdiction: str
    visa_category: str
    items: List[ChecklistItem]
    total_mandatory: int
    satisfied_mandatory: int
    total_items: int
    satisfied_items: int
    fulfillment_percentage: float
    missing_items: List[ChecklistItem] = field(default_factory=list)


PATHWAY_CHECKLISTS: Dict[str, List[Dict[str, Any]]] = {
    "EB-1A": [
        {
            "item_id": "eb1a_passport",
            "label": "Primary Passport & Identity Record",
            "requirement_citation": "8 CFR § 103.2(b)(1) - Primary Identification",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "eb1a_cv",
            "label": "Comprehensive Curriculum Vitae / Resume",
            "requirement_citation": "Evidentiary Foundation - Professional Background",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "other_evidence"],
        },
        {
            "item_id": "eb1a_degree",
            "label": "Highest Academic Degree or Diploma",
            "requirement_citation": "Educational Background & Credentials",
            "is_mandatory": False,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "eb1a_peer_review",
            "label": "Judging of the Work of Others (Peer Review)",
            "requirement_citation": "8 CFR § 204.5(h)(3)(iv) - Participation as a Judge",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
        {
            "item_id": "eb1a_scholarly_articles",
            "label": "Authorship of Scholarly Articles / Publications",
            "requirement_citation": "8 CFR § 204.5(h)(3)(vi) - Authorship of Articles",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence"],
        },
        {
            "item_id": "eb1a_critical_role",
            "label": "Leading or Critical Role for Distinguished Organizations",
            "requirement_citation": "8 CFR § 204.5(h)(3)(viii) - Critical Role",
            "is_mandatory": False,
            "acceptable_categories": ["employment_record", "other_evidence"],
        },
        {
            "item_id": "eb1a_original_contribution",
            "label": "Original Contributions of Major Significance",
            "requirement_citation": "8 CFR § 204.5(h)(3)(v) - Major Contributions",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
    ],
    "O-1A": [
        {
            "item_id": "o1a_passport",
            "label": "Valid Passport Biodata Page",
            "requirement_citation": "8 CFR § 214.2(o)(2) - Alien Identity",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "o1a_contract",
            "label": "Written Employment Contract / Deal Memo / Itinerary",
            "requirement_citation": "8 CFR § 214.2(o)(2)(ii)(B) - Agreement Terms",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "government_correspondence"],
        },
        {
            "item_id": "o1a_consultation",
            "label": "Peer Group / Labor Union Advisory Consultation",
            "requirement_citation": "8 CFR § 214.2(o)(5) - Consultation Requirement",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "o1a_high_remuneration",
            "label": "High Salary or Significant Remuneration Evidence",
            "requirement_citation": "8 CFR § 214.2(o)(3)(iii)(B)(8) - High Salary",
            "is_mandatory": False,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
    ],
    "EB-2": [
        {
            "item_id": "eb2_passport",
            "label": "Valid Passport Record",
            "requirement_citation": "8 CFR § 204.5(k)(1)",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "eb2_advanced_degree",
            "label": "Advanced Degree (Master's or Foreign Equivalent)",
            "requirement_citation": "8 CFR § 204.5(k)(2) - Advanced Degree",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "eb2_niw_statement",
            "label": "National Interest Waiver Matter of Dhanasar Statement",
            "requirement_citation": "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "eb2_expert_letters",
            "label": "Independent Expert Recommendation Letters",
            "requirement_citation": "Matter of Dhanasar Prong II (Well-Positioned)",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
    ],
    "H-1B": [
        {
            "item_id": "h1b_passport",
            "label": "Beneficiary Passport Biodata",
            "requirement_citation": "8 CFR § 214.2(h)(2)(i)(A)",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "h1b_degree",
            "label": "Bachelor's Degree or Equivalent in Specialty Field",
            "requirement_citation": "INA § 214(i)(1) - Specialty Degree",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "h1b_lca",
            "label": "Certified Labor Condition Application (Form ETA-9035)",
            "requirement_citation": "20 CFR § 655.700 - DOL Certification",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "other_evidence"],
        },
        {
            "item_id": "h1b_job_offer",
            "label": "Employer Support & Detailed Job Offer Letter",
            "requirement_citation": "8 CFR § 214.2(h)(4)(iii)(A) - Specialty Criteria",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
    ],
}


def audit_case_checklist(
    jurisdiction: str,
    visa_category: str,
    documents: List[Dict[str, Any]],
) -> ChecklistAuditReport:
    """Evaluates case documents against configured category checklist requirements."""
    category_key = visa_category.upper().replace("-", "")
    matched_template: List[Dict[str, Any]] = []

    for k, v in PATHWAY_CHECKLISTS.items():
        if k.upper().replace("-", "") in category_key or category_key in k.upper().replace("-", ""):
            matched_template = v
            break

    if not matched_template:
        matched_template = PATHWAY_CHECKLISTS["EB-1A"]  # Default sensible immigration standard

    checklist_items: List[ChecklistItem] = []

    for t in matched_template:
        item = ChecklistItem(
            item_id=t["item_id"],
            label=t["label"],
            requirement_citation=t["requirement_citation"],
            is_mandatory=t["is_mandatory"],
            acceptable_categories=t["acceptable_categories"],
        )

        # Match against uploaded documents
        # Document matches if its category matches acceptable categories
        for doc in documents:
            doc_cat = doc.get("category", "")
            # Check processing status not failed
            if doc.get("processing_status") != "failed" and doc_cat in item.acceptable_categories:
                item.is_satisfied = True
                item.matching_document_id = str(doc.get("id"))
                item.matching_document_title = doc.get("title") or doc.get("filename")
                item.notes = f"Evidenced by '{item.matching_document_title}'"
                break

        checklist_items.append(item)

    total_mandatory = sum(1 for it in checklist_items if it.is_mandatory)
    satisfied_mandatory = sum(1 for it in checklist_items if it.is_mandatory and it.is_satisfied)
    total_items = len(checklist_items)
    satisfied_items = sum(1 for it in checklist_items if it.is_satisfied)
    missing_items = [it for it in checklist_items if not it.is_satisfied]

    fulfillment_pct = (satisfied_items / total_items * 100.0) if total_items > 0 else 0.0

    return ChecklistAuditReport(
        jurisdiction=jurisdiction,
        visa_category=visa_category,
        items=checklist_items,
        total_mandatory=total_mandatory,
        satisfied_mandatory=satisfied_mandatory,
        total_items=total_items,
        satisfied_items=satisfied_items,
        fulfillment_percentage=round(fulfillment_pct, 1),
        missing_items=missing_items,
    )
