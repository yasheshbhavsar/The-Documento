"""Standalone Document Information and Recognition Extractor API.

Completely public / unauthenticated endpoint to test, explore, and audit
the platform's OCR engine, Document Classification, Entity Extraction,
Evidence Quality Auditing, and specialized Identity/Financial Intelligence.
"""
from __future__ import annotations

import base64
import hashlib
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.app.documents.security import MAX_ALLOWED_FILE_SIZE

from backend.app.ai.checklist_engine import audit_case_checklist
from backend.app.ai.document_intelligence import evaluate_role_aware_consistency
from backend.app.ai.financial_parser import FinancialIntelligenceEngine
from backend.app.ai.identity_resolver import IdentityResolver
from backend.app.ai.quality_detector import detect_document_quality_issues
from backend.app.ai.sponsor_intelligence import SponsorIntelligenceEngine
from backend.app.extraction.classifier import CATEGORY_RULES, classify_document
from backend.app.extraction.service import (
    extract_structured_fields,
    format_field_extraction_provenance,
)
from backend.app.ocr.engine import (
    OCREngine,
    PageBlock,
    PageExtractionResult,
    clean_ocr_text,
    detect_language,
    evaluate_handwriting_profile,
    evaluate_language_compliance,
    has_meaningful_script_chars,
)

try:
    from backend.app.ocr.barcode_decoder import decode_document_barcodes as _decode_document_barcodes
except ImportError:
    _decode_document_barcodes = None


def _safe_decode_barcodes(content: bytes, mime_type: str, max_pages: int = 10) -> list[dict[str, Any]]:
    """Safely decodes 1D/2D/QR barcodes using local barcode_decoder if available."""
    if _decode_document_barcodes is None or not content or mime_type == "text/plain":
        return []
    try:
        return _decode_document_barcodes(content, mime_type=mime_type, max_pages=max_pages)
    except Exception:
        return []


def _render_pdf_thumbnails_single_open(
    document_bytes: bytes, mime_type: str, max_pages: int = 20
) -> dict[int, str]:
    """Renders page thumbnails reusing a single PyMuPDF open handle."""
    page_images: dict[int, str] = {}
    if not document_bytes:
        return page_images
    try:
        import fitz

        if mime_type == "application/pdf" or document_bytes.startswith(b"%PDF"):
            mat = fitz.Matrix(1.6, 1.6)
            with fitz.open(stream=document_bytes, filetype="pdf") as pdf_doc:
                limit = min(len(pdf_doc), max_pages)
                for idx in range(limit):
                    pix = pdf_doc[idx].get_pixmap(matrix=mat, alpha=False)
                    img_b64 = base64.b64encode(pix.tobytes("jpeg", jpg_quality=85)).decode("ascii")
                    page_images[idx + 1] = f"data:image/jpeg;base64,{img_b64}"
        elif mime_type.startswith("image/"):
            img_b64 = base64.b64encode(document_bytes).decode("ascii")
            page_images[1] = f"data:{mime_type};base64,{img_b64}"
    except Exception:
        pass
    return page_images

router = APIRouter(prefix="/extractor", tags=["extractor"])


class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., description="Raw text of the document to recognize and extract")
    filename: Optional[str] = Field("sample_document.txt", description="Optional filename to assist classification")
    declared_category: Optional[str] = Field(None, description="Optional declared category")


class ExtractorSample(BaseModel):
    id: str
    title: str
    category: str
    filename: str
    description: str
    text_content: str


# 6 Realistic Immigration Test Documents
SAMPLE_DOCUMENTS: list[dict[str, str]] = []

@router.get("/samples", response_model=list[ExtractorSample])
def get_extractor_samples() -> list[dict[str, str]]:
    """Returns pre-configured immigration test documents for 1-click exploration."""
    return SAMPLE_DOCUMENTS


