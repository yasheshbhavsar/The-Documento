"""Regression tests for real-world scanned Passport OCR, orientation, MRZ repair, and multi-page stitching."""
from __future__ import annotations

import io
import os
import pymupdf
import pytest
from PIL import Image, ImageDraw, ImageFont
from fastapi.testclient import TestClient

from backend.app.ai.identity_resolver import IdentityResolver
from backend.app.main import app
from backend.app.ocr.mrz_parser import MRZParser

client = TestClient(app)


def _get_font(size: int, mono: bool = False):
    candidates = (
        [r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\cour.ttf"]
        if mono
        else [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\calibri.ttf"]
    )
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _mrz_cd(s: str) -> str:
    weights = [7, 3, 1]
    total = 0
    for i, ch in enumerate(s):
        if "0" <= ch <= "9":
            v = ord(ch) - 48
        elif "A" <= ch <= "Z":
            v = ord(ch) - 55
        else:
            v = 0
        total += v * weights[i % 3]
    return str(total % 10)


def _render_synthetic_passport_front() -> Image.Image:
    w, h = 1200, 840
    img = Image.new("RGB", (w, h), (245, 242, 234))
    draw = ImageDraw.Draw(img)
    f_title = _get_font(24)
    f_lbl = _get_font(15)
    f_val = _get_font(20)
    f_mrz = _get_font(28, mono=True)

    draw.text((60, 30), "REPUBLIC OF INDIA   BHARAT GANARAJYA", fill=(20, 30, 70), font=f_title)
    draw.text((60, 65), "PASSPORT   PASSEPORT", fill=(40, 40, 40), font=f_lbl)
    draw.rectangle([50, 120, 300, 460], outline=(90, 90, 90), width=2)

    draw.text((340, 115), "Type / Type      Country Code     Passport No. / Passeport No.", fill=(80, 80, 80), font=f_lbl)
    draw.text((340, 140), "P                IND              T8392014", fill=(15, 15, 15), font=f_val)

    rows = [
        ("Surname / Nom", "PATEL"),
        ("Given Name(s) / Prenoms", "ROHAN MAHESH"),
        ("Nationality / Nationalite", "INDIAN"),
        ("Sex / Sexe      Date of Birth", "M               14/08/1992"),
        ("Place of Birth", "AHMEDABAD, GUJARAT"),
        ("Date of Issue   Date of Expiry", "12/05/2021      11/05/2031"),
    ]
    y = 195
    for lbl, val in rows:
        draw.text((340, y), lbl, fill=(90, 90, 90), font=f_lbl)
        draw.text((340, y + 20), val, fill=(10, 10, 10), font=f_val)
        y += 65

    l1 = "P<INDPATEL<<ROHAN<MAHESH<<<<<<<<<<<<<<<<<<<<"
    doc9 = "T8392014<"
    c_doc = _mrz_cd(doc9)
    dob = "920814"
    c_dob = _mrz_cd(dob)
    exp = "310511"
    c_exp = _mrz_cd(exp)
    opt = "<<<<<<<<<<<<<<"
    c_opt = "0"
    comp = _mrz_cd(doc9 + c_doc + dob + c_dob + exp + c_exp + opt + c_opt)
    l2 = f"{doc9}{c_doc}IND{dob}{c_dob}M{exp}{c_exp}{opt}{c_opt}{comp}"
    draw.rectangle([0, 680, w, h], fill=(252, 250, 245))
    draw.text((40, 710), l1, fill=(10, 10, 10), font=f_mrz)
    draw.text((40, 760), l2, fill=(10, 10, 10), font=f_mrz)
    return img


def _render_synthetic_passport_back() -> Image.Image:
    w, h = 1200, 840
    img = Image.new("RGB", (w, h), (245, 242, 234))
    draw = ImageDraw.Draw(img)
    f_lbl = _get_font(15)
    f_val = _get_font(20)
    fields = [
        ("Name of Father / Legal Guardian", "MAHESH NATVARLAL PATEL"),
        ("Name of Mother", "KAVITA MAHESH PATEL"),
        ("Name of Spouse", "PRIYA ROHAN PATEL"),
        ("Address", "42 SATELLITE ROAD, AHMEDABAD, GUJARAT 380015, INDIA"),
        ("Old Passport No. with Date and Place of Issue", "K7129403   15/04/2011   AHMEDABAD"),
        ("File No.", "AH2075123498121"),
    ]
    y = 70
    for lbl, val in fields:
        draw.text((60, y), lbl, fill=(90, 90, 90), font=f_lbl)
        draw.text((60, y + 22), val, fill=(10, 10, 10), font=f_val)
        y += 85
    draw.text((60, 680), "ECNR   EMIGRATION CHECK NOT REQUIRED", fill=(20, 40, 90), font=f_val)
    return img


def _images_to_pdf_bytes(images: list[Image.Image], quality: int = 86) -> bytes:
    doc = pymupdf.open()
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality)
        page = doc.new_page(width=im.width * 72 / 150, height=im.height * 72 / 150)
        page.insert_image(page.rect, stream=buf.getvalue())
    out = doc.tobytes()
    doc.close()
    return out


def test_scanned_image_only_passport_pdf_and_no_false_pin():
    front = _render_synthetic_passport_front()
    pdf_bytes = _images_to_pdf_bytes([front])

    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("PASSPORT_SCANNED.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["recognition"]["category"] == "identity_passport"
    fmap = {f["field_name"]: f["normalized_value"] or f["original_value"] for f in body["extracted_fields"]}
    assert fmap.get("passport_number") == "T8392014"
    assert fmap.get("full_name") == "Rohan Mahesh Patel"
    assert fmap.get("date_of_birth") == "1992-08-14"
    assert fmap.get("expiry_date") == "2031-05-11"
    ic = body["specialized_intelligence"]["identity_compliance"]["indian_passport"]
    assert ic["pin_code"] is None


@pytest.mark.parametrize("angle", [90, 180, 270])
def test_rotated_scanned_passport_pdfs_auto_orient_cleanly(angle: int):
    front = _render_synthetic_passport_front().rotate(angle, expand=True)
    pdf_bytes = _images_to_pdf_bytes([front])

    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": (f"PASSPORT_ROT_{angle}.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    body = resp.json()
    fmap = {f["field_name"]: f["normalized_value"] or f["original_value"] for f in body["extracted_fields"]}
    assert fmap.get("passport_number") == "T8392014"
    assert fmap.get("full_name") == "Rohan Mahesh Patel"
    assert fmap.get("surname") == "Patel"
    assert fmap.get("given_names") == "Rohan Mahesh"
    assert fmap.get("expiry_date") == "2031-05-11"


def test_exif_rotated_standalone_jpeg_passport():
    front = _render_synthetic_passport_front()
    rotated = front.rotate(90, expand=True)
    exif = Image.Exif()
    exif[274] = 8  # Orientation tag 8 = 270 deg CW needed to undo 90 CCW
    buf = io.BytesIO()
    rotated.save(buf, format="JPEG", quality=88, exif=exif.tobytes())

    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("passport_mobile.jpg", buf.getvalue(), "image/jpeg")},
    )
    assert resp.status_code == 200
    body = resp.json()
    fmap = {f["field_name"]: f["normalized_value"] or f["original_value"] for f in body["extracted_fields"]}
    assert fmap.get("passport_number") == "T8392014"
    assert fmap.get("full_name") == "Rohan Mahesh Patel"


