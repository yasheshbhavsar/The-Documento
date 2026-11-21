"""Regression tests for AI OCR, Document Extractor Lab API, and Packet Sorter fixes."""
from __future__ import annotations

import io
import uuid

import fitz
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from backend.app.ai.financial_parser import FinancialIntelligenceEngine
from backend.app.extraction.service import extract_structured_fields
from backend.app.main import app
from backend.app.ocr.engine import OCREngine, PageExtractionResult


def _render_text_image_bytes(lines: list[str], fmt: str = "WEBP") -> bytes:
    img = Image.new("RGB", (1100, 650), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 30)
    except Exception:
        font = ImageFont.load_default()
    y = 40
    for line in lines:
        draw.text((40, y), line, fill=(10, 10, 10), font=font)
        y += 52
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    y = 60
    for line in text.splitlines():
        page.insert_text((48, y), line, fontsize=11)
        y += 16
    raw = doc.tobytes()
    doc.close()
    return raw


def _make_text_page(text: str) -> PageExtractionResult:
    return PageExtractionResult(
        page_number=1,
        width=595.0,
        height=842.0,
        text=text,
        blocks=[],
        ocr_applied=False,
        ocr_confidence=0.99,
    )


def test_webp_image_ocr_extracts_text_without_pymupdf_crash():
    webp_bytes = _render_text_image_bytes(
        [
            "REPUBLIC OF INDIA",
            "PASSPORT",
            "Passport No: Z8492014",
            "Surname: PATEL",
            "Given Names: ARJUN RAJESH",
            "Date of Birth: 15/08/1992",
        ],
        fmt="WEBP",
    )
    pages = OCREngine.extract_document(webp_bytes, mime_type="image/webp")
    assert len(pages) == 1
    assert pages[0].ocr_applied is True
    assert pages[0].ocr_confidence > 0.5
    assert "PASSPORT" in pages[0].text.upper()
    assert "Z8492014" in pages[0].text.upper()
    assert "ocr_unavailable_or_empty" not in getattr(pages[0], "warnings", [])


def test_octet_stream_pdf_and_image_uploads_route_to_ocr_not_utf8_text():
    client = TestClient(app)

    # 1. PNG uploaded with application/octet-stream must run RapidOCR, never raw UTF-8 decode
    # Valid Indian PAN format: 4th char 'P' = Individual, 5th char 'P' = surname initial (PATEL)
    png_bytes = _render_text_image_bytes(
        [
            "INCOME TAX DEPARTMENT",
            "GOVT. OF INDIA",
            "Permanent Account Number Card",
            "Name: ARJUN RAJESH PATEL",
            "PAN: ABCPP1234F",
            "Date of Birth: 15/08/1992",
        ],
        fmt="PNG",
    )
    resp_img = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("pan_scan.png", png_bytes, "application/octet-stream")},
        data={"filename": "pan_scan.png"},
    )
    assert resp_img.status_code == 200
    body_img = resp_img.json()
    assert body_img["metadata"]["mime_type"] == "image/png"
    assert body_img["ocr_summary"]["ocr_applied"] is True
    assert "ABCPP1234F" in body_img["raw_text_preview"].upper()
    assert any(f["normalized_value"] == "ABCPP1234F" for f in body_img["extracted_fields"])

    # 2. PDF uploaded with application/octet-stream must route through PDF extraction
    pdf_bytes = _make_pdf_bytes(
        "REPUBLIC OF INDIA\nPASSPORT\nPassport No: Z8492014\nSurname: PATEL\nGiven Names: ARJUN RAJESH\n"
    )
    resp_pdf = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("passport_binary.pdf", pdf_bytes, "application/octet-stream")},
        data={"filename": "passport_binary.pdf"},
    )
    assert resp_pdf.status_code == 200
    body_pdf = resp_pdf.json()
    assert body_pdf["metadata"]["mime_type"] == "application/pdf"
    assert body_pdf["recognition"]["category"] == "identity_passport"
    assert any(f["field_name"] == "passport_number" for f in body_pdf["extracted_fields"])