@router.post("/analyze")
async def analyze_document_standalone(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    declared_category: Optional[str] = Form(None),
    include_page_images: bool = Form(True),
) -> dict[str, Any]:
    """
    Public, unauthenticated standalone document recognition and information extractor.
    Accepts either an uploaded file (PDF, PNG, JPG, WEBP, TIFF) or raw text.
    Runs:
    1. OCREngine (PDF vector layout, RapidOCR, rotation correction, block coordinates)
    2. Document Classification (taxonomy recognition, confidence, keyword hits)
    3. Structured Field Extraction (normalized ISO values, bounding boxes, provenances)
    4. Evidence Quality Inspection (missing pagination, blur/faded scan, expiration checks)
    5. Specialized Financial, Identity, Barcode & Sponsor Statutory Intelligence
    """
    document_bytes: bytes = b""
    clean_filename = filename if isinstance(filename, str) and filename.strip() else None
    clean_raw_text = raw_text if isinstance(raw_text, str) and raw_text.strip() else None
    clean_declared_cat = declared_category if isinstance(declared_category, str) and declared_category.strip() else None
    should_render_images = include_page_images if isinstance(include_page_images, bool) else True

    content_filename: str = clean_filename or "document.txt"
    mime_type: str = "text/plain"

    if file is not None and hasattr(file, "filename") and file.filename:
        content_filename = clean_filename or file.filename
        chunk_size = 1024 * 1024  # 1MB
        doc_bytes_acc = bytearray()
        while chunk := await file.read(chunk_size):
            doc_bytes_acc.extend(chunk)
            if len(doc_bytes_acc) > MAX_ALLOWED_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Uploaded file exceeds maximum limit of {MAX_ALLOWED_FILE_SIZE // (1024 * 1024)}MB.",
                )
        document_bytes = bytes(doc_bytes_acc)
        mime_type = file.content_type or "application/octet-stream"
    elif clean_raw_text:
        document_bytes = clean_raw_text.encode("utf-8")
        mime_type = "text/plain"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an uploaded 'file' or 'raw_text' must be provided for extraction.",
        )

    file_size_bytes = len(document_bytes)
    sha256_hash = hashlib.sha256(document_bytes).hexdigest()

    # 1. OCR Extraction & Geometries
    pages: list[PageExtractionResult] = []
    if mime_type == "text/plain" or (mime_type == "application/octet-stream" and not document_bytes.startswith(b"%PDF")):
        # Pure text input - filter strictly to English, Gujarati, and Hindi characters and strip dotted leader lines
        raw_text_str = document_bytes.decode("utf-8", errors="replace")
        text_str = clean_ocr_text(raw_text_str)
        blocks: list[PageBlock] = []
        for idx, line in enumerate(text_str.splitlines()):
            line_clean = clean_ocr_text(line.strip())
            if line_clean and has_meaningful_script_chars(line_clean):
                blocks.append(
                    PageBlock(
                        x0=50.0,
                        y0=40.0 + (idx * 22.0),
                        x1=550.0,
                        y1=58.0 + (idx * 22.0),
                        text=line_clean,
                        confidence=0.99,
                        block_idx=idx,
                    )
                )
        pages = [
            PageExtractionResult(
                page_number=1,
                text=text_str,
                ocr_applied=False,
                ocr_confidence=0.99,
                blocks=blocks,
                width=612.0,
                height=max(792.0, 60.0 + (len(blocks) * 22.0)),
                detected_rotation=0,
                is_rotation_corrected=False,
                raw_unfiltered_text=raw_text_str,
            )
        ]
    else:
        # PDF or Image byte payload - run CPU-bound OCR in threadpool (C1)
        try:
            pages = await run_in_threadpool(OCREngine.extract_document, document_bytes, mime_type=mime_type)
        except Exception:
            # Fallback text representation
            text_str = document_bytes.decode("latin1", errors="ignore")
            pages = [
                PageExtractionResult(
                    page_number=1,
                    text=text_str,
                    ocr_applied=True,
                    ocr_confidence=0.85,
                    blocks=[],
                    width=612.0,
                    height=792.0,
                    detected_rotation=0,
                    is_rotation_corrected=False,
                    raw_unfiltered_text=text_str,
                )
            ]

    full_extracted_text = "\n\n".join([f"--- PAGE {p.page_number} ---\n{p.text}" for p in pages]).strip()
    full_raw_unfiltered_text = "\n\n".join([p.raw_unfiltered_text or p.text for p in pages]).strip()
    lang_compliance = evaluate_language_compliance(
        text=full_extracted_text,
        raw_unfiltered_text=full_raw_unfiltered_text,
        filename=content_filename,
    )
    detected_lang = lang_compliance["detected_language"]

    # 2. Document Classification
    try:
        recognized_category, category_confidence = classify_document(
            full_extracted_text, filename=content_filename, declared_category=clean_declared_cat
        )
    except Exception:
        recognized_category, category_confidence = clean_declared_cat or "supporting_evidence", 0.75

    # Match category details
    category_label = recognized_category.replace("_", " ").title()
    matched_rule = next((r for r in CATEGORY_RULES if r.get("category") == recognized_category), None)
    if matched_rule:
        category_label = matched_rule.get("label", category_label)

    # Find matched keyword highlights
    matched_keywords: list[str] = []
    if matched_rule:
        for pat in matched_rule.get("patterns", []):
            import re
            try:
                m = re.findall(pat, full_extracted_text, re.IGNORECASE)
                if m:
                    matched_keywords.extend([str(item) for item in m[:2]])
            except Exception:
                pass
    matched_keywords = list(dict.fromkeys(matched_keywords))[:8]

    # 3. Structured Field Extraction
    dummy_doc_id = uuid.uuid4()
    dummy_org_id = uuid.uuid4()
    try:
        extracted_fields = extract_structured_fields(
            document_id=dummy_doc_id,
            organization_id=dummy_org_id,
            category=recognized_category,
            pages=pages,
            document_bytes=document_bytes,
            mime_type=mime_type,
            filename=content_filename,
        )
    except Exception:
        extracted_fields = []

    # Format fields into provenances and structured response (deduplicated by field_name)
    formatted_fields: list[dict[str, Any]] = []
    seen_field_names: set[str] = set()
    for field in extracted_fields:
        try:
            if field.field_name in seen_field_names:
                continue
            seen_field_names.add(field.field_name)
            prov = format_field_extraction_provenance(field)
            formatted_fields.append({
                "field_name": field.field_name,
                "field_label": field.field_label or field.field_name.replace("_", " ").title(),
                "original_value": field.original_value,
                "normalized_value": field.normalized_value or field.original_value,
                "source_page": field.source_page or 1,
                "ocr_confidence": field.ocr_confidence,
                "extraction_confidence": field.extraction_confidence,
                "calibrated_confidence": prov.get("confidence", 0.90),
                "extraction_method": field.extraction_method or "native_pdf_layout",
                "model_version": field.model_version or "doc-intel-v5.0",
                "bounding_box": prov.get("bounding_box", [0.1, 0.1, 0.2, 0.5]),
                "source_location": field.source_location,
                "review_status": prov.get("review_status", "NEEDS_HUMAN_REVIEW"),
            })
        except Exception:
            pass

    # 4. Evidence Quality Inspection
    field_dicts_for_quality = [
        {"field_name": f["field_name"], "ocr_confidence": f["ocr_confidence"], "field_label": f["field_label"]}
        for f in formatted_fields
    ]
    try:
        raw_findings = detect_document_quality_issues(
            document_id=str(dummy_doc_id),
            title=content_filename,
            category=recognized_category,
            page_count=len(pages),
            extracted_text=full_extracted_text,
            extracted_fields=field_dicts_for_quality,
            ocr_applied=any(p.ocr_applied for p in pages),
            raw_unfiltered_text=full_raw_unfiltered_text,
            language_compliance=lang_compliance,
        )
    except Exception:
        raw_findings = []

    quality_findings: list[dict[str, Any]] = []
    for qf in raw_findings:
        quality_findings.append({
            "finding_type": qf.finding_type,
            "severity": qf.severity,
            "title": qf.title,
            "description": qf.description,
            "evidence_text": qf.evidence_text,
            "page_number": qf.page_number,
            "recommended_action": qf.recommended_action,
            "uncertainty_limitations": qf.uncertainty_limitations,
            "suggested_clarification": qf.suggested_clarification,
        })

    # 5. Specialized AI & Forensics
    handwriting_profile = evaluate_handwriting_profile(pages, formatted_fields)
    specialized_intelligence: dict[str, Any] = {
        "language_compliance": lang_compliance,
        "handwriting_recognition": handwriting_profile,
    }

    # Financial analysis
    if (
        recognized_category == "financial_evidence"
        or "statement" in content_filename.lower()
        or (
            "bank" in full_extracted_text.lower()
            and "personal information bank" not in full_extracted_text.lower()
            and recognized_category not in ("civil_status_family", "government_correspondence", "identity_passport", "police_medical")
        )
    ):
        try:
            bank_sum = FinancialIntelligenceEngine.parse_bank_statement_text(full_extracted_text)
            if (
                recognized_category == "financial_evidence"
                or bank_sum.opening_balance > 0
                or bank_sum.closing_balance > 0
                or bank_sum.suspicious_lump_sums
            ):
                specialized_intelligence["financial_forensics"] = {
                    "institution": bank_sum.financial_institution,
                    "account_number_masked": bank_sum.account_number_masked,
                    "statement_period": f"{bank_sum.statement_period_start or 'N/A'} - {bank_sum.statement_period_end or 'N/A'}",
                    "opening_balance": bank_sum.opening_balance,
                    "closing_balance": bank_sum.closing_balance,
                    "minimum_balance_observed": bank_sum.minimum_balance_observed,
                    "average_monthly_credits": bank_sum.average_monthly_credits,
                    "currency": bank_sum.currency,
                    "suspicious_lump_sums": [
                        {
                            "date": t.transaction_date,
                            "description": t.description,
                            "amount": t.amount,
                            "type": t.transaction_type,
                            "is_suspicious": t.is_suspicious_lump_sum,
                        }
                        for t in bank_sum.suspicious_lump_sums
                    ],
                    "risk_findings": bank_sum.risk_findings,
                }
        except Exception:
            pass

    if any(k in full_extracted_text.lower() for k in ("income tax return", "itr-v", "assessment year", "acknowledgement number")):
        try:
            itr_data = FinancialIntelligenceEngine.parse_itr_v(full_extracted_text)
            if itr_data:
                if isinstance(itr_data, dict):
                    if itr_data.get("is_itr_v"):
                        specialized_intelligence["itr_verification"] = itr_data
                else:
                    specialized_intelligence["itr_verification"] = {
                        "is_itr_v": True,
                        "assessment_year": getattr(itr_data, "assessment_year", None),
                        "acknowledgement_number": getattr(itr_data, "acknowledgement_number", None),
                        "pan_number": getattr(itr_data, "pan_number", None),
                        "taxpayer_name": getattr(itr_data, "taxpayer_name", None),
                        "gross_total_income": getattr(itr_data, "gross_total_income", 0.0),
                        "total_tax_payable": getattr(itr_data, "total_tax_payable", 0.0),
                        "verification_status": getattr(itr_data, "verification_status", None),
                    }
        except Exception:
            pass

    # Resume & Career Intelligence analysis
    is_resume_doc = (
        recognized_category == "employment_records"
        or "resume" in content_filename.lower()
        or "cv" in content_filename.lower()
        or any(k in full_extracted_text.lower() for k in ("resume", "curriculum vitae", "technical skills", "professional summary"))
    )
    if is_resume_doc:
        cand_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("applicant_name", "full_name")), None)
        email_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "email_address"), None)
        phone_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "phone_number"), None)
        role_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "job_title"), None)
        emp_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "employer_name"), None)
        li_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "linkedin_profile"), None)
        gh_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "github_profile"), None)
        loc_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "candidate_location"), None)
        skills_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "technical_skills"), None)
        deg_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "degree_title"), None)
        inst_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "institution_name"), None)
        years_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "years_of_experience"), None)
        lang_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "candidate_languages"), None)

        if any((cand_name, email_val, role_val, li_val, gh_val, skills_val)):
            edu_str = None
            if deg_val and inst_val:
                edu_str = f"{deg_val} | {inst_val}"
            elif deg_val or inst_val:
                edu_str = deg_val or inst_val

            specialized_intelligence["resume_intelligence"] = {
                "candidate_name": cand_name,
                "current_role": role_val,
                "employer": emp_val,
                "email": email_val,
                "phone": phone_val,
                "location": loc_val,
                "linkedin": li_val,
                "github": gh_val,
                "skills": skills_val,
                "education": edu_str,
                "languages": lang_val,
                "years_experience": years_val,
            }

    # Identity normalization analysis
    is_identity_doc = (
        recognized_category == "identity_passport"
        or any(k in full_extracted_text.lower() for k in ("passport", "aadhaar", "pan", "income tax", "uidai", "driving licence", "driver license", "voter id", "election commission", "epic"))
    )
    if is_identity_doc:
        try:
            ident_dict: dict[str, Any] = {}
            # Passport & MRZ checks
            ind_pass = IdentityResolver.parse_indian_passport(full_extracted_text)
            if ind_pass:
                ident_dict["indian_passport"] = {
                    "passport_number": ind_pass.passport_number,
                    "holder_name": ind_pass.holder_name,
                    "surname": ind_pass.surname,
                    "given_names": ind_pass.given_names,
                    "date_of_birth": ind_pass.date_of_birth,
                    "gender": ind_pass.gender,
                    "place_of_birth": ind_pass.place_of_birth,
                    "place_of_issue": ind_pass.place_of_issue,
                    "date_of_issue": ind_pass.date_of_issue,
                    "date_of_expiry": ind_pass.date_of_expiry,
                    "emigration_check_status": ind_pass.emigration_check,
                    "file_number": ind_pass.file_number,
                    "booklet_type": ind_pass.booklet_type,
                    "father_name": ind_pass.father_name,
                    "mother_name": ind_pass.mother_name,
                    "spouse_name": ind_pass.spouse_name,
                    "address": ind_pass.address,
                    "pin_code": ind_pass.pin_code,
                    "nationality": ind_pass.nationality,
                    "mrz_detected": ind_pass.mrz_detected,
                    "raw_mrz": ind_pass.raw_mrz,
                }

            first_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("given_names", "given_name", "first_name")), None)
            if not first_name and ind_pass and ind_pass.given_names:
                first_name = ind_pass.given_names

            last_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("surname", "last_name")), None)
            if not last_name and ind_pass and ind_pass.surname:
                last_name = ind_pass.surname

            if first_name or last_name:
                single_name_res = IdentityResolver.resolve_single_name(first_name, last_name)
                ident_dict["single_name_resolution"] = {
                    "is_single_name": single_name_res.is_single_name,
                    "uscis_representation": f"Surname: {single_name_res.uscis_surname}, Given Name: {single_name_res.uscis_first_name}",
                    "ircc_representation": f"Surname: {single_name_res.ircc_surname}, Given Name: '{single_name_res.ircc_given_name}'",
                    "ukvi_representation": f"Family Name: {single_name_res.ukvi_family_name}, Given Name: '{single_name_res.ukvi_given_name}'",
                    "guidance": single_name_res.guidance_notes,
                }

            aadhaar_res = IdentityResolver.parse_aadhaar(full_extracted_text)
            if aadhaar_res:
                ident_dict["aadhaar"] = {
                    "is_valid": aadhaar_res.is_valid,
                    "masked_number": aadhaar_res.masked_aadhaar_number,
                    "holder_name": aadhaar_res.holder_name,
                    "dob": aadhaar_res.date_of_birth,
                    "gender": aadhaar_res.gender,
                    "father_or_spouse": aadhaar_res.father_or_spouse_name,
                }

            pan_res = IdentityResolver.parse_pan(full_extracted_text)
            if pan_res:
                ident_dict["pan"] = {
                    "is_valid": pan_res.is_valid,
                    "pan_number": pan_res.pan_number,
                    "entity_type": pan_res.entity_type,
                    "holder_name": pan_res.holder_name,
                    "fifth_char_surname_match": pan_res.fifth_char_surname_match,
                }

            dl_res = IdentityResolver.parse_driving_licence(full_extracted_text)
            if dl_res:
                ident_dict["driving_licence"] = {
                    "is_valid": dl_res.is_valid,
                    "licence_number": dl_res.licence_number,
                    "jurisdiction": dl_res.jurisdiction,
                    "holder_name": dl_res.holder_name,
                    "expiry_date": dl_res.expiry_date,
                    "vehicle_class": dl_res.vehicle_class,
                }

            voter_res = IdentityResolver.parse_voter_id(full_extracted_text)
            if voter_res:
                ident_dict["voter_id"] = {
                    "is_valid": voter_res.is_valid,
                    "epic_number": voter_res.epic_number,
                    "elector_name": voter_res.elector_name,
                    "relative_name": voter_res.relative_name,
                }

            if ident_dict:
                specialized_intelligence["identity_compliance"] = ident_dict
        except Exception:
            pass

    # 6. Barcode Decoding + Role Attribution & Sponsor Statutory Intelligence
    decoded_barcodes: list[dict[str, Any]] = []
    if file is not None and document_bytes and mime_type != "text/plain":
        decoded_barcodes = await run_in_threadpool(_safe_decode_barcodes, document_bytes, mime_type)
    specialized_intelligence["barcodes"] = decoded_barcodes

    try:
        single_doc_payload = {
            "id": str(dummy_doc_id),
            "title": content_filename,
            "filename": content_filename,
            "category": recognized_category,
            "extracted_text": full_extracted_text,
            "extracted_fields": formatted_fields,
            "barcodes": decoded_barcodes,
        }
        specialized_intelligence["role_attribution"] = SponsorIntelligenceEngine.infer_role_for_document(
            single_doc_payload
        )
        specialized_intelligence["sponsor_statutory_intelligence"] = (
            SponsorIntelligenceEngine.evaluate_packet_or_case_intelligence([single_doc_payload])
        )
    except Exception:
        specialized_intelligence["role_attribution"] = {
            "person_role": "principal_applicant",
            "role_label": "Principal Applicant",
            "confidence": 0.85,
            "holder_name": None,
            "association_note": "Attributed to Principal Applicant",
        }
        specialized_intelligence["sponsor_statutory_intelligence"] = {}

    # Overall calculation of document health
    critical_issues = sum(1 for qf in quality_findings if qf["severity"] == "critical")
    major_issues = sum(1 for qf in quality_findings if qf["severity"] == "major")
    overall_health_score = max(20, round(100 - (critical_issues * 30) - (major_issues * 15)))

    # Geometries summary & rendered page previews for Spatial Canvas (reusing single PyMuPDF open)
    total_blocks = sum(len(p.blocks) for p in pages)
    page_images: dict[int, str] = {}
    if should_render_images and file is not None and document_bytes:
        page_images = await run_in_threadpool(_render_pdf_thumbnails_single_open, document_bytes, mime_type)

    return {
        "status": "success",
        "metadata": {
            "filename": content_filename,
            "mime_type": mime_type,
            "file_size_bytes": file_size_bytes,
            "sha256_hash": sha256_hash,
            "page_count": len(pages),
            "detected_language": detected_lang,
            "detected_language_label": lang_compliance.get("detected_language_label", detected_lang.upper()),
            "is_language_compliant": lang_compliance.get("is_compliant", True),
            "requires_caseworker_escalation": lang_compliance.get("requires_caseworker_escalation", False),
            "escalation_status": lang_compliance.get("escalation_status", "COMPLIANT"),
            "caseworker_action": lang_compliance.get("caseworker_action"),
            "client_outreach_template": lang_compliance.get("client_outreach_template"),
            "has_handwritten_content": handwriting_profile.get("has_handwritten_content", False),
            "handwriting_density": handwriting_profile.get("handwriting_density", "NONE"),
            "total_blocks_detected": total_blocks,
            "overall_health_score": overall_health_score,
        },
        "recognition": {
            "category": recognized_category,
            "category_label": category_label,
            "confidence": category_confidence,
            "matched_keywords": matched_keywords,
        },
        "extracted_fields": formatted_fields,
        "quality_findings": quality_findings,
        "specialized_intelligence": specialized_intelligence,
        "ocr_summary": {
            "ocr_applied": any(p.ocr_applied for p in pages),
            "avg_page_confidence": round(sum(p.ocr_confidence for p in pages) / max(len(pages), 1), 2),
            "pages": [
                {
                    "page_number": p.page_number,
                    "width": p.width,
                    "height": p.height,
                    "ocr_applied": p.ocr_applied,
                    "ocr_confidence": p.ocr_confidence,
                    "rotation_corrected": p.is_rotation_corrected,
                    "detected_rotation": p.detected_rotation,
                    "block_count": len(p.blocks),
                    "page_image_data_url": page_images.get(p.page_number),
                    "blocks": [
                        {
                            "block_idx": b.block_idx,
                            "text": b.text,
                            "confidence": round(b.confidence, 2),
                            "coordinates": [b.x0, b.y0, b.x1, b.y1],
                        }
                        for b in p.blocks[:35]  # up to 35 blocks per page for spatial canvas preview
                    ],
                }
                for p in pages
            ],
        },
        "raw_text_preview": full_extracted_text[:4000],
    }


