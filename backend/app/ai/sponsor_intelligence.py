"""Deterministic Statutory Sponsor, Sibling & Cross-Border Financial Rules Engine.

100% deterministic, zero-data-egress statutory evaluation engine covering:
1. Canada IRCC Super Visa Low Income Cut-Off (LICO) Calculator & $100k/365-Day Insurance Check
2. Canada Express Entry +15 CRS Points Sibling-in-Canada 3-Prong Verifier (IRCC MI s. 29(2))
3. UKVI Standard Visitor / Appendix Finance 28-Day Consecutive Funds & UK Sponsor Check
4. Australia Subclass 600 Sponsored Family / Visitor VEVO, ATO NOA & Form 1149 Check
5. Universal Evidentiary Guardrails (<6-month passport expiry & unexplained lump-sum spikes)
6. Semantic Person-Role Attribution & Family/Sponsor Graph Builder
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.app.ai.comparators import (
    are_roles_distinct_persons,
    compare_names,
    compare_parent_names,
    normalize_person_role,
    parse_date_flexibly,
)
from backend.app.ai.financial_parser import FinancialIntelligenceEngine

# Graceful optional integration with Subagent 1's OCR/extraction additions
try:
    from backend.app.extraction.service import infer_document_person_role as _ext_infer_person_role
except ImportError:
    _ext_infer_person_role = None

try:
    from backend.app.ocr.barcode_decoder import decode_document_barcodes as _ocr_decode_barcodes
except ImportError:
    _ocr_decode_barcodes = None


ROLE_LABELS: Dict[str, str] = {
    "principal_applicant": "Principal Applicant",
    "spouse_partner": "Spouse / Common-Law Partner",
    "dependant_child": "Dependant Child",
    "overseas_sponsor_host": "Overseas Sponsor / Host",
    "canadian_crs_sibling": "Canadian PR / Citizen Sibling (+15 CRS)",
}

CANADIAN_PROVINCE_TOKENS = (
    "ontario",
    "british columbia",
    "alberta",
    "quebec",
    "québec",
    "manitoba",
    "saskatchewan",
    "nova scotia",
    "new brunswick",
    "newfoundland",
    "prince edward island",
    "toronto",
    "vancouver",
    "calgary",
    "edmonton",
    "ottawa",
    "montreal",
    "winnipeg",
    "mississauga",
    "brampton",
    "surrey",
)

CANADIAN_POSTAL_RE = re.compile(
    r"\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z][\s\-]?\d[A-CEGHJ-NPR-TV-Z]\d\b",
    re.IGNORECASE,
)

UK_POSTCODE_RE = re.compile(
    r"\b(?:GIR\s?0AA|[A-PR-UWYZ][A-HK-Y]?\d[\dA-HJKSTUW]?\s+\d[ABD-HJLNP-UW-Z]{2})\b",
    re.IGNORECASE,
)

UK_SHARE_CODE_RE = re.compile(
    r"(?:share\s*code[\s:#\-]*([A-Z0-9]{3}[\s\-]?[A-Z0-9]{3}[\s\-]?[A-Z0-9]{3})|\b([WSR][A-Z0-9]{2}[\s\-][A-Z0-9]{3}[\s\-][A-Z0-9]{3})\b)",
    re.IGNORECASE,
)


def _parse_numeric_amount(raw: Any) -> Optional[float]:
    """Deterministically parses currency strings or numeric scalars into float."""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if not s:
        return None
    m = re.search(r"(-?\d[\d,]*(?:\.\d{1,2})?)", s)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _to_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    parsed = parse_date_flexibly(str(val))
    if not parsed:
        return None
    try:
        return date(parsed[0], parsed[1], parsed[2])
    except ValueError:
        return None


def _extract_doc_dict(doc: Any) -> Dict[str, Any]:
    """Normalizes a Document ORM model or dictionary into a uniform inspection dictionary."""
    if isinstance(doc, dict):
        raw_fields = doc.get("extracted_fields") or {}
        field_map: Dict[str, str] = {}
        if isinstance(raw_fields, dict):
            for k, v in raw_fields.items():
                if v is not None and str(v).strip():
                    field_map[str(k)] = str(v).strip()
        elif isinstance(raw_fields, list):
            for item in raw_fields:
                if isinstance(item, dict):
                    fk = item.get("field_name") or item.get("field")
                    fv = item.get("corrected_value") if item.get("is_manually_corrected") else (
                        item.get("normalized_value") or item.get("original_value") or item.get("value")
                    )
                    if fk and fv is not None and str(fv).strip() and fk not in field_map:
                        field_map[str(fk)] = str(fv).strip()
                elif hasattr(item, "field_name"):
                    fk = item.field_name
                    fv = item.corrected_value if getattr(item, "is_manually_corrected", False) else (
                        item.normalized_value or item.original_value
                    )
                    if fk and fv is not None and str(fv).strip() and fk not in field_map:
                        field_map[str(fk)] = str(fv).strip()

        # Merge top-level convenience keys if present
        for extra_k in (
            "holder_name",
            "full_name",
            "applicant_name",
            "father_name",
            "mother_name",
            "spouse_name",
            "address",
            "date_of_birth",
            "date_of_expiry",
            "expiry_date",
            "cra_line_15000_income",
            "annual_income",
            "t4_employment_income",
        ):
            if doc.get(extra_k) is not None and extra_k not in field_map:
                field_map[extra_k] = str(doc.get(extra_k)).strip()

        text = str(
            doc.get("extracted_text")
            or doc.get("text")
            or doc.get("raw_text_preview")
            or doc.get("text_preview")
            or ""
        )
        layout = doc.get("layout_metadata") or {}
        explicit_role = (
            doc.get("person_role")
            or doc.get("contributor_role")
            or doc.get("role")
            or layout.get("person_role")
            or layout.get("contributor_role")
            or field_map.get("person_role")
            or field_map.get("contributor_role")
        )
        return {
            "id": str(doc.get("id") or doc.get("document_index") or ""),
            "title": str(doc.get("title") or doc.get("filename") or "Document"),
            "filename": str(doc.get("filename") or doc.get("title") or "document.pdf"),
            "category": str(doc.get("category") or "supporting_evidence"),
            "document_subtype": str(doc.get("document_subtype") or ""),
            "text": text,
            "fields": field_map,
            "layout": layout if isinstance(layout, dict) else {},
            "explicit_role": normalize_person_role(explicit_role) if explicit_role else "",
            "barcodes": doc.get("barcodes") or [],
        }

    # ORM Document object
    field_map = {}
    for f in getattr(doc, "extracted_fields", []) or []:
        fk = getattr(f, "field_name", None)
        fv = (
            getattr(f, "corrected_value", None)
            if getattr(f, "is_manually_corrected", False)
            else (getattr(f, "normalized_value", None) or getattr(f, "original_value", None))
        )
        if fk and fv is not None and str(fv).strip() and fk not in field_map:
            field_map[str(fk)] = str(fv).strip()

    layout = getattr(doc, "layout_metadata", None) or {}
    explicit_role = (
        layout.get("person_role")
        or layout.get("contributor_role")
        or field_map.get("person_role")
        or field_map.get("contributor_role")
    )
    return {
        "id": str(getattr(doc, "id", "")),
        "title": str(getattr(doc, "title", None) or getattr(doc, "filename", None) or "Document"),
        "filename": str(getattr(doc, "filename", None) or "document.pdf"),
        "category": str(getattr(doc, "category", None) or "supporting_evidence"),
        "document_subtype": str(layout.get("document_subtype", "")),
        "text": str(getattr(doc, "extracted_text", None) or ""),
        "fields": field_map,
        "layout": layout if isinstance(layout, dict) else {},
        "explicit_role": normalize_person_role(explicit_role) if explicit_role else "",
        "barcodes": layout.get("barcodes", []) if isinstance(layout, dict) else [],
    }


def _extract_holder_name(d: Dict[str, Any]) -> Optional[str]:
    fields = d["fields"]
    for k in (
        "holder_name",
        "full_name",
        "applicant_name",
        "child_legal_name",
        "child_name",
        "taxpayer_name",
        "employee_name",
        "account_holder_name",
        "sponsor_name",
    ):
        if fields.get(k):
            return fields[k]
    if fields.get("given_names") and fields.get("surname"):
        return f"{fields['given_names']} {fields['surname']}".strip()

    text = d["text"]
    for pat in (
        r"(?:Taxpayer(?:'s)?[ \t]*Name|Account[ \t]*Holder|Employee[ \t]*Name|Sponsor[ \t]*Name|Holder[ \t]*Name|Child(?:'s)?[ \t]*Name|Full[ \t]*Name|Name[ \t]*of[ \t]*Child)[ \t:]+([A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+){1,3})",
        r"(?:^[ \t]*1\.[ \t]*(?:નામ[ \t]*/[ \t]*नाम[ \t]*/[ \t]*)?Name|\bName)[ \t:]+([A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+){1,3})",
    ):
        m = re.search(pat, text, re.MULTILINE)
        if m:
            cand = m.group(1).strip()
            if not any(bad in cand.lower() for bad in ("of father", "of mother", "of birth", "revenue agency")):
                return cand
    return None


def _extract_parents(d: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    fields = d["fields"]
    text = d["text"]

    father = (
        fields.get("father_legal_name")
        or fields.get("father_name")
        or fields.get("groom_father_name")
        or fields.get("bride_father_name")
    )
    if not father and fields.get("father_or_spouse_name"):
        father = fields.get("father_or_spouse_name")

    mother = fields.get("mother_legal_name") or fields.get("mother_name")

    if not father:
        fm = re.search(
            r"(?:Name\s+of\s+Father(?:\s*/\s*Legal\s+Guardian)?|Father(?:'s)?\s*(?:Legal\s*)?Name|પિતાનું\s*નામ[^\n:]*|पिता\s*का\s*नाम[^\n:]*)[\s:\.]+([A-Za-z][A-Za-z\s]{2,55})",
            text,
            re.IGNORECASE,
        )
        if fm:
            father = re.split(r"\n|Mother|Address|Spouse|Date", fm.group(1), maxsplit=1)[0].strip(" .:-")

    if not mother:
        mm = re.search(
            r"(?:Name\s+of\s+Mother|Mother(?:'s)?\s*(?:Legal\s*)?Name|માતાનું\s*નામ[^\n:]*|माता\s*का\s*नाम[^\n:]*)[\s:\.]+([A-Za-z][A-Za-z\s]{2,55})",
            text,
            re.IGNORECASE,
        )
        if mm:
            mother = re.split(r"\n|Father|Address|Spouse|Date|Permanent", mm.group(1), maxsplit=1)[0].strip(" .:-")

    return (father or None, mother or None)


def _has_canadian_status_markers(d: Dict[str, Any]) -> bool:
    fields = d["fields"]
    lower = f"{d['title']} {d['filename']} {d['document_subtype']} {d['text']}".lower()
    if any(
        fields.get(k)
        for k in (
            "copr_document_number",
            "pr_card_number",
            "canadian_citizenship_number",
            "citizenship_certificate_number",
            "became_pr_date",
        )
    ):
        return True
    if any(
        marker in lower
        for marker in (
            "permanent resident card",
            "carte de resident permanent",
            "carte de résident permanent",
            "confirmation of permanent residence",
            "ecopr",
            "certificate of canadian citizenship",
            "canadian citizenship certificate",
            "citizenship certificate",
            "passport canada",
            "canadian passport",
            "p<can",
            "cacan",
        )
    ):
        return True
    if fields.get("nationality", "").upper() in ("CAN", "CANADIAN", "CANADA"):
        return True
    return False


def _has_canadian_residency_markers(d: Dict[str, Any]) -> bool:
    fields = d["fields"]
    text = d["text"]
    lower = f"{d['title']} {d['filename']} {d['document_subtype']} {text}".lower()
    addr_blob = f"{fields.get('address', '')} {fields.get('residential_address', '')} {text}"

    has_ca_location = bool(CANADIAN_POSTAL_RE.search(addr_blob)) or any(
        prov in addr_blob.lower() for prov in CANADIAN_PROVINCE_TOKENS
    )
    residency_doc_markers = (
        "hydro",
        "utility bill",
        "electricity bill",
        "enbridge",
        "water bill",
        "lease agreement",
        "residential tenancy",
        "tenancy agreement",
        "property tax",
        "municipal tax",
        "driver's licence",
        "driver licence",
        "drivers license",
        "ontario",
        "notice of assessment",
        "canada revenue agency",
    )
    # Pure status cards (PR card / passport / CoPR) do NOT count as residential utility/address proof on their own
    is_pure_status_doc = any(
        k in lower
        for k in (
            "permanent resident card",
            "confirmation of permanent residence",
            "certificate of canadian citizenship",
            "p<can",
        )
    ) and not any(k in lower for k in ("hydro", "utility", "lease", "tenancy", "property tax", "notice of assessment"))

    if is_pure_status_doc:
        return False

    if any(m in lower for m in residency_doc_markers) and (
        has_ca_location or "hydro" in lower or "canada revenue agency" in lower
    ):
        return True
    return False


def _has_overseas_sponsor_markers(d: Dict[str, Any]) -> bool:
    fields = d["fields"]
    lower = f"{d['title']} {d['filename']} {d['document_subtype']} {d['text']}".lower()
    if any(
        fields.get(k)
        for k in (
            "cra_line_15000_income",
            "line_15000_income",
            "t4_employment_income",
            "uk_share_code",
            "hmrc_p60_income",
            "ato_taxable_income",
            "vevo_grant_number",
        )
    ):
        return True
    sponsor_phrases = (
        "canada revenue agency",
        "notice of assessment",
        "line 15000",
        "statement of remuneration paid",
        "t4 ",
        "form t4",
        "hmrc",
        "p60",
        "sa302",
        "council tax",
        "share code",
        "evisa",
        "indefinite leave to remain",
        "settled status",
        "british citizen",
        "united kingdom of great britain",
        "p<gbr",
        "australian taxation office",
        "vevo",
        "visa entitlement verification online",
        "form 1149",
        "council rates",
        "commonwealth of australia",
        "p<aus",
        "letter of invitation",
        "invitation letter",
        "financial undertaking",
        "sponsorship undertaking",
        "host in canada",
        "uk sponsor",
        "australian sponsor",
    )
    return any(p in lower for p in sponsor_phrases)


class SponsorIntelligenceEngine:
    """Deterministic statutory intelligence engine for sponsors, siblings, and family packets."""

    # Official IRCC Super Visa Low Income Cut-Off (LICO) baseline table (CAD)
    SUPER_VISA_LICO_TABLE: Dict[int, float] = {
        1: 29380.0,
        2: 36576.0,
        3: 44966.0,
        4: 54594.0,
        5: 61920.0,
        6: 69834.0,
        7: 77750.0,
    }
    SUPER_VISA_ADDITIONAL_PERSON_CAD: float = 7916.0

    @classmethod
    def get_required_lico_cad(cls, family_size: int) -> float:
        size = max(1, int(family_size or 1))
        if size <= 7:
            return cls.SUPER_VISA_LICO_TABLE[size]
        return cls.SUPER_VISA_LICO_TABLE[7] + ((size - 7) * cls.SUPER_VISA_ADDITIONAL_PERSON_CAD)

    @classmethod
    def evaluate_super_visa_lico(
        cls,
        documents: Optional[List[Any]] = None,
        family_size: int = 3,
        sponsor_income_cad: Optional[float] = None,
        co_signer_income_cad: Optional[float] = None,
        insurance_coverage_cad: Optional[float] = None,
        insurance_duration_days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates IRCC Super Visa Low Income Cut-Off (LICO) threshold and
        Super Visa Medical Insurance ($100,000+ CAD coverage for >= 365 days).
        """
        eff_family_size = max(1, int(family_size or 1))
        required_lico = cls.get_required_lico_cad(eff_family_size)

        docs = [_extract_doc_dict(d) for d in (documents or [])]

        # Extract sponsor & co-signer incomes grouped by individual holder to avoid double-counting NOA + T4 for same person
        holder_incomes: List[Dict[str, Any]] = []
        detected_ins_coverage: Optional[float] = insurance_coverage_cad
        detected_ins_days: Optional[int] = insurance_duration_days
        has_insurance_doc = (insurance_coverage_cad is not None) or (insurance_duration_days is not None)

        for d in docs:
            fields = d["fields"]
            text = d["text"]
            lower = f"{d['title']} {d['filename']} {text}".lower()

            # Skip Indian domestic tax returns (ITR-V / INR) so visiting parent's INR income is never added as CAD LICO
            is_indian_itr = any(
                k in lower
                for k in ("income tax department - govt. of india", "itr-v", "indian income tax return")
            )
            if is_indian_itr:
                continue

            # 1. Check income fields & CRA NOA / T4 text patterns
            noa_val = (
                _parse_numeric_amount(fields.get("cra_line_15000_income"))
                or _parse_numeric_amount(fields.get("line_15000_income"))
                or _parse_numeric_amount(fields.get("noa_total_income"))
            )
            if noa_val is None:
                m_noa = re.search(
                    r"(?:Line\s*15000|15000\s*[-–:]?\s*Total\s*income|Total\s*income\s*\(?Line\s*15000\)?)[^\d$\n]{0,45}\$?\s*([\d,]+(?:\.\d{2})?)",
                    text,
                    re.IGNORECASE,
                )
                if m_noa:
                    noa_val = _parse_numeric_amount(m_noa.group(1))

            t4_val = (
                _parse_numeric_amount(fields.get("t4_employment_income"))
                or _parse_numeric_amount(fields.get("employment_income"))
                or _parse_numeric_amount(fields.get("annual_income"))
                or _parse_numeric_amount(fields.get("annual_salary"))
            )
            if t4_val is None and any(
                k in lower for k in ("statement of remuneration paid", "box 14", "employment income", "cra", "canada", "cad")
            ):
                m_t4 = re.search(
                    r"(?:Box\s*14[^\d$\n]{0,30}|Employment\s*income[^\d$\n]{0,30}|Annual\s*(?:Base\s*)?(?:Salary|Income)[^\d$\n]{0,30})\$?\s*([\d,]+(?:\.\d{2})?)",
                    text,
                    re.IGNORECASE,
                )
                if m_t4:
                    t4_val = _parse_numeric_amount(m_t4.group(1))

            doc_income = noa_val if noa_val is not None else t4_val
            if doc_income is not None and doc_income > 0:
                holder = _extract_holder_name(d) or d["explicit_role"] or d["title"]
                matched_existing = None
                for entry in holder_incomes:
                    if entry["holder"] and holder and compare_names(entry["holder"], holder).is_concordant:
                        matched_existing = entry
                        break
                if matched_existing is not None:
                    # Prefer CRA NOA Line 15000 if available, else max to prevent double-counting same person's T4 + NOA
                    if noa_val is not None and not matched_existing["has_noa"]:
                        matched_existing["amount_cad"] = noa_val
                        matched_existing["has_noa"] = True
                    else:
                        matched_existing["amount_cad"] = max(matched_existing["amount_cad"], doc_income)
                else:
                    holder_incomes.append(
                        {
                            "holder": holder,
                            "amount_cad": doc_income,
                            "has_noa": noa_val is not None,
                            "source_document": d["title"],
                        }
                    )

            # 2. Check Super Visa Medical Insurance ($100,000+ CAD & >= 365 days)
            is_ins_doc = (
                d["category"] == "insurance_accommodation"
                or any(
                    k in lower
                    for k in (
                        "super visa insurance",
                        "medical insurance",
                        "emergency medical",
                        "visitors to canada",
                        "policy number",
                        "coverage amount",
                        "manulife",
                        "sun life",
                        "allianz",
                        "tuGo".lower(),
                        "destination canada",
                        "21st century",
                    )
                )
                or fields.get("insurance_coverage_cad") is not None
                or fields.get("coverage_amount") is not None
            )
            if is_ins_doc:
                has_insurance_doc = True
                cov_f = (
                    _parse_numeric_amount(fields.get("insurance_coverage_cad"))
                    or _parse_numeric_amount(fields.get("coverage_amount"))
                    or _parse_numeric_amount(fields.get("medical_coverage_amount"))
                )
                if cov_f is None:
                    m_cov = re.search(
                        r"(?:Coverage(?:\s*Amount|\s*Limit)?|Sum\s*Insured|Emergency\s*Medical(?:\s*Coverage)?|Maximum\s*Benefit)[^\d$]{0,35}(?:CAD\s*)?\$?\s*([\d,]+(?:\.\d{2})?)",
                        text,
                        re.IGNORECASE,
                    )
                    if not m_cov:
                        m_cov = re.search(r"\$\s*(1\d{2},\d{3}|[2-9]\d{2},\d{3}|1,000,000|50,000|75,000)\s*(?:CAD)?", text, re.IGNORECASE)
                    if m_cov:
                        cov_f = _parse_numeric_amount(m_cov.group(1))
                if cov_f is not None:
                    detected_ins_coverage = max(detected_ins_coverage or 0.0, cov_f)

                dur_f = _parse_numeric_amount(fields.get("policy_duration_days") or fields.get("coverage_days"))
                if dur_f is not None:
                    detected_ins_days = max(detected_ins_days or 0, int(dur_f))
                else:
                    m_days = re.search(r"\b(365|366|\d{2,3})\s*days?\b", text, re.IGNORECASE)
                    if m_days:
                        detected_ins_days = max(detected_ins_days or 0, int(m_days.group(1)))
                    elif re.search(r"\b(?:1\s*year|one\s*year|12\s*months|full\s*year)\b", text, re.IGNORECASE):
                        detected_ins_days = max(detected_ins_days or 0, 365)
                    else:
                        s_dt = _to_date(fields.get("policy_start_date") or fields.get("effective_date"))
                        e_dt = _to_date(fields.get("policy_end_date") or fields.get("expiry_date"))
                        if s_dt and e_dt and e_dt > s_dt:
                            detected_ins_days = max(detected_ins_days or 0, (e_dt - s_dt).days + 1)

        total_income_cad = sum(item["amount_cad"] for item in holder_incomes)
        if sponsor_income_cad is not None or co_signer_income_cad is not None:
            explicit_sum = float(sponsor_income_cad or 0.0) + float(co_signer_income_cad or 0.0)
            total_income_cad = explicit_sum if explicit_sum > 0 or not holder_incomes else total_income_cad

        total_income_cad = round(total_income_cad, 2)
        surplus_or_shortfall = round(total_income_cad - required_lico, 2)
        is_met = total_income_cad >= required_lico

        insurance_compliant: Optional[bool] = None
        if has_insurance_doc:
            cov_ok = (detected_ins_coverage or 0.0) >= 100000.0
            days_ok = (detected_ins_days if detected_ins_days is not None else 0) >= 365
            insurance_compliant = bool(cov_ok and days_ok)

        return {
            "is_met": is_met,
            "family_size": eff_family_size,
            "required_lico_cad": round(required_lico, 2),
            "documented_income_cad": total_income_cad,
            "surplus_or_shortfall_cad": surplus_or_shortfall,
            "insurance_compliant": insurance_compliant,
            "citation": "IRPA s. 11(1) / IRPR Super Visa Ministerial Instructions",
            "income_sources": holder_incomes,
            "insurance_details": {
                "evidence_detected": has_insurance_doc,
                "coverage_amount_cad": detected_ins_coverage,
                "duration_days": detected_ins_days,
                "minimum_required_coverage_cad": 100000.0,
                "minimum_required_days": 365,
            },
        }

    @classmethod
    def evaluate_crs_sibling_points(
        cls,
        documents: List[Any],
        principal_applicant_name: Optional[str] = None,
        spouse_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates Express Entry +15 CRS Canadian PR/Citizen Sibling eligibility
        across all 3 IRCC Ministerial Instruction s. 29(2) prongs:
        1) Status Prong: Canadian PR Card / CoPR / eCoPR / Citizenship Certificate / Canadian Passport
        2) Residency Prong: Active Canadian residential address proof (Hydro/Utility, Lease, Provincial DL, Property Tax, CRA NOA)
        3) Shared-Parent Prong: Shared biological/adoptive Father and/or Mother across PA/Spouse & Sibling birth/passport records
        """
        docs = [_extract_doc_dict(d) for d in (documents or [])]

        status_verified = any(_has_canadian_status_markers(d) for d in docs)
        residency_verified = any(_has_canadian_residency_markers(d) for d in docs)

        # Collect Canadian sibling holder names from status/residency or explicit sibling role documents
        sibling_names: List[str] = []
        applicant_side_names: List[str] = []
        if principal_applicant_name:
            applicant_side_names.append(principal_applicant_name)
        if spouse_name:
            applicant_side_names.append(spouse_name)

        for d in docs:
            h_name = _extract_holder_name(d)
            role = d["explicit_role"]
            if role == "canadian_crs_sibling" or _has_canadian_status_markers(d) or _has_canadian_residency_markers(d):
                if h_name and not any(compare_names(h_name, s).is_concordant for s in sibling_names):
                    sibling_names.append(h_name)
            elif role in ("principal_applicant", "spouse_partner"):
                if h_name and not any(compare_names(h_name, a).is_concordant for a in applicant_side_names):
                    applicant_side_names.append(h_name)

        # Collect lineage records (documents bearing father_name and/or mother_name)
        lineage_records: List[Dict[str, Any]] = []
        for d in docs:
            father, mother = _extract_parents(d)
            if not father and not mother:
                continue
            holder = _extract_holder_name(d) or d["title"]
            role = d["explicit_role"]

            side = "unknown"
            if role in ("canadian_crs_sibling", "overseas_sponsor_host"):
                side = "sibling"
            elif role in ("principal_applicant", "spouse_partner"):
                side = "applicant"
            elif holder and any(compare_names(holder, s).is_concordant for s in sibling_names):
                side = "sibling"
            elif holder and any(compare_names(holder, a).is_concordant for a in applicant_side_names):
                side = "applicant"

            lineage_records.append(
                {
                    "holder": holder,
                    "side": side,
                    "father_name": father,
                    "mother_name": mother,
                    "title": d["title"],
                }
            )

        matched_parent_names: List[str] = []
        shared_parent_verified = False

        def _parents_match(name_1: Optional[str], name_2: Optional[str], label: str) -> Optional[str]:
            if not name_1 or not name_2:
                return None
            cmp_primary = compare_names(name_1, name_2)
            if cmp_primary.is_concordant:
                return name_1
            cmp_parent = compare_parent_names(name_1, name_2, parent_role=label)
            if not cmp_parent.is_confirmed_contradiction and cmp_parent.similarity_score >= 0.84:
                return name_1
            return None

        # Compare pairs of lineage records belonging to distinct individuals (one applicant/spouse, one sibling)
        for i in range(len(lineage_records)):
            for j in range(i + 1, len(lineage_records)):
                rec_a = lineage_records[i]
                rec_b = lineage_records[j]

                # Must represent two distinct individuals (not two IDs of the same person)
                same_holder = (
                    rec_a["holder"]
                    and rec_b["holder"]
                    and compare_names(rec_a["holder"], rec_b["holder"]).is_concordant
                )
                if same_holder and rec_a["side"] == rec_b["side"]:
                    continue
                if rec_a["side"] != "unknown" and rec_b["side"] != "unknown" and rec_a["side"] == rec_b["side"]:
                    continue

                f_match = _parents_match(rec_a["father_name"], rec_b["father_name"], "Father")
                if f_match and f_match not in matched_parent_names:
                    matched_parent_names.append(f_match)

                m_match = _parents_match(rec_a["mother_name"], rec_b["mother_name"], "Mother")
                if m_match and m_match not in matched_parent_names:
                    matched_parent_names.append(m_match)

        if matched_parent_names:
            shared_parent_verified = True

        missing_evidence: List[str] = []
        if not status_verified:
            missing_evidence.append(
                "Sibling Canadian PR Card, Confirmation of Permanent Residence (CoPR/eCoPR), Citizenship Certificate, or Canadian Passport"
            )
        if not residency_verified:
            missing_evidence.append(
                "Sibling active Canadian residential address proof (Utility/Hydro bill, Lease agreement, Provincial Driver's Licence, Property Tax, or CRA NOA)"
            )
        if not shared_parent_verified:
            missing_evidence.append(
                "Birth certificates or passport parent endorsements for both Applicant/Spouse and Canadian Sibling confirming at least one common parent"
            )

        eligible = bool(status_verified and residency_verified and shared_parent_verified)
        return {
            "eligible_for_15_crs_points": eligible,
            "crs_points_awarded": 15 if eligible else 0,
            "prongs": {
                "status_verified": status_verified,
                "residency_verified": residency_verified,
                "shared_parent_verified": shared_parent_verified,
                "matched_parent_names": matched_parent_names,
            },
            "missing_evidence": missing_evidence,
            "citation": "Express Entry Ministerial Instructions s. 29(2) — Sibling in Canada (+15 CRS)",
        }

    @classmethod
    def evaluate_uk_sponsor_and_funds(
        cls,
        documents: List[Any],
        required_floor_gbp: float = 0.0,
        as_of_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates UKVI Appendix V & Appendix Finance requirements:
        - 28-day consecutive minimum balance floor
        - Statement ending within 31 days of application/audit date
        - UK Sponsor immigration status (British Passport / UKVI eVisa Share Code / ILR / Settled Status)
        - HMRC P60 / SA302 / UK Payslip income verification
        - UK Council Tax / Tenancy / Mortgage accommodation proof
        """
        ref_dt = (as_of_date or datetime.now(timezone.utc)).date()
        docs = [_extract_doc_dict(d) for d in (documents or [])]

        min_balance_observed: Optional[float] = None
        days_covered: int = 0
        statement_end_date: Optional[date] = None
        statement_within_31_days: Optional[bool] = None

        sponsor_status_verified = False
        sponsor_status_type: Optional[str] = None
        share_code_detected: Optional[str] = None

        hmrc_income_verified = False
        documented_income_gbp: float = 0.0
        accommodation_verified = False

        for d in docs:
            fields = d["fields"]
            text = d["text"]
            lower = f"{d['title']} {d['filename']} {text}".lower()

            # 1. UK Sponsor Status (British Passport / eVisa Share Code / ILR / Settled Status)
            sc_val = fields.get("uk_share_code") or fields.get("share_code")
            if not sc_val:
                sc_m = UK_SHARE_CODE_RE.search(text)
                if sc_m:
                    sc_val = (sc_m.group(1) or sc_m.group(2) or "").strip().upper()
            if sc_val:
                share_code_detected = sc_val
                sponsor_status_verified = True
                sponsor_status_type = "UKVI eVisa Share Code"

            if any(
                k in lower
                for k in (
                    "british citizen",
                    "united kingdom of great britain",
                    "p<gbr",
                    "british passport",
                    "indefinite leave to remain",
                    "settled status",
                    "eu settlement scheme",
                    "evisa",
                    "right to reside",
                )
            ):
                sponsor_status_verified = True
                if not sponsor_status_type:
                    if "passport" in lower or "p<gbr" in lower or "british citizen" in lower:
                        sponsor_status_type = "British Citizen Passport"
                    elif "settled status" in lower:
                        sponsor_status_type = "UK EUSS Settled Status"
                    elif "indefinite leave" in lower:
                        sponsor_status_type = "UK Indefinite Leave to Remain (ILR)"
                    else:
                        sponsor_status_type = "UKVI eVisa Status"

            # 2. HMRC P60 / SA302 / Payslip Income
            if any(k in lower for k in ("p60", "sa302", "hmrc", "hm revenue", "national insurance", "paye", "payslip")):
                inc_val = (
                    _parse_numeric_amount(fields.get("hmrc_p60_income"))
                    or _parse_numeric_amount(fields.get("annual_income"))
                    or _parse_numeric_amount(fields.get("total_pay"))
                )
                if inc_val is None:
                    m_uk_inc = re.search(
                        r"(?:Total\s*(?:pay|income)(?:\s*in\s*this\s*employment|\s*received)?|Gross\s*(?:Annual\s*)?Pay|Taxable\s*Income)[^\d£\n]{0,40}£?\s*([\d,]+(?:\.\d{2})?)",
                        text,
                        re.IGNORECASE,
                    )
                    if not m_uk_inc:
                        m_uk_inc = re.search(r"£\s*([\d,]{4,}(?:\.\d{2})?)", text)
                    if m_uk_inc:
                        inc_val = _parse_numeric_amount(m_uk_inc.group(1))
                hmrc_income_verified = True
                if inc_val:
                    documented_income_gbp = max(documented_income_gbp, inc_val)

            # 3. Council Tax / Tenancy / Accommodation Proof
            if any(
                k in lower
                for k in (
                    "council tax",
                    "assured shorthold tenancy",
                    "tenancy agreement",
                    "land registry",
                    "mortgage statement",
                    "accommodation undertaking",
                )
            ) or (bool(UK_POSTCODE_RE.search(text)) and any(k in lower for k in ("utility", "thames water", "british gas", "octopus energy", "lease"))):
                accommodation_verified = True

            # 4. Bank Statement 28-Day Consecutive Balance & 31-Day Recency Check
            if d["category"] == "financial_evidence" or any(
                k in lower for k in ("bank statement", "account statement", "opening balance", "closing balance", "minimum daily balance", "28 consecutive days", "28 days")
            ):
                bank_sum = FinancialIntelligenceEngine.parse_bank_statement_text(text, default_currency="GBP")
                cand_min = (
                    _parse_numeric_amount(fields.get("minimum_balance_observed"))
                    or _parse_numeric_amount(fields.get("minimum_balance"))
                    or (bank_sum.minimum_balance_observed if bank_sum.minimum_balance_observed > 0 else None)
                    or (bank_sum.closing_balance if bank_sum.closing_balance > 0 else None)
                )
                if cand_min is not None:
                    min_balance_observed = cand_min if min_balance_observed is None else max(min_balance_observed, cand_min)

                explicit_days = _parse_numeric_amount(fields.get("consecutive_days_held") or fields.get("days_held"))
                if explicit_days is not None:
                    days_covered = max(days_covered, int(explicit_days))
                elif re.search(r"\b(?:28|29|30|31|60|90|180)\s*(?:consecutive\s*)?days\b", lower):
                    m_d = re.search(r"\b(\d{2,3})\s*(?:consecutive\s*)?days\b", lower)
                    if m_d:
                        days_covered = max(days_covered, int(m_d.group(1)))

                s_start = _to_date(fields.get("statement_period_start") or bank_sum.statement_period_start)
                s_end = _to_date(fields.get("statement_period_end") or fields.get("statement_date") or bank_sum.statement_period_end)
                if not s_start or not s_end:
                    all_dates = re.findall(
                        r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b",
                        text,
                    )
                    parsed_dts = [dt for raw_d in all_dates if (dt := _to_date(raw_d)) is not None]
                    if len(parsed_dts) >= 2:
                        s_start = s_start or min(parsed_dts)
                        s_end = s_end or max(parsed_dts)
                    elif len(parsed_dts) == 1 and not s_end:
                        s_end = parsed_dts[0]

                if s_start and s_end and s_end >= s_start:
                    days_covered = max(days_covered, (s_end - s_start).days + 1)
                if s_end:
                    if statement_end_date is None or s_end > statement_end_date:
                        statement_end_date = s_end

        days_since_end: Optional[int] = None
        if statement_end_date is not None:
            days_since_end = (ref_dt - statement_end_date).days
            statement_within_31_days = days_since_end <= 31

        balance_val = round(min_balance_observed or 0.0, 2)
        twenty_eight_day_met = bool(days_covered >= 28 and balance_val >= required_floor_gbp and (min_balance_observed is not None))

        missing_evidence: List[str] = []
        if not twenty_eight_day_met:
            missing_evidence.append("Bank statement demonstrating required funds held continuously for >= 28 consecutive days")
        if statement_within_31_days is False:
            missing_evidence.append("Recent bank statement with closing date within 31 days of application")
        if not sponsor_status_verified:
            missing_evidence.append("UK Sponsor immigration status (British Passport, ILR, Settled Status, or UKVI eVisa Share Code)")
        if not hmrc_income_verified:
            missing_evidence.append("UK Sponsor HMRC P60, SA302 Tax Calculation, or recent UK payslips")
        if not accommodation_verified:
            missing_evidence.append("UK Council Tax bill, Tenancy Agreement, or accommodation undertaking")

        is_compliant = bool(
            twenty_eight_day_met
            and (statement_within_31_days is not False)
            and sponsor_status_verified
            and hmrc_income_verified
            and accommodation_verified
        )

        return {
            "is_compliant": is_compliant,
            "twenty_eight_day_rule_met": twenty_eight_day_met,
            "days_covered": days_covered,
            "minimum_balance_observed": balance_val,
            "required_floor_gbp": round(required_floor_gbp, 2),
            "statement_within_31_days": statement_within_31_days,
            "statement_end_date": statement_end_date.isoformat() if statement_end_date else None,
            "days_since_statement_end": days_since_end,
            "sponsor_status_verified": sponsor_status_verified,
            "sponsor_status_type": sponsor_status_type,
            "share_code_detected": share_code_detected,
            "hmrc_income_verified": hmrc_income_verified,
            "documented_income_gbp": round(documented_income_gbp, 2),
            "accommodation_verified": accommodation_verified,
            "missing_evidence": missing_evidence,
            "citation": "UK Immigration Rules Appendix V (V 4.2–4.3) & Appendix Finance (FIN 7.1 — 28-Day Rule)",
        }

    @classmethod
    def evaluate_au_sponsor_evidence(cls, documents: List[Any]) -> Dict[str, Any]:
        """
        Evaluates Australia Subclass 600 Sponsored Family / Visitor sponsor evidence:
        - VEVO active visa / Permanent Resident / Australian Citizen entitlement
        - ATO Notice of Assessment taxable income (AUD)
        - Australian residential address proof (Council Rates / Utility) or Form 1149 undertaking
        """
        docs = [_extract_doc_dict(d) for d in (documents or [])]

        vevo_or_status_verified = False
        entitlement_type: Optional[str] = None
        visa_grant_number: Optional[str] = None

        ato_noa_verified = False
        taxable_income_aud: float = 0.0

        has_form_1149 = False
        has_au_address_proof = False

        for d in docs:
            fields = d["fields"]
            text = d["text"]
            lower = f"{d['title']} {d['filename']} {text}".lower()

            # 1. VEVO / Australian PR / Australian Citizenship / Passport
            grant_val = fields.get("vevo_grant_number") or fields.get("visa_grant_number")
            if not grant_val:
                m_grant = re.search(r"Visa\s*Grant\s*Number[\s:#\-]*(\d{10,15})", text, re.IGNORECASE)
                if m_grant:
                    grant_val = m_grant.group(1)
            if grant_val:
                visa_grant_number = grant_val

            if any(
                k in lower
                for k in (
                    "vevo",
                    "visa entitlement verification online",
                    "in effect",
                    "australian citizenship",
                    "commonwealth of australia",
                    "australian passport",
                    "p<aus",
                )
            ):
                # Reject expired/ceased VEVO
                if not any(bad in lower for bad in ("visa status: ceased", "visa status: expired", "not in effect")):
                    vevo_or_status_verified = True
                    if "passport" in lower or "p<aus" in lower:
                        entitlement_type = "Australian Citizen Passport"
                    elif "citizenship" in lower:
                        entitlement_type = "Australian Citizenship Certificate"
                    else:
                        entitlement_type = "VEVO Active Visa / PR Entitlement"

            # 2. ATO Notice of Assessment
            if any(
                k in lower
                for k in (
                    "australian taxation office",
                    "your taxable income is",
                    "ato ",
                    "payg payment summary",
                )
            ) or ("notice of assessment" in lower and any(a in lower for a in ("australian", "ato", "aud", "tfn", "sydney", "melbourne", "brisbane", "perth", "adelaide"))):
                ato_noa_verified = True
                inc = (
                    _parse_numeric_amount(fields.get("ato_taxable_income"))
                    or _parse_numeric_amount(fields.get("taxable_income"))
                    or _parse_numeric_amount(fields.get("annual_income"))
                )
                if inc is None:
                    m_ato = re.search(
                        r"(?:Your\s*taxable\s*income\s*is|Taxable\s*Income|Gross\s*Payments)[^\d$\n]{0,40}(?:AUD\s*)?\$?\s*([\d,]+(?:\.\d{2})?)",
                        text,
                        re.IGNORECASE,
                    )
                    if m_ato:
                        inc = _parse_numeric_amount(m_ato.group(1))
                if inc:
                    taxable_income_aud = max(taxable_income_aud, inc)

            # 3. Form 1149 / Statutory Declaration / Australian Residency Proof
            if "form 1149" in lower or "1149" in d["filename"].lower() or "sponsored family visitor" in lower:
                has_form_1149 = True
            if any(
                k in lower
                for k in (
                    "council rates",
                    "rates notice",
                    "origin energy",
                    "agl ",
                    "sydney water",
                    "telstra",
                    " statutory declaration",
                    "new south wales",
                    "victoria",
                    "queensland",
                    "western australia",
                    "south australia",
                )
            ):
                has_au_address_proof = True

        residency_or_undertaking_verified = bool(has_form_1149 or has_au_address_proof)
        missing_evidence: List[str] = []
        if not vevo_or_status_verified:
            missing_evidence.append("Australian Sponsor VEVO active visa check, Citizenship Certificate, or Australian Passport")
        if not ato_noa_verified:
            missing_evidence.append("Australian Taxation Office (ATO) Notice of Assessment or PAYG income summary")
        if not residency_or_undertaking_verified:
            missing_evidence.append("Australian Council Rates / Utility residency proof or Form 1149 Sponsorship Undertaking")

        is_compliant = bool(vevo_or_status_verified and ato_noa_verified and residency_or_undertaking_verified)

        return {
            "is_compliant": is_compliant,
            "vevo_or_status_verified": vevo_or_status_verified,
            "entitlement_type": entitlement_type,
            "visa_grant_number": visa_grant_number,
            "ato_noa_verified": ato_noa_verified,
            "taxable_income_aud": round(taxable_income_aud, 2),
            "residency_or_undertaking_verified": residency_or_undertaking_verified,
            "has_form_1149": has_form_1149,
            "has_au_address_proof": has_au_address_proof,
            "missing_evidence": missing_evidence,
            "citation": "Migration Regulations 1994 (Cth) Schedule 2, Subclass 600 (600.211 / Sponsored Family Stream)",
        }

    @classmethod
    def evaluate_universal_guardrails(
        cls,
        documents: List[Any],
        as_of_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Universal statutory guardrails across all pathways:
        1) passport_six_month_warning: Passport expiring within < 180 days (or already expired)
        2) unexplained_lump_sum_warning: Sharp closing balance spike / unseasoned large deposit
        """
        ref_dt = (as_of_date or datetime.now(timezone.utc)).date()
        docs = [_extract_doc_dict(d) for d in (documents or [])]

        passport_warnings: List[Dict[str, Any]] = []
        lump_sum_warnings: List[Dict[str, Any]] = []

        for d in docs:
            fields = d["fields"]
            text = d["text"]
            lower = f"{d['title']} {d['filename']} {text}".lower()

            # 1. Passport < 6 months remaining validity check
            is_passport = d["category"] == "identity_passport" and (
                "passport" in lower or "passeport" in lower or fields.get("passport_number") is not None
            )
            if is_passport:
                exp_raw = (
                    fields.get("date_of_expiry")
                    or fields.get("expiry_date")
                    or fields.get("expiration_date")
                    or fields.get("passport_expiry")
                )
                if not exp_raw:
                    m_exp = re.search(
                        r"(?:Date\s*of\s*Expir(?:y|ation)|Valid\s*Until|Expiry\s*Date)[^\d\n]{0,25}(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})",
                        text,
                        re.IGNORECASE,
                    )
                    if m_exp:
                        exp_raw = m_exp.group(1)

                exp_dt = _to_date(exp_raw)
                if exp_dt is not None:
                    days_rem = (exp_dt - ref_dt).days
                    if days_rem < 180:
                        passport_warnings.append(
                            {
                                "document": d["title"],
                                "holder_name": _extract_holder_name(d),
                                "expiry_date": exp_dt.isoformat(),
                                "days_remaining": days_rem,
                                "is_expired": days_rem < 0,
                                "message": (
                                    f"Passport '{d['title']}' has expired ({exp_dt.isoformat()})."
                                    if days_rem < 0
                                    else f"Passport '{d['title']}' has only {days_rem} days validity remaining (< 6-month consular rule)."
                                ),
                            }
                        )

            # 2. Unexplained large lump-sum deposit / sharp closing balance spike check
            if d["category"] == "financial_evidence" or any(
                k in lower for k in ("bank statement", "account statement", "beginning balance", "opening balance")
            ):
                bank_sum = FinancialIntelligenceEngine.parse_bank_statement_text(text)
                opening = _parse_numeric_amount(fields.get("opening_balance")) or bank_sum.opening_balance
                closing = _parse_numeric_amount(fields.get("closing_balance")) or bank_sum.closing_balance

                if bank_sum.suspicious_lump_sums:
                    for t in bank_sum.suspicious_lump_sums:
                        lump_sum_warnings.append(
                            {
                                "document": d["title"],
                                "amount": t.amount,
                                "date": t.transaction_date,
                                "description": t.description,
                                "reason": "Unexplained large non-payroll credit detected on bank statement.",
                            }
                        )
                elif closing > 0 and opening >= 0 and (closing - opening) >= 10000.0 and closing >= max(opening * 2.5, 15000.0):
                    # Check if payroll credits explain the jump
                    has_matching_payroll = bool(re.search(r"payroll|salary\s*credit", lower)) and bank_sum.average_monthly_credits * 4 >= (closing - opening)
                    if not has_matching_payroll:
                        lump_sum_warnings.append(
                            {
                                "document": d["title"],
                                "amount": round(closing - opening, 2),
                                "date": None,
                                "description": f"Opening {opening:,.2f} -> Closing {closing:,.2f}",
                                "reason": "Closing balance spikes sharply above opening balance without commensurate payroll trail.",
                            }
                        )

        return {
            "passport_six_month_warning": len(passport_warnings) > 0,
            "passport_warnings": passport_warnings,
            "unexplained_lump_sum_warning": len(lump_sum_warnings) > 0,
            "lump_sum_warnings": lump_sum_warnings,
        }

    @classmethod
    def infer_role_for_document(
        cls,
        doc: Any,
        anchor_applicant_name: Optional[str] = None,
        anchor_spouse_name: Optional[str] = None,
        known_sibling_names: Optional[List[str]] = None,
        known_sponsor_names: Optional[List[str]] = None,
        pathway: str = "",
        default_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Deterministically assigns a semantic person role to a document:
        - principal_applicant
        - spouse_partner
        - dependant_child
        - overseas_sponsor_host
        - canadian_crs_sibling
        """
        d = _extract_doc_dict(doc)
        if d["explicit_role"]:
            role = d["explicit_role"]
            is_distinct = are_roles_distinct_persons("principal_applicant", role)
            return {
                "person_role": role,
                "role_label": ROLE_LABELS.get(role, role.replace("_", " ").title()),
                "confidence": 0.99,
                "holder_name": _extract_holder_name(d),
                "association_note": (
                    "Attributed to Overseas Sponsor / Family Contributor"
                    if is_distinct
                    else "Attributed to Principal Applicant"
                ),
            }

        if default_role:
            norm_def = normalize_person_role(default_role)
            if norm_def and norm_def != "principal_applicant":
                return {
                    "person_role": norm_def,
                    "role_label": ROLE_LABELS.get(norm_def, norm_def.replace("_", " ").title()),
                    "confidence": 0.96,
                    "holder_name": _extract_holder_name(d),
                    "association_note": "Attributed to Overseas Sponsor / Family Contributor",
                }

        holder = _extract_holder_name(d)
        lower = f"{d['title']} {d['filename']} {d['document_subtype']} {d['text']}".lower()
        upper_pathway = (pathway or "").upper()
        is_express_entry = any(k in upper_pathway for k in ("EXPRESS", "CRS", "FSW", "CEC", "EE"))

        # Check Subagent 1's infer_document_person_role if available
        sub1_role: Optional[str] = None
        if _ext_infer_person_role is not None:
            try:
                res_sub1 = _ext_infer_person_role(d["text"], d["fields"], d["category"], d["filename"])
                if isinstance(res_sub1, dict):
                    sub1_role = normalize_person_role(res_sub1.get("person_role") or res_sub1.get("role"))
                elif isinstance(res_sub1, str):
                    sub1_role = normalize_person_role(res_sub1)
            except Exception:
                sub1_role = None

        # Known sibling match
        if holder and known_sibling_names and any(compare_names(holder, s).is_concordant for s in known_sibling_names):
            return {
                "person_role": "canadian_crs_sibling",
                "role_label": ROLE_LABELS["canadian_crs_sibling"],
                "confidence": 0.95,
                "holder_name": holder,
                "association_note": "Attributed to Overseas Sponsor / Family Contributor",
            }

        # Known sponsor match
        if holder and known_sponsor_names and any(compare_names(holder, s).is_concordant for s in known_sponsor_names):
            return {
                "person_role": "overseas_sponsor_host",
                "role_label": ROLE_LABELS["overseas_sponsor_host"],
                "confidence": 0.95,
                "holder_name": holder,
                "association_note": "Attributed to Overseas Sponsor / Family Contributor",
            }

        # Sibling detection: Express Entry + Canadian status/residency (or explicit sibling mention)
        if any(k in lower for k in ("sibling in canada", "brother in canada", "sister in canada", "crs sibling")) or (
            is_express_entry
            and (_has_canadian_status_markers(d) or _has_canadian_residency_markers(d))
            and (not anchor_applicant_name or not holder or not compare_names(anchor_applicant_name, holder).is_concordant)
        ):
            return {
                "person_role": "canadian_crs_sibling",
                "role_label": ROLE_LABELS["canadian_crs_sibling"],
                "confidence": 0.94,
                "holder_name": holder,
                "association_note": "Attributed to Overseas Sponsor / Family Contributor",
            }

        # Overseas Sponsor / Host detection (CRA NOA, T4, Canadian PR/Citizen host, UK HMRC/eVisa/Council Tax, AU VEVO/ATO/Form 1149)
        if _has_overseas_sponsor_markers(d) or (
            (_has_canadian_status_markers(d) or _has_canadian_residency_markers(d))
            and not is_express_entry
            and (not anchor_applicant_name or not holder or not compare_names(anchor_applicant_name, holder).is_concordant)
        ):
            return {
                "person_role": "overseas_sponsor_host",
                "role_label": ROLE_LABELS["overseas_sponsor_host"],
                "confidence": 0.94,
                "holder_name": holder,
                "association_note": "Attributed to Overseas Sponsor / Family Contributor",
            }

        # Spouse detection
        if anchor_spouse_name and holder and compare_names(anchor_spouse_name, holder).is_concordant:
            return {
                "person_role": "spouse_partner",
                "role_label": ROLE_LABELS["spouse_partner"],
                "confidence": 0.93,
                "holder_name": holder,
                "association_note": "Attributed to Overseas Sponsor / Family Contributor",
            }
        if "marriage certificate" in lower or "memorandum of marriage" in lower:
            if anchor_applicant_name and holder and not compare_names(anchor_applicant_name, holder).is_concordant:
                return {
                    "person_role": "spouse_partner",
                    "role_label": ROLE_LABELS["spouse_partner"],
                    "confidence": 0.90,
                    "holder_name": holder,
                    "association_note": "Attributed to Overseas Sponsor / Family Contributor",
                }

        # Dependant Child detection: Birth certificate where anchor_applicant_name is Father or Mother
        father, mother = _extract_parents(d)
        if anchor_applicant_name and holder and not compare_names(anchor_applicant_name, holder).is_concordant:
            if (father and compare_names(anchor_applicant_name, father).is_concordant) or (
                mother and compare_names(anchor_applicant_name, mother).is_concordant
            ):
                # Unless this child is an adult Canadian host/sponsor!
                return {
                    "person_role": "dependant_child",
                    "role_label": ROLE_LABELS["dependant_child"],
                    "confidence": 0.91,
                    "holder_name": holder,
                    "association_note": "Attributed to Overseas Sponsor / Family Contributor",
                }

        if sub1_role and sub1_role in ROLE_LABELS:
            is_distinct = are_roles_distinct_persons("principal_applicant", sub1_role)
            return {
                "person_role": sub1_role,
                "role_label": ROLE_LABELS[sub1_role],
                "confidence": 0.88,
                "holder_name": holder,
                "association_note": (
                    "Attributed to Overseas Sponsor / Family Contributor"
                    if is_distinct
                    else "Attributed to Principal Applicant"
                ),
            }

        return {
            "person_role": "principal_applicant",
            "role_label": ROLE_LABELS["principal_applicant"],
            "confidence": 0.90,
            "holder_name": holder,
            "association_note": "Attributed to Principal Applicant",
        }

    @classmethod
    def evaluate_packet_or_case_intelligence(
        cls,
        documents: List[Any],
        pathway: str = "",
        family_size: int = 3,
        default_contributor_role: Optional[str] = None,
        as_of_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Unified Document/Packet Evaluator:
        1. Two-pass person & role resolution across Principal Applicant, Spouse, Dependant Child,
           Overseas Sponsor/Host, and Canadian CRS Sibling.
        2. Builds the Family & Sponsor Graph (nodes + relationship edges).
        3. Executes all statutory checks (Super Visa LICO, Express Entry +15 CRS Sibling,
           UKVI 28-Day & Sponsor, Australia Subclass 600 Sponsor, and Universal Guardrails).
        """
        norm_docs = [_extract_doc_dict(d) for d in (documents or [])]
        upper_pathway = (pathway or "").upper()
        is_express_entry = any(k in upper_pathway for k in ("EXPRESS", "CRS", "FSW", "CEC", "EE"))

        # Pass 1: Identify anchor Principal Applicant, Spouse, Sponsor, and Sibling names
        anchor_applicant_name: Optional[str] = None
        anchor_spouse_name: Optional[str] = None
        known_sibling_names: List[str] = []
        known_sponsor_names: List[str] = []

        for d in norm_docs:
            holder = _extract_holder_name(d)
            role = d["explicit_role"]
            if role == "principal_applicant" and holder and not anchor_applicant_name:
                anchor_applicant_name = holder
                if d["fields"].get("spouse_name") or d["fields"].get("spouse_legal_name"):
                    anchor_spouse_name = d["fields"].get("spouse_name") or d["fields"].get("spouse_legal_name")
            elif role == "canadian_crs_sibling" and holder:
                known_sibling_names.append(holder)
            elif role == "overseas_sponsor_host" and holder:
                known_sponsor_names.append(holder)
            elif role == "spouse_partner" and holder and not anchor_spouse_name:
                anchor_spouse_name = holder

        # Heuristic Pass 1b if explicit roles weren't pre-populated
        for d in norm_docs:
            holder = _extract_holder_name(d)
            if not holder:
                continue
            has_ca_or_overseas = _has_overseas_sponsor_markers(d) or _has_canadian_status_markers(d) or _has_canadian_residency_markers(d)
            if has_ca_or_overseas:
                if is_express_entry or "sibling" in f"{d['title']} {d['text']}".lower():
                    if not any(compare_names(holder, s).is_concordant for s in known_sibling_names):
                        known_sibling_names.append(holder)
                else:
                    if not any(compare_names(holder, s).is_concordant for s in known_sponsor_names):
                        known_sponsor_names.append(holder)
            elif not anchor_applicant_name and d["category"] == "identity_passport":
                anchor_applicant_name = holder
                anchor_spouse_name = anchor_spouse_name or d["fields"].get("spouse_name") or d["fields"].get("spouse_legal_name")

        if not anchor_applicant_name:
            for d in norm_docs:
                holder = _extract_holder_name(d)
                if (
                    holder
                    and not any(compare_names(holder, s).is_concordant for s in known_sibling_names)
                    and not any(compare_names(holder, s).is_concordant for s in known_sponsor_names)
                ):
                    anchor_applicant_name = holder
                    break

        # If Express Entry has Canadian status/residency docs (even without extracted name on Hydro) + a second birth cert sharing parents with PA, tag that second birth cert holder as sibling!
        has_any_ca_status_or_res = any(_has_canadian_status_markers(d) or _has_canadian_residency_markers(d) for d in norm_docs)
        if (is_express_entry or has_any_ca_status_or_res) and anchor_applicant_name and not known_sibling_names:
            pa_parents: List[str] = []
            for d in norm_docs:
                h = _extract_holder_name(d)
                if h and compare_names(h, anchor_applicant_name).is_concordant:
                    f_n, m_n = _extract_parents(d)
                    if f_n:
                        pa_parents.append(f_n)
                    if m_n:
                        pa_parents.append(m_n)
            if pa_parents:
                for d in norm_docs:
                    h = _extract_holder_name(d)
                    if h and not compare_names(h, anchor_applicant_name).is_concordant:
                        f_n, m_n = _extract_parents(d)
                        cand_parents = [p for p in (f_n, m_n) if p]
                        if any(
                            compare_names(p1, p2).is_concordant or compare_parent_names(p1, p2).similarity_score >= 0.84
                            for p1 in pa_parents
                            for p2 in cand_parents
                        ):
                            if is_express_entry:
                                known_sibling_names.append(h)

        # Pass 2: Assign semantic role to each document and build Family & Sponsor Graph
        document_roles: List[Dict[str, Any]] = []
        enriched_docs_for_eval: List[Dict[str, Any]] = []
        nodes_map: Dict[str, Dict[str, Any]] = {}

        for idx, orig_doc in enumerate(documents or []):
            d = norm_docs[idx]
            role_info = cls.infer_role_for_document(
                d,
                anchor_applicant_name=anchor_applicant_name,
                anchor_spouse_name=anchor_spouse_name,
                known_sibling_names=known_sibling_names,
                known_sponsor_names=known_sponsor_names,
                pathway=pathway,
                default_role=default_contributor_role,
            )
            role_code = role_info["person_role"]
            holder = role_info["holder_name"] or ROLE_LABELS.get(role_code, "Unassigned")

            doc_copy = dict(orig_doc) if isinstance(orig_doc, dict) else dict(d)
            doc_copy["person_role"] = role_code
            enriched_docs_for_eval.append(doc_copy)

            document_roles.append(
                {
                    "document_id": d["id"] or f"doc-{idx + 1}",
                    "title": d["title"],
                    "category": d["category"],
                    "holder_name": role_info["holder_name"],
                    "person_role": role_code,
                    "role_label": role_info["role_label"],
                    "confidence": role_info["confidence"],
                    "association_note": role_info["association_note"],
                }
            )

            # Merge into graph node
            matched_node_key = None
            for n_key, n_val in nodes_map.items():
                if n_val["person_role"] == role_code and (
                    n_val["name"] == holder or compare_names(n_val["name"], holder).is_concordant
                ):
                    matched_node_key = n_key
                    break
            if not matched_node_key:
                matched_node_key = f"{role_code}:{len(nodes_map) + 1}"
                nodes_map[matched_node_key] = {
                    "node_id": matched_node_key,
                    "name": holder,
                    "person_role": role_code,
                    "role_label": role_info["role_label"],
                    "document_count": 0,
                    "documents": [],
                }
            nodes_map[matched_node_key]["document_count"] += 1
            nodes_map[matched_node_key]["documents"].append(d["title"])

        # Build relationship edges anchored to Principal Applicant node
        nodes_list = list(nodes_map.values())
        pa_node = next((n for n in nodes_list if n["person_role"] == "principal_applicant"), None)
        edges_list: List[Dict[str, Any]] = []
        if pa_node:
            for n in nodes_list:
                if n["node_id"] == pa_node["node_id"]:
                    continue
                rel_type = {
                    "spouse_partner": "spousal_partnership",
                    "dependant_child": "parent_dependant_child",
                    "overseas_sponsor_host": "financial_or_accommodation_sponsorship",
                    "canadian_crs_sibling": "shared_parent_canadian_sibling_crs_15",
                }.get(n["person_role"], "family_contributor")
                edges_list.append(
                    {
                        "source": n["node_id"],
                        "target": pa_node["node_id"],
                        "relationship": rel_type,
                    }
                )

        roles_summary: Dict[str, int] = {}
        for dr in document_roles:
            roles_summary[dr["person_role"]] = roles_summary.get(dr["person_role"], 0) + 1

        super_visa_lico = cls.evaluate_super_visa_lico(enriched_docs_for_eval, family_size=family_size)
        crs_sibling_points = cls.evaluate_crs_sibling_points(
            enriched_docs_for_eval,
            principal_applicant_name=anchor_applicant_name,
            spouse_name=anchor_spouse_name,
        )
        uk_sponsor_check = cls.evaluate_uk_sponsor_and_funds(enriched_docs_for_eval, as_of_date=as_of_date)
        au_sponsor_check = cls.evaluate_au_sponsor_evidence(enriched_docs_for_eval)
        guardrails = cls.evaluate_universal_guardrails(enriched_docs_for_eval, as_of_date=as_of_date)

        return {
            "pathway": pathway or "AUTO_DETECTED",
            "family_size": family_size,
            "document_roles": document_roles,
            "family_sponsor_graph": {
                "nodes": nodes_list,
                "edges": edges_list,
                "roles_summary": roles_summary,
            },
            "super_visa_lico": super_visa_lico,
            "crs_sibling_points": crs_sibling_points,
            "uk_sponsor_check": uk_sponsor_check,
            "au_sponsor_check": au_sponsor_check,
            "guardrails": guardrails,
        }
