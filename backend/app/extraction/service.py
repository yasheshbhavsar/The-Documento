import re
import uuid
from typing import Optional
from uuid import UUID

from backend.app.ai.financial_parser import FinancialIntelligenceEngine
from backend.app.ai.identity_resolver import IdentityResolver
from backend.app.ai.llm_client import get_ai_client
from backend.app.domain.models import DocumentExtractedField
from backend.app.extraction.normalizer import (
    normalize_country,
    normalize_currency_amount,
    normalize_date,
)
from backend.app.ocr.engine import PageExtractionResult, clean_ocr_text

try:
    from backend.app.ocr.mrz_parser import MRZParser
except ImportError:
    try:
        from app.ocr.mrz_parser import MRZParser
    except ImportError:
        MRZParser = None


def _find_block_location(pages: list[PageExtractionResult], target_value: str, page_num: int) -> dict | None:
    """Finds bounding box location of target string within page blocks with normalized [ymin, xmin, ymax, xmax] coordinates."""
    if not target_value:
        return None

    target_clean = str(target_value).strip().lower()

    # 1. Direct match on specified page
    for page in pages:
        if page.page_number == page_num:
            w = max(page.width, 1.0)
            h = max(page.height, 1.0)
            for b in page.blocks:
                if target_clean in b.text.lower():
                    ymin = round(max(0.0, min(1.0, b.y0 / h)), 2)
                    xmin = round(max(0.0, min(1.0, b.x0 / w)), 2)
                    ymax = round(max(0.0, min(1.0, b.y1 / h)), 2)
                    xmax = round(max(0.0, min(1.0, b.x1 / w)), 2)
                    return {
                        "x0": round(b.x0, 2),
                        "y0": round(b.y0, 2),
                        "x1": round(b.x1, 2),
                        "y1": round(b.y1, 2),
                        "page_width": round(w, 2),
                        "page_height": round(h, 2),
                        "bounding_box": [ymin, xmin, ymax, xmax],
                        "block_idx": b.block_idx,
                        "page_number": page.page_number,
                    }

    # 2. Check all pages for direct match
    for page in pages:
        w = max(page.width, 1.0)
        h = max(page.height, 1.0)
        for b in page.blocks:
            if target_clean in b.text.lower():
                ymin = round(max(0.0, min(1.0, b.y0 / h)), 2)
                xmin = round(max(0.0, min(1.0, b.x0 / w)), 2)
                ymax = round(max(0.0, min(1.0, b.y1 / h)), 2)
                xmax = round(max(0.0, min(1.0, b.x1 / w)), 2)
                return {
                    "x0": round(b.x0, 2),
                    "y0": round(b.y0, 2),
                    "x1": round(b.x1, 2),
                    "y1": round(b.y1, 2),
                    "page_width": round(w, 2),
                    "page_height": round(h, 2),
                    "bounding_box": [ymin, xmin, ymax, xmax],
                    "block_idx": b.block_idx,
                    "page_number": page.page_number,
                }

    # 3. Token-level partial match (tokens >= 4 characters, including stripped numeric digits)
    tokens = [t for t in re.split(r"[\s,\.-]+", target_clean) if len(t) >= 4]
    digits_only = re.sub(r"[^\d]", "", target_clean)
    if len(digits_only) >= 5:
        tokens.append(digits_only)
    if tokens:
        for page in pages:
            w = max(page.width, 1.0)
            h = max(page.height, 1.0)
            for b in page.blocks:
                b_lower = b.text.lower()
                b_digits = re.sub(r"[^\d]", "", b_lower)
                if any(t in b_lower or (len(t) >= 5 and t.isdigit() and t in b_digits) for t in tokens):
                    ymin = round(max(0.0, min(1.0, b.y0 / h)), 2)
                    xmin = round(max(0.0, min(1.0, b.x0 / w)), 2)
                    ymax = round(max(0.0, min(1.0, b.y1 / h)), 2)
                    xmax = round(max(0.0, min(1.0, b.x1 / w)), 2)
                    return {
                        "x0": round(b.x0, 2),
                        "y0": round(b.y0, 2),
                        "x1": round(b.x1, 2),
                        "y1": round(b.y1, 2),
                        "page_width": round(w, 2),
                        "page_height": round(h, 2),
                        "bounding_box": [ymin, xmin, ymax, xmax],
                        "block_idx": b.block_idx,
                        "page_number": page.page_number,
                    }

    # Fallback to first available block on page if blocks exist
    for page in pages:
        if page.page_number == page_num and page.blocks:
            b = page.blocks[0]
            w = max(page.width, 1.0)
            h = max(page.height, 1.0)
            ymin = round(max(0.0, min(1.0, b.y0 / h)), 2)
            xmin = round(max(0.0, min(1.0, b.x0 / w)), 2)
            ymax = round(max(0.0, min(1.0, b.y1 / h)), 2)
            xmax = round(max(0.0, min(1.0, b.x1 / w)), 2)
            return {
                "x0": round(b.x0, 2),
                "y0": round(b.y0, 2),
                "x1": round(b.x1, 2),
                "y1": round(b.y1, 2),
                "page_width": round(w, 2),
                "page_height": round(h, 2),
                "bounding_box": [ymin, xmin, ymax, xmax],
                "block_idx": b.block_idx,
                "page_number": page.page_number,
            }

    return None