@router.post("/analyze-text")
async def analyze_text_standalone(request: AnalyzeTextRequest) -> dict[str, Any]:
    """Convenience JSON endpoint to analyze and extract from text content directly."""
    return await analyze_document_standalone(
        file=None,
        raw_text=request.text,
        filename=request.filename,
        declared_category=request.declared_category,
    )


class DossierDocumentInput(BaseModel):
    title: str = Field(..., description="Document title or filename")
    text: str = Field(..., description="Document text content")
    declared_category: Optional[str] = None


class CompareDocumentSetRequest(BaseModel):
    applicant_name: Optional[str] = Field(None, description="Optional reference applicant full name")
    applicant_dob: Optional[str] = Field(None, description="Optional reference date of birth")
    documents: List[DossierDocumentInput] = Field(..., min_length=2, description="2 or more documents belonging to the same person")


@router.post("/compare-set")
async def compare_same_person_document_set(payload: CompareDocumentSetRequest) -> dict[str, Any]:
    """
    Cross-compares a set of documents belonging to the same person.
    Detects changes/discrepancies across:
    1. Applicant Legal Name (spelling, middle name/patronymic omission, maiden/married surname change)
    2. Date of Birth (DD/MM vs MM/DD inversion, year/day discrepancy across Passport, Aadhaar, PAN, Birth/Marriage certs)
    3. Parents' Names (Father's Name & Mother's Name changes, '-bhai'/'-ben'/'-kumar' suffixes, middle name expansions)
    4. Residential Address & PIN/Postal Code changes (Permanent Passport address vs Present Aadhaar/Bank address)
    """
    from backend.app.ai.comparators import (
        compare_addresses,
        compare_dates_of_birth,
        compare_names,
        compare_parent_names,
    )

    analyzed_docs: list[dict[str, Any]] = []
    for idx, doc_in in enumerate(payload.documents):
        res = await analyze_document_standalone(
            file=None,
            raw_text=doc_in.text,
            filename=doc_in.title,
            declared_category=doc_in.declared_category,
        )
        fields_map: dict[str, str] = {}
        for f in res.get("extracted_fields", []):
            fname = f.get("field_name")
            val = (f.get("normalized_value") or f.get("original_value") or "").strip()
            if fname and val and fname not in fields_map:
                fields_map[fname] = val

        # Also pull from specialized identity compliance if present
        ident = res.get("specialized_intelligence", {}).get("identity_compliance", {})
        ind_p = ident.get("indian_passport") or {}
        aadh = ident.get("aadhaar") or {}
        pan_d = ident.get("pan") or {}

        holder_name = (
            fields_map.get("full_name")
            or fields_map.get("applicant_name")
            or fields_map.get("groom_name")
            or fields_map.get("bride_name")
            or ind_p.get("holder_name")
            or aadh.get("holder_name")
            or pan_d.get("holder_name")
        )
        dob_val = (
            fields_map.get("date_of_birth")
            or ind_p.get("date_of_birth")
            or aadh.get("dob")
        )
        father_val = (
            fields_map.get("father_legal_name")
            or fields_map.get("father_name")
            or fields_map.get("father_or_spouse_name")
            or fields_map.get("guardian_or_spouse_name")
            or fields_map.get("groom_father_name")
            or fields_map.get("bride_father_name")
            or ind_p.get("father_name")
            or aadh.get("father_or_spouse")
        )
        mother_val = (
            fields_map.get("mother_legal_name")
            or fields_map.get("mother_name")
            or ind_p.get("mother_name")
        )
        addr_val = (
            fields_map.get("residential_address")
            or fields_map.get("address")
            or fields_map.get("permanent_address")
            or ind_p.get("address")
        )

        analyzed_docs.append({
            "doc_index": idx + 1,
            "title": doc_in.title,
            "category": res.get("recognition", {}).get("category", "supporting_evidence"),
            "holder_name": holder_name,
            "date_of_birth": dob_val,
            "father_name": father_val,
            "mother_name": mother_val,
            "address": addr_val,
            "extracted_fields": res.get("extracted_fields", []),
        })

    has_marriage_doc = any(d["category"] in ("civil_status_family", "civil_status") or "marriage" in d["title"].lower() for d in analyzed_docs)

    discrepancies: list[dict[str, Any]] = []

    def _compare_dimension(
        dimension_key: str,
        dimension_label: str,
        field_attr: str,
        comparator_fn,
    ):
        docs_with_val = [d for d in analyzed_docs if d.get(field_attr)]
        if len(docs_with_val) < 2:
            return
        anchor = docs_with_val[0]
        anchor_val = anchor[field_attr]
        for other in docs_with_val[1:]:
            other_val = other[field_attr]
            cmp_res = comparator_fn(anchor_val, other_val)
            # Also catch middle-name / patronymic omission on applicant name even if compare_names marks subset as concordant
            is_subset_name_diff = (
                dimension_key == "applicant_name"
                and cmp_res.variation_type == "name_change"
                and anchor_val.strip().lower() != other_val.strip().lower()
            )
            if not cmp_res.is_concordant or is_subset_name_diff:
                discrepancies.append({
                    "dimension": dimension_key,
                    "dimension_label": dimension_label,
                    "severity": "critical" if cmp_res.is_confirmed_contradiction else "major" if dimension_key in ("date_of_birth", "father_name", "mother_name") else "minor",
                    "variation_type": cmp_res.variation_type or "discrepancy",
                    "anchor_document": anchor["title"],
                    "anchor_value": anchor_val,
                    "compared_document": other["title"],
                    "compared_value": other_val,
                    "similarity_score": round(cmp_res.similarity_score, 2),
                    "is_confirmed_contradiction": cmp_res.is_confirmed_contradiction,
                    "explanation": cmp_res.explanation,
                    "recommended_action": cmp_res.suggested_clarification or (
                        "Execute a notarized 'One and the Same Person' Affidavit bridging the name/middle-name variance across documents."
                    ),
                })

    _compare_dimension(
        "applicant_name",
        "Applicant Legal Name",
        "holder_name",
        lambda a, b: compare_names(a, b, has_marriage_record=has_marriage_doc),
    )
    _compare_dimension(
        "date_of_birth",
        "Date of Birth (DOB)",
        "date_of_birth",
        compare_dates_of_birth,
    )
    _compare_dimension(
        "father_name",
        "Father's Name",
        "father_name",
        lambda a, b: compare_parent_names(a, b, parent_role="Father"),
    )
    _compare_dimension(
        "mother_name",
        "Mother's Name",
        "mother_name",
        lambda a, b: compare_parent_names(a, b, parent_role="Mother"),
    )
    _compare_dimension(
        "address",
        "Residential Address & PIN Code",
        "address",
        compare_addresses,
    )

    return {
        "status": "success",
        "documents_analyzed": len(analyzed_docs),
        "discrepancies_count": len(discrepancies),
        "identity_matrix": [
            {
                "title": d["title"],
                "category": d["category"],
                "holder_name": d["holder_name"],
                "date_of_birth": d["date_of_birth"],
                "father_name": d["father_name"],
                "mother_name": d["mother_name"],
                "address": d["address"],
            }
            for d in analyzed_docs
        ],
        "discrepancies": discrepancies,
    }