def test_sort_packet_accepts_single_image_without_crashing():
    client = TestClient(app)
    png_bytes = _render_text_image_bytes(
        [
            "REPUBLIC OF INDIA",
            "PASSPORT",
            "Passport No: Z8492014",
            "Surname: PATEL",
            "Given Names: ARJUN RAJESH",
            "Date of Birth: 15/08/1992",
        ],
        fmt="PNG",
    )
    resp = client.post(
        "/api/v1/extractor/sort-packet",
        files={"file": ("passport_photo.png", png_bytes, "image/png")},
        data={"filename": "passport_photo.png"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "success"
    assert payload["total_pages_analyzed"] == 1
    assert payload["total_persons_detected"] >= 1


def test_financial_parser_and_bank_statement_extract_currency_prefixed_balances_and_null_honesty():
    text_with_inr = (
        "HDFC Bank\n"
        "Account Statement\n"
        "Account Holder: ARJUN RAJESH PATEL\n"
        "Account Number: XXXX4321\n"
        "Statement Period: 01/01/2026 to 31/03/2026\n"
        "Opening Balance: INR 150,000.00\n"
        "Closing Balance: INR 450,000.00\n"
    )
    summary = FinancialIntelligenceEngine.parse_bank_statement_text(text_with_inr)
    assert summary.currency == "INR"
    assert summary.opening_balance == 150000.0
    assert summary.closing_balance == 450000.0
    assert summary.statement_period_start == "01/01/2026"
    assert summary.statement_period_end == "31/03/2026"

    fields = extract_structured_fields(
        uuid.uuid4(),
        uuid.uuid4(),
        "financial_evidence",
        [_make_text_page(text_with_inr)],
    )
    by_name = {f.field_name: f.normalized_value for f in fields}
    assert by_name.get("account_holder_name", "").upper() == "ARJUN RAJESH PATEL"
    assert "150000" in by_name.get("opening_balance", "").replace(",", "")
    assert "450000" in by_name.get("closing_balance", "").replace(",", "")

    # Absent opening balance must remain honestly None (never fabricated)
    text_no_open = (
        "HDFC Bank\n"
        "Account Statement\n"
        "Account Holder: ARJUN PATEL\n"
        "Account Number: XXXX1234\n"
        "Closing Balance: INR 450,000.00\n"
    )
    summary_no_open = FinancialIntelligenceEngine.parse_bank_statement_text(text_no_open)
    assert summary_no_open.opening_balance is None
    assert summary_no_open.closing_balance == 450000.0


def test_marriage_certificate_extracts_bridegroom_and_bride_without_full_prefix():
    text = (
        "CERTIFICATE OF MARRIAGE\n"
        "Registration No.: MC/2021/45678\n"
        "Date of Marriage: 14/02/2021\n"
        "Place of Marriage: Ahmedabad, Gujarat\n"
        "Name of Bridegroom: ARJUN RAJESH PATEL\n"
        "Name of Bride: PRIYA MEHTA\n"
    )
    fields = extract_structured_fields(
        uuid.uuid4(),
        uuid.uuid4(),
        "civil_status_family",
        [_make_text_page(text)],
    )
    by_name = {f.field_name: f.normalized_value for f in fields}
    assert by_name.get("groom_name", "").upper() == "ARJUN RAJESH PATEL"
    assert by_name.get("bride_name", "").upper() == "PRIYA MEHTA"
    assert by_name.get("marriage_date") == "2021-02-14"


def test_analyze_response_exposes_frontend_compatible_role_attribution_and_barcode_aliases():
    client = TestClient(app)
    pdf_bytes = _make_pdf_bytes(
        "REPUBLIC OF INDIA\nPASSPORT\nPassport No: Z8492014\nSurname: PATEL\nGiven Names: ARJUN RAJESH\n"
    )
    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("passport_arjun.pdf", pdf_bytes, "application/pdf")},
        data={"filename": "passport_arjun.pdf"},
    )
    assert resp.status_code == 200
    si = resp.json()["specialized_intelligence"]
    role = si.get("role_attribution")
    assert role is not None
    assert role.get("person_name") == role.get("holder_name")
    assert bool(role.get("role_label"))
    assert bool(role.get("subtype_label"))
    assert isinstance(role.get("statutory_badges"), list)
