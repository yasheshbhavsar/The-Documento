"""Verification suite for Workstream A:
1. 100% Local Zero-Egress QR & 2D Barcode Decoder (`barcode_decoder.py`)
2. Zero-Copy Multi-Core Parallel OCR, Pre-Opened Doc Reuse, AcroForm/XFA <150ms Fast-Path & Indic CLAHE (`engine.py`)
3. ICAO MRZ Parser Enhancements for CAN/GBR/GBO/AUS/NZL/DEU/IND/USA & Canadian PR Card TD1 (`mrz_parser.py`)
4. CA / UK / AU Sponsor, Host & CRS Sibling Taxonomy, Field Extraction & `infer_document_person_role` (`classifier.py`, `service.py`)
5. Multi-Person Packet Sorter Role & Jurisdiction Attribution (`sorter.py`)
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import time
import uuid

import cv2
import fitz
import numpy as np
import pytest

from backend.app.extraction.classifier import classify_document
from backend.app.extraction.service import (
    extract_structured_fields,
    infer_document_person_role,
)
from backend.app.extraction.sorter import (
    PacketPersonFolder,
    PacketSortedDocument,
    detect_page_subtype,
    sort_and_split_document_packet,
)
from backend.app.ocr.barcode_decoder import (
    decode_document_barcodes,
    mask_aadhaar_uid,
    parse_barcode_payload,
)
from backend.app.ocr.engine import (
    OCREngine,
    PageExtractionResult,
    evaluate_language_compliance,
)
from backend.app.ocr.mrz_parser import MRZParser


def _extract_fields_map(text: str, category: str, filename: str = "doc.pdf") -> dict[str, str]:
    page = PageExtractionResult(
        page_number=1,
        text=text,
        ocr_applied=False,
        ocr_confidence=0.99,
        blocks=[],
        width=612.0,
        height=792.0,
    )
    items = extract_structured_fields(
        document_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        category=category,
        pages=[page],
        document_bytes=None,
        mime_type="text/plain",
        filename=filename,
    )
    out: dict[str, str] = {}
    for item in items:
        key = getattr(item, "field_name", None) or item["field_name"]
        val = (
            getattr(item, "normalized_value", None)
            or getattr(item, "original_value", None)
            if hasattr(item, "field_name")
            else (item.get("normalized_value") or item.get("original_value"))
        )
        if key not in out and val is not None:
            out[str(key)] = str(val)
    return out


def _build_qr_png_bytes(payload: str) -> bytes | None:
    """Generates a deterministic QR PNG image in-memory if zxingcpp writer is available."""
    try:
        import zxingcpp  # type: ignore

        if hasattr(zxingcpp, "create_barcode") and hasattr(zxingcpp, "write_barcode_to_image"):
            bc = zxingcpp.create_barcode(payload, zxingcpp.BarcodeFormat.QRCode)
            bc_img = zxingcpp.write_barcode_to_image(bc, scale=6)
            arr = np.asarray(bc_img)
            ok, buf = cv2.imencode(".png", arr)
            if ok:
                return bytes(buf)
        if hasattr(zxingcpp, "write_barcode"):
            bc_img = zxingcpp.write_barcode(
                zxingcpp.BarcodeFormat.QRCode,
                payload,
                width=360,
                height=360,
                quiet_zone=4,
            )
            arr = np.asarray(bc_img)
            ok, buf = cv2.imencode(".png", arr)
            if ok:
                return bytes(buf)
    except Exception:
        pass
    return None


# ==============================================================================
# 1. BARCODE & QR DECODER TESTS
# ==============================================================================


def test_parse_barcode_payload_uidai_aadhaar_xml_masks_uid() -> None:
    aadhaar_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<PrintLetterBarcodeData uid="948271634829" name="Rameshbhai Kalidas Patel" '
        'gender="M" yob="1962" dob="14/08/1962" co="S/O Kalidas Patel" '
        'vtc="Ahmedabad" dist="Ahmedabad" state="Gujarat" pc="380054"/>'
    )
    parsed_type, fields = parse_barcode_payload(aadhaar_xml)
    assert parsed_type == "uidai_aadhaar_xml"
    assert fields["uid"] == "XXXX-XXXX-4829"
    assert fields["aadhaar_number_masked"] == "XXXX-XXXX-4829"
    assert "948271634829" not in fields["uid"]
    assert fields["name"] == "Rameshbhai Kalidas Patel"
    assert fields["gender"] == "M"
    assert fields["dob"] == "14/08/1962"
    assert fields["yob"] == "1962"
    assert fields["dist"] == "Ahmedabad"
    assert fields["state"] == "Gujarat"
    assert fields["pc"] == "380054"
    assert mask_aadhaar_uid("9482 7163 4829") == "XXXX-XXXX-4829"


def test_parse_barcode_payload_epan_ircc_uk_vevo_and_verification_urls() -> None:
    # 1. Income Tax e-PAN QR
    epan_raw = "PAN: ABCDE1234F | Name: VIKRAM RAMESHBHAI PATEL | Father Name: RAMESHBHAI PATEL | DOB: 19/05/1991"
    p_type, p_fields = parse_barcode_payload(epan_raw)
    assert p_type == "income_tax_epan_qr"
    assert p_fields["pan"] == "ABCDE1234F"
    assert "VIKRAM RAMESHBHAI PATEL" in p_fields["name"].upper()
    assert p_fields["dob"] == "19/05/1991"
    assert "RAMESHBHAI PATEL" in p_fields["father_name"].upper()

    # 2. IRCC 2D Form Barcode (IMM 5257)
    ircc_raw = "IMM 5257|01|UCI: 11-2233-4455|App: V309482910|PATEL|RAMESHBHAI KALIDAS|1962-08-14|IND"
    ircc_type, ircc_fields = parse_barcode_payload(ircc_raw)
    assert ircc_type == "ircc_uscis_2d_form"
    assert ircc_fields["form_code"] == "IMM 5257"
    assert ircc_fields["ircc_uci"] == "11-2233-4455"
    assert ircc_fields["application_number"] == "V309482910"
    assert len(ircc_fields["delimited_fields"]) >= 6

    # 3. UK Home Office eVisa Share Code URL
    uk_url = "https://www.gov.uk/view-prove-immigration-status?shareCode=W8K4M9P2Q"
    uk_type, uk_fields = parse_barcode_payload(uk_url)
    assert uk_type == "uk_evisa_verification_url"
    assert uk_fields["uk_share_code"] == "W8K-4M9-P2Q"

    # 4. Australia Home Affairs VEVO Check URL
    au_url = (
        "https://immi.homeaffairs.gov.au/visas/already-have-a-visa/"
        "check-visa-details-and-conditions?grant_number=0064829104829&trn=EGO9482019"
    )
    au_type, au_fields = parse_barcode_payload(au_url)
    assert au_type == "australia_vevo_verification_url"
    assert au_fields["vevo_grant_number"] == "0064829104829"
    assert au_fields["vevo_trn"] == "EGO9482019"

    # 5. DigiLocker / IELTS verification URL
    dl_url = "https://digilocker.gov.in/verify/certificate?docId=GUJ-2024-99481"
    dl_type, dl_fields = parse_barcode_payload(dl_url)
    assert dl_type == "credential_verification_url"
    assert "digilocker.gov.in" in dl_fields["verification_domain"]


def test_live_qr_image_and_pdf_barcode_decoding() -> None:
    aadhaar_payload = (
        '<PrintLetterBarcodeData uid="771288349910" name="Kavya Devang Mehta" '
        'gender="F" dob="18/04/2006" dist="Gandhinagar" state="Gujarat" pc="382721"/>'
    )
    qr_png = _build_qr_png_bytes(aadhaar_payload)
    if qr_png is None:
        pytest.skip("zxingcpp barcode generator not available in environment")

    # Direct image decode
    img_hits = decode_document_barcodes(qr_png, mime_type="image/png")
    assert len(img_hits) == 1
    hit = img_hits[0]
    assert set(hit.keys()) == {"format", "raw_text", "page_number", "parsed_type", "parsed_fields", "confidence"}
    assert hit["page_number"] == 1
    assert hit["parsed_type"] == "uidai_aadhaar_xml"
    assert hit["parsed_fields"]["uid"] == "XXXX-XXXX-9910"
    assert hit["confidence"] > 0.90

    # Embedded PDF decode on Page 2
    pdf = fitz.open()
    p1 = pdf.new_page(width=595, height=842)
    p1.insert_text((72, 100), "Cover Sheet - No Barcode", fontsize=14)
    p2 = pdf.new_page(width=595, height=842)
    p2.insert_image(fitz.Rect(150, 200, 410, 460), stream=qr_png)
    pdf_bytes = pdf.tobytes()
    pdf.close()

    pdf_hits = decode_document_barcodes(pdf_bytes, mime_type="application/pdf")
    assert len(pdf_hits) == 1
    assert pdf_hits[0]["page_number"] == 2
    assert pdf_hits[0]["parsed_fields"]["uid"] == "XXXX-XXXX-9910"
    assert pdf_hits[0]["parsed_fields"]["name"] == "Kavya Devang Mehta"


# ==============================================================================
# 2. FAST ZERO-COPY MULTI-CORE OCR, ACROFORM <150ms & INDIC PREPROCESSING TESTS
# ==============================================================================


def test_zero_copy_pixmap_conversion_and_preopened_doc_reuse() -> None:
    doc = fitz.open()
    p1 = doc.new_page(width=595, height=842)
    p1.insert_text(
        (72, 100),
        "GOVERNMENT OF CANADA - DIGITAL VECTOR EXTRACTION TEST\nApplicant: Vikramkumar Rameshbhai Patel\nUCI: 11-2233-4455",
        fontsize=12,
    )
    # Test zero-copy RGB, RGBA, and Grayscale pixmaps
    pix_rgb = p1.get_pixmap(alpha=False)
    bgr_from_rgb = OCREngine._pixmap_to_bgr_array(pix_rgb)
    assert bgr_from_rgb.shape == (pix_rgb.height, pix_rgb.width, 3)
    assert bgr_from_rgb.dtype == np.uint8

    pix_rgba = p1.get_pixmap(alpha=True)
    bgr_from_rgba = OCREngine._pixmap_to_bgr_array(pix_rgba)
    assert bgr_from_rgba.shape == (pix_rgba.height, pix_rgba.width, 3)

    pix_gray = p1.get_pixmap(colorspace=fitz.csGRAY, alpha=False)
    bgr_from_gray = OCREngine._pixmap_to_bgr_array(pix_gray)
    assert bgr_from_gray.shape == (pix_gray.height, pix_gray.width, 3)

    pdf_bytes = doc.tobytes()
    pages = OCREngine.extract_document(pdf_bytes, mime_type="application/pdf", preopened_doc=doc)
    assert not doc.is_closed, "preopened_doc must NOT be closed by OCREngine.extract_document"
    assert len(pages) == 1
    assert "11-2233-4455" in pages[0].text
    doc.close()


def test_acroform_interactive_pdf_fast_path_under_150ms() -> None:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((50, 50), "IMM 5257 - APPLICATION FOR VISITOR VISA (TEMPORARY RESIDENT VISA)", fontsize=12)

    fields_spec = [
        ("UCI_Number", "11-2233-4455", fitz.Rect(50, 90, 260, 115)),
        ("Family_Name", "PATEL", fitz.Rect(50, 130, 260, 155)),
        ("Given_Name", "RAMESHBHAI KALIDAS", fitz.Rect(50, 170, 320, 195)),
        ("Passport_Number", "Z8492014", fitz.Rect(50, 210, 260, 235)),
        ("Purpose_of_Visit", "Super Visa Family Visit to Son in Ontario", fitz.Rect(50, 250, 420, 275)),
    ]
    for fname, fval, rect in fields_spec:
        w = fitz.Widget()
        w.field_name = fname
        w.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        w.field_value = fval
        w.rect = rect
        page.add_widget(w)

    acro_bytes = doc.tobytes()
    doc.close()

    # Warm call + timed assertion (<150ms)
    t0 = time.perf_counter()
    pages = OCREngine.extract_document(acro_bytes, mime_type="application/pdf")
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert elapsed_ms < 150.0, f"Expected AcroForm fast-path <150ms, took {elapsed_ms:.1f}ms"
    assert len(pages) == 1
    assert pages[0].ocr_applied is False
    assert "UCI_Number: 11-2233-4455" in pages[0].text
    assert "Given_Name: RAMESHBHAI KALIDAS" in pages[0].text
    assert "Super Visa Family Visit" in pages[0].text


def test_multicore_parallel_scanned_pdf_preserves_page_order_and_thread_safety() -> None:
    # Build a 4-page pure raster PDF (zero native vector text, forcing parallel RapidOCR)
    raster_doc = fitz.open()
    markers = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"]
    for idx, marker in enumerate(markers, start=1):
        canvas = np.full((700, 1000, 3), 255, dtype=np.uint8)
        cv2.putText(
            canvas,
            f"OFFICIAL SCANNED PAGE {idx} CODE {marker}",
            (60, 220),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.15,
            (15, 15, 15),
            3,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            f"REGISTRATION REF {7140 + idx}",
            (60, 320),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (25, 25, 25),
            2,
            cv2.LINE_AA,
        )
        ok, png_buf = cv2.imencode(".png", canvas)
        assert ok
        pg = raster_doc.new_page(width=595, height=842)
        pg.insert_image(fitz.Rect(20, 40, 575, 500), stream=bytes(png_buf))

    raster_pdf_bytes = raster_doc.tobytes()
    raster_doc.close()

    results = OCREngine.extract_document(raster_pdf_bytes, mime_type="application/pdf")
    assert [p.page_number for p in results] == [1, 2, 3, 4]
    for idx, marker in enumerate(markers, start=1):
        assert results[idx - 1].ocr_applied is True
        norm_txt = results[idx - 1].text.upper().replace(" ", "")
        assert marker in norm_txt and f"PAGE{idx}" in norm_txt

    # Verify concurrent thread-pool execution safety across 2 simultaneous callers
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = [pool.submit(OCREngine.extract_document, raster_pdf_bytes, "application/pdf") for _ in range(2)]
        for fut in futs:
            res = fut.result()
            assert [p.page_number for p in res] == [1, 2, 3, 4]


def test_faded_bilingual_indic_civil_scan_preprocessing_and_compliance() -> None:
    # Simulate a faded low-contrast civil certificate scan (pale gray ink on off-white paper)
    faded = np.full((520, 1100, 3), 236, dtype=np.uint8)
    cv2.putText(faded, "GOVERNMENT OF GUJARAT - BIRTH CERTIFICATE", (45, 130), cv2.FONT_HERSHEY_SIMPLEX, 1.05, (182, 182, 182), 2, cv2.LINE_AA)
    cv2.putText(faded, "Name: KAVYA DEVANG MEHTA", (45, 230), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (180, 180, 180), 2, cv2.LINE_AA)
    cv2.putText(faded, "Registration No: 814   DOB: 18/04/2006", (45, 330), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (180, 180, 180), 2, cv2.LINE_AA)

    enhanced = OCREngine._preprocess_bgr_for_ocr(faded, aggressive=True)
    assert enhanced.shape == faded.shape
    # Enhanced scan must significantly expand dynamic contrast vs faded input
    assert float(enhanced.std()) > float(faded.std())

    ok, png_buf = cv2.imencode(".png", faded)
    assert ok
    ocr_pages = OCREngine.extract_document(bytes(png_buf), mime_type="image/png")
    assert len(ocr_pages) == 1
    up_ocr = ocr_pages[0].text.upper()
    assert "BIRTH" in up_ocr and "MEHTA" in up_ocr

    # Trilingual Gujarati + Hindi + English language compliance must remain COMPLIANT
    trilingual_text = (
        "ભારત સરકાર / भारत सरकार / GOVERNMENT OF INDIA\n"
        "જન્મ પ્રમાણપત્ર / जन्म प्रमाण पत्र / BIRTH CERTIFICATE\n"
        "1. નામ / नाम / Name: KAVYA DEVANG MEHTA\n"
        "3. જન્મ તારીખ / जन्म तिथि / Date of Birth: ૧૮/૦૪/૨૦૦૬"
    )
    comp = evaluate_language_compliance(trilingual_text, raw_unfiltered_text=trilingual_text)
    assert comp["is_compliant"] is True
    assert comp["requires_caseworker_escalation"] is False


# ==============================================================================
# 3. ICAO MRZ PARSER TESTS (CAN / GBR / GBO / AUS / NZL / DEU / PR CARD TD1)
# ==============================================================================


def test_mrz_parser_supports_can_gbr_aus_nzl_deu_and_canadian_pr_card_td1() -> None:
    # 1. Canadian Passport TD3
    can_mrz = (
        "P<CANPATEL<<VIKRAMKUMAR<RAMESHBHAI<<<<<<<<<<\n"
        "GA948201<4CAN9105192M3205187<<<<<<<<<<<<<<02"
    )
    parsed_can = MRZParser.parse_text(can_mrz)
    assert parsed_can is not None
    assert parsed_can.doc_type == "TD3"
    assert parsed_can.nationality_code == "CAN"
    assert parsed_can.nationality == "Canada"
    assert parsed_can.issuing_country == "Canada"
    assert parsed_can.surname.upper() == "PATEL"

    # 2. British (GBR + GBO), Australian, New Zealand & German ('D<<') Passports TD3
    gbr_mrz = (
        "P<GBRSHARMA<<ROHAN<KUMAR<<<<<<<<<<<<<<<<<<<<\n"
        "5394820194GBR8811224M3109148<<<<<<<<<<<<<<06"
    )
    parsed_gbr = MRZParser.parse_text(gbr_mrz)
    assert parsed_gbr is not None
    assert parsed_gbr.nationality_code == "GBR"
    assert parsed_gbr.nationality == "United Kingdom"

    gbo_mrz = (
        "P<GBOPATEL<<KISHORE<BHAI<<<<<<<<<<<<<<<<<<<<\n"
        "7194820194GBO7804124M3009148<<<<<<<<<<<<<<02"
    )
    parsed_gbo = MRZParser.parse_text(gbo_mrz)
    assert parsed_gbo is not None
    assert parsed_gbo.nationality_code == "GBO"
    assert "British Overseas" in parsed_gbo.nationality

    aus_mrz = (
        "P<AUSMEHTA<<NEHA<DEVANG<<<<<<<<<<<<<<<<<<<<<\n"
        "PA83920149AUS9003155F3304102<<<<<<<<<<<<<<04"
    )
    parsed_aus = MRZParser.parse_text(aus_mrz)
    assert parsed_aus is not None
    assert parsed_aus.nationality_code == "AUS"
    assert parsed_aus.nationality == "Australia"

    nzl_mrz = (
        "P<NZLWILSON<<LIAM<JAMES<<<<<<<<<<<<<<<<<<<<<\n"
        "LA482910<4NZL8906214M3206208<<<<<<<<<<<<<<04"
    )
    parsed_nzl = MRZParser.parse_text(nzl_mrz)
    assert parsed_nzl is not None
    assert parsed_nzl.nationality_code == "NZL"
    assert parsed_nzl.nationality == "New Zealand"

    deu_mrz = (
        "P<D<<MUELLER<<HANS<PETER<<<<<<<<<<<<<<<<<<<<\n"
        "C01X00T478D<<8508125M3010319<<<<<<<<<<<<<<<4"
    )
    parsed_deu = MRZParser.parse_text(deu_mrz)
    assert parsed_deu is not None
    assert parsed_deu.nationality_code == "DEU"
    assert parsed_deu.nationality == "Germany"
    assert parsed_deu.issuing_country == "Germany"

    # 3. Canadian PR Card TD1 (CACAN extended format & I<CAN standard format)
    pr_td1 = (
        "CACAN6677889900<01234567<<<<<<\n"
        "9105192M2908154CAN<<<<<<<<<<<8\n"
        "PATEL<<VIKRAMKUMAR<RAMESHBHAI<"
    )
    parsed_pr = MRZParser.parse_text(pr_td1)
    assert parsed_pr is not None
    assert parsed_pr.doc_type == "TD1"
    assert parsed_pr.issuing_country == "Canada"
    assert parsed_pr.nationality == "Canada"
    assert parsed_pr.surname.upper() == "PATEL"
    assert "VIKRAMKUMAR" in parsed_pr.given_names.upper()


# ==============================================================================
# 4. CA / UK / AU SPONSOR & SIBLING CLASSIFICATION, EXTRACTION & ROLE TESTS
# ==============================================================================


def test_canada_sponsor_and_sibling_extraction_and_role_attribution() -> None:
    # A. CRA Notice of Assessment
    cra_noa_text = (
        "Canada Revenue Agency / Agence du revenu du Canada\n"
        "NOTICE OF ASSESSMENT - T451 E\n"
        "Taxpayer Name: Vikramkumar Rameshbhai Patel\n"
        "Social Insurance Number: 512 849 789\n"
        "Tax year: 2024\n"
        "Total income (Line 15000): $98,450.00\n"
        "Net income (Line 23600): $89,200.00\n"
        "Taxable income (Line 26000): $87,500.00\n"
        "Page 1 of 4"
    )
    cat, conf = classify_document(cra_noa_text)
    assert cat == "financial_evidence" and conf >= 0.85
    sub_cat, sub_name = detect_page_subtype(cra_noa_text, cat)
    assert sub_name == "CRA_Notice_of_Assessment"
    fields = _extract_fields_map(cra_noa_text, sub_cat)
    assert fields["tax_year"] == "2024"
    assert fields["cra_line_15000_income"] == "98450.00"
    assert fields["cra_line_23600_income"] == "89200.00"
    assert fields["sin_masked"] == "XXX-XXX-789"
    role = infer_document_person_role(cra_noa_text, sub_cat, sub_name, fields)
    assert role["person_role"] == "overseas_sponsor_host"
    assert role["sponsor_jurisdiction"] == "Canada"

    # B. CRA T4 Statement of Remuneration Paid
    t4_text = (
        "Canada Revenue Agency\n"
        "T4 Statement of Remuneration Paid - Tax Year 2024\n"
        "Employer's name: Shopify Inc.\n"
        "Employee Name: Vikramkumar Rameshbhai Patel\n"
        "Social Insurance Number: 512-849-789\n"
        "Employment income - Box 14: $104,500.00\n"
    )
    t4_cat, _ = classify_document(t4_text)
    _, t4_sub = detect_page_subtype(t4_text, t4_cat)
    assert t4_sub == "CRA_T4_Remuneration"
    t4_fields = _extract_fields_map(t4_text, t4_cat)
    assert t4_fields["t4_employment_income"] == "104500.00"
    assert t4_fields["sin_masked"] == "XXX-XXX-789"

    # C. Super Visa $100k / 365-Day Medical Insurance
    sv_ins_text = (
        "MANULIFE FINANCIAL - SUPER VISA EMERGENCY MEDICAL INSURANCE POLICY\n"
        "Policy Number: SV-2026-884920\n"
        "Insured Person Name: Rameshbhai Kalidas Patel\n"
        "Coverage Amount: $100,000 CAD Emergency Medical Coverage\n"
        "Effective Date: 2026-06-01   Expiry Date: 2027-06-01\n"
        "Coverage Duration: 365 days valid for Super Visa entry to Canada\n"
    )
    ins_cat, _ = classify_document(sv_ins_text)
    assert ins_cat == "insurance_accommodation"
    _, ins_sub = detect_page_subtype(sv_ins_text, ins_cat)
    assert ins_sub == "Super_Visa_Medical_Insurance"
    ins_fields = _extract_fields_map(sv_ins_text, ins_cat)
    assert "100000.00" in ins_fields["insurance_coverage_amount"]
    assert "365" in ins_fields["insurance_duration_days"]

    # D. Canadian Residency Proof (Hydro One Utility Bill)
    hydro_text = (
        "HYDRO ONE NETWORKS INC. - ELECTRICITY UTILITY STATEMENT\n"
        "Customer Name: Vikramkumar Rameshbhai Patel\n"
        "Account Number: 2000-4928-1920\n"
        "Service Address: 145 King Street West, Toronto, ON M5H 1J8\n"
        "Amount Due: $142.80 CAD\n"
    )
    res_cat, _ = classify_document(hydro_text)
    _, res_sub = detect_page_subtype(hydro_text, res_cat)
    assert res_sub == "Canadian_Residency_Proof"
    res_fields = _extract_fields_map(hydro_text, res_cat)
    assert "M5H 1J8" in res_fields["canadian_residential_address"].upper()
    assert res_fields["province"] == "Ontario"

    # E. Canadian CRS Sibling (+15 Points Express Entry)
    sibling_text = (
        "EXPRESS ENTRY CRS SIBLING VERIFICATION - SECTION C - BROTHERS AND SISTERS\n"
        "Relationship to Applicant: Sister residing in Canada\n"
        "PERMANENT RESIDENT CARD / CARTE DE RESIDENT PERMANENT - CANADA\n"
        "Name / Nom: Nehaben Rameshbhai Patel\n"
        "ID No / UCI: 88-7766-5544\n"
        "Status: Canadian Permanent Resident\n"
    )
    sib_cat, _ = classify_document(sibling_text)
    _, sib_sub = detect_page_subtype(sibling_text, sib_cat)
    sib_fields = _extract_fields_map(sibling_text, sib_cat)
    assert sib_fields["ircc_uci"] == "88-7766-5544"
    sib_role = infer_document_person_role(sibling_text, sib_cat, sib_sub, sib_fields)
    assert sib_role["person_role"] == "canadian_crs_sibling"
    assert sib_role["sponsor_jurisdiction"] == "Canada"


def test_uk_and_australia_sponsor_extraction_and_role_attribution() -> None:
    # 1. UK Home Office eVisa Share Code
    uk_evisa = (
        "UK HOME OFFICE - IMMIGRATION STATUS (VIEW AND PROVE)\n"
        "Name: Rohan Rajesh Sharma\n"
        "Immigration Status: Settled Status (Indefinite Leave to Remain)\n"
        "Share Code: W8K 4M9 P2Q\n"
        "Valid Until: No time limit\n"
    )
    uk_cat, _ = classify_document(uk_evisa)
    assert uk_cat == "visas_residence_permits"
    _, uk_sub = detect_page_subtype(uk_evisa, uk_cat)
    assert uk_sub == "UK_eVisa_Share_Code"
    uk_fields = _extract_fields_map(uk_evisa, uk_cat)
    assert uk_fields["uk_share_code"] == "W8K-4M9-P2Q"
    assert "Settled" in uk_fields["uk_immigration_status"] or "Indefinite" in uk_fields["uk_immigration_status"]
    uk_role = infer_document_person_role(uk_evisa, uk_cat, uk_sub, uk_fields)
    assert uk_role["person_role"] == "overseas_sponsor_host"
    assert uk_role["sponsor_jurisdiction"] == "United Kingdom"

    # 2. HMRC P60 End of Year Certificate + Council Tax
    p60_text = (
        "HM Revenue & Customs (HMRC) - P60 End of Year Certificate\n"
        "Tax year to 5 April 2025\n"
        "Employee Name: Rohan Rajesh Sharma\n"
        "National Insurance Number: QQ 12 34 56 C\n"
        "Employer: Barclays Execution Services Ltd\n"
        "Total pay in this employment: £68,500.00\n"
    )
    p60_cat, _ = classify_document(p60_text)
    _, p60_sub = detect_page_subtype(p60_text, p60_cat)
    assert p60_sub == "HMRC_P60_Certificate"
    p60_fields = _extract_fields_map(p60_text, p60_cat)
    assert p60_fields["uk_gross_annual_income"] == "68500.00"
    assert p60_fields["uk_ni_number_masked"] == "XX-XX-XX-XX-C"

    ctax_text = (
        "LONDON BOROUGH OF CAMDEN - COUNCIL TAX ANNUAL BILL 2025/2026\n"
        "Liable Person: Rohan Rajesh Sharma\n"
        "Property Address: 22 Baker Street, London NW1 6XE\n"
        "Valuation Band: D\n"
    )
    ct_cat, _ = classify_document(ctax_text)
    _, ct_sub = detect_page_subtype(ctax_text, ct_cat)
    assert ct_sub == "UK_Council_Tax_Bill"
    ct_fields = _extract_fields_map(ctax_text, ct_cat)
    assert "CAMDEN" in ct_fields["uk_council_authority"].upper()
    assert "NW1 6XE" in ct_fields["uk_residential_address"].upper()

    # 3. Australia VEVO + ATO Notice of Assessment + Form 1149
    vevo_text = (
        "Australian Government - Department of Home Affairs\n"
        "VEVO - Visa Entitlement Verification Online\n"
        "Family name: MEHTA   Given names: DEVANG RAMESHBHAI\n"
        "Visa class / subclass: Skilled Independent (subclass 189)\n"
        "Visa Grant Number: 0064829104829\n"
        "Must not arrive after: 15 November 2029\n"
        "Work entitlements: Unlimited work and study entitlements (Permanent Resident)\n"
    )
    vevo_cat, _ = classify_document(vevo_text)
    assert vevo_cat == "visas_residence_permits"
    _, vevo_sub = detect_page_subtype(vevo_text, vevo_cat)
    assert vevo_sub == "Australia_VEVO_Check"
    vevo_fields = _extract_fields_map(vevo_text, vevo_cat)
    assert vevo_fields["vevo_visa_subclass"] == "189"
    assert vevo_fields["vevo_grant_number"] == "0064829104829"
    au_role = infer_document_person_role(vevo_text, vevo_cat, vevo_sub, vevo_fields)
    assert au_role["person_role"] == "overseas_sponsor_host"
    assert au_role["sponsor_jurisdiction"] == "Australia"

    ato_text = (
        "Australian Taxation Office (ATO) - Notice of Assessment\n"
        "Year ended 30 June 2025\n"
        "Taxpayer Name: Devang Rameshbhai Mehta\n"
        "Tax File Number (TFN): 849 201 654\n"
        "Your taxable income is $118,400.00 AUD\n"
    )
    ato_cat, _ = classify_document(ato_text)
    _, ato_sub = detect_page_subtype(ato_text, ato_cat)
    assert ato_sub == "ATO_Notice_of_Assessment"
    ato_fields = _extract_fields_map(ato_text, ato_cat)
    assert ato_fields["ato_taxable_income"] == "118400.00"
    assert ato_fields["ato_tfn_masked"] == "XXX-XXX-654"

    f1149_text = (
        "Australian Government - Department of Home Affairs\n"
        "Form 1149 - Application for sponsorship for Sponsored Family Visitors (Subclass 600)\n"
        "Sponsor Name: Devang Rameshbhai Mehta\n"
        "Residential Address: 48 Macquarie Street, Parramatta NSW 2150\n"
    )
    f_cat, _ = classify_document(f1149_text)
    _, f_sub = detect_page_subtype(f1149_text, f_cat)
    assert f_sub == "AU_Form_1149_Statutory_Declaration"
    f_fields = _extract_fields_map(f1149_text, f_cat)
    assert "NSW 2150" in f_fields["au_residential_address"].upper()


# ==============================================================================
# 5. MULTI-PERSON PACKET SORTER ROLE & SPONSOR JURISDICTION TESTS
# ==============================================================================


def test_packet_sorter_separates_indian_applicant_and_canadian_sponsor_with_roles() -> None:
    # Verify dataclass contract directly
    sample_doc = PacketSortedDocument(
        document_index=1,
        filename="01_CRA_Notice_of_Assessment_P001.pdf",
        relative_path="Vikram_Patel/01_CRA_Notice_of_Assessment_P001.pdf",
        category="financial_evidence",
        document_subtype="CRA Notice of Assessment",
        page_numbers=[1],
        person_role="overseas_sponsor_host",
        sponsor_jurisdiction="Canada",
    )
    sample_folder = PacketPersonFolder(
        person_id="person-1",
        canonical_name="Vikram Patel",
        folder_name="Vikram_Patel",
        documents=[sample_doc],
        total_documents=1,
        total_pages=1,
        person_role="overseas_sponsor_host",
        sponsor_jurisdiction="Canada",
    )
    f_dict = sample_folder.to_dict()
    assert f_dict["person_role"] == "overseas_sponsor_host"
    assert f_dict["sponsor_jurisdiction"] == "Canada"
    assert f_dict["documents"][0]["person_role"] == "overseas_sponsor_host"
    assert f_dict["documents"][0]["sponsor_jurisdiction"] == "Canada"

    # Build a 6-page combined packet: Indian Father (Principal Applicant) + Canadian Son (Overseas Sponsor)
    packet = fitz.open()
    pages_content = [
        # Page 1: Indian Applicant Passport
        (
            "REPUBLIC OF INDIA / PASSPORT\n"
            "Type: P  Country Code: IND  Passport No: Z8492014\n"
            "Surname: PATEL\n"
            "Given Name(s): RAMESHBHAI KALIDAS\n"
            "Nationality: INDIAN  Sex: M  Date of Birth: 14/08/1962\n"
            "Date of Issue: 10/05/2021  Date of Expiry: 09/05/2031\n"
            "P<INDPATEL<<RAMESHBHAI<KALIDAS<<<<<<<<<<<<<<\n"
            "Z8492014<2IND6208148M3105094<<<<<<<<<<<<<<02"
        ),
        # Page 2: Indian Applicant Bank Statement
        (
            "STATE BANK OF INDIA - STATEMENT OF ACCOUNT\n"
            "Account Holder: MR RAMESHBHAI KALIDAS PATEL\n"
            "12 Shantinagar Society, Ahmedabad, Gujarat 380013\n"
            "Account Number: 30948291048  IFSC: SBIN0004123\n"
            "Closing Balance: INR 24,50,000.00\n"
            "Page 1 of 1"
        ),
        # Page 3: Super Visa Medical Insurance insuring Indian Applicant
        (
            "MANULIFE SUPER VISA MEDICAL INSURANCE POLICY\n"
            "Policy Number: SV-9948201\n"
            "Insured Person Name: Rameshbhai Kalidas Patel\n"
            "Coverage Amount: $100,000 CAD Emergency Medical Insurance\n"
            "Effective Date: 2026-07-01  Expiry Date: 2027-07-01\n"
            "Duration: 365 days\n"
            "Page 1 of 1"
        ),
        # Page 4: Canadian Son's PR Card
        (
            "CANADA - PERMANENT RESIDENT CARD / CARTE DE RESIDENT PERMANENT\n"
            "Name / Nom: VIKRAMKUMAR RAMESHBHAI PATEL\n"
            "ID No / UCI: 11-2233-4455\n"
            "Nationality: IND   Expiry: 2029/08/15\n"
            "CACAN6677889900<01234567<<<<<<\n"
            "9105192M2908154CAN<<<<<<<<<<<8\n"
            "PATEL<<VIKRAMKUMAR<RAMESHBHAI<"
        ),
        # Page 5: Canadian Son's CRA Notice of Assessment
        (
            "Canada Revenue Agency - NOTICE OF ASSESSMENT (T451 E)\n"
            "Taxpayer Name: Vikramkumar Rameshbhai Patel\n"
            "Social Insurance Number: 512 849 789\n"
            "Tax year: 2024\n"
            "Total income Line 15000: $98,450.00\n"
            "Net income Line 23600: $89,200.00\n"
            "Page 1 of 1"
        ),
        # Page 6: Canadian Son's Letter of Invitation & Financial Undertaking
        (
            "LETTER OF INVITATION AND FINANCIAL UNDERTAKING FOR SUPER VISA\n"
            "Sponsor Name: Vikramkumar Rameshbhai Patel\n"
            "Residential Address: 145 King Street West, Toronto, ON M5H 1J8\n"
            "Invitee: Rameshbhai Kalidas Patel (Relationship: Father)\n"
            "I, Vikramkumar Rameshbhai Patel, a Canadian Permanent Resident residing in Ontario, "
            "hereby undertake full financial responsibility for my father during his stay in Canada.\n"
            "Sincerely,\nVikramkumar Rameshbhai Patel"
        ),
    ]
    for txt in pages_content:
        pg = packet.new_page(width=612, height=792)
        pg.insert_text((48, 64), txt, fontsize=11)
    packet_bytes = packet.tobytes()
    packet.close()

    sorted_res = sort_and_split_document_packet(
        packet_bytes,
        filename="Super_Visa_Family_Packet.pdf",
        include_split_pdf_bytes=False,
    )
    assert sorted_res["status"] == "success"
    assert sorted_res["total_persons_detected"] == 2

    folders_by_role = {f["person_role"]: f for f in sorted_res["person_folders"]}
    assert "principal_applicant" in folders_by_role
    assert "overseas_sponsor_host" in folders_by_role

    applicant_folder = folders_by_role["principal_applicant"]
    sponsor_folder = folders_by_role["overseas_sponsor_host"]

    assert "Rameshbhai" in applicant_folder["canonical_name"]
    assert applicant_folder["sponsor_jurisdiction"] is None
    app_pages = sorted(p for d in applicant_folder["documents"] for p in d["page_numbers"])
    assert app_pages == [1, 2, 3]

    assert "Vikramkumar" in sponsor_folder["canonical_name"]
    assert sponsor_folder["sponsor_jurisdiction"] == "Canada"
    sp_pages = sorted(p for d in sponsor_folder["documents"] for p in d["page_numbers"])
    assert sp_pages == [4, 5, 6]


def test_packet_sorter_canadian_crs_sibling_attribution() -> None:
    packet = fitz.open()
    pages_content = [
        (
            "REPUBLIC OF INDIA / PASSPORT\n"
            "Type: P  Country Code: IND  Passport No: K4920184\n"
            "Surname: PATEL\n"
            "Given Name(s): AARAV RAMESHBHAI\n"
            "Nationality: INDIAN  Sex: M  Date of Birth: 10/03/1995\n"
            "Date of Expiry: 09/03/2032\n"
            "P<INDPATEL<<AARAV<RAMESHBHAI<<<<<<<<<<<<<<<<\n"
            "K4920184<2IND9503104M3203098<<<<<<<<<<<<<<04"
        ),
        (
            "EXPRESS ENTRY CRS SIBLING PROOF - SECTION C - BROTHERS AND SISTERS\n"
            "Relationship to Applicant: Sister residing in Canada\n"
            "CANADA - PERMANENT RESIDENT CARD / CARTE DE RESIDENT PERMANENT\n"
            "Name / Nom: NEHABEN RAMESHBHAI PATEL\n"
            "ID No / UCI: 88-7766-5544\n"
            "CACAN8877665544<01234567<<<<<<\n"
            "9204122F2910154CAN<<<<<<<<<<<4\n"
            "PATEL<<NEHABEN<RAMESHBHAI<<<<<"
        ),
        (
            "HYDRO ONE NETWORKS INC. - ELECTRICITY UTILITY STATEMENT\n"
            "Customer Name: Nehaben Rameshbhai Patel\n"
            "Service Address: 88 Bloor Street East, Toronto, ON M4W 3G9\n"
            "Amount Due: $96.40 CAD\n"
            "Page 1 of 1"
        ),
    ]
    for txt in pages_content:
        pg = packet.new_page(width=612, height=792)
        pg.insert_text((48, 64), txt, fontsize=11)
    pdf_bytes = packet.tobytes()
    packet.close()

    res = sort_and_split_document_packet(
        pdf_bytes,
        filename="Express_Entry_Sibling_Packet.pdf",
        include_split_pdf_bytes=False,
    )
    assert res["total_persons_detected"] == 2
    roles_map = {f["person_role"]: f for f in res["person_folders"]}
    assert "principal_applicant" in roles_map
    assert "canadian_crs_sibling" in roles_map
    sib_folder = roles_map["canadian_crs_sibling"]
    assert sib_folder["sponsor_jurisdiction"] == "Canada"
    assert sorted(p for d in sib_folder["documents"] for p in d["page_numbers"]) == [2, 3]