@router.post("/sort-packet")
async def sort_and_split_packet_endpoint(
    file: Optional[UploadFile] = File(None),
) -> dict[str, Any]:
    """
    Multi-Person Document Packet Sorter & Splitter.
    Accepts a merged PDF containing mixed documents (IDs, Passports, Bank Statements,
    ITRs, Marksheets, Marriage/Birth Certificates, Employment records) across multiple
    people, understands every page using the existing OCR & AI pipeline, clusters name
    variations per person, stitches multi-page continuations, places joint documents
    into each named holder's folder, and returns an interactive Person Folder Tree +
    a 1-click downloadable ZIP archive of separated PDFs.
    """
    if file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a PDF file to sort and split by person.",
        )

    chunk_size = 1024 * 1024  # 1MB
    pdf_bytes_acc = bytearray()
    while chunk := await file.read(chunk_size):
        pdf_bytes_acc.extend(chunk)
        if len(pdf_bytes_acc) > MAX_ALLOWED_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum limit of {MAX_ALLOWED_FILE_SIZE // (1024 * 1024)}MB.",
            )
    pdf_bytes = bytes(pdf_bytes_acc)
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    from backend.app.extraction.sorter import sort_and_split_document_packet

    try:
        result = await run_in_threadpool(
            sort_and_split_document_packet,
            pdf_bytes=pdf_bytes,
            filename=file.filename or "combined_packet.pdf",
            write_to_disk_dir=None,
            include_split_pdf_bytes=True,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Could not sort PDF packet: {exc}",
        )