def test_two_page_front_back_passport_stays_unified_in_smart_intake():
    front = _render_synthetic_passport_front()
    back = _render_synthetic_passport_back()
    pdf_bytes = _images_to_pdf_bytes([front, back])

    resp = client.post(
        "/api/v1/extractor/smart-intake",
        files=[("files", ("PASSPORT_2PAGE.pdf", pdf_bytes, "application/pdf"))],
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["logical_documents_count"] == 1
    assert body["was_multi_document_split"] is False
    doc = body["documents"][0]
    assert doc["category"] == "identity_passport"
    assert doc["page_numbers"] == [1, 2]
    fmap = {f["field_name"]: f["normalized_value"] or f["original_value"] for f in doc["extracted_fields"]}
    assert fmap.get("passport_number") == "T8392014"
    assert fmap.get("passport_file_number") == "AH2075123498121"
    assert "Patel" in (fmap.get("father_legal_name") or "")
    assert "380015" in (fmap.get("residential_address") or "")


def test_mrz_surname_ending_in_l_and_k_preserved_and_filler_noise_reconciled():
    # Single '<' after surname ending in L must preserve trailing 'L' in PATEL
    mrz_single = MRZParser.parse_text(
        "P<INDPATEL<ROHAN<MAHESH<<<<<<<<<<<<<<<<<<<\n"
        "T8392014<9IND9208142M3105113<<<<<<<<<<<<<<00"
    )
    assert mrz_single is not None
    assert mrz_single.surname == "Patel"
    assert mrz_single.given_names == "Rohan Mahesh"

    # Real name ending in K must stay intact
    mrz_vivek = MRZParser.parse_text(
        "P<INDPATEL<<VIVEK<<<<<<<<<<<<<<<<<<<<<<<<<<<\n"
        "T8392014<9IND9208142M3105113<<<<<<<<<<<<<<00"
    )
    assert mrz_vivek is not None
    assert mrz_vivek.given_names == "Vivek"

    # Tilted MRZ trailing '<' misread as 'K' reconciles cleanly against visual OCR name
    noisy_passport = IdentityResolver.parse_indian_passport(
        "REPUBLIC OF INDIA PASSPORT\n"
        "Surname: PATEL\n"
        "Given Name(s): ROHAN MAHESH\n"
        "P<INDPATEL<<ROHAN<MAHESHK<<<<<<<<<<<<<<<<<<<\n"
        "T8392014<9IND9208142M3105113<<<<<<<<<<<<<<00\n"
        "Date of Issue: 12/05/2021 Date of Expiry: 11/05/2031"
    )
    assert noisy_passport is not None
    assert noisy_passport.holder_name == "Rohan Mahesh Patel"
    assert noisy_passport.given_names == "Rohan Mahesh"
    assert noisy_passport.pin_code is None


def test_blank_scanned_pdf_extracts_zero_fabricated_fields():
    blank = Image.new("RGB", (800, 600), (255, 255, 255))
    pdf_bytes = _images_to_pdf_bytes([blank])
    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("blank.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["extracted_fields"] == []