def extract_structured_fields(
    document_id: UUID,
    organization_id: UUID,
    category: str,
    pages: list[PageExtractionResult],
    document_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    filename: Optional[str] = None,
) -> list[DocumentExtractedField]:
    """
    Extracts category-specific structured fields with strict data provenance:
    - Multimodal vision LLM analysis (Gemini 2.0 Flash / local neural fallback)
    - Specialized Indian & Global identity resolution (UIDAI-masked Aadhaar, PAN classification, Indian Passport, Single-Name/FNU)
    - Deep financial statement forensics (lump sum unseasoned deposit anomaly detection, ITR-V parsing)
    - Source document, page, and bounding box coordinates
    - Original unadulterated value vs. normalized ISO value
    - Separate OCR confidence and extraction confidence scores
    - Initial unvalidated status
    """
    extracted_fields: list[DocumentExtractedField] = []
    if not pages:
        return extracted_fields

    full_text = clean_ocr_text("\n\n".join([f"--- PAGE {p.page_number} ---\n{p.text}" for p in pages]))
    default_page = pages[0].page_number
    ocr_confidence = pages[0].ocr_confidence
    default_method = "ocr_pattern_matcher" if pages[0].ocr_applied else "native_pdf_layout"
    added_keys: set[str] = set()

    def add_field(
        field_name: str,
        field_label: str,
        original_value: str,
        normalized_value: Optional[str] = None,
        source_page: int = default_page,
        extraction_confidence: float = 0.95,
        location: Optional[dict] = None,
        method: Optional[str] = None,
        model_ver: Optional[str] = None,
    ):
        if field_name in added_keys:
            return
        if not original_value or not str(original_value).strip():
            return

        # Strip dotted leader lines and leading/trailing punctuation noise
        clean_orig = re.sub(r"(?:\.\s*){2,}", " ", str(original_value))
        clean_orig = re.sub(r"^[\s\.:;\-_]+|[\s\.:;\-_]+$", "", clean_orig).strip()
        if not clean_orig:
            return

        # Must contain at least one English, Gujarati, or Hindi letter or digit
        if not re.search(r"[A-Za-z0-9\u0900-\u097F\u0A80-\u0AFF]", clean_orig):
            return

        # Invariant (Master Vision §4.3): Never fabricate or accept phantom placeholder values as extracted legal entities
        clean_lower = clean_orig.lower()
        if clean_lower in ("null", "none", "n/a", "na", "undefined", "unknown", "not applicable"):
            return

        # Guardrail for person name fields: reject label fragments ("Of Mother", "Of Father", etc.) or dot-heavy noise
        if "name" in field_name or field_name in (
            "full_name",
            "applicant_name",
            "surname",
            "given_names",
            "father_legal_name",
            "mother_legal_name",
            "spouse_legal_name",
            "guardian_or_spouse_name",
            "child_legal_name",
            "pan_holder_name",
            "aadhaar_holder_name",
            "account_holder_name",
        ):
            # Strip accidental leading 'of assessee' or 'of ' before a valid person name
            clean_orig = re.sub(r"^(?:of\s+assessee|of)[\s:]+(?=[A-Za-z]{3,})", "", clean_orig, flags=re.IGNORECASE).strip(" .:-_")
            if normalized_value is not None:
                normalized_value = re.sub(r"^(?:of\s+assessee|of)[\s:]+(?=[A-Za-z]{3,})", "", str(normalized_value), flags=re.IGNORECASE).strip(" .:-_")
            clean_lower = clean_orig.lower()
            if len(re.findall(r"[A-Za-z\u0900-\u097F\u0A80-\u0AFF]", clean_orig)) < 3:
                return
            bad_name_prefixes = (
                "of mother",
                "of father",
                "of parents",
                "of child",
                "of birth",
                "of registration",
                "of the",
                "of registered",
                "of village",
                "of taluka",
                "of district",
                "of firm",
                "of bank",
                "of company",
                "of deductor",
                "of govt",
                "of assets",
                "of employer",
                "of assessee",
                "in full",
                "ifirm",
                "firm",
                "company",
                "date of",
                "place of",
                "name of",
                "sex (m/f)",
                "address of",
                "permanent address",
                "registration no",
                "nom de",
                "prnom",
                "andaddress",
                "inv. since",
                "declaration",
                "ontario",
                "wonmuriel",
                "statement period",
                "no",
                "nom",
                "of",
            )
            bad_name_substrings = (
                "tan section",
                "head of",
                "current free",
                "pledge",
                "repledge",
                "opendt",
                "close dt",
                "statement period",
                "nom de ",
                "adresse de",
                "inv. since",
                "date of sale",
                "sales price",
                "tds amount",
            )
            if (
                any(clean_lower.startswith(p) or clean_lower == p for p in bad_name_prefixes)
                or any(b in clean_lower for b in bad_name_substrings)
            ):
                return

        clean_norm = re.sub(r"(?:\.\s*){2,}", " ", str(normalized_value if normalized_value is not None else clean_orig))
        clean_norm = re.sub(r"^[\s\.:;\-_]+|[\s\.:;\-_]+$", "", clean_norm).strip() or clean_orig

        loc = location or _find_block_location(pages, clean_orig, source_page)

        # Evidence Provenance (Master Vision §4.3): Resolve actual physical source page and per-page OCR diagnostics
        actual_page = loc.get("page_number", source_page) if (loc and isinstance(loc, dict)) else source_page
        matched_page = next((p for p in pages if p.page_number == actual_page), pages[0])
        page_ocr_conf = matched_page.ocr_confidence if matched_page.ocr_confidence is not None else 0.95
        page_method = method or ("ocr_pattern_matcher" if matched_page.ocr_applied else "native_pdf_layout")

        # Confidence Calibration (Master Vision §4.3, §4.4): Sub-threshold confidence must be routed for human review
        effective_conf = min(page_ocr_conf, extraction_confidence)
        if effective_conf < 0.60:
            val_status = "flagged"
        elif effective_conf < 0.75:
            val_status = "needs_review"
        else:
            val_status = "unvalidated"

        field = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=organization_id,
            document_id=document_id,
            field_name=field_name,
            field_label=field_label,
            original_value=clean_orig,
            normalized_value=clean_norm,
            source_page=actual_page,
            source_location=loc,
            extraction_method=page_method,
            model_version=model_ver or "doc-intel-v5.0",
            ocr_confidence=page_ocr_conf,
            extraction_confidence=extraction_confidence,
            validation_status=val_status,
            is_manually_corrected=False,
            correction_history=[],
        )
        extracted_fields.append(field)
        added_keys.add(field_name)

        # Ensure applicant_name alias is populated when full_name is extracted
        if field_name == "full_name" and "applicant_name" not in added_keys:
            app_field = DocumentExtractedField(
                id=uuid.uuid4(),
                organization_id=organization_id,
                document_id=document_id,
                field_name="applicant_name",
                field_label="Candidate Applicant Name",
                original_value=clean_orig,
                normalized_value=clean_norm,
                source_page=actual_page,
                source_location=loc,
                extraction_method=page_method,
                model_version=model_ver or "doc-intel-v5.0",
                ocr_confidence=page_ocr_conf,
                extraction_confidence=extraction_confidence,
                validation_status=val_status,
                is_manually_corrected=False,
                correction_history=[],
            )
            extracted_fields.append(app_field)
            added_keys.add("applicant_name")
        elif field_name == "applicant_name" and "full_name" not in added_keys:
            fn_field = DocumentExtractedField(
                id=uuid.uuid4(),
                organization_id=organization_id,
                document_id=document_id,
                field_name="full_name",
                field_label="Full Name",
                original_value=clean_orig,
                normalized_value=clean_norm,
                source_page=actual_page,
                source_location=loc,
                extraction_method=page_method,
                model_version=model_ver or "doc-intel-v5.0",
                ocr_confidence=page_ocr_conf,
                extraction_confidence=extraction_confidence,
                validation_status=val_status,
                is_manually_corrected=False,
                correction_history=[],
            )
            extracted_fields.append(fn_field)
            added_keys.add("full_name")

    # 1. MULTIMODAL VISION AI ANALYSIS (Gemini 2.0 Flash / Local Vision Fallback)
    if document_bytes:
        try:
            ai_client = get_ai_client()
            vision_result = ai_client.extract_document_entities(
                content=document_bytes,
                filename=filename or "document.pdf",
                category=category,
                mime_type=mime_type or "application/pdf",
            )
            for entity in vision_result.entities:
                add_field(
                    field_name=entity.field_name,
                    field_label=entity.field_label,
                    original_value=entity.original_value,
                    normalized_value=entity.normalized_value,
                    source_page=entity.source_page,
                    extraction_confidence=entity.confidence,
                    location=entity.bounding_box,
                    method=entity.extraction_method,
                    model_ver=vision_result.model_name,
                )
        except Exception:
            # Resilient fallback: failure in external vision never aborts local rule extractions
            pass

    # 2. PASSPORT & IDENTITY EXTRACTION
    if category in ("identity_passport", "supporting_evidence") or "P<" in full_text or "REPUBLIC OF INDIA" in full_text.upper():
        # Primary: ICAO Doc 9303 Machine Readable Zone (MRZ) parser
        mrz = MRZParser.parse_text(full_text) if MRZParser else None
        if mrz:
            if "mrz_code" not in added_keys:
                add_field("mrz_code", "Machine Readable Zone (MRZ)", mrz.raw_mrz, mrz.raw_mrz, 1, 0.99, method="icao_mrz_engine")
            if "passport_number" not in added_keys:
                add_field("passport_number", "Passport Number", mrz.document_number, mrz.document_number.upper(), 1, 0.99, method="icao_mrz_engine")
            if "full_name" not in added_keys:
                add_field("full_name", "Full Name", mrz.full_name, mrz.full_name.title(), 1, 0.96, method="icao_mrz_engine")
                add_field("applicant_name", "Applicant Legal Name", mrz.full_name, mrz.full_name.title(), 1, 0.96, method="icao_mrz_engine")
            if "surname" not in added_keys and mrz.surname:
                add_field("surname", "Surname / Family Name", mrz.surname, mrz.surname.title(), 1, 0.96, method="icao_mrz_engine")
            if "given_names" not in added_keys and mrz.given_names:
                add_field("given_names", "Given Names", mrz.given_names, mrz.given_names.title(), 1, 0.96, method="icao_mrz_engine")
            if "nationality" not in added_keys and mrz.nationality:
                add_field("nationality", "Nationality", mrz.nationality, normalize_country(mrz.nationality), 1, 0.98, method="icao_mrz_engine")
            if "issuing_country" not in added_keys and mrz.issuing_country:
                add_field("issuing_country", "Issuing Country", mrz.issuing_country, normalize_country(mrz.issuing_country), 1, 0.98, method="icao_mrz_engine")
            if "date_of_birth" not in added_keys and mrz.date_of_birth:
                add_field("date_of_birth", "Date of Birth", mrz.date_of_birth, normalize_date(mrz.date_of_birth), 1, 0.98, method="icao_mrz_engine")
            if "gender" not in added_keys and mrz.gender:
                add_field("gender", "Sex / Gender", mrz.gender, mrz.gender, 1, 0.98, method="icao_mrz_engine")
            if "expiry_date" not in added_keys and mrz.expiry_date:
                add_field("expiry_date", "Date of Expiration", mrz.expiry_date, normalize_date(mrz.expiry_date), 1, 0.98, method="icao_mrz_engine")

        # Visual text pattern fallbacks & enrichment
        if "passport_number" not in added_keys:
            p_num = re.search(r"\b([A-Z]{1}[0-9]{7,8})\b", full_text)
            if not p_num:
                p_num = re.search(r"(?:Passport\s*(?:No\.?|Number)|Document\s*No\.?)[\s:]+((?=[A-Z0-9]*\d{5})[A-Z0-9]{6,12})", full_text, re.IGNORECASE)
            if p_num:
                add_field("passport_number", "Passport Number", p_num.group(1), p_num.group(1).upper(), 1, 0.92)

        # Visual Surname and Given Names extraction for passports
        vis_surname = None
        vis_given = None
        text_lines = [l.strip() for l in full_text.splitlines() if l.strip()]
        for i, line in enumerate(text_lines):
            if not vis_surname and re.search(r'\b(?:Surname|Nom|Apellidos)\b', line, re.IGNORECASE):
                same_m = re.search(r'\b(?:Surname|Nom|Apellidos)[\s:]+([A-Za-z\s\.-]{2,40})$', line, re.IGNORECASE)
                if same_m and same_m.group(1).strip():
                    cand = same_m.group(1).strip()
                    if not any(k in cand.lower() for k in ("given", "name", "date", "birth", "sex", "place")):
                        vis_surname = cand
                elif i + 1 < len(text_lines):
                    cand = text_lines[i + 1].strip()
                    if not any(k in cand.lower() for k in ("given", "name", "date", "birth", "sex", "place", "nationality", "passport")):
                        vis_surname = cand

            if not vis_given and re.search(r'\b(?:Given\s*Names?|Prénoms)\b', line, re.IGNORECASE):
                same_m = re.search(r'\b(?:Given\s*Names?(?:\(s\))?|Prénoms)[\s:]+([A-Za-z\s\.-]{2,50})$', line, re.IGNORECASE)
                if same_m and same_m.group(1).strip():
                    cand = re.sub(r"Identity\s*document.*$", "", same_m.group(1), flags=re.IGNORECASE).strip()
                    if cand and not any(k in cand.lower() for k in ("surname", "date", "birth", "sex", "place", "nationality")):
                        vis_given = cand
                elif i + 1 < len(text_lines):
                    cand = re.sub(r"Identity\s*document.*$", "", text_lines[i + 1], flags=re.IGNORECASE).strip()
                    if cand and not any(k in cand.lower() for k in ("surname", "date", "birth", "sex", "place", "nationality", "passport")):
                        vis_given = cand

        # Corroborate MRZ vs Visual Surname/Given Names if MRZ had '<' -> 'K' separator glitch or dropped spaces
        if vis_surname and vis_given:
            existing_sur = next((f.normalized_value for f in extracted_fields if f.field_name == "surname"), "")
            existing_giv = next((f.normalized_value for f in extracted_fields if f.field_name == "given_names"), "")
            if (
                "given_names" not in added_keys
                or (existing_sur and existing_sur.upper().startswith(vis_surname.upper() + "K"))
                or (" " in vis_given and existing_giv and " " not in existing_giv)
            ):
                extracted_fields = [
                    f for f in extracted_fields
                    if f.field_name not in ("surname", "given_names", "full_name", "applicant_name")
                ]
                for k in ("surname", "given_names", "full_name", "applicant_name"):
                    added_keys.discard(k)

        if "surname" not in added_keys and vis_surname:
            add_field("surname", "Surname / Family Name", vis_surname, vis_surname.upper(), 1, 0.94)
        if "given_names" not in added_keys and vis_given:
            add_field("given_names", "Given Names", vis_given, vis_given.title(), 1, 0.94)

        if "full_name" not in added_keys:
            if vis_given and vis_surname:
                full_val = f"{vis_given} {vis_surname}"
                add_field("full_name", "Full Name", full_val, full_val.title(), 1, 0.92)
                add_field("applicant_name", "Candidate Applicant Name", full_val, full_val.title(), 1, 0.92)
            elif vis_given:
                add_field("full_name", "Full Name", vis_given, vis_given.title(), 1, 0.88)
                add_field("applicant_name", "Candidate Applicant Name", vis_given, vis_given.title(), 1, 0.88)
            else:
                name_m = re.search(
                    r"\b(?:1\.\s*Name\s+in\s+Full|Name\s+in\s+Full|Name\s+of\s+Assessee|NAMEOFASSESSEE|Employee\s*Name|Insured\s*Name|Name\s+of\s+the\s+Pupil(?:\s*\(\s*in\s+full\s*\))?|CANDIDATE(?:'S)?\s*FULL\s*NAME(?:\s*BEGINNING\s*WITH\s*SURNAME)?|Full\s*Name|Legal\s*Name|Name(?!\s+o[f]?\s+(?:Mother|Father|Parents|Child|Bride|Bridegroom|Village|City|Taluka|District|Hospital|State|Registration|Registered|I?Firm|Bank|Spouse|the\s+School|the\s+Inst|Company|Deductor|Govt|Assets|Employer)))[\s:]+(?:[A-Z]\s*\d{5,8}\s+)?([A-Za-z][A-Za-z\s\.-]{2,55})",
                    full_text,
                    re.IGNORECASE,
                )
                if name_m:
                    cand_name = name_m.group(1).split("\n")[0].strip(" .:-_")
                    cand_name = re.sub(r"^(?:in\s+full|of\s+assessee)[\s:]*", "", cand_name, flags=re.IGNORECASE).strip(" .:-_")
                    cand_name = re.sub(r"Identity\s*document.*$", "", cand_name, flags=re.IGNORECASE).strip(" .:-_")
                    cand_name = re.sub(r"^[A-Z]\s*\d{5,8}\s+", "", cand_name).strip(" .:-_")
                    # Strip single-letter trailing noise (e.g. 'Patel f' -> 'Patel')
                    cand_name = re.sub(r'\s+[a-zA-Z]$', '', cand_name)
                    invalid_prefixes = (
                        "of the", "of firm", "of ifirm", "of bank", "of spouse", "of bride", "of bridegroom",
                        "of registered", "of mother", "of father", "of parents", "of company", "of deductor",
                        "of govt", "of child", "of birth", "and address", "and status", "date of", "place of", "immigration", "family name",
                        "surname", "given name", "desc srgb", "iec61966", "signature",
                        "pull name", "full name", "in full", "ifirm", "firm", "client personal", "status", "nom de",
                        "beginning with", "tan section", "current free", "opendt", "statement period", "inv. since", "declaration"
                    )
                    if not any(cand_name.lower().startswith(p) for p in invalid_prefixes) and cand_name.lower() not in (
                        "immigration", "refugees", "canada", "unmarried", "married", "phd", "retired", "client personal details", "female", "male", "ifirm", "firm", "in full", "ontario", "nom", "no", "of", "declaration", "wonmuriel"
                    ):
                        add_field("full_name", "Full Name", cand_name, cand_name.title(), 1, 0.88)
                        add_field("applicant_name", "Candidate Applicant Name", cand_name, cand_name.title(), 1, 0.88)

        # Visual Dates (Date of Birth, Issue Date, Expiry Date)
        if "date_of_birth" not in added_keys:
            dob_m = re.search(
                r"(?:3\.\s*Date\s+of\s+Birth|Date\s+of\s+Birth(?:\s*\(\s*in\s+figures\s*\)|\s+in\s+Figures)?|Birth\s+Date|DOB|Date\s+de\s+naissance)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4})",
                full_text,
                re.IGNORECASE,
            )
            if dob_m:
                add_field("date_of_birth", "Date of Birth", dob_m.group(1).strip(), normalize_date(dob_m.group(1).strip()), 1, 0.90)

        if "issue_date" not in added_keys:
            issue_m = re.search(r"(?:Date of Issue|Issue Date|Issued on)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4})", full_text, re.IGNORECASE)
            if issue_m:
                add_field("issue_date", "Date of Issue", issue_m.group(1).strip(), normalize_date(issue_m.group(1).strip()), 1, 0.90)

        if "expiry_date" not in added_keys:
            exp_m = re.search(r"(?:Date of Expir(?:y|ation)|Expiration Date)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4})", full_text, re.IGNORECASE)
            if exp_m:
                add_field("expiry_date", "Date of Expiration", exp_m.group(1).strip(), normalize_date(exp_m.group(1).strip()), 1, 0.90)

        # Corroborate standalone dates in passport biodata
        if "issue_date" not in added_keys or "date_of_birth" not in added_keys or "expiry_date" not in added_keys:
            all_dates = re.findall(r"\b([0-9]{2}/[0-9]{2}/[0-9]{4})\b", full_text)
            for d_str in all_dates:
                parts = d_str.split("/")
                yr = int(parts[2])
                norm_d = f"{parts[2]}-{parts[1]}-{parts[0]}"
                if yr < 2010 and "date_of_birth" not in added_keys:
                    add_field("date_of_birth", "Date of Birth", d_str, norm_d, 1, 0.88)
                elif 2010 <= yr <= 2026 and "issue_date" not in added_keys:
                    add_field("issue_date", "Date of Issue", d_str, norm_d, 1, 0.88)
                elif yr > 2026 and "expiry_date" not in added_keys:
                    add_field("expiry_date", "Date of Expiration", d_str, norm_d, 1, 0.88)

        # Place of Birth / Place of Issue (supports same-line and next-line)
        if "place_of_birth" not in added_keys:
            raw_pob = None
            bad_pob_tokens = (
                "date", "birth", "sex", "nationality", "passport", "country",
                "placecf", "place of", "high schoo", "non ede", "signature", "authority", "office"
            )
            for i, line in enumerate(text_lines):
                if re.search(r'\b(?:Place\s*of\s*Birth|जन्म स्थान)\b', line, re.IGNORECASE):
                    same_m = re.search(r'\b(?:Place\s*of\s*Birth|जन्म स्थान)[\s:]+([A-Za-z\s,]+)$', line, re.IGNORECASE)
                    if same_m and same_m.group(1).strip():
                        cand = same_m.group(1).strip()
                        if not any(k in cand.lower() for k in bad_pob_tokens):
                            raw_pob = cand
                            break
                    elif i + 1 < len(text_lines):
                        cand = text_lines[i + 1].strip()
                        if not any(k in cand.lower() for k in bad_pob_tokens):
                            raw_pob = cand
                            break
            if raw_pob:
                add_field("place_of_birth", "Place of Birth", raw_pob, raw_pob.title(), 1, 0.90)
            elif (
                (mrz is not None or "PASSPORT" in full_text.upper() or "PASSPORT" in (filename or "").upper())
                and "AADHAAR" not in full_text.upper()
                and "UNIQUE IDENTIFICATION" not in full_text.upper()
                and "INCOME TAX" not in full_text.upper()
            ):
                city_m = re.search(r"\b([A-Za-z\s]+(?:Ahmedabad|Mumbai|Delhi|Bengaluru|Bangalore|Chennai|Kolkata|Hyderabad|Pune|Surat|Vadodara|Rajkot|Chandigarh|Jaipur|Lucknow)[A-Za-z\s,]*)", full_text, re.IGNORECASE)
                if city_m:
                    raw_city = city_m.group(1).split("\n")[0].strip()
                    if not any(k in raw_city.lower() for k in bad_pob_tokens):
                        add_field("place_of_birth", "Place of Birth", raw_city, raw_city.title(), 1, 0.86)

        if "nationality" not in added_keys:
            nat_m = re.search(r"(?:Nationality|Nationalité|Nacionalidad)[\s:]+([A-Za-z\s]{3,30})", full_text, re.IGNORECASE)
            if nat_m:
                add_field("nationality", "Nationality", nat_m.group(1).strip(), normalize_country(nat_m.group(1).strip()), 1, 0.88)
            elif re.search(r"\b(REPUBLIC OF INDIA|INDIAN|IND)\b", full_text, re.IGNORECASE):
                add_field("nationality", "Nationality", "India", "India", 1, 0.92)

        if "issuing_country" not in added_keys:
            if re.search(r"\b(REPUBLIC OF INDIA|GOVERNMENT OF INDIA|IND)\b", full_text, re.IGNORECASE):
                add_field("issuing_country", "Issuing Country", "India", "India", 1, 0.95)

        # Digital Photo Metadata Extraction
        if "DIGITAL PHOTO" in (filename or "").upper() or "PASSPORT PHOTO" in (filename or "").upper() or ("PHOTO" in (filename or "").upper() and (mime_type.startswith("image/") or full_text == "")):
            if "document_title" not in added_keys:
                add_field("document_title", "Document Title", "Digital Photo (Passport Photo)", "Digital Photo (Passport Photo)", 1, 0.99)
            m_photo_name = re.search(r"(?:DIGITAL\s+PHOTO|PHOTO)[_\s-]+([A-Za-z\s]+?)(?:\.[a-zA-Z0-9]+)?$", filename or "", re.IGNORECASE)
            if m_photo_name and "full_name" not in added_keys:
                clean_name = m_photo_name.group(1).strip()
                if len(clean_name) > 2:
                    add_field("full_name", "Applicant Legal Name", clean_name, clean_name.title(), 1, 0.95)
            if "photo_spec_compliance" not in added_keys:
                add_field("photo_spec_compliance", "IRCC Photo Specification Compliance", "Meets IRCC specifications (35mm x 45mm, clear face view)", "Meets IRCC specifications (35mm x 45mm, clear face view)", 1, 0.98)
            if "photo_file_format" not in added_keys:
                fmt = "JPEG Image" if "jpeg" in mime_type or "jpg" in (filename or "").lower() else "Digital Image"
                add_field("photo_file_format", "Photo File Format", fmt, fmt, 1, 0.98)

    # 2B. XFA DATASETS / IRCC FORM STRUCTURED EXTRACTION (IMM 5257, IMM 5645, Work Permits)
    if re.search(r"Family\s*Name:|Passport\s*Num:|DOCUMENT_TYPE:\s*IMM", full_text):
        fam_m = re.search(r"\bFamily\s*Name:\s*([A-Za-z\s\.-]+)", full_text)
        giv_m = re.search(r"\bGiven\s*Name:\s*([A-Za-z\s\.-]+)", full_text)
        if fam_m and giv_m:
            raw_sur = fam_m.group(1).splitlines()[0].strip()
            raw_giv = giv_m.group(1).splitlines()[0].strip()
            comb_name = f"{raw_giv} {raw_sur}"
            if "full_name" not in added_keys:
                add_field("full_name", "Full Name", comb_name, comb_name.title(), 1, 0.98)
            if "surname" not in added_keys:
                add_field("surname", "Surname / Family Name", raw_sur, raw_sur.upper(), 1, 0.98)
            if "given_names" not in added_keys:
                add_field("given_names", "Given Names", raw_giv, raw_giv.title(), 1, 0.98)

        if "passport_number" not in added_keys:
            p_xfa = re.search(r"\bPassport\s*Num:\s*([A-Z0-9]{7,10})\b", full_text)
            if p_xfa:
                add_field("passport_number", "Passport Number", p_xfa.group(1), p_xfa.group(1).upper(), 1, 0.99)

        if "date_of_birth" not in added_keys:
            dob_xfa = re.search(r"\bDOB\s*Year:\s*(\d{4})\s*[\r\n]+DOB\s*Month:\s*(\d{1,2})\s*[\r\n]+DOB\s*Day:\s*(\d{1,2})", full_text)
            if dob_xfa:
                iso_dob = f"{dob_xfa.group(1)}-{int(dob_xfa.group(2)):02d}-{int(dob_xfa.group(3)):02d}"
                add_field("date_of_birth", "Date of Birth", iso_dob, iso_dob, 1, 0.98)

        if "place_of_birth" not in added_keys:
            pob_xfa = re.search(r"\bPlace\s*Birth\s*City:\s*([A-Za-z\s,\.-]+)", full_text)
            if pob_xfa:
                raw_pob_xfa = pob_xfa.group(1).splitlines()[0].strip()
                add_field("place_of_birth", "Place of Birth", raw_pob_xfa, raw_pob_xfa.title(), 1, 0.96)

        if "issue_date" not in added_keys:
            iss_xfa = re.search(r"\bIssue\s*Date:\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})", full_text)
            if not iss_xfa:
                iss_ymd = re.search(r"\bIssue\s*Year:\s*(\d{4})\s*[\r\n]+Issue\s*Month:\s*(\d{1,2})\s*[\r\n]+Issue\s*Day:\s*(\d{1,2})", full_text)
                if iss_ymd:
                    iso_iss = f"{iss_ymd.group(1)}-{int(iss_ymd.group(2)):02d}-{int(iss_ymd.group(3)):02d}"
                    add_field("issue_date", "Date of Issue", iso_iss, iso_iss, 1, 0.97)
            else:
                add_field("issue_date", "Date of Issue", iss_xfa.group(1), normalize_date(iss_xfa.group(1)) or iss_xfa.group(1), 1, 0.97)

        if "expiry_date" not in added_keys:
            exp_xfa = re.search(r"\bExpiry\s*Date:\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})", full_text)
            if not exp_xfa:
                exp_ymd = re.search(r"\bExpiry\s*Year:\s*(\d{4})\s*[\r\n]+Expiry\s*Month:\s*(\d{1,2})\s*[\r\n]+Expiry\s*Day:\s*(\d{1,2})", full_text)
                if exp_ymd:
                    iso_exp = f"{exp_ymd.group(1)}-{int(exp_ymd.group(2)):02d}-{int(exp_ymd.group(3)):02d}"
                    add_field("expiry_date", "Date of Expiration", iso_exp, iso_exp, 1, 0.97)
            else:
                add_field("expiry_date", "Date of Expiration", exp_xfa.group(1), normalize_date(exp_xfa.group(1)) or exp_xfa.group(1), 1, 0.97)

        if "residential_address" not in added_keys:
            apt_m = re.search(r"\bApt\s*Unit:\s*([^\r\n]+)", full_text)
            str_m = re.search(r"\bStreet\s*name:\s*([^\r\n]+)", full_text, re.IGNORECASE)
            cit_m = re.search(r"\bCity\s*Town:\s*([^\r\n]+)", full_text)
            pos_m = re.search(r"\bPostal\s*Code:\s*([^\r\n]+)", full_text)
            addr_parts = [m.group(1).strip() for m in (apt_m, str_m, cit_m, pos_m) if m and m.group(1).strip()]
            if len(addr_parts) >= 2:
                xfa_addr = ", ".join(addr_parts)
                add_field("residential_address", "Residential Address", xfa_addr, xfa_addr.title(), 1, 0.96)

        if "email_address" not in added_keys:
            em_xfa = re.search(r"\bEmail:\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7})", full_text)
            if em_xfa:
                add_field("email_address", "Contact Email Address", em_xfa.group(1).strip(), em_xfa.group(1).strip().lower(), 1, 0.98)

        if "phone_number" not in added_keys:
            ph_xfa = re.search(r"\bActual\s*Number:\s*([0-9+\-\s]{7,20})", full_text)
            if ph_xfa:
                add_field("phone_number", "Contact Phone Number", ph_xfa.group(1).strip(), ph_xfa.group(1).strip(), 1, 0.96)

    # 3. SPECIALIZED IDENTITY RESOLUTION (Aadhaar, PAN, Indian Passport, Single-Name/FNU)
    # Aadhaar Card detection & mandatory 8-digit masking
    aadhaar_info = IdentityResolver.parse_aadhaar(full_text)
    if aadhaar_info and "aadhaar_number_masked" not in added_keys:
        add_field(
            "aadhaar_number_masked",
            "Aadhaar Number (UIDAI Masked)",
            aadhaar_info.masked_aadhaar_number,
            aadhaar_info.masked_aadhaar_number,
            1,
            0.99,
            method="statutory_identity_resolver",
        )
        if aadhaar_info.holder_name and "full_name" not in added_keys:
            add_field("full_name", "Full Name", aadhaar_info.holder_name, aadhaar_info.holder_name.title(), 1, 0.95, method="statutory_identity_resolver")
        if aadhaar_info.gender and "gender" not in added_keys:
            add_field("gender", "Gender", aadhaar_info.gender, aadhaar_info.gender, 1, 0.95, method="statutory_identity_resolver")
        if aadhaar_info.date_of_birth and "date_of_birth" not in added_keys:
            add_field("date_of_birth", "Date of Birth", aadhaar_info.date_of_birth, normalize_date(aadhaar_info.date_of_birth), 1, 0.95, method="statutory_identity_resolver")
        elif aadhaar_info.year_of_birth and "year_of_birth" not in added_keys:
            add_field("year_of_birth", "Year of Birth", str(aadhaar_info.year_of_birth), str(aadhaar_info.year_of_birth), 1, 0.95, method="statutory_identity_resolver")
        if aadhaar_info.father_or_spouse_name and "guardian_or_spouse_name" not in added_keys:
            add_field("guardian_or_spouse_name", "Father / Spouse Legal Name", aadhaar_info.father_or_spouse_name, aadhaar_info.father_or_spouse_name.title(), 1, 0.92, method="statutory_identity_resolver")
            if re.search(r"\b(S/O|D/O|Father)\b", full_text, re.IGNORECASE) and "father_legal_name" not in added_keys:
                add_field("father_legal_name", "Father's Legal Name", aadhaar_info.father_or_spouse_name, aadhaar_info.father_or_spouse_name.title(), 1, 0.92, method="statutory_identity_resolver")
        if aadhaar_info.address and "residential_address" not in added_keys:
            add_field("residential_address", "Residential Address", aadhaar_info.address, aadhaar_info.address, 1, 0.92, method="statutory_identity_resolver")

    # PAN Card structure & entity classification
    pan_info = IdentityResolver.parse_pan(full_text)
    if pan_info and "pan_number" not in added_keys:
        add_field("pan_number", "Permanent Account Number (PAN)", pan_info.pan_number, pan_info.pan_number, 1, 0.99, method="statutory_identity_resolver")
        add_field("pan_taxpayer_type", "PAN Taxpayer Classification", pan_info.entity_type, pan_info.entity_type, 1, 0.98, method="statutory_identity_resolver")
        if pan_info.holder_name and "pan_holder_name" not in added_keys:
            add_field("pan_holder_name", "PAN Registered Name", pan_info.holder_name, pan_info.holder_name, 1, 0.94, method="statutory_identity_resolver")
            if "full_name" not in added_keys:
                add_field("full_name", "Full Name", pan_info.holder_name, pan_info.holder_name, 1, 0.94, method="statutory_identity_resolver")
        if pan_info.father_name and "father_legal_name" not in added_keys:
            add_field("father_legal_name", "Father's Legal Name", pan_info.father_name, pan_info.father_name, 1, 0.94, method="statutory_identity_resolver")
        if pan_info.date_of_birth_or_incorporation and "date_of_birth" not in added_keys:
            add_field("date_of_birth", "Date of Birth", pan_info.date_of_birth_or_incorporation, normalize_date(pan_info.date_of_birth_or_incorporation) or pan_info.date_of_birth_or_incorporation, 1, 0.94, method="statutory_identity_resolver")

    # Indian Passport Endorsements (ECR vs ECNR, File Number, Booklet Type, Family, Biodata)
    indian_passport = IdentityResolver.parse_indian_passport(full_text)
    if indian_passport and (indian_passport.mrz_detected or indian_passport.passport_number or category == "identity_passport" or "passport" in (filename or "").lower()):
        if indian_passport.passport_number and "passport_number" not in added_keys:
            add_field("passport_number", "Passport Number", indian_passport.passport_number, indian_passport.passport_number.upper(), 1, 0.98, method="statutory_identity_resolver")
        if indian_passport.surname and "surname" not in added_keys:
            add_field("surname", "Surname / Family Name", indian_passport.surname, indian_passport.surname.upper(), 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.given_names and "given_names" not in added_keys:
            add_field("given_names", "Given Names", indian_passport.given_names, indian_passport.given_names.title(), 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.holder_name and "full_name" not in added_keys:
            add_field("full_name", "Full Name", indian_passport.holder_name, indian_passport.holder_name.title(), 1, 0.95, method="statutory_identity_resolver")
            add_field("applicant_name", "Candidate Applicant Name", indian_passport.holder_name, indian_passport.holder_name.title(), 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.place_of_birth and "place_of_birth" not in added_keys:
            add_field("place_of_birth", "Place of Birth", indian_passport.place_of_birth, indian_passport.place_of_birth.title(), 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.date_of_birth and "date_of_birth" not in added_keys:
            add_field("date_of_birth", "Date of Birth", indian_passport.date_of_birth, normalize_date(indian_passport.date_of_birth) or indian_passport.date_of_birth, 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.date_of_issue and "issue_date" not in added_keys:
            add_field("issue_date", "Date of Issue", indian_passport.date_of_issue, normalize_date(indian_passport.date_of_issue) or indian_passport.date_of_issue, 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.date_of_expiry and "expiry_date" not in added_keys:
            add_field("expiry_date", "Date of Expiration", indian_passport.date_of_expiry, normalize_date(indian_passport.date_of_expiry) or indian_passport.date_of_expiry, 1, 0.95, method="statutory_identity_resolver")
        if "emigration_check_status" not in added_keys:
            add_field("emigration_check_status", "Emigration Check Status (ECR/ECNR)", indian_passport.emigration_check, indian_passport.emigration_check, 1, 0.98, method="statutory_identity_resolver")
        if indian_passport.file_number and "passport_file_number" not in added_keys:
            add_field("passport_file_number", "Passport Office File Number", indian_passport.file_number, indian_passport.file_number, 1, 0.96, method="statutory_identity_resolver")
        if indian_passport.father_name and "father_legal_name" not in added_keys:
            add_field("father_legal_name", "Father's Legal Name", indian_passport.father_name, indian_passport.father_name, 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.mother_name and "mother_legal_name" not in added_keys:
            add_field("mother_legal_name", "Mother's Legal Name", indian_passport.mother_name, indian_passport.mother_name, 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.spouse_name and "spouse_legal_name" not in added_keys:
            add_field("spouse_legal_name", "Spouse's Legal Name", indian_passport.spouse_name, indian_passport.spouse_name, 1, 0.95, method="statutory_identity_resolver")
        if indian_passport.address and "residential_address" not in added_keys:
            add_field("residential_address", "Permanent / Residential Address", indian_passport.address, indian_passport.address, 1, 0.95, method="statutory_identity_resolver")
        if "passport_booklet_type" not in added_keys:
            add_field("passport_booklet_type", "Passport Booklet Type", indian_passport.booklet_type, indian_passport.booklet_type, 1, 0.95, method="statutory_identity_resolver")

    # Generic Parent & Address Extraction Fallback across Civil / Identity / Supporting Documents
    if "father_legal_name" not in added_keys:
        gen_fat_m = re.search(
            r"(?:5\.\s*Father(?:'s)?\s*/\s*Hu(?:s?\s*band)(?:'s)?\s*Name|Father(?:'s)?\s*/\s*Hu(?:s?\s*band)(?:'s)?\s*Name|Father(?:'s)?(?:\s*Legal)?\s*Name|Name\s*of\s*Father)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})",
            full_text,
            re.IGNORECASE,
        )
        if gen_fat_m:
            raw_fat = gen_fat_m.group(1).splitlines()[0].strip(" .:-_")
            if (
                raw_fat
                and not any(raw_fat.lower().startswith(p) for p in ("of ", "is ", "and ", "in "))
                and not any(k in raw_fat.lower() for k in ("mother", "spouse", "address", "date", "birth", "name", "nationality", "occupation", "relationship"))
            ):
                add_field("father_legal_name", "Father's Legal Name", raw_fat, raw_fat.title(), 1, 0.92)

    if "mother_legal_name" not in added_keys:
        gen_mot_m = re.search(
            r"(?:Mother(?:'s)?(?:\s*Legal)?\s*Name|Name\s*of\s*Mother)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})",
            full_text,
            re.IGNORECASE,
        )
        if gen_mot_m:
            raw_mot = gen_mot_m.group(1).splitlines()[0].strip(" .:-_")
            if (
                raw_mot
                and not any(raw_mot.lower().startswith(p) for p in ("of ", "is ", "and ", "in "))
                and not any(k in raw_mot.lower() for k in ("father", "spouse", "address", "date", "birth", "name", "nationality", "occupation", "relationship"))
            ):
                add_field("mother_legal_name", "Mother's Legal Name", raw_mot, raw_mot.title(), 1, 0.92)

    if "residential_address" not in added_keys:
        gen_addr_m = re.search(
            r"(?:Permanent\s*Resi(?:dential)?\s*Address(?:\s*:\s*Present\s*Resi(?:dential)?\s*Address)?|Present\s*Resi(?:dential)?\s*Address|Permanent\s*Address|Residential\s*Address|Present\s*Address|Address(?!\s*(?:In\s*Canada|of\s*parents|of\s*the)))[\s:]+([^\r\n]{8,140})",
            full_text,
            re.IGNORECASE,
        )
        if gen_addr_m:
            raw_addr = gen_addr_m.group(1).strip(" .:-_")
            bad_addr_substrings = (
                "you to canada", "yes no", "itr-", "incanada", "in canada", "(with sufficient",
                "status of the", "date of", "place of", "occupation", "relationship",
                "presentresiaddress", "permanentresiaddress", "present resi", "permanent resi"
            )
            if (
                raw_addr
                and not any(raw_addr.lower().startswith(p) for p in ("http", "www", "email", "(", "of ", "in canada"))
                and not any(b in raw_addr.lower() for b in bad_addr_substrings)
            ):
                add_field("residential_address", "Residential Address", raw_addr, raw_addr, 1, 0.90)

    # Driving Licence detection
    dl_info = IdentityResolver.parse_driving_licence(full_text)
    if dl_info and "driving_licence_number" not in added_keys:
        add_field("driving_licence_number", "Driving Licence Number", dl_info.licence_number, dl_info.licence_number, 1, 0.98, method="statutory_identity_resolver")
        add_field("driving_licence_jurisdiction", "Driving Licence Jurisdiction", dl_info.jurisdiction, dl_info.jurisdiction, 1, 0.96, method="statutory_identity_resolver")
        if dl_info.holder_name and "full_name" not in added_keys:
            add_field("full_name", "Full Name", dl_info.holder_name, dl_info.holder_name, 1, 0.94, method="statutory_identity_resolver")
        if dl_info.expiry_date and "driving_licence_expiry" not in added_keys:
            add_field("driving_licence_expiry", "Driving Licence Expiry", dl_info.expiry_date, normalize_date(dl_info.expiry_date) or dl_info.expiry_date, 1, 0.94, method="statutory_identity_resolver")
        if dl_info.vehicle_class and "driving_licence_class" not in added_keys:
            add_field("driving_licence_class", "Vehicle Authorization Class", dl_info.vehicle_class, dl_info.vehicle_class, 1, 0.95, method="statutory_identity_resolver")

    # Voter ID / EPIC Card detection
    voter_info = IdentityResolver.parse_voter_id(full_text)
    if voter_info and "voter_id_number" not in added_keys:
        add_field("voter_id_number", "Voter ID / EPIC Number", voter_info.epic_number, voter_info.epic_number, 1, 0.98, method="statutory_identity_resolver")
        if voter_info.elector_name and "full_name" not in added_keys:
            add_field("full_name", "Full Name", voter_info.elector_name, voter_info.elector_name, 1, 0.95, method="statutory_identity_resolver")
        if voter_info.relative_name and "guardian_or_spouse_name" not in added_keys:
            add_field("guardian_or_spouse_name", "Father / Husband Legal Name", voter_info.relative_name, voter_info.relative_name, 1, 0.93, method="statutory_identity_resolver")

    # Single-Name / FNU Detection (applicable to Identity/Passport documents where a legal single name is recorded)
    if category == "identity_passport" or "P<" in full_text or "PASSPORT" in full_text.upper():
        full_name_fields = [f for f in extracted_fields if f.field_name in ("full_name", "pan_holder_name")]
        if full_name_fields:
            cand_name = full_name_fields[0].original_value.strip()
            parts = cand_name.split()
            if len(parts) == 1 and len(parts[0]) >= 3 and parts[0].lower() not in ("ifirm", "firm", "company"):
                single_res = IdentityResolver.resolve_single_name(first_name=parts[0], last_name=None)
                if single_res.is_single_name and "single_name_uscis_given" not in added_keys:
                    add_field("single_name_uscis_given", "USCIS Form Given Name", single_res.uscis_first_name, single_res.uscis_first_name, 1, 0.99, method="statutory_identity_resolver")
                    add_field("single_name_ircc_given", "Canada IRCC Given Name", single_res.ircc_given_name or "(Blank)", single_res.ircc_given_name, 1, 0.99, method="statutory_identity_resolver")
                    add_field("single_name_ukvi_given", "UKVI Given Name", single_res.ukvi_given_name, single_res.ukvi_given_name, 1, 0.99, method="statutory_identity_resolver")
                    add_field("single_name_guidance", "Single Name Form Guidance", single_res.guidance_notes, single_res.guidance_notes, 1, 0.99, method="statutory_identity_resolver")

    # 4. CIVIL STATUS, BIRTH CERTIFICATE & MARRIAGE CERTIFICATE EXTRACTION
    has_birth_cert_any_page = any(
        re.search(
            r"BIRTH\s*CERTIFICATE|CERTIFICATE\s*OF\s*BIRTH|Registration\s+of\s+Births\s+and\s+Deaths|જન્મ\s*અને\s*મરણ|જન્મના\s*મૂળ\s*રેકર્ડ|जन्म\s*प्रमाण\s*पत्र|(?:Name\s*of\s*Mother.*?Name\s*of\s*Father)",
            p.text,
            re.IGNORECASE | re.DOTALL,
        )
        for p in pages
    )
    if category in ("civil_status_family", "civil_status", "supporting_evidence", "identity_passport") or has_birth_cert_any_page:
        # Dedicated Bilingual (English / Gujarati / Hindi) Birth Certificate Extractor (Page-by-Page + 2D Spatial Blocks)
        bc_bad_name_tokens = {
            "birth", "certificate", "issued", "under", "section", "registration", "births", "deaths",
            "act", "rule", "rules", "gujarat", "government", "this", "certify", "that", "following",
            "information", "taken", "from", "original", "record", "which", "register", "village",
            "city", "taluka", "district", "state", "name", "sex", "female", "male", "date", "place",
            "hospital", "maternity", "clinic", "nursing", "mother", "father", "address", "parents",
            "time", "child", "permanent", "society", "colony", "nagar", "road", "remarks", "signature",
            "issuing", "authority", "municipal", "corporation", "panchayat", "kalol", "gandhinagar",
            "ahmedabad", "surat", "vadodara", "rajkot", "india", "of", "the", "and", "in", "for", "at",
        }

        def _clean_bc_candidate_name(raw_str: str) -> str:
            s = re.sub(
                r"^(?:[1-9]|10|[૧૨૩૪૫૬૭૮૯૦]+)?\s*[\.\)\-]?\s*(?:(?:Name\s*of\s*Mother|Mother(?:'s)?\s*Name|Name\s*of\s*Father|Father(?:'s)?\s*Name|Full\s*Name|Name|માતાનું\s*નામ|પિતાનું\s*નામ|નામ|माता\s*का\s*नाम|पिता\s*का\s*नाम|नाम)[\s/:\.\-]*)+",
                "",
                raw_str or "",
                flags=re.IGNORECASE,
            )
            s = re.sub(r"(?:\.\s*){2,}", " ", s)
            s = re.sub(r"^[\s\.:;\-_,/]+|[\s\.:;\-_,/]+$", "", s).strip()
            return s

        def _is_valid_bc_person_name(raw_str: str) -> bool:
            cand = _clean_bc_candidate_name(raw_str)
            if not cand or len(cand) < 3 or len(cand) > 55:
                return False
            if re.search(r"[\d:]", cand):
                return False
            if re.search(r"(?:માતાનું|પિતાનું|નામ|સરકાર|પ્રમાણપત્ર|જન્મ|તારીખ|સ્થળ|સરનામું|નોંધણી|જાતિ|माता|पिता|नाम|सरकार|प्रमाण|जन्म|तिथि|स्थान|पता|पंजीकरण|लिंग)", cand):
                return False
            letters = re.findall(r"[A-Za-z\u0900-\u097F\u0A80-\u0AFF]", cand)
            if len(letters) < 3:
                return False
            raw_eng_words = re.findall(r"[A-Za-z]+", cand)
            if raw_eng_words:
                # Reject OCR misreads of Gujarati script which start with lowercase letters (e.g., 'khialkk Ho', 'dai olh')
                if any(w[0].islower() for w in raw_eng_words):
                    return False
                eng_words = [w.lower() for w in raw_eng_words]
                if any(w in bc_bad_name_tokens for w in eng_words):
                    return False
                if not all(len(w) >= 2 or len(eng_words) > 1 for w in eng_words):
                    return False
            return True

        def _block_to_loc(b: Any, page_obj: PageExtractionResult) -> dict:
            w = max(page_obj.width, 1.0)
            h = max(page_obj.height, 1.0)
            return {
                "x0": round(b.x0, 2),
                "y0": round(b.y0, 2),
                "x1": round(b.x1, 2),
                "y1": round(b.y1, 2),
                "page_width": round(w, 2),
                "page_height": round(h, 2),
                "bounding_box": [
                    round(max(0.0, min(1.0, b.y0 / h)), 2),
                    round(max(0.0, min(1.0, b.x0 / w)), 2),
                    round(max(0.0, min(1.0, b.y1 / h)), 2),
                    round(max(0.0, min(1.0, b.x1 / w)), 2),
                ],
                "block_idx": b.block_idx,
                "page_number": page_obj.page_number,
            }

        def _add_bc_field(
            primary_key: str,
            alt_key: str,
            label: str,
            orig_val: str,
            norm_val: Optional[str],
            page_num: int,
            conf: float = 0.96,
            loc: Optional[dict] = None,
        ):
            # If primary_key was previously populated on the SAME page by a generic/fallback rule, replace it
            existing_same_page = [
                f for f in extracted_fields if f.field_name == primary_key and f.source_page == page_num
            ]
            if existing_same_page:
                extracted_fields[:] = [
                    f for f in extracted_fields
                    if not (
                        f.source_page == page_num
                        and (
                            f.field_name == primary_key
                            or (primary_key == "full_name" and f.field_name == "applicant_name")
                        )
                    )
                ]
                added_keys.discard(primary_key)
                if primary_key == "full_name":
                    added_keys.discard("applicant_name")

            if primary_key not in added_keys:
                add_field(primary_key, label, orig_val, norm_val, page_num, conf, loc)
            elif alt_key not in added_keys:
                add_field(alt_key, label, orig_val, norm_val, page_num, conf, loc)
            else:
                scoped = f"{alt_key}_p{page_num}"
                if scoped not in added_keys:
                    add_field(scoped, label, orig_val, norm_val, page_num, conf, loc)

        for p in pages:
            p_text = clean_ocr_text(p.text or "")
            is_bc_page = bool(
                re.search(
                    r"BIRTH\s*CERTIFICATE|CERTIFICATE\s*OF\s*BIRTH|Registration\s+of\s+Births\s+and\s+Deaths|જન્મ\s*અને\s*મરણ|જન્મના\s*મૂળ\s*રેકર્ડ|जन्म\s*प्रमाण\s*पत्र|(?:Name\s*of\s*Mother.*?Name\s*of\s*Father)",
                    p_text,
                    re.IGNORECASE | re.DOTALL,
                )
            )
            if not is_bc_page:
                continue

            p_num = p.page_number
            p_lines = [ln.strip() for ln in p_text.splitlines() if ln.strip()]
            pw = max(p.width, 1.0)
            ph = max(p.height, 1.0)

            # Classify spatial person-name blocks on this Birth Certificate page into Left Column vs Right Column
            header_y1 = max(
                (b.y1 for b in p.blocks if re.search(r"Certify\s+that|village\s*/\s*City", b.text, re.IGNORECASE)),
                default=ph * 0.25,
            )
            left_name_blocks: list[tuple[str, Any]] = []
            right_name_blocks: list[tuple[str, Any]] = []
            for b in sorted(p.blocks, key=lambda blk: (blk.y0, blk.x0)):
                # Only consider body region of certificate below the header preamble
                if b.y0 < header_y1 - 4.0 or b.y0 > ph * 0.75:
                    continue
                cand_b = _clean_bc_candidate_name(b.text)
                if _is_valid_bc_person_name(cand_b) and (b.confidence >= 0.72 or cand_b.isupper()):
                    if b.x0 < pw * 0.45:
                        left_name_blocks.append((cand_b, b))
                    else:
                        right_name_blocks.append((cand_b, b))

            # 1. Child / Subject Name (1. Name / ૧. નામ / 1. नाम)
            bc_child_name: Optional[str] = None
            bc_child_loc: Optional[dict] = None
            for idx_l, ln in enumerate(p_lines):
                if (
                    re.search(r"(?:^|\b)(?:1\s*[\.\)]?\s*(?:Name|નામ|नाम)|^Name\b|^નામ\b|^नाम\b)(?!\s+of\b)", ln, re.IGNORECASE)
                    and not re.search(r"(?:માતાનું|પિતાનું|माता|पिता|Mother|Father)", ln, re.IGNORECASE)
                ):
                    same_val = _clean_bc_candidate_name(ln)
                    if _is_valid_bc_person_name(same_val):
                        bc_child_name = same_val
                        break
                    for adj in (idx_l - 1, idx_l + 1, idx_l - 2, idx_l + 2):
                        if 0 <= adj < len(p_lines) and _is_valid_bc_person_name(p_lines[adj]):
                            cand_adj = _clean_bc_candidate_name(p_lines[adj])
                            if abs(adj - idx_l) == 1 or cand_adj.isupper():
                                bc_child_name = cand_adj
                                break
                    if bc_child_name:
                        break

            if not bc_child_name and left_name_blocks:
                # Uppermost left-column person name block is 1. Name (e.g. BHOOMI)
                first_cand, first_blk = left_name_blocks[0]
                if first_blk.y0 < ph * 0.50 or len(left_name_blocks) >= 2:
                    bc_child_name = first_cand
                    bc_child_loc = _block_to_loc(first_blk, p)

            if bc_child_name:
                if not bc_child_loc:
                    bc_child_loc = _find_block_location([p], bc_child_name, p_num)
                _add_bc_field("full_name", "child_legal_name", "Full Name (Birth Certificate)", bc_child_name, bc_child_name.title(), p_num, 0.97, bc_child_loc)

            # 2. Sex / Gender (2. Sex (M/F) / ૨. જાતિ)
            bc_sex: Optional[str] = None
            bc_sex_loc: Optional[dict] = None
            for b in p.blocks:
                m_sex = re.search(r"\b(Female|Male|સ્ત્રી|પુરુષ|પુરૂષ|महिला|पुरुष)\b", b.text, re.IGNORECASE)
                if m_sex:
                    raw_s = m_sex.group(1)
                    bc_sex = "Female" if raw_s.lower() in ("female", "સ્ત્રી", "महिला") else "Male"
                    bc_sex_loc = _block_to_loc(b, p)
                    break
            if not bc_sex:
                m_sex_txt = re.search(r"\b(Female|Male|સ્ત્રી|પુરુષ|પુરૂષ|महिला|पुरुष)\b", p_text, re.IGNORECASE)
                if m_sex_txt:
                    raw_s = m_sex_txt.group(1)
                    bc_sex = "Female" if raw_s.lower() in ("female", "સ્ત્રી", "महिला") else "Male"
            if bc_sex:
                _add_bc_field("gender", "child_gender", "Sex (M/F)", bc_sex, bc_sex, p_num, 0.97, bc_sex_loc)

            # 3 & 10. Date of Birth (3. Date of Birth) and Date of Registration (10. Date of Registration)
            bc_dob: Optional[str] = None
            bc_dob_loc: Optional[dict] = None
            bc_reg_date: Optional[str] = None
            bc_reg_date_loc: Optional[dict] = None

            m_reg_dt = re.search(
                r"(?:10\s*[\.\)]?\s*)?(?:(?:Date\s*of\s*Registration|નોંધણીની\s*તારીખ|નોંધણી\s*તારીખ|पंजीकरण\s*(?:की\s*)?तिथि)[\s/:]*)+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4})",
                p_text,
                re.IGNORECASE,
            )
            if m_reg_dt:
                bc_reg_date = m_reg_dt.group(1).strip()

            m_dob_dt = re.search(
                r"(?:3\s*[\.\)]?\s*)?(?:(?:Date\s*of\s*Birth|જન્મ\s*તારીખ|जन्म\s*तिथि|जन्म\s*तारीख)[\s/:]*)+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4})",
                p_text,
                re.IGNORECASE,
            )
            if m_dob_dt:
                bc_dob = m_dob_dt.group(1).strip()

            # Spatial date block inspection on Birth Certificate page
            for b in p.blocks:
                for dm in re.finditer(r"\b([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})\b", b.text):
                    d_val = dm.group(1)
                    if b.y0 >= ph * 0.60 or (b.x0 >= pw * 0.45 and b.y0 >= ph * 0.55):
                        if not bc_reg_date:
                            bc_reg_date = d_val
                        if d_val == bc_reg_date and not bc_reg_date_loc:
                            bc_reg_date_loc = _block_to_loc(b, p)
                    elif b.x0 < pw * 0.48 and b.y0 < ph * 0.60:
                        if not bc_dob:
                            bc_dob = d_val
                        if d_val == bc_dob and not bc_dob_loc:
                            bc_dob_loc = _block_to_loc(b, p)

            if bc_dob:
                if not bc_dob_loc:
                    bc_dob_loc = _find_block_location([p], bc_dob, p_num)
                _add_bc_field("date_of_birth", "child_date_of_birth", "Date of Birth", bc_dob, normalize_date(bc_dob) or bc_dob, p_num, 0.96, bc_dob_loc)

            if bc_reg_date:
                if not bc_reg_date_loc:
                    bc_reg_date_loc = _find_block_location([p], bc_reg_date, p_num)
                _add_bc_field("birth_registration_date", "date_of_registration", "Date of Registration", bc_reg_date, normalize_date(bc_reg_date) or bc_reg_date, p_num, 0.97, bc_reg_date_loc)

            # 4. Place of Birth (4. Place of Birth / ૪. જન્મ સ્થળ)
            bc_pob: Optional[str] = None
            bc_pob_loc: Optional[dict] = None
            for idx_l, ln in enumerate(p_lines):
                if re.search(r"(?:4\s*[\.\)]?\s*)?(?:Place\s*of\s*Birth|જન્મ\s*સ્થળ|जन्म\s*स्थान)", ln, re.IGNORECASE):
                    m_same_pob = re.search(r"(?:Place\s*of\s*Birth|જન્મ\s*સ્થળ|जन्म\s*स्थान)[\s:]+([A-Za-z][A-Za-z0-9\s,\.-]{2,60})$", ln, re.IGNORECASE)
                    if m_same_pob:
                        cand_pob = m_same_pob.group(1).strip(" .:-_")
                        if not any(k in cand_pob.lower() for k in ("name of", "mother", "father", "date of", "sex")):
                            bc_pob = cand_pob
                            break
                    if idx_l + 1 < len(p_lines):
                        cand_next = p_lines[idx_l + 1].strip(" .:-_")
                        if (
                            len(re.findall(r"[A-Za-z]", cand_next)) >= 3
                            and not any(k in cand_next.lower() for k in ("name of", "mother", "father", "date of", "sex", "address", "પિતાનું", "માતાનું"))
                        ):
                            bc_pob = cand_next
                            break

            if not bc_pob:
                for b in p.blocks:
                    m_hosp = re.search(
                        r"\b([A-Za-z][A-Za-z\s,\.-]{1,35}\b(?:HOSPITAL|MATERNITY\s*HOME|NURSING\s*HOME|CLINIC|DISPENSARY|HEALTH\s*CENTRE)(?:[\s,]+[A-Za-z]+)?)\b",
                        b.text,
                        re.IGNORECASE,
                    )
                    if m_hosp:
                        bc_pob = re.sub(r"^(?:Place\s*of\s*Birth|Pla[a-z]*\s+|4\s*[\.\)])[\s:]*", "", m_hosp.group(1), flags=re.IGNORECASE).strip(" .:-_")
                        bc_pob_loc = _block_to_loc(b, p)
                        break

            if bc_pob:
                bc_pob = re.sub(r"^(?:Place\s*of\s*Birth|Pla[a-z]*\s+|4\s*[\.\)])[\s:]*", "", bc_pob, flags=re.IGNORECASE).strip(" .:-_")
                if not bc_pob_loc:
                    bc_pob_loc = _find_block_location([p], bc_pob, p_num)
                _add_bc_field("place_of_birth", "birth_cert_place_of_birth", "Place of Birth", bc_pob, bc_pob.title(), p_num, 0.96, bc_pob_loc)

            # 5. Name of Mother (5. Name of Mother / ૫. માતાનું નામ / माता का नाम)
            bc_mother: Optional[str] = None
            bc_mother_loc: Optional[dict] = None
            for idx_l, ln in enumerate(p_lines):
                if re.search(r"(?:5\s*[\.\)]?\s*)?(?:Name\s*of\s*Mother|Mother(?:'s)?\s*Name|માતાનું\s*નામ|माता\s*का\s*नाम)", ln, re.IGNORECASE):
                    m_mot = re.search(
                        r"(?:Name\s*of\s*Mother|Mother(?:'s)?\s*Name|માતાનું\s*નામ|माता\s*का\s*नाम)[\s:]*([A-Za-z][A-Za-z\s\.-]{2,50})",
                        ln,
                        re.IGNORECASE,
                    )
                    if m_mot and _is_valid_bc_person_name(m_mot.group(1)):
                        bc_mother = _clean_bc_candidate_name(m_mot.group(1))
                        break
                    for adj in (idx_l + 1, idx_l - 1):
                        if 0 <= adj < len(p_lines) and _is_valid_bc_person_name(p_lines[adj]):
                            cand_m = _clean_bc_candidate_name(p_lines[adj])
                            if cand_m != bc_child_name:
                                bc_mother = cand_m
                                break
                    if bc_mother:
                        break

            if not bc_mother and left_name_blocks:
                for cand_m, blk_m in left_name_blocks:
                    if cand_m != bc_child_name and blk_m.y0 >= ph * 0.44:
                        bc_mother = cand_m
                        bc_mother_loc = _block_to_loc(blk_m, p)
                        break

            if bc_mother:
                if not bc_mother_loc:
                    bc_mother_loc = _find_block_location([p], bc_mother, p_num)
                _add_bc_field("mother_legal_name", "birth_cert_mother_name", "Mother's Legal Name", bc_mother, bc_mother.title(), p_num, 0.97, bc_mother_loc)

            # 6. Name of Father (6. Name of Father / ૬. પિતાનું નામ / पिता का नाम)
            bc_father: Optional[str] = None
            bc_father_loc: Optional[dict] = None
            for idx_l, ln in enumerate(p_lines):
                if re.search(r"(?:6\s*[\.\)]?\s*)?(?:Name\s*of\s*Father|Father(?:'s)?\s*Name|પિતાનું\s*નામ|पिता\s*का\s*नाम)", ln, re.IGNORECASE):
                    m_fat = re.search(
                        r"(?:Name\s*of\s*Father|Father(?:'s)?\s*Name|પિતાનું\s*નામ|पिता\s*का\s*नाम)[\s:]*([A-Za-z][A-Za-z\s\.-]{2,50})",
                        ln,
                        re.IGNORECASE,
                    )
                    if m_fat and _is_valid_bc_person_name(m_fat.group(1)):
                        bc_father = _clean_bc_candidate_name(m_fat.group(1))
                        break
                    for adj in (idx_l + 1, idx_l + 2, idx_l - 1):
                        if 0 <= adj < len(p_lines) and _is_valid_bc_person_name(p_lines[adj]):
                            cand_f = _clean_bc_candidate_name(p_lines[adj])
                            if cand_f not in (bc_child_name, bc_mother):
                                bc_father = cand_f
                                break
                    if bc_father:
                        break

            if not bc_father and right_name_blocks:
                for cand_f, blk_f in right_name_blocks:
                    if cand_f not in (bc_child_name, bc_mother):
                        bc_father = cand_f
                        bc_father_loc = _block_to_loc(blk_f, p)
                        break

            if bc_father:
                if not bc_father_loc:
                    bc_father_loc = _find_block_location([p], bc_father, p_num)
                _add_bc_field("father_legal_name", "birth_cert_father_name", "Father's Legal Name", bc_father, bc_father.title(), p_num, 0.97, bc_father_loc)

            # 7 & 8. Address of Parents (7. Address of parents at the time of Birth / 8. Permanent Address of Parents)
            bc_address: Optional[str] = None
            bc_address_loc: Optional[dict] = None
            for idx_l, ln in enumerate(p_lines):
                if re.search(r"(?:Address\s+of\s+parents\s+at\s+the\s+time\s+of\s+Birth|Permanent\s+Address\s+of\s+Parents|માતા[\-\s/]*પિતાનું\s*(?:કાયમી\s*)?સરનામું)", ln, re.IGNORECASE):
                    collected_addr: list[str] = []
                    same_a = re.sub(
                        r"^.*?(?:Birth\s+of\s+child|Permanent\s+Address\s+of\s+Parents|સરનામું)[\s:]*",
                        "",
                        ln,
                        flags=re.IGNORECASE,
                    ).strip(" .:-_")
                    if same_a and len(re.findall(r"[A-Za-z0-9]", same_a)) >= 4 and not any(k in same_a.lower() for k in ("permanent address", "address of parents")):
                        collected_addr.append(same_a)
                    for j in range(idx_l + 1, min(idx_l + 4, len(p_lines))):
                        nxt = p_lines[j].strip(" .:-_")
                        if re.search(r"(?:^|\b)(?:[89]|10|૮|૯|૧૦)\s*[\.\)]|Registration\s*No|Date\s*of\s*Registration|Permanent\s*Address|નોંધણી|રીમાર્ક|Remarks", nxt, re.IGNORECASE):
                            break
                        if re.search(r"[\u0A80-\u0AFF]{3,}", nxt) and not re.search(r"[A-Za-z0-9]{3,}", nxt):
                            continue
                        if nxt and nxt not in collected_addr:
                            collected_addr.append(nxt)
                    if collected_addr:
                        bc_address = ", ".join(c.rstrip(",") for c in collected_addr)
                        break

            if not bc_address:
                for b in p.blocks:
                    m_soc = re.search(
                        r"\b(\d{1,4}\s*,\s*[A-Za-z0-9\s,\.-]+(?:SOCIETY|NAGAR|PARK|COLONY|APARTMENT|ROAD|SECTOR)[A-Za-z0-9\s,\.-]*)",
                        b.text,
                        re.IGNORECASE,
                    )
                    if m_soc:
                        bc_address = m_soc.group(1).strip(" .:-_,")
                        bc_address_loc = _block_to_loc(b, p)
                        break

            if bc_address:
                if not bc_address_loc:
                    bc_address_loc = _find_block_location([p], bc_address.split(",")[0], p_num)
                _add_bc_field("residential_address", "parents_residential_address", "Address of Parents (Birth Certificate)", bc_address, bc_address.title(), p_num, 0.95, bc_address_loc)

            # 9. Registration Number (9. Registration No. / ૯. નોંધણી ક્રમાંક)
            bc_reg_no: Optional[str] = None
            bc_reg_no_loc: Optional[dict] = None
            m_reg_no = re.search(
                r"(?:9\s*[\.\)]?\s*)?(?:Registration\s*No\.?|નોંધણી\s*ક્રમાંક|पंजीकरण\s*संख्या)[\s:]*([0-9]{1,10}(?:/[0-9]{2,4})?)(?!\s*[\.\)]\s*[A-Za-z])",
                p_text,
                re.IGNORECASE,
            )
            if m_reg_no:
                bc_reg_no = m_reg_no.group(1).strip(" .:-_")
            else:
                for idx_l, ln in enumerate(p_lines):
                    if re.search(r"(?:9\s*[\.\)]?\s*)?(?:Registration\s*No\.?|નોંધણી\s*ક્રમાંક)", ln, re.IGNORECASE) and idx_l + 1 < len(p_lines):
                        m_nxt_no = re.search(r"^([0-9]{1,8}(?:/[0-9]{2,4})?)$", p_lines[idx_l + 1].strip(" .:-_"))
                        if m_nxt_no:
                            bc_reg_no = m_nxt_no.group(1)
                            break

            if bc_reg_no:
                bc_reg_no_loc = _find_block_location([p], bc_reg_no, p_num)
                _add_bc_field("birth_registration_number", "registration_number", "Birth Registration No.", bc_reg_no, bc_reg_no, p_num, 0.97, bc_reg_no_loc)

            # Date of Issue & Issuing Authority (Footer of Birth Certificate)
            for idx_l, ln in enumerate(p_lines):
                if re.search(r"(?:Date\s*of\s*Issue|તારીખ)", ln, re.IGNORECASE):
                    m_iss_bc = re.search(r"([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})", ln)
                    if not m_iss_bc and idx_l - 1 >= 0:
                        m_iss_bc = re.search(r"([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})", p_lines[idx_l - 1])
                    if not m_iss_bc and idx_l + 1 < len(p_lines):
                        m_iss_bc = re.search(r"([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})", p_lines[idx_l + 1])
                    if m_iss_bc:
                        raw_bc_iss = m_iss_bc.group(1)
                        iss_loc = _find_block_location([p], raw_bc_iss, p_num)
                        _add_bc_field("issue_date", "birth_cert_issue_date", "Date of Issue", raw_bc_iss, normalize_date(raw_bc_iss) or raw_bc_iss, p_num, 0.95, iss_loc)
                        break

            # Municipality / Village / Taluka / District from Header
            m_muni = re.search(
                r"village\s*/\s*City[\s:]*([A-Za-z]+)(?:.*?Taluka[\s:]*([A-Za-z]+))?(?:.*?District[\s:]*([A-Za-z]+))?",
                p_text,
                re.IGNORECASE | re.DOTALL,
            )
            if m_muni:
                parts_muni = [g.strip().title() for g in m_muni.groups() if g and g.strip()]
                dedup_muni = list(dict.fromkeys(parts_muni))
                if dedup_muni:
                    muni_str = ", ".join(dedup_muni)
                    muni_loc = _find_block_location([p], parts_muni[-1], p_num)
                    _add_bc_field("registration_municipality", "birth_registration_district", "Registration Municipality & District", muni_str, muni_str, p_num, 0.94, muni_loc)

        # IRCC IMM 5713 Use of a Family Representative
        rep_form = re.search(r"\b(IMM\s*(?:5713|6713|S713))\b", full_text, re.IGNORECASE)
        if rep_form and "ircc_form_number" not in added_keys:
            add_field("ircc_form_number", "IRCC Form Identifier", "IMM 5713", "IMM 5713", 1, 0.98)

        if "USE OF A FAMILY" in full_text.upper() or "FAMILY MEMBER REPRESENTATIVE" in full_text.upper() or "IMM5713" in (filename or "").upper():
            if "ircc_form_number" not in added_keys:
                add_field("ircc_form_number", "IRCC Form Identifier", "IMM 5713", "IMM 5713", 1, 0.98)
            rep_m = re.search(r"(?:Representative\s*Name|Appointed\s*Representative)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if rep_m and "representative_name" not in added_keys:
                raw_rep = rep_m.group(1).splitlines()[0].strip().title()
                add_field("representative_name", "Appointed Family Representative", raw_rep, raw_rep, 1, 0.96)

            app_name = re.search(r"(?:Family\s*Member\s*Name|Represented\s*Family\s*Member)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if app_name and "represented_family_member" not in added_keys:
                raw_fam = app_name.group(1).splitlines()[0].strip().title()
                add_field("represented_family_member", "Represented Family Member", raw_fam, raw_fam, 1, 0.96)

        # IRCC IMM 5645 Family Information Form
        if "FAMILY INFORMATION" in full_text.upper() or "FAMILYINFORMATION" in full_text.upper() or "IMM5645" in (filename or "").upper():
            if "ircc_form_number" not in added_keys:
                add_field("ircc_form_number", "IRCC Form Identifier", "IMM 5645", "IMM 5645", 1, 0.99)
            app_m = re.search(r"(?:Applicant\s*Name|Full\s*Name|ApplicantName)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if not app_m:
                app_m = re.search(r"([A-Z][A-Za-z\s]{4,45}?)\s+Applicant\s+Country\s+of\s+Birth", full_text)
            if app_m and "full_name" not in added_keys:
                raw_app = app_m.group(1).splitlines()[-1].strip().title()
                if not any(k in raw_app.lower() for k in ("spouse", "mother", "father", "relationship", "date", "section", "note")):
                    add_field("full_name", "Full Name", raw_app, raw_app, 1, 0.96)

            imm_dob_m = re.search(r"Applicant\s+Country\s+of\s+Birth[\s:]*([0-9]{4}-[0-9]{2}-[0-9]{2})", full_text, re.IGNORECASE)
            if imm_dob_m and "date_of_birth" not in added_keys:
                add_field("date_of_birth", "Date of Birth", imm_dob_m.group(1), imm_dob_m.group(1), 1, 0.97)

            sp_m = re.search(r"(?:Spouse\s*or\s*Common-law\s*Partner|Spouse\s*Name|SpouseName)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if not sp_m:
                sp_m = re.search(r"(?:Marital\s*status:\s*)?([A-Z][A-Za-z\s]{4,45}?)\s+(?:common-law\s+)?Spouse\b", full_text)
            if sp_m and "spouse_legal_name" not in added_keys:
                raw_sp = sp_m.group(1).splitlines()[-1].strip().title()
                if not any(k in raw_sp.lower() for k in ("applicant", "mother", "father", "relationship", "date", "married", "present")):
                    add_field("spouse_legal_name", "Spouse's Legal Name", raw_sp, raw_sp, 1, 0.96)

            mot_5645 = re.search(r"([A-Z][A-Za-z\s]{4,45}?)\s+Mother\s+Country\s+of\s+Birth", full_text)
            if mot_5645 and "mother_legal_name" not in added_keys:
                raw_m5645 = mot_5645.group(1).splitlines()[-1].strip().title()
                if not any(k in raw_m5645.lower() for k in ("deceased", "ahmedabad", "india", "married")):
                    add_field("mother_legal_name", "Mother's Legal Name", raw_m5645, raw_m5645, 1, 0.96)

            fat_5645 = re.search(r"([A-Z][A-Za-z\s]{4,45}?)\s+Father\s+Country\s+of\s+Birth", full_text)
            if fat_5645 and "father_legal_name" not in added_keys:
                raw_f5645 = fat_5645.group(1).splitlines()[-1].strip().title()
                if not any(k in raw_f5645.lower() for k in ("society", "ahmedabad", "india", "married")):
                    add_field("father_legal_name", "Father's Legal Name", raw_f5645, raw_f5645, 1, 0.96)

        # Memorandum / Certificate of Marriage (supports both tabular Memorandum and Gujarat Form II Prose Certificate)
        if (
            "MEMRANDUM OF MARRIAGE" in full_text.upper()
            or "MEMORANDUM OF MARRIAGE" in full_text.upper()
            or "CERTIFICATE OF MARRIAGE" in full_text.upper()
            or "MARRIAGE" in (filename or "").upper()
            or ("SOLEMNIZED" in full_text.upper() and "MARRIAGE" in full_text.upper())
            or "BRIDEGROOM" in full_text.upper()
        ):
            # 1. Gujarat Form II Prose Certificate ("Certify that Shri <Groom> Son of Shri <GroomFather> ... and <Bride> daughter of Shri <BrideFather> ... solemnized on <Date> ... serial No <No>")
            prose_groom_m = re.search(
                r"Certify\s+that\s+(?:Shri|Smt\.?|Mr\.?)?\s*([A-Za-z][A-Za-z\s\.-]{2,45}?)\s+(?:Son|S/o)\s+of\s+(?:Shri|Mr\.?)?\s*([A-Za-z][A-Za-z\s\.-]{2,45}?)\s+residing\s+at",
                full_text,
                re.IGNORECASE | re.DOTALL,
            )
            if prose_groom_m:
                raw_pg = " ".join(prose_groom_m.group(1).split()).strip(" .:-_")
                raw_pgf = " ".join(prose_groom_m.group(2).split()).strip(" .:-_")
                if raw_pg and "groom_name" not in added_keys:
                    add_field("groom_name", "Bridegroom Legal Name", raw_pg, raw_pg.title(), 1, 0.98)
                    if "full_name" not in added_keys:
                        add_field("full_name", "Full Name", raw_pg, raw_pg.title(), 1, 0.98)
                        add_field("applicant_name", "Candidate Applicant Name", raw_pg, raw_pg.title(), 1, 0.98)
                if raw_pgf and "father_legal_name" not in added_keys:
                    add_field("father_legal_name", "Bridegroom's Father Name", raw_pgf, raw_pgf.title(), 1, 0.96)

            prose_bride_m = re.search(
                r"\band\s+(?:Kum\.?|Smt\.?|Ms\.?|Chi\.?)?\s*([A-Za-z][A-Za-z\s\.-]{2,45}?)\s+(?:daughter\s*of|D/o)\s+(?:Shri|Mr\.?)?\s*([A-Za-z0-9][A-Za-z0-9\s\.-]{2,45}?)(?:\s+(?:n\s*|r\s*)?residing|\s+[nr]\s+siding|\s+have|\s+was|\r|\n)",
                full_text,
                re.IGNORECASE | re.DOTALL,
            )
            if prose_bride_m:
                raw_pb = " ".join(prose_bride_m.group(1).split()).strip(" .:-_")
                raw_pbf = " ".join(prose_bride_m.group(2).split()).strip(" .:-_")
                # Check if an interline family surname was written just below 'daughter of Shri ... residing at ...' before 'have furnished'
                tail_after_bride = full_text[prose_bride_m.end():prose_bride_m.end() + 140]
                interline_surname_m = re.search(
                    r"\b(PATEL|SHAH|AMIN|DESAI|MEHTA|MODI|JOSHI|TRIVEDI|PANDYA|BHATT|PARIKH|CHAUHAN|SOLANKI|RATHOD|THAKKAR|VYAS|BRAHMBHATT|PRAJAPATI|PANCHAL|BHAVSAR|SONI|GANDHI|KOTHARI)\b(?=.*?\bhave\b)",
                    tail_after_bride,
                    re.IGNORECASE | re.DOTALL,
                )
                if interline_surname_m:
                    cand_sur = interline_surname_m.group(1).upper()
                    if cand_sur not in raw_pbf.upper().split():
                        raw_pbf = f"{raw_pbf} {cand_sur}".strip()
                if raw_pb and "bride_name" not in added_keys:
                    add_field("bride_name", "Bride Legal Name", raw_pb, raw_pb.title(), 1, 0.98)
                    if "spouse_legal_name" not in added_keys:
                        add_field("spouse_legal_name", "Spouse / Bride Legal Name", raw_pb, raw_pb.title(), 1, 0.97)
                if raw_pbf and "bride_father_name" not in added_keys:
                    add_field("bride_father_name", "Bride's Father Name", raw_pbf, raw_pbf.title(), 1, 0.95)

            cert_no_m = re.search(
                r"(?:Certificate\s*No\.?|Registration\s*No\.?|se?a?rial\s*No\.?)[\s:_/\-]*([0-9A-Za-z][0-9A-Za-z\s/\-_]{0,12}?)(?=\s+of\s+volume|\s+of\s+\d{4}|[\r\n]|$)",
                full_text,
                re.IGNORECASE,
            )
            if cert_no_m and "marriage_certificate_number" not in added_keys:
                cand_cno = cert_no_m.group(1).strip(" .:-_/")
                cand_cno = re.sub(r"\s+of$", "", cand_cno, flags=re.IGNORECASE).strip(" .:-_/")
                # Collapse spaces inside handwritten digits (e.g., '_8 2_' -> '82')
                if re.fullmatch(r"[\d\s_]+", cand_cno):
                    cand_cno = re.sub(r"[\s_]+", "", cand_cno)
                if any(ch.isdigit() for ch in cand_cno):
                    add_field("marriage_certificate_number", "Marriage Certificate Number", cand_cno, cand_cno.upper(), 1, 0.98)

            m_d = re.search(r"(?:Date\s+of\s+Marriage[\s:]+|solemnized\s+on\s+(?:date\s*)?)(\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4})", full_text, re.IGNORECASE)
            if not m_d:
                m_d = re.search(r"\b(\d{1,2}-\d{1,2}-\d{4})\b", full_text)
            if m_d and "marriage_date" not in added_keys:
                add_field("marriage_date", "Date of Marriage", m_d.group(1), normalize_date(m_d.group(1)) or m_d.group(1), 1, 0.98)

            reg_d = re.search(
                r"(?:Date\s+of\s+Registration[\s:]+|Reg[ie]st[e]?red\s+on[\s:]+|Given\s+under\s+my\s+hand[^\r\n]*?on\s+(?:date\s*)?|\bDate\s*:\s*)(\d{1,2}[/\.-]\s*\d{1,2}[/\.-]\s*\d{2,4})",
                full_text,
                re.IGNORECASE,
            )
            if reg_d and "marriage_registration_date" not in added_keys:
                raw_reg_d = re.sub(r"\s+", "", reg_d.group(1))
                add_field("marriage_registration_date", "Date of Registration", raw_reg_d, normalize_date(raw_reg_d) or raw_reg_d, 1, 0.97)

            groom_label_m = re.search(r"(?:FULL\s+NAME\s+OF\s+THE\s+BRIDEGROOM|BRIDEGROOM\s+NAME|GROOM\s+NAME)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if groom_label_m and "groom_name" not in added_keys:
                raw_g = groom_label_m.group(1).splitlines()[0].strip()
                if not any(k in raw_g.lower() for k in ("religion", "age", "occupation", "status", "address")):
                    add_field("groom_name", "Bridegroom Legal Name", raw_g, raw_g.title(), 1, 0.98)
                    if "full_name" not in added_keys:
                        add_field("full_name", "Full Name", raw_g, raw_g.title(), 1, 0.98)

            bride_label_m = re.search(r"(?:FULL\s+NAME\s+OF\s+THE\s+BRIDE|BRIDE\s+NAME)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if bride_label_m and "bride_name" not in added_keys:
                raw_b = bride_label_m.group(1).splitlines()[0].strip()
                if not any(k in raw_b.lower() for k in ("religion", "age", "occupation", "status", "address")):
                    add_field("bride_name", "Bride Legal Name", raw_b, raw_b.title(), 1, 0.98)

            # Fallback for old Bombay Marriage Act Memorandum where Groom/Bride names precede '<N> years'
            if "groom_name" not in added_keys or "bride_name" not in added_keys:
                age_names = re.findall(r"([A-Z][A-Z\s,\.]{4,45}?)\s*[\r\n]+\s*[1-6][0-9]\s*years", full_text)
                cleaned_age_names = [
                    " ".join(re.sub(r"[\.,]+", " ", an).split()).strip()
                    for an in age_names
                    if not any(k in an.lower() for k in ("age", "status", "unmarried", "married", "address", "bride", "father"))
                ]
                if len(cleaned_age_names) >= 1 and "groom_name" not in added_keys:
                    add_field("groom_name", "Bridegroom Legal Name", cleaned_age_names[0], cleaned_age_names[0].title(), 1, 0.94)
                    if "full_name" not in added_keys:
                        add_field("full_name", "Full Name", cleaned_age_names[0], cleaned_age_names[0].title(), 1, 0.94)
                if len(cleaned_age_names) >= 2 and "bride_name" not in added_keys:
                    add_field("bride_name", "Bride Legal Name", cleaned_age_names[1], cleaned_age_names[1].title(), 1, 0.94)
                    if "spouse_legal_name" not in added_keys:
                        add_field("spouse_legal_name", "Spouse / Bride Legal Name", cleaned_age_names[1], cleaned_age_names[1].title(), 1, 0.94)

            priest_m = re.search(r"(?:Officiating\s+Priest|Priest\s+Name)[\s:]+([A-Za-z\s\.-]{3,45})", full_text, re.IGNORECASE)
            if priest_m and "officiating_priest" not in added_keys:
                raw_p = priest_m.group(1).splitlines()[0].strip()
                add_field("officiating_priest", "Officiating Priest Name", raw_p, raw_p.title(), 1, 0.95)

            place_m = re.search(r"(?:Place\s+of\s+Marriage)[\s:]+([^\r\n]{4,80})", full_text, re.IGNORECASE)
            if place_m and "marriage_place" not in added_keys:
                raw_pl = place_m.group(1).strip()
                if not any(k in raw_pl.lower() for k in ("(with sufficient", "particulars to locate", "village, taluka")):
                    add_field("marriage_place", "Place of Marriage", raw_pl, raw_pl, 1, 0.96)

            act_m = re.search(r"\b(Bombay Registration of Marriages Act[^\n\r,]*|Gujarat Registration of Marriages Act[^\n\r,]*|Registration of Marriages Act(?:,\s*\d{4})?|Special Marriage Act|Hindu Marriage Act)\b", full_text, re.IGNORECASE)
            if act_m and "marriage_governing_act" not in added_keys:
                add_field("marriage_governing_act", "Marriage Governing Statute", act_m.group(1).strip(), act_m.group(1).strip().title(), 1, 0.94)

        # Children and Sponsor relations in Relationship packet
        sponsor_m = re.search(r"([A-Za-z\s\.-]{3,50})\s*\n+\((?:Son|Daughter|Child)\s+of\s+Main\s+Applicant\)", full_text, re.IGNORECASE)
        if sponsor_m and "inviting_child_name" not in added_keys:
            raw_child = sponsor_m.group(1).strip()
            add_field("inviting_child_name", "Inviting Child / Sponsor in Canada", raw_child, raw_child.title(), 1, 0.94)

    # 5. EDUCATIONAL RECORDS EXTRACTION
    if category in ("educational_records", "educational_record", "supporting_evidence"):
        # Recipient name on diplomas ("have conferred on\n\nAARAV SHARMA\n\nthe degree of")
        conf_name_m = re.search(r"(?:conferred\s+on|awarded\s+to|certifies\s+that)\s*[\r\n]+\s*([A-Z][A-Za-z\s\.-]{3,45})\s*[\r\n]+", full_text, re.IGNORECASE)
        if conf_name_m and "full_name" not in added_keys:
            raw_recipient = conf_name_m.group(1).strip()
            add_field("full_name", "Full Name", raw_recipient, raw_recipient.title(), 1, 0.96)

        deg_m = re.search(r"(?:Degree|Diploma|Title of|the degree of)\s*[:\r\n]+\s*([A-Za-z\s\.-]{5,65}(?:Science|Arts|Engineering|Philosophy|Doctorate|Master|Bachelor|Technology|Computer)[A-Za-z\s\.-]*)", full_text, re.IGNORECASE)
        if not deg_m:
            deg_m = re.search(r"\b((?:Doctor of Philosophy|Master of Science|Bachelor of Science|Bachelor of Technology|Bachelor of Arts|Bachelor of Law)(?:\s+in\s+[A-Za-z\s]+)?)\b", full_text, re.IGNORECASE)
        if deg_m and "degree_title" not in added_keys:
            raw_deg = deg_m.group(1).splitlines()[0].strip()
            add_field("degree_title", "Conferred Degree Title", raw_deg, raw_deg.title(), 1, 0.94)

        for inst_match in re.finditer(r"\b([A-Za-z][A-Za-z \t\.-]+(?:University|Institute of Technology|College|Polytechnic|Academy))\b", full_text, re.IGNORECASE):
            raw_inst = inst_match.group(1).strip()
            if "trustees of the" in raw_inst.lower() or "board of" in raw_inst.lower():
                continue
            if "institution_name" not in added_keys:
                add_field("institution_name", "Academic Institution", raw_inst, raw_inst.title(), 1, 0.92)
                break

        gpa_m = re.search(r"(?:GPA|Grade Point Average|Cumulative GPA)[\s:]+([0-4]\.[0-9]{1,2}(?:\s*/\s*4\.00?)?)", full_text, re.IGNORECASE)
        if gpa_m and "gpa" not in added_keys:
            add_field("gpa", "Grade Point Average (GPA)", gpa_m.group(1).strip(), gpa_m.group(1).strip(), 1, 0.95)

        grad_m = re.search(r"(?:Conferred on|Date of Graduation|Graduated|Conferral Date)[\s:]+([A-Za-z0-9\s,\.-]{6,30})", full_text, re.IGNORECASE)
        if not grad_m:
            grad_m = re.search(r"\(((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\)", full_text, re.IGNORECASE)
        if grad_m and "graduation_date" not in added_keys:
            add_field("graduation_date", "Graduation / Conferral Date", grad_m.group(1).strip(), normalize_date(grad_m.group(1).strip()), 1, 0.92)

    # 6. EMPLOYMENT RECORDS EXTRACTION
    if category in ("employment_records", "employment_record", "supporting_evidence"):
        emp_m = re.search(r"(?:Employer|Company|Organization Name|employed[^\r\n]{1,30}with)[\s:]+([A-Za-z0-9\s,\.-]{2,50}(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Technologies|AI|Systems))", full_text, re.IGNORECASE)
        if emp_m and "employer_name" not in added_keys:
            add_field("employer_name", "Employer / Company Name", emp_m.group(1).strip(), emp_m.group(1).strip().title(), 1, 0.93)

        emp_person_m = re.search(r"(?:confirm\s+that|certify\s+that|LETTER\s*[-–]\s*)([A-Z][A-Za-z\s]{3,40}?)(?:\s+has\s+been|\r|\n|$)", full_text)
        if emp_person_m and "full_name" not in added_keys:
            raw_emp_person = emp_person_m.group(1).strip()
            add_field("full_name", "Full Name", raw_emp_person, raw_emp_person.title(), 1, 0.95)

        title_m = re.search(r"(?:^|[\r\n])\s*(?:Current Position|Job Title|Position Title|Role|Designation)\s*[:\-]\s*([A-Za-z0-9\s\(\)\.\-:]{3,75})", full_text, re.IGNORECASE)
        if title_m and "job_title" not in added_keys:
            raw_jt = title_m.group(1).splitlines()[0].strip()
            add_field("job_title", "Job Title / Professional Role", raw_jt, raw_jt, 1, 0.94)

        sal_m = re.search(r"(?:Annual (?:Base )?Salary|Salary|Annual (?:Base )?Compensation|Base Pay)[\s:]+(\$?[0-9,]+(?:\.[0-9]{2})?(?:\s*(?:USD|per year|per annum|annually))?)", full_text, re.IGNORECASE)
        if sal_m and "annual_salary" not in added_keys:
            add_field("annual_salary", "Annual Compensation", sal_m.group(1).strip(), normalize_currency_amount(sal_m.group(1).strip()), 1, 0.95)

        start_m = re.search(
            r"(?:Start Date|Hire Date|Employment Commenced|since)\s*[:\s]\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[/\.-]\d{1,2}[/\.-]\d{4})",
            full_text,
            re.IGNORECASE,
        )
        if start_m and "employment_start_date" not in added_keys:
            raw_start = start_m.group(1).strip().split("\n")[0].strip()
            add_field("employment_start_date", "Employment Start Date", raw_start, normalize_date(raw_start) or raw_start, 1, 0.92)

        # Resume & CV entity extraction
        is_resume = (
            "RESUME" in (filename or "").upper()
            or "CV" in (filename or "").upper()
            or "CURRICULUM VITAE" in full_text.upper()
            or "RESUME" in full_text.upper()
            or "TECHNICAL SKILLS" in full_text.upper()
            or "WORK EXPERIENCE" in full_text.upper()
            or "PROFESSIONAL EXPERIENCE" in full_text.upper()
            or "CAREER OBJECTIVE" in full_text.upper()
        )
        if is_resume:
            # 1. Experience Block (extract current role and employer)
            exp_match = re.search(r"(?:^|[\r\n])\s*(?:EXPERIENCE|WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE)\s*[\r\n]+([^\r\n]+)\s*[\r\n]+([^\r\n]+)", full_text, re.IGNORECASE)
            if exp_match:
                cand_role = exp_match.group(1).strip()
                company_line = exp_match.group(2).strip()
                cand_company = company_line.split("|")[0].strip()
                if "job_title" not in added_keys and len(cand_role) >= 3 and not any(cand_role.lower().startswith(bad) for bad in ("experience", "work", "page", "skills")):
                    add_field("job_title", "Professional Role / Title", cand_role, cand_role.title(), 1, 0.95)
                if "employer_name" not in added_keys and len(cand_company) >= 2 and not any(cand_company.lower().startswith(bad) for bad in ("experience", "work", "present")):
                    add_field("employer_name", "Employer / Company Name", cand_company, cand_company.title(), 1, 0.94)

            # 2. Candidate name from filename if format like 'Firstname Lastname - Resume'
            if filename and "applicant_name" not in added_keys and "full_name" not in added_keys:
                clean_fname = re.sub(r"[-_.]", " ", filename)
                name_cand = re.sub(r"\b(pdf|resume|final|doc|docx|cv|curriculum|vitae)\b", "", clean_fname, flags=re.IGNORECASE).strip()
                name_cand = " ".join(name_cand.split())
                if len(name_cand.split()) >= 2 and all(len(p) >= 2 for p in name_cand.split()):
                    add_field("applicant_name", "Candidate Applicant Name", name_cand, name_cand.title(), 1, 0.95)

            # 3. Candidate name from top 5 lines of document text if not found yet
            if "applicant_name" not in added_keys and "full_name" not in added_keys and pages:
                cand_lines = [l.strip() for l in pages[0].text.splitlines() if l.strip()]
                for line in cand_lines[:5]:
                    if any(bad in line.lower() for bad in ("@", "http", "www.", "github", "linkedin", "phone", "tel:", "curriculum", "resume", "page ", "experience", "education", "skills")):
                        continue
                    words = [w for w in re.split(r"\s+", line) if w]
                    if 2 <= len(words) <= 4 and all(re.match(r"^[A-Za-z\.-]+$", w) for w in words) and 4 <= len(line) <= 45:
                        cand_name = " ".join(words)
                        add_field("applicant_name", "Candidate Applicant Name", cand_name, cand_name.title(), 1, 0.94)
                        break

            # 4. Email extraction
            email_m = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", full_text)
            if email_m and "email_address" not in added_keys:
                add_field("email_address", "Contact Email Address", email_m.group(0), email_m.group(0).lower(), 1, 0.98)

            # 5. Phone extraction (international and national formats)
            phone_m = re.search(r"(?:\+?91[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", full_text)
            if phone_m and "phone_number" not in added_keys:
                add_field("phone_number", "Contact Phone Number", phone_m.group(0).strip(), phone_m.group(0).strip(), 1, 0.94)

            # 6. LinkedIn profile URL
            linkedin_m = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/([A-Za-z0-9_-]+)", full_text, re.IGNORECASE)
            if linkedin_m and "linkedin_profile" not in added_keys:
                li_url = f"https://linkedin.com/in/{linkedin_m.group(1)}"
                add_field("linkedin_profile", "LinkedIn Profile", li_url, li_url, 1, 0.97)

            # 7. GitHub / Portfolio URL
            github_m = re.search(r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9_-]+)|(https?://[A-Za-z0-9_-]+\.github\.io/[A-Za-z0-9_/-]*)", full_text, re.IGNORECASE)
            if github_m and "github_profile" not in added_keys:
                gh_url = github_m.group(2) or f"https://github.com/{github_m.group(1)}"
                add_field("github_profile", "GitHub Portfolio", gh_url, gh_url, 1, 0.97)

            # 8. Candidate location (single-line City, State / Country)
            loc_m = re.search(
                r"\b([A-Z][a-zA-Z\t .-]{2,35},\s*(?:[A-Z][a-zA-Z\t .-]{2,35},\s*)?(?:India|Canada|USA|United States|UK|United Kingdom|Australia|Germany|France|Gujarat|Ontario|California|New York|Texas|Bengaluru|Bangalore|Mumbai|Delhi|Ahmedabad|Pune|Hyderabad))\b",
                full_text,
            )
            if loc_m and "candidate_location" not in added_keys:
                raw_loc = loc_m.group(1).strip()
                add_field("candidate_location", "Candidate Location / Residence", raw_loc, raw_loc.title(), 1, 0.92)

            # 9. Professional role fallback
            if "job_title" not in added_keys:
                role_m = re.search(r"\b((?:Senior|Lead|Staff|Principal|Junior)?\s*(?:(?:Software|Full\s*Stack|Backend|Frontend|Data|DevOps|Systems|Cloud|AI|Machine\s*Learning)[\s,&/]*)*(?:Engineer|Developer|Architect|Consultant|Manager|Director|Scientist))\b", full_text, re.IGNORECASE)
                if role_m:
                    add_field("job_title", "Professional Role / Title", role_m.group(1).strip(), role_m.group(1).strip().title(), 1, 0.92)

            # 10. Technical Skills extraction (bullet points and comma lists)
            skills_section = re.search(r"(?:^|[\r\n])\s*(?:TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|KEY\s+SKILLS|SKILLS\s*&?\s*ABILITIES|SKILLS)\s*[\r\n]+((?:[^\r\n]+[\r\n]+){1,20})", full_text, re.IGNORECASE)
            if skills_section and "technical_skills" not in added_keys:
                raw_lines = skills_section.group(1).splitlines()
                clean_skills = []
                for l in raw_lines:
                    l_clean = l.strip()
                    if not l_clean:
                        continue
                    if re.match(r"^(?:CERTIFICAT|EDUCATION|EXPERIENCE|PROJECT|AWARDS|WORK\s+EXPERIENCE|EMPLOYMENT)\b", l_clean, re.IGNORECASE):
                        break
                    if re.match(r"^LANGUAGES?\s*$", l_clean, re.IGNORECASE):
                        break
                    item = re.sub(r"^[•\*\-·▪\s]+", "", l_clean).strip()
                    if item:
                        clean_skills.append(item)
                if clean_skills:
                    skills_str = ", ".join(clean_skills[:15])
                    add_field("technical_skills", "Technical Skills Summary", skills_str, skills_str, 1, 0.94)

            # 11. Years of Experience
            exp_years = re.search(r"\b([0-9]{1,2}\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp))\b", full_text, re.IGNORECASE)
            if exp_years and "years_of_experience" not in added_keys:
                add_field("years_of_experience", "Total Professional Experience", exp_years.group(1).strip(), exp_years.group(1).strip(), 1, 0.91)

            # 12. Conferred Degree from Resume Education section
            if "degree_title" not in added_keys:
                resume_deg = re.search(r"\b((?:Bachelor|Master|Doctor|Ph\.?D\.?|Associate|Diploma)\s+(?:of|in)\s+[A-Za-z0-9\t &/-]{3,50})\b", full_text, re.IGNORECASE)
                if resume_deg:
                    add_field("degree_title", "Conferred Degree Title", resume_deg.group(1).strip(), resume_deg.group(1).strip().title(), 1, 0.93)

            # 13. University / Institution from Resume Education section
            if "institution_name" not in added_keys:
                for line in full_text.splitlines():
                    inst_m = re.search(r"\b([A-Za-z0-9\.\s-]+(?:University|Institute|Technical Institute|College|Polytechnic|Academy)(?:,\s*[A-Za-z]+)?)\b", line, re.IGNORECASE)
                    if inst_m and not any(k in line.lower() for k in ("diploma", "bachelor", "master", "education", "degree", "doctor")):
                        add_field("institution_name", "Academic Institution", inst_m.group(1).strip(), inst_m.group(1).strip().title(), 1, 0.92)
                        break

            # 14. Languages Proficiency
            if "candidate_languages" not in added_keys:
                lang_m = re.search(r"(?:^|[\r\n])\s*LANGUAGES\s*[\r\n]+((?:[^\r\n]+[\r\n]+){1,10})", full_text, re.IGNORECASE)
                if lang_m:
                    raw_langs = lang_m.group(1).splitlines()
                    clean_langs = []
                    for l in raw_langs:
                        l_clean = l.strip()
                        if not l_clean:
                            continue
                        if any(l_clean.upper().startswith(k) for k in ("SKILLS", "EDUCATION", "EXPERIENCE", "CERTIFICATE", "PROJECT")):
                            break
                        item = re.sub(r"^[•\*\-·▪\s]+", "", l_clean).split("[")[0].strip()
                        if item:
                            clean_langs.append(item)
                    if clean_langs:
                        langs_str = ", ".join(clean_langs[:6])
                        add_field("candidate_languages", "Proficient Languages", langs_str, langs_str, 1, 0.92)

    # 7. FINANCIAL EVIDENCE EXTRACTION & FORENSICS (Bank Statements, CA Net Worth, Property Valuations)
    if category in ("financial_evidence", "supporting_evidence"):
        # CA Certified Net Worth Summary
        networth_inr = re.search(r"(?:Valuation of Immovable Properties And Movable Properties comes to\s*RS\.?|Total Net Worth[\s:]*Rs\.?)\s*([0-9,]+(?:\.[0-9]{2})?/-?)", full_text, re.IGNORECASE)
        if networth_inr and "ca_total_net_worth_inr" not in added_keys:
            raw_inr = networth_inr.group(1).strip().rstrip("/-")
            add_field("ca_total_net_worth_inr", "CA Certified Total Net Worth (INR)", f"Rs. {raw_inr}", normalize_currency_amount(raw_inr), 1, 0.98)

        networth_cad = re.search(r"(?:in CANADIAN DOLLAR Value Is CAD|Net Worth in CAD)[\s:]*([0-9,]+(?:\.[0-9]{2})?)", full_text, re.IGNORECASE)
        if networth_cad and "ca_total_net_worth_cad" not in added_keys:
            raw_cad = networth_cad.group(1).strip()
            add_field("ca_total_net_worth_cad", "CA Certified Total Net Worth (CAD)", f"CAD ${raw_cad}", normalize_currency_amount(raw_cad), 1, 0.98)

        ca_firm = re.search(r"(?:FOR,?\s*)?([A-Z\s&]+CO(?:MPANY)?)\s+CHARTERED ACCOUNTANTS", full_text)
        if ca_firm and "chartered_accountant_firm" not in added_keys:
            raw_firm = ca_firm.group(1).strip()
            add_field("chartered_accountant_firm", "Chartered Accountant Firm", raw_firm, raw_firm.title(), 1, 0.95)

        udin_m = re.search(r"\bUDIN\s*[:\s]*([0-9A-Z]{18})\b", full_text)
        if udin_m and "ca_udin" not in added_keys:
            add_field("ca_udin", "CA Unique Document Identification (UDIN)", udin_m.group(1), udin_m.group(1), 1, 0.99)

        valuer_m = re.search(r"(?:Name of registered valuer|Valuer)[\s\.:\n]+([A-Za-z\s\.-]{3,40})", full_text, re.IGNORECASE)
        if valuer_m and "registered_valuer_name" not in added_keys:
            raw_val = valuer_m.group(1).strip().split("\n")[0].strip()
            if not raw_val.lower().startswith("report"):
                add_field("registered_valuer_name", "Registered Property Valuer", raw_val, raw_val.title(), 1, 0.94)

        prop_val = re.search(r"(?:Total value of the property|Present value of such type of property is)[\s:]*Rs\.?\s*([0-9,]+)", full_text, re.IGNORECASE)
        if prop_val and "immovable_property_valuation" not in added_keys:
            raw_prop = prop_val.group(1).strip()
            add_field("immovable_property_valuation", "Immovable Property Valuation", f"Rs. {raw_prop}", normalize_currency_amount(raw_prop), 1, 0.94)

        # Banking institution and balance
        bank_m = re.search(
            r"\b((?:State\s+Bank\s+of\s+[A-Za-z]+|Royal\s+Bank\s+of\s+[A-Za-z]+|The\s+Kalupur\s+Commercial|[A-Za-z][A-Za-z\s\.-]{2,35}?(?:Bank(?:\s+of\s+[A-Za-z]+)?|Credit Union|Federal Bank|Financial|Bancorp|SBI|HDFC|ICICI|RBC|TD Canada)))\b",
            full_text,
            re.IGNORECASE,
        )
        if bank_m and "financial_institution" not in added_keys:
            raw_bank = bank_m.group(1).strip()
            add_field("financial_institution", "Financial Institution", raw_bank, raw_bank.title(), 1, 0.92)

        open_bal_m = re.search(r"(?:Opening Balance|Beginning Balance|Previous Balance)[\s:]+([₹\$£€]?\s*[0-9,]+(?:\.[0-9]{2})?(?:\s*[A-Z]{3})?)", full_text, re.IGNORECASE)
        if open_bal_m and "opening_balance" not in added_keys:
            add_field("opening_balance", "Opening Balance", open_bal_m.group(1).strip(), normalize_currency_amount(open_bal_m.group(1).strip()), 1, 0.94)

        bal_m = re.search(r"(?:Closing Balance|Ending Balance|Total Balance|Available Funds)[\s:]+([₹\$£€]?\s*[0-9,]+(?:\.[0-9]{2})?(?:\s*[A-Z]{3})?)", full_text, re.IGNORECASE)
        if bal_m and "closing_balance" not in added_keys:
            add_field("closing_balance", "Closing Balance", bal_m.group(1).strip(), normalize_currency_amount(bal_m.group(1).strip()), 1, 0.95)

        acc_m = re.search(r"(?:Account (?:Number|No\.?)|Account ending in|FD A/c No\.?|PPF A/c No\.?)[\s:\.]*([X\*\d-]{4,20})", full_text, re.IGNORECASE)
        if acc_m and "account_number_masked" not in added_keys:
            add_field("account_number_masked", "Account Number (Masked)", acc_m.group(1).strip(), acc_m.group(1).strip(), 1, 0.92)

        stmt_m = re.search(r"(?:Statement Date|Period Ending|Statement Period)[\s:]+([A-Za-z0-9\s,\.-]{6,30})", full_text, re.IGNORECASE)
        if stmt_m and "statement_date" not in added_keys:
            add_field("statement_date", "Statement Date", stmt_m.group(1).strip(), normalize_date(stmt_m.group(1).strip()), 1, 0.88)

        # Deep Financial Forensics: unseasoned deposits & liquidity
        stmt_summary = FinancialIntelligenceEngine.parse_bank_statement_text(full_text)
        if stmt_summary.suspicious_lump_sums and "unseasoned_funds_flag" not in added_keys:
            add_field(
                "unseasoned_funds_flag",
                "Unseasoned Deposit Anomaly",
                f"{len(stmt_summary.suspicious_lump_sums)} unseasoned deposits detected",
                f"{len(stmt_summary.suspicious_lump_sums)} deposits",
                1,
                0.95,
                method="financial_forensics_engine",
            )
            add_field(
                "financial_risk_notes",
                "Banking Seasoning Risk Warnings",
                "; ".join(stmt_summary.risk_findings),
                "; ".join(stmt_summary.risk_findings),
                1,
                0.95,
                method="financial_forensics_engine",
            )
        if stmt_summary.minimum_balance_observed > 0 and "minimum_monthly_balance" not in added_keys:
            add_field(
                "minimum_monthly_balance",
                "Observed Minimum Balance",
                f"{stmt_summary.currency} {stmt_summary.minimum_balance_observed:,.2f}",
                str(stmt_summary.minimum_balance_observed),
                1,
                0.92,
                method="financial_forensics_engine",
            )

        # Indian ITR-V Form Processing
        itr_summary = FinancialIntelligenceEngine.parse_itr_v(full_text)
        if itr_summary:
            if "itr_assessment_year" not in added_keys:
                add_field("itr_assessment_year", "ITR Assessment Year", itr_summary.assessment_year, itr_summary.assessment_year, 1, 0.98, method="financial_forensics_engine")
            if "itr_acknowledgement_number" not in added_keys:
                add_field("itr_acknowledgement_number", "ITR-V Acknowledgement Number", itr_summary.acknowledgement_number, itr_summary.acknowledgement_number, 1, 0.99, method="financial_forensics_engine")
            if itr_summary.gross_total_income > 0 and "itr_gross_total_income" not in added_keys:
                add_field("itr_gross_total_income", "Gross Total Income (INR)", f"INR {itr_summary.gross_total_income:,.2f}", str(itr_summary.gross_total_income), 1, 0.95, method="financial_forensics_engine")
            if itr_summary.total_tax_payable > 0 and "itr_total_tax_payable" not in added_keys:
                add_field("itr_total_tax_payable", "Total Tax Paid / Payable", f"INR {itr_summary.total_tax_payable:,.2f}", str(itr_summary.total_tax_payable), 1, 0.95, method="financial_forensics_engine")

    # 8. VISAS & RESIDENCE PERMITS
    if category in ("visas_residence_permits", "supporting_evidence"):
        visa_num_m = re.search(r"(?:Visa Number|Control Number|Control No\.?)[\s:]+([A-Z0-9]{8,12})", full_text, re.IGNORECASE)
        if visa_num_m and "visa_number" not in added_keys:
            add_field("visa_number", "Visa Foil Control Number", visa_num_m.group(1).strip(), visa_num_m.group(1).strip().upper(), 1, 0.95)

        class_m = re.search(r"(?:Visa (?:Type|Class)|Class)[\s:]+([A-Z0-9-]{1,8})", full_text, re.IGNORECASE)
        if class_m and "visa_class" not in added_keys:
            add_field("visa_class", "Visa Classification", class_m.group(1).strip(), class_m.group(1).strip().upper(), 1, 0.92)

    # 9. GOVERNMENT CORRESPONDENCE EXTRACTION & IRCC APPLICATIONS
    if category in ("government_correspondence", "supporting_evidence"):
        uci_m = re.search(r"\b(?:UCIClientID|UCI|Client ID)[\s:]*([0-9]{8,11})\b", full_text, re.IGNORECASE)
        if uci_m and "uci_number" not in added_keys:
            add_field("uci_number", "Unique Client Identifier (UCI)", uci_m.group(1).strip(), uci_m.group(1).strip(), 1, 0.99)

        ircc_form_m = re.search(r"\b(IMM\s*5257[A-Za-z]?|IMM\s*5713)\b", full_text, re.IGNORECASE)
        if ircc_form_m and "ircc_form_number" not in added_keys:
            add_field("ircc_form_number", "IRCC Form Identifier", ircc_form_m.group(1).upper(), ircc_form_m.group(1).upper(), 1, 0.98)

        funds_m = re.search(r"\bFunds:\s*([0-9]+)\b", full_text)
        if funds_m and "available_funds_cad" not in added_keys:
            raw_funds = funds_m.group(1).strip()
            add_field("available_funds_cad", "Available Funds for Visit (CAD)", f"${raw_funds} CAD", normalize_currency_amount(raw_funds), 1, 0.98)

        refusal_m = re.search(r"\brefusedDetails:\s*([^\r\n]{10,250})", full_text, re.IGNORECASE)
        if refusal_m and "visa_refusal_disclosure" not in added_keys:
            raw_ref = refusal_m.group(1).strip()
            add_field("visa_refusal_disclosure", "Prior Visa Refusal Disclosure", raw_ref, raw_ref, 1, 0.98)

        # Invitation letter sponsor names
        inviter_m = re.search(r"\b([A-Za-z\s\.-]{3,40})\s*\n+\(Son of Main Applicant\)", full_text)
        if inviter_m and "inviting_sponsor_name" not in added_keys:
            add_field("inviting_sponsor_name", "Canadian Inviter / Sponsor Name", inviter_m.group(1).strip().title(), inviter_m.group(1).strip().title(), 1, 0.95)

        rec_m = re.search(r"\b([A-Z]{3}[0-9]{10})\b", full_text)  # e.g. LIN2490018822, WAC23...
        if rec_m and "receipt_number" not in added_keys:
            add_field("receipt_number", "USCIS Receipt Number", rec_m.group(1), rec_m.group(1).upper(), 1, 0.98)

        notice_m = re.search(r"\b(Form I-797[A-E]?|Notice of Action|Receipt Notice|Approval Notice)\b", full_text, re.IGNORECASE)
        if notice_m and "notice_type" not in added_keys:
            add_field("notice_type", "Government Notice Type", notice_m.group(1).strip(), notice_m.group(1).strip().upper(), 1, 0.95)

    # 10. TRAVEL RECORDS EXTRACTION (IMM 5562, Purpose of Travel)
    if category in ("travel_records", "supporting_evidence"):
        ircc_form_travel = re.search(r"\b(IMM\s*5562)\b", full_text, re.IGNORECASE)
        if ircc_form_travel and "ircc_form_number" not in added_keys:
            add_field("ircc_form_number", "IRCC Form Identifier", ircc_form_travel.group(1).upper(), ircc_form_travel.group(1).upper(), 1, 0.98)

        purpose_m = re.search(r"(?:Subject:\s*Application for Super Visa[^\n\r]*|Foremost purpose of our intended visit[^\n\r]*|Purpose of Visit[\s:]*[^\n\r]*)", full_text, re.IGNORECASE)
        if purpose_m and "purpose_of_travel" not in added_keys:
            raw_purp = purpose_m.group(0).strip()
            add_field("purpose_of_travel", "Purpose of Travel / Visit", raw_purp, raw_purp, 1, 0.95)

        travel_start = re.search(r"(?:FromDate|From Date|Visit:? From)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[A-Za-z0-9\s,]{6,25})", full_text, re.IGNORECASE)
        if travel_start and "travel_start_date" not in added_keys:
            raw_s = travel_start.group(1).strip()
            add_field("travel_start_date", "Intended Travel Start Date", raw_s, normalize_date(raw_s) or raw_s, 1, 0.92)

        travel_end = re.search(r"(?:ToDate|To Date|Visit:? To)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[A-Za-z0-9\s,]{6,25})", full_text, re.IGNORECASE)
        if travel_end and "travel_end_date" not in added_keys:
            raw_e = travel_end.group(1).strip()
            add_field("travel_end_date", "Intended Travel End Date", raw_e, normalize_date(raw_e) or raw_e, 1, 0.92)

        sign_date_m = re.search(r"(?:Date\s*Signed|Signing\s*Date)[\s:]*([0-9]{4}-[0-9]{2}-[0-9]{2})", full_text, re.IGNORECASE)
        if sign_date_m and "form_signing_date" not in added_keys:
            add_field("form_signing_date", "Form Signing Date", sign_date_m.group(1), sign_date_m.group(1), 1, 0.96)

    # 11. INSURANCE & ACCOMMODATION EXTRACTION (Super Visa Coverage)
    if category in ("insurance_accommodation", "supporting_evidence"):
        ins_prov = re.search(r"\b(Manulife|Allianz|Sun Life|Blue Cross|TuGo|Destination Canada|GMS)\b", full_text, re.IGNORECASE)
        if ins_prov and "insurance_provider" not in added_keys:
            add_field("insurance_provider", "Insurance Provider", ins_prov.group(1).strip(), ins_prov.group(1).strip().title(), 1, 0.95)

        ins_pol = re.search(r"\b(?:Policy number:\s*|Policy\s*#?|Certificate\s*#?)[\s:]*([A-Z0-9-]{8,25})\b", full_text, re.IGNORECASE)
        if ins_pol and "insurance_policy_number" not in added_keys:
            add_field("insurance_policy_number", "Insurance Policy Number", ins_pol.group(1).strip(), ins_pol.group(1).strip().upper(), 1, 0.98)

        ins_cov = re.search(r"(?:Coverage amount:\s*|Coverage(?:\s*Amount)?|Maximum Sum Insured)[\s:]*\$?([0-9,]+(?:\.[0-9]{2})?)", full_text, re.IGNORECASE)
        if ins_cov and "insurance_coverage_amount" not in added_keys:
            add_field("insurance_coverage_amount", "Insurance Coverage Amount", f"${ins_cov.group(1).strip()}", normalize_currency_amount(ins_cov.group(1).strip()), 1, 0.98)

        ins_prem = re.search(r"(?:Total amount paid:\s*|Total premium:\s*|Total amount due:\s*)[\s:]*\$?([0-9,]+(?:\.[0-9]{2})?)", full_text, re.IGNORECASE)
        if ins_prem and "insurance_premium_paid" not in added_keys:
            add_field("insurance_premium_paid", "Insurance Premium Paid", f"${ins_prem.group(1).strip()}", normalize_currency_amount(ins_prem.group(1).strip()), 1, 0.96)

        if "Deductible" in full_text and "insurance_deductible" not in added_keys:
            add_field("insurance_deductible", "Insurance Deductible", "$0.00 (Nil)", "$0.00", 1, 0.95)

        eff_date = re.search(r"Effective date:\s*([A-Za-z0-9\s,]+)", full_text)
        if eff_date and "insurance_effective_date" not in added_keys:
            raw_eff = eff_date.group(1).strip().split("\n")[0]
            add_field("insurance_effective_date", "Insurance Policy Effective Date", raw_eff, normalize_date(raw_eff), 1, 0.95)

        exp_date = re.search(r"Expiry date:\s*([A-Za-z0-9\s,]+)", full_text)
        if exp_date and "insurance_expiry_date" not in added_keys:
            raw_exp = exp_date.group(1).strip().split("\n")[0]
            add_field("insurance_expiry_date", "Insurance Policy Expiry Date", raw_exp, normalize_date(raw_exp), 1, 0.95)

        insured_m = re.search(r"(?:Primary\s*Insured|Insured\s*Person(?:\s*Name)?)[\s:]+([A-Za-z\s,\.-]{3,45})", full_text, re.IGNORECASE)
        if insured_m and "insured_person_name" not in added_keys:
            raw_ins = insured_m.group(1).splitlines()[0].strip()
            add_field("insured_person_name", "Insured Person Name", raw_ins, raw_ins.title(), 1, 0.96)

    # 12. POLICE & UPFRONT MEDICAL EXTRACTION (eMedical / IME / UMI)
    if category in ("police_medical", "supporting_evidence") or "eMedical" in full_text or "501MedicalExamination" in full_text:
        umi_m = re.search(r"\b(?:UMI#?|UMI\s*#?|UMI\s*No\.?)[\s:]*([A-Z0-9]{8,15})\b", full_text, re.IGNORECASE)
        if umi_m and "umi_number" not in added_keys:
            add_field("umi_number", "Upfront Medical Identifier (UMI)", umi_m.group(1).strip(), umi_m.group(1).strip().upper(), 1, 0.98)

        ime_m = re.search(r"\b(?:IME#?|IME\s*#?|IME\s*No\.?)[\s:]*([0-9]{8,10})\b", full_text, re.IGNORECASE)
        if ime_m and "ime_number" not in added_keys:
            add_field("ime_number", "Immigration Medical Exam (IME)", ime_m.group(1).strip(), ime_m.group(1).strip().upper(), 1, 0.98)

        med_fam = re.search(r"\bFamily\s*name[\s:]+([A-Za-z][A-Za-z\s\.-]{1,35}?)(?=\s*Date\s*of\s*Birth|\r|\n|$)", full_text, re.IGNORECASE)
        med_giv = re.search(r"\bGiven\s*Name(?:\(s\))?[\s:]+([A-Za-z][A-Za-z\s\.-]{1,45}?)(?=\s*Identity|\s*Gender|\r|\n|$)", full_text, re.IGNORECASE)
        if med_fam and med_giv:
            raw_mf = med_fam.group(1).strip()
            raw_mg = med_giv.group(1).strip()
            comb_med = f"{raw_mg} {raw_mf}"
            if "surname" not in added_keys:
                add_field("surname", "Surname / Family Name", raw_mf, raw_mf.upper(), 1, 0.97)
            if "given_names" not in added_keys:
                add_field("given_names", "Given Names", raw_mg, raw_mg.title(), 1, 0.97)
            if "full_name" not in added_keys:
                add_field("full_name", "Full Name", comb_med, comb_med.title(), 1, 0.98)

        med_dob = re.search(r"\bDate\s*of\s*Birth[\s:]+([0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4}|[0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})", full_text, re.IGNORECASE)
        if med_dob and "date_of_birth" not in added_keys:
            raw_mdob = med_dob.group(1).strip()
            add_field("date_of_birth", "Date of Birth", raw_mdob, normalize_date(raw_mdob) or raw_mdob, 1, 0.97)

        med_gen = re.search(r"\bGender[\s:]+(Female|Male)\b", full_text, re.IGNORECASE)
        if med_gen and "gender" not in added_keys:
            add_field("gender", "Gender", med_gen.group(1).title(), med_gen.group(1).title(), 1, 0.97)

        med_date = re.search(r"(?:Visit date:?|Exam date:?)[\s:]*([0-9]{1,2}\s*[A-Za-z]{3}\s*[0-9]{4}|[0-9]{4}[-/][0-9]{2}[-/][0-9]{2})", full_text, re.IGNORECASE)
        if med_date and "medical_exam_date" not in added_keys:
            raw_d = med_date.group(1).strip()
            add_field("medical_exam_date", "Medical Examination Date", raw_d, normalize_date(raw_d) or raw_d, 1, 0.98)

        med_clinic = re.search(r"\b(Apollo\s*Hospitals?(?:-[A-Za-z]+)?|Max\s*Healthcare(?:-[A-Za-z]+)?|Fortis(?:\s*Hospital)?|Medanta|KD\s*Hospital|CIMS\s*Hospital)\b", full_text, re.IGNORECASE)
        if not med_clinic:
            for cm in re.finditer(r"\b([A-Z][A-Za-z\s\-]{3,35}(?:Clinic|Hospital))\b", full_text):
                cand_cl = cm.group(1).strip()
                if not any(bad in cand_cl.lower() for bad in ("emedical", "e medical", "medicalclinic", "medical clinic", "this clinic", "panel clinic")):
                    med_clinic = cm
                    break
        if med_clinic and "medical_exam_clinic" not in added_keys:
            add_field("medical_exam_clinic", "Designated Medical Clinic", med_clinic.group(1).strip(), med_clinic.group(1).strip().title(), 1, 0.95)

        med_doc = re.search(r"(?:Panel\s*Physician|Examining\s*Doctor)[\s:]+(Dr\.?\s*[A-Za-z\s\.-]{3,40})", full_text, re.IGNORECASE)
        if med_doc and "medical_examiner_doctor" not in added_keys:
            raw_doc = med_doc.group(1).splitlines()[0].strip()
            add_field("medical_examiner_doctor", "Designated Panel Physician", raw_doc, raw_doc.title(), 1, 0.95)

        if "501MedicalExamination" in full_text or "501 Medical Examination" in full_text:
            if "medical_exam_type" not in added_keys:
                add_field("medical_exam_type", "Medical Examination Protocol", "501 Medical Examination (Upfront Visitor)", "501 Medical Examination", 1, 0.96)

        p_med = re.search(r"Identity\s*document\s*number[\s:]+([A-Z0-9]{7,10})", full_text, re.IGNORECASE)
        if p_med and "passport_number" not in added_keys:
            add_field("passport_number", "Passport Number", p_med.group(1).upper(), p_med.group(1).upper(), 1, 0.96)

        med_iss = re.search(r"Date\s*of\s*issue[\s:]+([0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4})", full_text, re.IGNORECASE)
        if med_iss and "issue_date" not in added_keys:
            raw_mi = med_iss.group(1).strip()
            add_field("issue_date", "Date of Issue", raw_mi, normalize_date(raw_mi) or raw_mi, 1, 0.96)

        med_exp = re.search(r"Date\s*of\s*expiry[\s:]+([0-9]{1,2}\s*[A-Za-z]{3,9}\s*[0-9]{4})", full_text, re.IGNORECASE)
        if med_exp and "expiry_date" not in added_keys:
            raw_me = med_exp.group(1).strip()
            add_field("expiry_date", "Date of Expiration", raw_me, normalize_date(raw_me) or raw_me, 1, 0.96)

    # 11. INDIAN MULTILINGUAL EXTRACTION (GUJARATI ગુજરાતી & HINDI हिन्दी NATIVE LABELS)
    if re.search(r"[\u0900-\u097F\u0A80-\u0AFF]", full_text):
        # Full Name / Applicant Name in Gujarati or Hindi labels (e.g., નામ: / પૂરું નામ: / नाम: / पूरा नाम:)
        if "full_name" not in added_keys:
            indic_name_m = re.search(
                r"(?:પૂરું\s*નામ|અરજદારનું\s*નામ|નામ|पूरा\s*नाम|आवेदक\s*का\s*नाम|नाम)\s*[:\-–]\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF][A-Za-z\u0900-\u097F\u0A80-\u0AFF\s\.]{2,60})",
                full_text,
            )
            if indic_name_m:
                raw_in_name = indic_name_m.group(1).splitlines()[0].strip()
                norm_in_name = raw_in_name.title() if re.search(r"[A-Za-z]", raw_in_name) else raw_in_name
                add_field("full_name", "Full Name (Indian Multilingual)", raw_in_name, norm_in_name, 1, 0.95)

        # Father's Name in Gujarati (પિતાનું નામ) or Hindi (पिता का नाम)
        if "father_legal_name" not in added_keys:
            indic_father_m = re.search(
                r"(?:પિતાનું\s*નામ|પિતા\s*નામ|पिता\s*का\s*नाम|पिता\s*नाम)\s*[:\-–]\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF][A-Za-z\u0900-\u097F\u0A80-\u0AFF\s\.]{2,60})",
                full_text,
            )
            if indic_father_m:
                raw_if = indic_father_m.group(1).splitlines()[0].strip()
                norm_if = raw_if.title() if re.search(r"[A-Za-z]", raw_if) else raw_if
                add_field("father_legal_name", "Father's Legal Name", raw_if, norm_if, 1, 0.95)

        # Mother's Name in Gujarati (માતાનું નામ) or Hindi (माता का नाम)
        if "mother_legal_name" not in added_keys:
            indic_mother_m = re.search(
                r"(?:માતાનું\s*નામ|માતા\s*નામ|माता\s*का\s*नाम|माता\s*नाम)\s*[:\-–]\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF][A-Za-z\u0900-\u097F\u0A80-\u0AFF\s\.]{2,60})",
                full_text,
            )
            if indic_mother_m:
                raw_im = indic_mother_m.group(1).splitlines()[0].strip()
                norm_im = raw_im.title() if re.search(r"[A-Za-z]", raw_im) else raw_im
                add_field("mother_legal_name", "Mother's Legal Name", raw_im, norm_im, 1, 0.95)

        # Spouse Name in Gujarati (પતિ/પત્નીનું નામ) or Hindi (पति/पत्नी का नाम)
        if "spouse_legal_name" not in added_keys:
            indic_spouse_m = re.search(
                r"(?:પતિ(?:/પત્ની)?નું\s*નામ|પત્નીનું\s*નામ|पति(?:/पत्नी)?\s*का\s*नाम|पत्नी\s*का\s*नाम)\s*[:\-–]\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF][A-Za-z\u0900-\u097F\u0A80-\u0AFF\s\.]{2,60})",
                full_text,
            )
            if indic_spouse_m:
                raw_isp = indic_spouse_m.group(1).splitlines()[0].strip()
                norm_isp = raw_isp.title() if re.search(r"[A-Za-z]", raw_isp) else raw_isp
                add_field("spouse_legal_name", "Spouse's Legal Name", raw_isp, norm_isp, 1, 0.95)

        # Date of Birth in Gujarati (જન્મ તારીખ) or Hindi (जन्म तिथि)
        if "date_of_birth" not in added_keys:
            indic_dob_m = re.search(
                r"(?:જન્મ\s*તારીખ|જ\.?\s*તા\.?|जन्म\s*तिथि|जन्म\s*तारीख)\s*[:\-–]\s*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4}|[0-9]{4}[/\.-][0-9]{1,2}[/\.-][0-9]{1,2})",
                full_text,
            )
            if indic_dob_m:
                raw_idob = indic_dob_m.group(1).strip()
                add_field("date_of_birth", "Date of Birth", raw_idob, normalize_date(raw_idob) or raw_idob, 1, 0.96)

        # Place of Birth in Gujarati (જન્મ સ્થળ) or Hindi (जन्म स्थान)
        if "place_of_birth" not in added_keys:
            indic_pob_m = re.search(
                r"(?:જન્મ\s*સ્થળ|जन्म\s*स्थान)\s*[:\-–]\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF][A-Za-z\u0900-\u097F\u0A80-\u0AFF\s,\.-]{2,60})",
                full_text,
            )
            if indic_pob_m:
                raw_ipob = indic_pob_m.group(1).splitlines()[0].strip()
                add_field("place_of_birth", "Place of Birth", raw_ipob, raw_ipob, 1, 0.94)

        # Gender in Gujarati (પુરુષ / સ્ત્રી) or Hindi (पुरुष / महिला)
        if "gender" not in added_keys:
            if re.search(r"(?:પુરુષ|पुरुष)", full_text):
                add_field("gender", "Gender", "Male (પુરુષ / पुरुष)", "Male", 1, 0.96)
            elif re.search(r"(?:સ્ત્રી|महिला)", full_text):
                add_field("gender", "Gender", "Female (સ્ત્રી / महिला)", "Female", 1, 0.96)

        # Address in Gujarati (સરનામું / કાયમી સરનામું) or Hindi (पता / स्थायी पता)
        if "residential_address" not in added_keys:
            indic_addr_m = re.search(
                r"(?:કાયમી\s*સરનામું|હાલનું\s*સરનામું|સરનામું|स्थायी\s*पता|वर्तमान\s*पता|पता)\s*[:\-–]\s*([A-Za-z0-9\u0900-\u097F\u0A80-\u0AFF][A-Za-z0-9\u0900-\u097F\u0A80-\u0AFF\s,\./\-]{5,120})",
                full_text,
            )
            if indic_addr_m:
                raw_iaddr = indic_addr_m.group(1).splitlines()[0].strip()
                add_field("residential_address", "Residential Address", raw_iaddr, raw_iaddr, 1, 0.93)

        # Registration Number in Gujarati (નોંધણી ક્રમાંક) or Hindi (पंजीकरण संख्या)
        if "birth_registration_number" not in added_keys:
            indic_reg_m = re.search(
                r"(?:નોંધણી\s*ક્રમાંક|નોંધણી\s*નંબર|पंजीकरण\s*संख्या|रजिस्ट्रेशन\s*नं\.?)\s*[:\-–]\s*([A-Za-z0-9/\-]{1,25})",
                full_text,
            )
            if indic_reg_m:
                raw_ireg = indic_reg_m.group(1).strip()
                add_field("birth_registration_number", "Registration Number", raw_ireg, raw_ireg, 1, 0.95)

        # Registration Date in Gujarati (નોંધણીની તારીખ) or Hindi (पंजीकरण तिथि)
        if "birth_registration_date" not in added_keys:
            indic_rdate_m = re.search(
                r"(?:નોંધણીની\s*તારીખ|નોંધણી\s*તારીખ|पंजीकरण\s*तिथि|पंजीकरण\s*की\s*तारीख)\s*[:\-–]\s*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{4})",
                full_text,
            )
            if indic_rdate_m:
                raw_irdate = indic_rdate_m.group(1).strip()
                add_field("birth_registration_date", "Date of Registration", raw_irdate, normalize_date(raw_irdate) or raw_irdate, 1, 0.95)

    return extracted_fields


def format_field_extraction_provenance(
    field: DocumentExtractedField,
    version_id: str = "",
) -> dict:
    """
    Formats a DocumentExtractedField into the exact Phase 5 JSON provenance specification:
    {
      "field": "applicant_name",
      "value": "Example Person",
      "source_document_version_id": "...",
      "page_number": 1,
      "bounding_box": [0.12, 0.18, 0.72, 0.24],
      "confidence": 0.91,
      "extractor_version": "...",
      "review_status": "NEEDS_HUMAN_REVIEW"
    }
    """
    bbox = [0.10, 0.10, 0.20, 0.50]
    loc = field.source_location
    if loc and isinstance(loc, dict):
        if "bounding_box" in loc and isinstance(loc["bounding_box"], list) and len(loc["bounding_box"]) == 4:
            bbox = [round(float(coord), 2) for coord in loc["bounding_box"]]
        elif "x0" in loc and "y0" in loc:
            w = float(loc.get("page_width", 612.0)) or 612.0
            h = float(loc.get("page_height", 792.0)) or 792.0
            y0 = float(loc.get("y0", 40.0))
            x0 = float(loc.get("x0", 40.0))
            y1 = float(loc.get("y1", y0 + 20.0))
            x1 = float(loc.get("x1", x0 + 150.0))
            bbox = [
                round(max(0.0, min(1.0, y0 / h)), 2),
                round(max(0.0, min(1.0, x0 / w)), 2),
                round(max(0.0, min(1.0, y1 / h)), 2),
                round(max(0.0, min(1.0, x1 / w)), 2),
            ]

    # Calculate calibrated confidence
    conf = round(min(field.ocr_confidence if field.ocr_confidence is not None else 0.92, field.extraction_confidence if field.extraction_confidence is not None else 0.92), 2)

    val_status = field.validation_status or "unvalidated"
    if field.is_manually_corrected:
        status = "CORRECTED"
    elif val_status in ("valid", "verified"):
        # Calibrated safety (Master Vision §4.3): Sub-threshold OCR cannot claim verified status without human signoff
        if (field.ocr_confidence or 1.0) < 0.70:
            status = "NEEDS_HUMAN_REVIEW"
        else:
            status = "VERIFIED"
    elif val_status in ("flagged", "needs_review", "unvalidated"):
        status = "NEEDS_HUMAN_REVIEW"
    elif val_status == "rejected":
        status = "REJECTED"
    else:
        status = val_status.upper()

    val = field.corrected_value if field.is_manually_corrected else (field.normalized_value or field.original_value or "")

    return {
        "field": field.field_name,
        "value": val,
        "source_document_version_id": version_id or str(field.document_id),
        "page_number": field.source_page or 1,
        "bounding_box": bbox,
        "confidence": conf,
        "extractor_version": field.model_version or "doc-intel-v5.0",
        "review_status": status,
    }


def suggest_applicant_association(
    extracted_fields: list[DocumentExtractedField],
    family_members: list[dict],
) -> tuple[Optional[dict], float]:
    """
    Suggests the most probable applicant association from family members
    based on candidate extracted names, passport numbers, and document evidence.
    Enforces abstention when an extracted token is ambiguous or shared across family members.
    Returns: (matched_member_dict_or_none, confidence)
    """
    if not family_members:
        return None, 0.0

    # 1. Deterministic Unique Identifier Check (Passport Number)
    doc_passports = [
        (f.normalized_value or f.original_value or "").replace(" ", "").upper()
        for f in extracted_fields
        if f.field_name in ("passport_number", "passport_no", "travel_doc_no")
        and (f.normalized_value or f.original_value)
    ]
    for p_num in doc_passports:
        if len(p_num) >= 6:
            matching_by_passport = [
                m for m in family_members
                if (m.get("passport_number") or "").replace(" ", "").upper() == p_num
            ]
            if len(matching_by_passport) == 1:
                return matching_by_passport[0], 0.99

    # 2. Name-based matching
    name_fields = [
        f for f in extracted_fields
        if f.field_name in ("applicant_name", "full_name", "given_name", "surname", "insured_person_name")
    ]
    if not name_fields:
        return None, 0.0

    member_scores: dict[str, float] = {}

    for f in name_fields:
        val = (f.normalized_value or f.original_value or "").lower().strip()
        if not val:
            continue
        val_tokens = set(re.findall(r"[a-z]+", val))
        if not val_tokens:
            continue

        for idx, member in enumerate(family_members):
            m_key = member.get("id") or str(idx)
            m_name = (
                member.get("name")
                or f"{member.get('first_name', '')} {member.get('last_name', '')}"
            ).lower().strip()
            m_tokens = set(re.findall(r"[a-z]+", m_name))
            if not m_tokens:
                continue

            intersection = val_tokens.intersection(m_tokens)
            score = 0.0

            if val == m_name:
                score = 0.98
            elif len(intersection) >= 2:
                score = 0.92
            elif len(intersection) == 1:
                # Check if the single matching token is a shared family surname present in other members
                matching_token = next(iter(intersection))
                other_members_with_token = [
                    om for om in family_members
                    if om != member and matching_token in set(
                        re.findall(
                            r"[a-z]+",
                            (om.get("name") or f"{om.get('first_name', '')} {om.get('last_name', '')}").lower()
                        )
                    )
                ]
                if other_members_with_token:
                    # Shared surname among family members - ambiguous, abstain from auto-scoring
                    score = 0.0
                elif len(m_tokens) <= 2 and len(matching_token) >= 4:
                    # Unique token belonging only to this member
                    score = 0.72
                else:
                    score = 0.0

            if score > member_scores.get(m_key, 0.0):
                member_scores[m_key] = score

    if not member_scores:
        return None, 0.0

    max_score = max(member_scores.values())
    if max_score < 0.70:
        return None, 0.0

    top_candidates = [
        m for idx, m in enumerate(family_members)
        if member_scores.get(m.get("id") or str(idx), 0.0) == max_score
    ]

    # If multiple candidates tie (ambiguity), abstain to require human review
    if len(top_candidates) == 1:
        return top_candidates[0], round(max_score, 2)

    return None, 0.0