def _render_single_page_sync(doc_bytes: bytes, mime_type: str, page_number: int, dpi: int) -> dict[str, Any]:
    """Renders a single requested page in <80ms using a single PyMuPDF open."""
    import fitz

    is_pdf = mime_type == "application/pdf" or doc_bytes.startswith(b"%PDF")
    if is_pdf:
        with fitz.open(stream=doc_bytes, filetype="pdf") as pdf_doc:
            page_count = len(pdf_doc)
            if page_count == 0 or page_number < 1 or page_number > page_count:
                raise ValueError(f"Requested page_number {page_number} is out of bounds (1..{page_count}).")
            scale = max(60, min(dpi, 300)) / 72.0
            pix = pdf_doc[page_number - 1].get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            img_b64 = base64.b64encode(pix.tobytes("jpeg", jpg_quality=82)).decode("ascii")
            return {
                "page_number": page_number,
                "page_count": page_count,
                "preview_image_b64": f"data:image/jpeg;base64,{img_b64}",
            }

    if page_number != 1:
        raise ValueError("Single-frame image documents only contain page_number=1.")
    eff_mime = mime_type if mime_type.startswith("image/") else "image/png"
    img_b64 = base64.b64encode(doc_bytes).decode("ascii")
    return {
        "page_number": 1,
        "page_count": 1,
        "preview_image_b64": f"data:{eff_mime};base64,{img_b64}",
    }


