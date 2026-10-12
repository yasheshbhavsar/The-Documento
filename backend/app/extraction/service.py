import re
import uuid
from typing import Optional
from uuid import UUID

from backend.app.domain.models import DocumentExtractedField
from backend.app.extraction.normalizer import (
    normalize_country,
    normalize_currency_amount,
    normalize_date,
)
from backend.app.ocr.engine import PageExtractionResult


def _find_block_location(pages: list[PageExtractionResult], target_value: str, page_num: int) -> dict | None:
    """Finds bounding box location of target string within page blocks."""
    for page in pages:
        if page.page_number == page_num:
            for b in page.blocks:
                if target_value.lower() in b.text.lower():
                    return {
                        "x0": round(b.x0, 2),
                        "y0": round(b.y0, 2),
                        "x1": round(b.x1, 2),
                        "y1": round(b.y1, 2),
                        "block_idx": b.block_idx,
                    }
    return None


def extract_structured_fields(
    document_id: UUID,
    organization_id: UUID,
    category: str,
    pages: list[PageExtractionResult],
) -> list[DocumentExtractedField]:
    """
    Extracts category-specific structured fields with strict data provenance:
    - Source document, page, and bounding box coordinates
    - Original unadulterated value vs. normalized ISO value
    - Extraction method and model version
    - Separate OCR confidence and extraction confidence scores
    - Initial unvalidated status
    """
    extracted_fields: list[DocumentExtractedField] = []
    if not pages:
        return extracted_fields

    full_text = "\n\n".join([f"--- PAGE {p.page_number} ---\n{p.text}" for p in pages])
    default_page = pages[0].page_number
    ocr_confidence = pages[0].ocr_confidence
    default_method = "ocr_pattern_matcher" if pages[0].ocr_applied else "native_pdf_layout"

    def add_field(
        field_name: str,
        field_label: str,
        original_value: str,
        normalized_value: Optional[str] = None,
        source_page: int = default_page,
        extraction_confidence: float = 0.95,
        location: Optional[dict] = None,
    ):
        if not original_value or not original_value.strip():
            return

        clean_orig = original_value.strip()
        loc = location or _find_block_location(pages, clean_orig, source_page)

        field = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=organization_id,
            document_id=document_id,
            field_name=field_name,
            field_label=field_label,
            original_value=clean_orig,
            normalized_value=normalized_value or clean_orig,
            source_page=source_page,
            source_location=loc,
            extraction_method=default_method,
            model_version="immigration-ner-v2.4",
            ocr_confidence=ocr_confidence,
            extraction_confidence=extraction_confidence,
            validation_status="unvalidated",
            is_manually_corrected=False,
            correction_history=[],
        )
        extracted_fields.append(field)

    # 1. PASSPORT & IDENTITY EXTRACTION
    if category in ("identity_passport", "supporting_evidence"):
        # MRZ Line detection
        mrz_match = re.search(r"P<([A-Z]{3})([A-Z0-9<]+)\n([A-Z0-9]{9})[0-9]([A-Z]{3})([0-9]{6})[0-9]([MF<])([0-9]{6})", full_text)
        if mrz_match:
            issuing_country = mrz_match.group(1)
            raw_name = mrz_match.group(2).replace("<", " ").strip()
            passport_num = mrz_match.group(3).replace("<", "")
            nat = mrz_match.group(4)
            dob_raw = mrz_match.group(5)
            exp_raw = mrz_match.group(7)

            add_field("mrz_code", "Machine Readable Zone (MRZ)", mrz_match.group(0), mrz_match.group(0), 1, 0.99)
            add_field("passport_number", "Passport Number", passport_num, passport_num.upper(), 1, 0.99)
            add_field("full_name", "Full Name", raw_name, raw_name.title(), 1, 0.95)
            add_field("nationality", "Nationality", nat, normalize_country(nat), 1, 0.98)
            add_field("issuing_country", "Issuing Country", issuing_country, normalize_country(issuing_country), 1, 0.98)
            add_field("date_of_birth", "Date of Birth", dob_raw, normalize_date(dob_raw), 1, 0.96)
            add_field("expiry_date", "Date of Expiration", exp_raw, normalize_date(exp_raw), 1, 0.96)
        else:
            # Key-value pattern fallbacks
            p_num = re.search(r"(?:Passport\s*(?:No\.?|Number)|Document\s*No\.?)[\s:]+([A-Z0-9]{6,12})", full_text, re.IGNORECASE)
            if p_num:
                add_field("passport_number", "Passport Number", p_num.group(1), p_num.group(1).upper(), 1, 0.92)

            name_m = re.search(r"(?:Name|Full Name|Surname\s*and\s*Given\s*Names|Nom|Apellidos)[\s:]+([A-Za-z\s\.-]{3,50})", full_text, re.IGNORECASE)
            if name_m:
                add_field("full_name", "Full Name", name_m.group(1).strip(), name_m.group(1).strip().title(), 1, 0.88)

            dob_m = re.search(r"(?:Date of Birth|Birth Date|DOB|Date de naissance)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})", full_text, re.IGNORECASE)
            if dob_m:
                add_field("date_of_birth", "Date of Birth", dob_m.group(1).strip(), normalize_date(dob_m.group(1).strip()), 1, 0.90)

            nat_m = re.search(r"(?:Nationality|Nationalité|Nacionalidad)[\s:]+([A-Za-z\s]{3,30})", full_text, re.IGNORECASE)
            if nat_m:
                add_field("nationality", "Nationality", nat_m.group(1).strip(), normalize_country(nat_m.group(1).strip()), 1, 0.88)

            exp_m = re.search(r"(?:Date of Expir(?:y|ation)|Expiration Date)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})", full_text, re.IGNORECASE)
            if exp_m:
                add_field("expiry_date", "Date of Expiration", exp_m.group(1).strip(), normalize_date(exp_m.group(1).strip()), 1, 0.90)

    # 2. EDUCATIONAL RECORDS EXTRACTION
    if category in ("educational_records", "supporting_evidence"):
        deg_m = re.search(r"(?:Degree|Diploma|Title of)\s*[:\n]\s*([A-Za-z\s\.-]{5,60}(?:Science|Arts|Engineering|Philosophy|Doctorate|Master|Bachelor)[A-Za-z\s\.-]*)", full_text, re.IGNORECASE)
        if not deg_m:
            deg_m = re.search(r"\b(Doctor of Philosophy|Master of Science|Bachelor of Science|Ph\.?D\.?|Bachelor of Arts)\b", full_text, re.IGNORECASE)
        if deg_m:
            add_field("degree_title", "Conferred Degree Title", deg_m.group(1).strip(), deg_m.group(1).strip().title(), 1, 0.94)

        inst_m = re.search(r"\b([A-Za-z][A-Za-z\s\.-]+(?:University|Institute of Technology|College|Polytechnic|Academy))", full_text, re.IGNORECASE)
        if inst_m:
            raw_inst = inst_m.group(1).strip()
            add_field("institution_name", "Academic Institution", raw_inst, raw_inst.title(), 1, 0.92)

        gpa_m = re.search(r"(?:GPA|Grade Point Average|Cumulative GPA)[\s:]+([0-4]\.[0-9]{1,2}(?:\s*/\s*4\.00?)?)", full_text, re.IGNORECASE)
        if gpa_m:
            add_field("gpa", "Grade Point Average (GPA)", gpa_m.group(1).strip(), gpa_m.group(1).strip(), 1, 0.95)

        grad_m = re.search(r"(?:Conferred on|Date of Graduation|Graduated|Conferral Date)[\s:]+([A-Za-z0-9\s,\.-]{6,30})", full_text, re.IGNORECASE)
        if grad_m:
            add_field("graduation_date", "Graduation / Conferral Date", grad_m.group(1).strip(), normalize_date(grad_m.group(1).strip()), 1, 0.90)

    # 3. EMPLOYMENT RECORDS EXTRACTION
    if category in ("employment_records", "supporting_evidence"):
        emp_m = re.search(r"(?:Employer|Company|Organization Name)[\s:]+([A-Za-z0-9\s,\.-]{3,60}(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Technologies|AI|Systems)?)", full_text, re.IGNORECASE)
        if emp_m:
            add_field("employer_name", "Employer / Company Name", emp_m.group(1).strip(), emp_m.group(1).strip().title(), 1, 0.92)

        title_m = re.search(r"(?:Job Title|Position Title|Role|Designation)[\s:]+([A-Za-z\s\.-]{3,50})", full_text, re.IGNORECASE)
        if title_m:
            add_field("job_title", "Job Title / Professional Role", title_m.group(1).strip(), title_m.group(1).strip().title(), 1, 0.93)

        sal_m = re.search(r"(?:Salary|Annual (?:Base )?Compensation|Base Pay)[\s:]+(\$?[0-9,]+(?:\.[0-9]{2})?(?:\s*(?:USD|per year|annually))?)", full_text, re.IGNORECASE)
        if sal_m:
            add_field("annual_salary", "Annual Compensation", sal_m.group(1).strip(), normalize_currency_amount(sal_m.group(1).strip()), 1, 0.94)

        start_m = re.search(r"(?:Start Date|Hire Date|Employment Commenced)[\s:]+([^\r\n]{6,30})", full_text, re.IGNORECASE)
        if start_m:
            raw_start = start_m.group(1).strip().split("\n")[0].strip()
            add_field("employment_start_date", "Employment Start Date", raw_start, normalize_date(raw_start) or raw_start, 1, 0.90)

    # 4. FINANCIAL EVIDENCE EXTRACTION
    if category in ("financial_evidence", "supporting_evidence"):
        bank_m = re.search(r"\b([A-Za-z][A-Za-z\s\.-]+(?:Bank|Credit Union|Federal Bank|Financial|Bancorp))", full_text, re.IGNORECASE)
        if bank_m:
            raw_bank = bank_m.group(1).strip()
            add_field("financial_institution", "Financial Institution", raw_bank, raw_bank.title(), 1, 0.92)

        bal_m = re.search(r"(?:Closing Balance|Ending Balance|Total Balance|Available Funds)[\s:]+(\$?[0-9,]+(?:\.[0-9]{2})?(?:\s*[A-Z]{3})?)", full_text, re.IGNORECASE)
        if bal_m:
            add_field("closing_balance", "Closing Balance", bal_m.group(1).strip(), normalize_currency_amount(bal_m.group(1).strip()), 1, 0.95)

        acc_m = re.search(r"(?:Account (?:Number|No\.?)|Account ending in)[\s:]+([X\*\d-]{4,20})", full_text, re.IGNORECASE)
        if acc_m:
            add_field("account_number_masked", "Account Number (Masked)", acc_m.group(1).strip(), acc_m.group(1).strip(), 1, 0.92)

        stmt_m = re.search(r"(?:Statement Date|Period Ending|Statement Period)[\s:]+([A-Za-z0-9\s,\.-]{6,30})", full_text, re.IGNORECASE)
        if stmt_m:
            add_field("statement_date", "Statement Date", stmt_m.group(1).strip(), normalize_date(stmt_m.group(1).strip()), 1, 0.88)

    # 5. VISAS & RESIDENCE PERMITS
    if category in ("visas_residence_permits", "supporting_evidence"):
        visa_num_m = re.search(r"(?:Visa Number|Control Number|Control No\.?)[\s:]+([A-Z0-9]{8,12})", full_text, re.IGNORECASE)
        if visa_num_m:
            add_field("visa_number", "Visa Foil Control Number", visa_num_m.group(1).strip(), visa_num_m.group(1).strip().upper(), 1, 0.95)

        class_m = re.search(r"(?:Visa (?:Type|Class)|Class)[\s:]+([A-Z0-9-]{1,8})", full_text, re.IGNORECASE)
        if class_m:
            add_field("visa_class", "Visa Classification", class_m.group(1).strip(), class_m.group(1).strip().upper(), 1, 0.92)

    # 6. GOVERNMENT CORRESPONDENCE EXTRACTION
    if category in ("government_correspondence", "supporting_evidence"):
        rec_m = re.search(r"\b([A-Z]{3}[0-9]{10})\b", full_text)  # e.g. LIN2490018822, WAC23...
        if rec_m:
            add_field("receipt_number", "USCIS Receipt Number", rec_m.group(1), rec_m.group(1).upper(), 1, 0.98)

        notice_m = re.search(r"\b(Form I-797[A-E]?|Notice of Action|Receipt Notice|Approval Notice)\b", full_text, re.IGNORECASE)
        if notice_m:
            add_field("notice_type", "Government Notice Type", notice_m.group(1).strip(), notice_m.group(1).strip().upper(), 1, 0.95)

    return extracted_fields