@router.post("/page-preview")
async def render_single_page_preview(
    file: UploadFile = File(...),
    page_number: int = Form(1),
    dpi: int = Form(130),
) -> dict[str, Any]:
    """
    Fast lazy single-page preview endpoint (<80ms).
    Renders ONLY the requested 1-indexed page at the requested DPI without full-packet OCR.
    """
    doc_bytes_acc = bytearray()
    chunk_size = 1024 * 1024
    while chunk := await file.read(chunk_size):
        doc_bytes_acc.extend(chunk)
        if len(doc_bytes_acc) > MAX_ALLOWED_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum limit of {MAX_ALLOWED_FILE_SIZE // (1024 * 1024)}MB.",
            )
    doc_bytes = bytes(doc_bytes_acc)
    if not doc_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    eff_page = page_number if isinstance(page_number, int) else 1
    eff_dpi = dpi if isinstance(dpi, int) else 130
    mime = file.content_type or "application/octet-stream"

    import time as _time

    t_start = _time.perf_counter()
    try:
        rendered = _render_single_page_sync(doc_bytes, mime, eff_page, eff_dpi)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Preview render failed: {exc}")
    render_ms = round((_time.perf_counter() - t_start) * 1000.0, 2)

    return {
        "status": "success",
        "page_number": rendered["page_number"],
        "page_count": rendered["page_count"],
        "dpi": max(60, min(eff_dpi, 300)),
        "render_ms": render_ms,
        "preview_image_b64": rendered["preview_image_b64"],
    }


def _extract_logical_doc_sync(
    doc_bytes: bytes,
    filename: str,
    mime_type: str,
    declared_category: Optional[str] = None,
    page_numbers_hint: Optional[list[int]] = None,
    subtype_hint: Optional[str] = None,
    sorter_fields_hint: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Extracts text, taxonomy, structured fields, and barcodes for one logical document."""
    is_text = mime_type == "text/plain" or (
        mime_type == "application/octet-stream"
        and not doc_bytes.startswith(b"%PDF")
        and not doc_bytes.startswith(b"\x89PNG")
        and not doc_bytes.startswith(b"\xff\xd8")
    )
    if is_text:
        raw_str = doc_bytes.decode("utf-8", errors="replace")
        cleaned = clean_ocr_text(raw_str)
        pages = [
            PageExtractionResult(
                page_number=1,
                text=cleaned,
                ocr_applied=False,
                ocr_confidence=0.99,
                blocks=[],
                width=612.0,
                height=792.0,
                detected_rotation=0,
                is_rotation_corrected=False,
                raw_unfiltered_text=raw_str,
            )
        ]
    else:
        try:
            pages = OCREngine.extract_document(doc_bytes, mime_type=mime_type)
        except Exception:
            fallback_txt = doc_bytes.decode("latin1", errors="ignore")
            pages = [
                PageExtractionResult(
                    page_number=1,
                    text=fallback_txt,
                    ocr_applied=True,
                    ocr_confidence=0.80,
                    blocks=[],
                    width=612.0,
                    height=792.0,
                    detected_rotation=0,
                    is_rotation_corrected=False,
                    raw_unfiltered_text=fallback_txt,
                )
            ]

    full_text = "\n\n".join(p.text for p in pages).strip()
    try:
        cat, conf = classify_document(full_text, filename=filename, declared_category=declared_category)
    except Exception:
        cat, conf = declared_category or "supporting_evidence", 0.78

    doc_id = uuid.uuid4()
    org_id = uuid.uuid4()
    try:
        raw_fields = extract_structured_fields(
            document_id=doc_id,
            organization_id=org_id,
            category=cat,
            pages=pages,
            document_bytes=doc_bytes,
            mime_type=mime_type,
            filename=filename,
        )
    except Exception:
        raw_fields = []

    formatted_fields: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for f in raw_fields:
        if f.field_name in seen_names:
            continue
        seen_names.add(f.field_name)
        prov = format_field_extraction_provenance(f)
        formatted_fields.append(
            {
                "field_name": f.field_name,
                "field_label": f.field_label or f.field_name.replace("_", " ").title(),
                "original_value": f.original_value,
                "normalized_value": f.normalized_value or f.original_value,
                "source_page": f.source_page or 1,
                "ocr_confidence": f.ocr_confidence,
                "calibrated_confidence": prov.get("confidence", 0.90),
                "review_status": prov.get("review_status", "NEEDS_HUMAN_REVIEW"),
            }
        )

    # Merge any extra fields discovered by sorter or barcode decoder
    if isinstance(sorter_fields_hint, dict):
        for k, v in sorter_fields_hint.items():
            if v is not None and str(v).strip() and k not in seen_names:
                seen_names.add(k)
                formatted_fields.append(
                    {
                        "field_name": str(k),
                        "field_label": str(k).replace("_", " ").title(),
                        "original_value": str(v),
                        "normalized_value": str(v),
                        "source_page": 1,
                        "ocr_confidence": 0.92,
                        "calibrated_confidence": 0.90,
                        "review_status": "NEEDS_HUMAN_REVIEW",
                    }
                )

    barcodes = _safe_decode_barcodes(doc_bytes, mime_type) if not is_text else []
    for bc in barcodes:
        for bk, bv in (bc.get("parsed_fields") or {}).items():
            if bv is not None and str(bv).strip() and bk not in seen_names:
                seen_names.add(bk)
                formatted_fields.append(
                    {
                        "field_name": str(bk),
                        "field_label": str(bk).replace("_", " ").title(),
                        "original_value": str(bv),
                        "normalized_value": str(bv),
                        "source_page": bc.get("page_number", 1),
                        "ocr_confidence": bc.get("confidence", 0.95),
                        "calibrated_confidence": bc.get("confidence", 0.95),
                        "review_status": "NEEDS_HUMAN_REVIEW",
                    }
                )

    return {
        "id": str(doc_id),
        "title": filename,
        "filename": filename,
        "category": cat,
        "classification_confidence": round(float(conf), 2),
        "document_subtype": subtype_hint or cat,
        "page_numbers": page_numbers_hint or list(range(1, len(pages) + 1)),
        "page_count": len(pages),
        "extracted_text": full_text,
        "text_preview": full_text[:1200],
        "extracted_fields": formatted_fields,
        "barcodes": barcodes,
        "processing_status": "completed",
    }


def _infer_smart_pathway_and_jurisdiction(explicit_pathway: str, docs: list[dict[str, Any]]) -> tuple[str, str]:
    """Resolves jurisdiction and pathway when not explicitly supplied by caller."""
    if explicit_pathway:
        up = explicit_pathway.upper()
        if up.startswith("UK") or "UK" in up:
            return ("UK", explicit_pathway)
        if up.startswith("AU") or "600" in up or "500" in up or "AUSTRALIA" in up:
            return ("AU", explicit_pathway)
        if up.startswith("US") or any(k in up for k in ("EB-", "H-1B", "O-1", "B1", "F1")):
            return ("US", explicit_pathway)
        return ("CA", explicit_pathway)

    combined = " ".join(f"{d.get('title', '')} {d.get('extracted_text', '')}" for d in docs).lower()
    if any(k in combined for k in ("super visa", "line 15000", "emergency medical")) and "canada" in combined:
        return ("CA", "CA-SUPER-VISA")
    if any(k in combined for k in ("permanent resident card", "hydro", "express entry", "sibling")):
        return ("CA", "CA-EXPRESS-ENTRY")
    if any(k in combined for k in ("hmrc", "p60", "sa302", "council tax", "share code", "evisa")):
        return ("UK", "UK-VISITOR-SPONSOR")
    if any(k in combined for k in ("vevo", "australian taxation office", "form 1149", "subclass 600")):
        return ("AU", "AU-SUBCLASS-600-SPONSOR")
    return ("CA", "CA-VISITOR-TRV")


@router.post("/smart-intake")
async def smart_intake_unified(
    files: List[UploadFile] = File(...),
    pathway: Optional[str] = Form(None),
    family_size: int = Form(3),
    contributor_role: Optional[str] = Form(None),
) -> dict[str, Any]:
    """
    Unified Smart-Intake Endpoint:
    Handles ANY drop in one call — 1 image, 5 separate PDFs, or a 60-page merged family+sponsor PDF!
    - Automatically splits multi-document PDFs
    - Runs 1D/2D/QR barcode, MRZ & structured entity extraction
    - Assigns semantic `person_role` (`principal_applicant`, `spouse_partner`, `dependant_child`,
      `overseas_sponsor_host`, `canadian_crs_sibling`)
    - Computes deterministic `sponsor_statutory_intelligence` (Super Visa LICO, +15 CRS Sibling,
      UK 28-day & Sponsor, AU VEVO/ATO, Universal Guardrails)
    - Audits pathway checklist satisfaction & emits 1-click user-confirmable `prefill_candidates`
    """
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required.")

    clean_pathway = pathway.strip() if isinstance(pathway, str) and pathway.strip() else ""
    eff_family_size = max(1, int(family_size)) if isinstance(family_size, int) else 3
    clean_contributor_role = (
        contributor_role.strip() if isinstance(contributor_role, str) and contributor_role.strip() else None
    )

    from backend.app.extraction.sorter import sort_and_split_document_packet
    import fitz

    logical_docs: list[dict[str, Any]] = []
    was_multi_document_split = False
    non_empty_uploads = 0

    for up_file in files:
        chunk_size = 1024 * 1024
        buf = bytearray()
        while chunk := await up_file.read(chunk_size):
            buf.extend(chunk)
            if len(buf) > MAX_ALLOWED_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File '{up_file.filename}' exceeds maximum limit of {MAX_ALLOWED_FILE_SIZE // (1024 * 1024)}MB.",
                )
        raw_bytes = bytes(buf)
        if not raw_bytes:
            continue
        non_empty_uploads += 1

        upload_name = up_file.filename or f"upload_{non_empty_uploads}.pdf"
        mime = up_file.content_type or "application/octet-stream"
        is_pdf = mime == "application/pdf" or raw_bytes.startswith(b"%PDF")

        pdf_page_count = 1
        if is_pdf:
            try:
                with fitz.open(stream=raw_bytes, filetype="pdf") as tmp_pdf:
                    pdf_page_count = len(tmp_pdf)
            except Exception:
                pdf_page_count = 1

        if is_pdf and pdf_page_count >= 2:
            try:
                split_res = await run_in_threadpool(
                    sort_and_split_document_packet,
                    pdf_bytes=raw_bytes,
                    filename=upload_name,
                    write_to_disk_dir=None,
                    include_split_pdf_bytes=True,
                )
                seen_page_tuples: set[tuple[int, ...]] = set()
                split_segments: list[dict[str, Any]] = []
                for folder in split_res.get("person_folders", []):
                    for seg in folder.get("documents", []):
                        p_tuple = tuple(seg.get("page_numbers") or [])
                        if p_tuple and p_tuple in seen_page_tuples:
                            continue
                        if p_tuple:
                            seen_page_tuples.add(p_tuple)
                        split_segments.append(seg)

                if len(split_segments) > 1:
                    was_multi_document_split = True

                for seg in split_segments:
                    seg_b64 = seg.get("pdf_base64")
                    seg_bytes = base64.b64decode(seg_b64) if seg_b64 else raw_bytes
                    seg_fname = seg.get("filename") or upload_name
                    extracted_seg = await run_in_threadpool(
                        _extract_logical_doc_sync,
                        seg_bytes,
                        seg_fname,
                        "application/pdf",
                        seg.get("category"),
                        seg.get("page_numbers"),
                        seg.get("document_subtype"),
                        seg.get("extracted_fields"),
                    )
                    extracted_seg["source_upload_filename"] = upload_name
                    logical_docs.append(extracted_seg)
                continue
            except Exception:
                # Graceful fallback to single-document extraction if packet splitter encounters corrupt PDF trailer
                pass

        single_extracted = await run_in_threadpool(
            _extract_logical_doc_sync,
            raw_bytes,
            upload_name,
            mime,
            None,
            None,
            None,
            None,
        )
        single_extracted["source_upload_filename"] = upload_name
        logical_docs.append(single_extracted)

    if non_empty_uploads == 0 or not logical_docs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded files were empty.")

    # Evaluate unified role attribution, Family/Sponsor Graph & Statutory Rules
    sponsor_intel = SponsorIntelligenceEngine.evaluate_packet_or_case_intelligence(
        logical_docs,
        pathway=clean_pathway,
        family_size=eff_family_size,
        default_contributor_role=clean_contributor_role,
    )

    doc_roles_list = sponsor_intel.get("document_roles", [])
    for idx, ldoc in enumerate(logical_docs):
        role_meta = doc_roles_list[idx] if idx < len(doc_roles_list) else {}
        ldoc["person_role"] = role_meta.get("person_role", clean_contributor_role or "principal_applicant")
        ldoc["role_label"] = role_meta.get("role_label", "Principal Applicant")
        ldoc["holder_name"] = role_meta.get("holder_name")
        ldoc["association_note"] = role_meta.get("association_note")

    # Role-aware cross-document discrepancy evaluation
    consistency_audit = evaluate_role_aware_consistency(None, logical_docs, pathway=clean_pathway)

    # Pathway checklist mapping
    inferred_jur, eff_pathway = _infer_smart_pathway_and_jurisdiction(clean_pathway, logical_docs)
    checklist_report = audit_case_checklist(
        jurisdiction=inferred_jur,
        visa_category=eff_pathway,
        documents=logical_docs,
    )
    satisfied_categories = sorted({d["category"] for d in logical_docs if d.get("category")})

    # Build 1-click user-confirmable prefill candidates (requires_user_confirmation=True)
    prefill_candidates: list[dict[str, Any]] = []
    seen_prefill_keys: set[tuple[str, str]] = set()
    for ldoc in logical_docs:
        p_role = ldoc.get("person_role", "principal_applicant")
        for ef in ldoc.get("extracted_fields", []):
            fn = ef.get("field_name")
            val = ef.get("normalized_value") or ef.get("original_value")
            if not fn or val is None or not str(val).strip():
                continue
            dedup_key = (p_role, fn)
            if dedup_key in seen_prefill_keys:
                continue
            seen_prefill_keys.add(dedup_key)
            prefill_candidates.append(
                {
                    "field_name": fn,
                    "field_label": ef.get("field_label") or fn.replace("_", " ").title(),
                    "proposed_value": str(val).strip(),
                    "person_role": p_role,
                    "holder_name": ldoc.get("holder_name"),
                    "source_document": ldoc.get("filename"),
                    "source_page": ef.get("source_page", 1),
                    "confidence": ef.get("calibrated_confidence", 0.90),
                    "requires_user_confirmation": True,
                }
            )

    return {
        "status": "success",
        "uploaded_files_count": non_empty_uploads,
        "logical_documents_count": len(logical_docs),
        "was_multi_document_split": was_multi_document_split,
        "jurisdiction": inferred_jur,
        "pathway": eff_pathway,
        "family_size": eff_family_size,
        "documents": [
            {
                "document_id": d["id"],
                "filename": d["filename"],
                "source_upload_filename": d.get("source_upload_filename", d["filename"]),
                "page_numbers": d["page_numbers"],
                "page_count": d["page_count"],
                "category": d["category"],
                "classification_confidence": d["classification_confidence"],
                "document_subtype": d["document_subtype"],
                "person_role": d["person_role"],
                "role_label": d["role_label"],
                "holder_name": d["holder_name"],
                "association_note": d["association_note"],
                "extracted_fields": d["extracted_fields"],
                "barcodes": d["barcodes"],
                "text_preview": d["text_preview"],
            }
            for d in logical_docs
        ],
        "family_sponsor_graph": sponsor_intel.get("family_sponsor_graph", {}),
        "sponsor_statutory_intelligence": sponsor_intel,
        "role_aware_consistency": consistency_audit,
        "checklist_audit": {
            "jurisdiction": checklist_report.jurisdiction,
            "pathway": checklist_report.visa_category,
            "fulfillment_percentage": checklist_report.fulfillment_percentage,
            "satisfied_mandatory": checklist_report.satisfied_mandatory,
            "total_mandatory": checklist_report.total_mandatory,
            "satisfied_items": checklist_report.satisfied_items,
            "total_items": checklist_report.total_items,
            "satisfied_categories": satisfied_categories,
            "items": [
                {
                    "item_id": it.item_id,
                    "label": it.label,
                    "requirement_citation": it.requirement_citation,
                    "is_mandatory": it.is_mandatory,
                    "is_satisfied": it.is_satisfied,
                    "matching_document_id": it.matching_document_id,
                    "matching_document_title": it.matching_document_title,
                }
                for it in checklist_report.items
            ],
            "missing_items": [
                {
                    "item_id": m.item_id,
                    "label": m.label,
                    "requirement_citation": m.requirement_citation,
                    "is_mandatory": m.is_mandatory,
                }
                for m in checklist_report.missing_items
            ],
        },
        "prefill_candidates": prefill_candidates,
    }



