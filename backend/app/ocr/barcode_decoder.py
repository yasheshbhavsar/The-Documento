"""100% Local Zero-Egress 1D/2D Barcode & QR Decoder for Immigration & Identity Documents.

Supports deterministic decoding and structured parsing of:
  - UIDAI Aadhaar PrintLetterBarcodeData XML & Secure QR text (with statutory XXXX-XXXX-1234 masking)
  - Income Tax Department e-PAN QR payloads
  - IRCC / USCIS 2D PDF417 / QR form barcodes (IMM 5257, IMM 1294, IMM 0008, I-140, etc.)
  - UK Home Office eVisa Share Code, Australian VEVO, DigiLocker, NAD, IELTS & WES verification URLs

Operates 100% locally in-memory using zero-copy PyMuPDF rendering, ``zxingcpp`` (when installed),
and OpenCV ``QRCodeDetector`` / ``BarcodeDetector`` fallbacks. Zero external network requests.
"""

from __future__ import annotations

import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore[assignment]

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    try:
        import pymupdf as fitz  # type: ignore[no-redef]
    except ImportError:
        fitz = None  # type: ignore[assignment]

try:
    import zxingcpp
except ImportError:  # pragma: no cover
    zxingcpp = None  # type: ignore[assignment]


_PAN_RE = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
_AADHAAR_DIGITS_RE = re.compile(r"(?<!\d)(\d{4}[\s-]?\d{4}[\s-]?\d{4})(?!\d)")
_IRCC_FORM_RE = re.compile(
    r"\b(IMM[\s_-]?(?:5257|1294|1295|0008|5645|5406|5709|5710|5476|5532|1344|5669)[A-Z]?|"
    r"I-(?:129|130|140|485|539|765|864|94)|DS-(?:160|260))\b",
    re.IGNORECASE,
)
_UCI_LABELED_RE = re.compile(
    r"(?:UCI|Client\s*ID)\s*[:=#-]?\s*(\d{4}[-\s]?\d{4}(?:[-\s]?\d{2})?|\d{8,10})\b",
    re.IGNORECASE,
)
_UCI_STANDALONE_RE = re.compile(r"\b(\d{2}-\d{4}-\d{4}|\d{4}-\d{4}|\d{8}|\d{10})\b")
_IRCC_APP_NO_RE = re.compile(
    r"\b([VSWFBGE]\d{9}|(?:EAC|WAC|LIN|SRC|IOE|MSC)\d{10})\b",
    re.IGNORECASE,
)
_UK_SHARE_CODE_RE = re.compile(
    r"\b([A-Z0-9]{3}[-\s]?[A-Z0-9]{3}[-\s]?[A-Z0-9]{3})\b",
    re.IGNORECASE,
)
_VEVO_GRANT_RE = re.compile(r"\b(\d{13})\b")
_URL_RE = re.compile(r"(https?://[^\s<>\"'|]+)", re.IGNORECASE)
_XML_ATTR_RE = re.compile(r'([A-Za-z_][A-Za-z0-9_:-]*)\s*=\s*["\']([^"\']*)["\']')
_DATE_TOKEN_RE = re.compile(
    r"\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{8})\b"
)


def mask_aadhaar_uid(raw_uid: str) -> str:
    """Mask first 8 digits of a 12-digit UIDAI Aadhaar number as ``XXXX-XXXX-1234``."""
    if not raw_uid:
        return ""
    cleaned = re.sub(r"[\s-]", "", str(raw_uid).strip())
    if re.fullmatch(r"[Xx*]{8}\d{4}", cleaned):
        return f"XXXX-XXXX-{cleaned[-4:]}"
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) >= 12:
        return f"XXXX-XXXX-{digits[-4:]}"
    if len(digits) == 4:
        return f"XXXX-XXXX-{digits}"
    return "XXXX-XXXX-XXXX"


def _normalize_ircc_form_code(raw_code: str) -> str:
    up = re.sub(r"[\s_-]+", " ", raw_code.strip().upper())
    m = re.match(r"^IMM\s*(\d{4})[A-Z]?$", up)
    if m:
        return f"IMM {m.group(1)}"
    return up


def _normalize_uci(raw_uci: str) -> str:
    digits = re.sub(r"\D", "", raw_uci or "")
    if len(digits) == 10:
        return f"{digits[:2]}-{digits[2:6]}-{digits[6:]}"
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:]}"
    return raw_uci.strip()


def _normalize_share_code(raw_code: str) -> str:
    alnum = re.sub(r"[^A-Za-z0-9]", "", raw_code or "").upper()
    if len(alnum) == 9:
        return f"{alnum[:3]}-{alnum[3:6]}-{alnum[6:]}"
    return raw_code.strip().upper()


def _parse_aadhaar_xml(text: str) -> dict[str, Any] | None:
    """Parse UIDAI PrintLetterBarcodeData XML (even with minor OCR/encoding malformations)."""
    lowered = text.lower()
    if (
        "printletterbarcodedata" not in lowered
        and "aadhaar" not in lowered
        and not ("uid=" in lowered and ("vtc=" in lowered or "yob=" in lowered))
    ):
        return None

    attrs: dict[str, str] = {}
    xml_start = text.find("<")
    if xml_start != -1:
        snippet = text[xml_start:].strip()
        try:
            root = ET.fromstring(snippet)
            attrs = {k.lower(): (v or "").strip() for k, v in root.attrib.items()}
        except ET.ParseError:
            for k, v in _XML_ATTR_RE.findall(snippet):
                attrs[k.lower()] = v.strip()
    else:
        for k, v in _XML_ATTR_RE.findall(text):
            attrs[k.lower()] = v.strip()

    if not attrs:
        return None

    fields: dict[str, Any] = {}
    raw_uid = attrs.get("uid", "")
    if raw_uid:
        masked = mask_aadhaar_uid(raw_uid)
        fields["uid"] = masked
        fields["aadhaar_number_masked"] = masked
    else:
        m_uid = _AADHAAR_DIGITS_RE.search(text)
        if m_uid:
            masked = mask_aadhaar_uid(m_uid.group(1))
            fields["uid"] = masked
            fields["aadhaar_number_masked"] = masked

    key_map = (
        "name",
        "gender",
        "yob",
        "dob",
        "co",
        "gname",
        "house",
        "street",
        "lm",
        "loc",
        "vtc",
        "po",
        "dist",
        "subdist",
        "state",
        "pc",
    )
    for key in key_map:
        val = attrs.get(key)
        if val:
            fields[key] = val

    if "co" not in fields and "gname" in fields:
        fields["co"] = fields["gname"]

    addr_parts = [
        fields.get(k, "")
        for k in ("house", "street", "lm", "loc", "vtc", "dist", "state", "pc")
        if fields.get(k)
    ]
    if addr_parts:
        fields["address"] = ", ".join(addr_parts)

    return fields if fields else None


def _parse_epan_payload(text: str) -> dict[str, Any] | None:
    """Parse Income Tax Department e-PAN QR payloads (JSON, key-value, or pipe/newline delimited)."""
    pan_match = _PAN_RE.search(text.upper())
    if not pan_match:
        return None

    lowered = text.lower()
    # Avoid misclassifying generic URLs unless they explicitly carry PAN details
    if text.strip().lower().startswith(("http://", "https://")) and "pan" not in lowered:
        return None

    pan_val = pan_match.group(1).upper()
    fields: dict[str, Any] = {
        "pan": pan_val,
        "pan_number": pan_val,
    }

    # 1. JSON payload check
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        try:
            obj = json.loads(stripped)
            if isinstance(obj, dict):
                lower_obj = {str(k).lower(): v for k, v in obj.items()}
                for k in ("name", "fullname", "full_name", "applicant_name"):
                    if lower_obj.get(k):
                        fields["name"] = str(lower_obj[k]).strip()
                        break
                for k in ("fathername", "father_name", "fathers_name", "fname"):
                    if lower_obj.get(k):
                        fields["father_name"] = str(lower_obj[k]).strip()
                        break
                for k in ("dob", "date_of_birth", "dateofbirth", "birth_date"):
                    if lower_obj.get(k):
                        fields["dob"] = str(lower_obj[k]).strip()
                        break
                return fields
        except Exception:
            pass

    # 2. Labeled key-value extraction
    name_m = re.search(
        r"(?:^|[|\n;,])\s*(?:Applicant\s*)?Name\s*[:=-]\s*([A-Za-z][A-Za-z .'-]{1,80}?)(?=\s*(?:[|\n;,]|Father|DOB|Date|PAN|$))",
        text,
        re.IGNORECASE,
    )
    father_m = re.search(
        r"Father(?:'?s)?\s*Name\s*[:=-]\s*([A-Za-z][A-Za-z .'-]{1,80}?)(?=\s*(?:[|\n;,]|DOB|Date|PAN|Name|$))",
        text,
        re.IGNORECASE,
    )
    dob_m = re.search(
        r"(?:DOB|Date\s*of\s*Birth)\s*[:=-]\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4}|[0-9]{4}[-/][0-9]{2}[-/][0-9]{2})",
        text,
        re.IGNORECASE,
    )

    if name_m:
        fields["name"] = name_m.group(1).strip()
    if father_m:
        fields["father_name"] = father_m.group(1).strip()
    if dob_m:
        fields["dob"] = dob_m.group(1).strip()

    # 3. Delimited fallback (e.g. "ABCDE1234F|RAJESH KUMAR PATEL|SURESHBHAI PATEL|15/08/1991")
    if "name" not in fields or "dob" not in fields:
        tokens = [
            t.strip()
            for t in re.split(r"[|\n\r;]+", text)
            if t.strip() and ":" not in t
        ]
        person_tokens: list[str] = []
        for tok in tokens:
            if tok.upper() == pan_val:
                continue
            dt_m = _DATE_TOKEN_RE.fullmatch(tok)
            if dt_m and "dob" not in fields:
                fields["dob"] = dt_m.group(1)
                continue
            if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{2,70}", tok) and tok.lower() not in {
                "income tax department",
                "govt of india",
                "government of india",
                "permanent account number",
            }:
                person_tokens.append(tok)
        if person_tokens and "name" not in fields:
            fields["name"] = person_tokens[0]
        if len(person_tokens) >= 2 and "father_name" not in fields:
            fields["father_name"] = person_tokens[1]

    if "dob" not in fields:
        any_dt = _DATE_TOKEN_RE.search(text)
        if any_dt:
            fields["dob"] = any_dt.group(1)

    return fields


def _parse_verification_url(text: str) -> tuple[str, dict[str, Any]] | None:
    """Parse UK Home Office eVisa, Australian VEVO, DigiLocker, NAD, IELTS, or University verification URLs."""
    url_match = _URL_RE.search(text)
    candidate_url = url_match.group(1).rstrip(").,;]") if url_match else ""

    if not candidate_url:
        # Handle schemeless government verification domains in QR payloads
        schemeless_m = re.search(
            r"\b((?:www\.)?(?:gov\.uk/view-prove-immigration-status|"
            r"[a-z0-9.-]*right-to-work\.service\.gov\.uk|"
            r"immi\.homeaffairs\.gov\.au/visas/already-have-a-visa/check-visa-details-and-conditions|"
            r"online\.immi\.gov\.au/evo|"
            r"[a-z0-9.-]*digilocker\.gov\.in|"
            r"[a-z0-9.-]*nad\.gov\.in|"
            r"[a-z0-9.-]*ielts\.org|"
            r"[a-z0-9.-]*wes\.org)[^\s<>\"'|]*)",
            text,
            re.IGNORECASE,
        )
        if schemeless_m:
            candidate_url = "https://" + schemeless_m.group(1).rstrip(").,;]")

    if not candidate_url:
        return None

    parsed = urlparse(candidate_url)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    query_raw = parse_qs(parsed.query)
    query_flat = {k.lower(): v[0] for k, v in query_raw.items() if v}

    # 1. UK Home Office eVisa / Share Code URL
    if (
        "view-prove-immigration-status" in path
        or "right-to-work.service.gov.uk" in host
        or "right-to-rent.service.gov.uk" in host
        or ("gov.uk" in host and ("immigration" in path or "share-code" in path or "evisa" in path))
    ):
        fields: dict[str, Any] = {
            "verification_url": candidate_url,
            "authority": "UK Home Office",
            "jurisdiction": "United Kingdom",
        }
        for qk in ("share", "share_code", "sharecode", "code"):
            if query_flat.get(qk):
                fields["uk_share_code"] = _normalize_share_code(query_flat[qk])
                break
        if "uk_share_code" not in fields:
            sc_m = re.search(
                r"(?:share\s*code\s*[:=#-]?\s*)([A-Z0-9]{3}[-\s]?[A-Z0-9]{3}[-\s]?[A-Z0-9]{3})\b",
                text,
                re.IGNORECASE,
            )
            if sc_m:
                fields["uk_share_code"] = _normalize_share_code(sc_m.group(1))
        return "uk_evisa_verification_url", fields

    # 2. Australian Department of Home Affairs VEVO URL
    if (
        ("homeaffairs.gov.au" in host and ("check-visa-details-and-conditions" in path or "vevo" in path))
        or ("immi.gov.au" in host and ("evo" in path or "vevo" in path))
    ):
        fields = {
            "verification_url": candidate_url,
            "authority": "Australian Department of Home Affairs (VEVO)",
            "jurisdiction": "Australia",
        }
        for qk in ("grant", "grant_number", "grantnumber", "visagrantnumber", "vgn"):
            if query_flat.get(qk):
                fields["vevo_grant_number"] = query_flat[qk]
                break
        if "vevo_grant_number" not in fields:
            vgn_m = _VEVO_GRANT_RE.search(text)
            if vgn_m:
                fields["vevo_grant_number"] = vgn_m.group(1)
        if query_flat.get("trn"):
            fields["transaction_reference_number"] = query_flat["trn"]
            fields["vevo_trn"] = query_flat["trn"]
        return "australia_vevo_verification_url", fields

    # 3. DigiLocker / NAD / IELTS / WES / Academic University Verification URLs
    portal: str | None = None
    if "digilocker.gov.in" in host:
        portal = "DigiLocker"
    elif "nad.gov.in" in host or "abc.gov.in" in host:
        portal = "National Academic Depository (NAD)"
    elif "ielts.org" in host or "ielts.ucles.org.uk" in host or "britishcouncil" in host and "ielts" in path:
        portal = "IELTS Verification"
    elif "wes.org" in host or "icascanada.ca" in host or "iqas.alberta.ca" in host:
        portal = "ECA Credential Verification"
    elif any(
        tok in host or tok in path
        for tok in (".edu", ".ac.in", ".ac.uk", "verify", "transcript", "certificate", "degree")
    ):
        portal = "Academic / Institutional Verification"

    if portal:
        fields = {
            "verification_url": candidate_url,
            "verification_portal": portal,
            "verification_domain": host,
        }
        for k, v in query_flat.items():
            fields[k] = v
        return "credential_verification_url", fields

    return "generic_url", {"verification_url": candidate_url}


def _parse_ircc_uscis_2d_form(text: str) -> dict[str, Any] | None:
    """Parse IRCC / USCIS 2D PDF417 / QR form barcode payloads (IMM 5257, IMM 1294, IMM 0008, I-140, etc.)."""
    form_match = _IRCC_FORM_RE.search(text)
    uci_labeled = _UCI_LABELED_RE.search(text)
    pipe_count = text.count("|") + text.count("^") + text.count("~")

    if not form_match and not (uci_labeled and pipe_count >= 1):
        return None

    fields: dict[str, Any] = {}
    if form_match:
        norm_form = _normalize_ircc_form_code(form_match.group(1))
        fields["form_code"] = norm_form
        fields["authority"] = "IRCC" if norm_form.startswith("IMM") else "USCIS"

    if uci_labeled:
        uci_val = _normalize_uci(uci_labeled.group(1))
        fields["uci"] = uci_val
        fields["ircc_uci"] = uci_val

    app_m = _IRCC_APP_NO_RE.search(text)
    if app_m:
        fields["application_number"] = app_m.group(1).upper()

    if pipe_count >= 1:
        raw_tokens = [t.strip() for t in re.split(r"[|^~\t]+", text) if t.strip()]
        fields["delimited_fields"] = raw_tokens
        for tok in raw_tokens:
            if ":" in tok or "=" in tok:
                k, v = re.split(r"[:=]", tok, maxsplit=1)
                kl = k.strip().lower().replace(" ", "_")
                vv = v.strip()
                if kl in {"uci", "client_id"} and vv:
                    norm_u = _normalize_uci(vv)
                    fields["uci"] = norm_u
                    fields["ircc_uci"] = norm_u
                elif kl in {"app", "application", "application_no", "application_number"} and vv:
                    fields["application_number"] = vv
                elif kl in {"surname", "family_name", "last_name"} and vv:
                    fields["family_name"] = vv
                elif kl in {"given_name", "given_names", "first_name"} and vv:
                    fields["given_name"] = vv
                elif kl in {"dob", "date_of_birth"} and vv:
                    fields["dob"] = vv
            elif "uci" not in fields and _UCI_STANDALONE_RE.fullmatch(tok):
                # Avoid mistaking YYYYMMDD dates for 8-digit UCIs when starting with 19xx/20xx
                if not (len(tok) == 8 and tok[:2] in {"19", "20"} and 1 <= int(tok[4:6]) <= 12):
                    norm_u = _normalize_uci(tok)
                    fields["uci"] = norm_u
                    fields["ircc_uci"] = norm_u

        # Positional heuristic for pure pipe-delimited IRCC barcodes:
        # e.g. "IMM 5257|11-2233-4455|V309988776|PATEL|RAJESH KUMAR|1991-08-15|IND"
        alpha_name_tokens = [
            t
            for t in raw_tokens
            if ":" not in t
            and "=" not in t
            and not _IRCC_FORM_RE.search(t)
            and re.fullmatch(r"[A-Za-z][A-Za-z '-]{1,40}", t)
            and len(t) > 3
        ]
        if len(alpha_name_tokens) >= 2:
            fields.setdefault("family_name", alpha_name_tokens[0])
            fields.setdefault("given_name", alpha_name_tokens[1])

    if "uci" not in fields:
        # Check standalone UCI anywhere in non-delimited text
        for cand_m in _UCI_STANDALONE_RE.finditer(text):
            cand = cand_m.group(1)
            if len(cand) == 8 and cand[:2] in {"19", "20"}:
                continue
            norm_u = _normalize_uci(cand)
            fields["uci"] = norm_u
            fields["ircc_uci"] = norm_u
            break

    return fields if fields else None


def parse_barcode_payload(raw_text: str) -> tuple[str, dict[str, Any]]:
    """Deterministically classify and extract structured fields from a decoded barcode payload.

    Returns ``(parsed_type, parsed_fields)``.
    """
    text = (raw_text or "").strip()
    if not text:
        return "empty", {}

    # 1. UIDAI Aadhaar XML / PrintLetterBarcodeData
    aadhaar_fields = _parse_aadhaar_xml(text)
    if aadhaar_fields is not None:
        return "uidai_aadhaar_xml", aadhaar_fields

    # 2. IRCC / USCIS 2D Form Barcode (IMM 5257, IMM 1294, IMM 0008, etc.)
    ircc_fields = _parse_ircc_uscis_2d_form(text)
    if ircc_fields is not None:
        return "ircc_uscis_2d_form", ircc_fields

    # 3. UK Home Office eVisa / Australia VEVO / DigiLocker / NAD / IELTS Verification URLs
    url_parsed = _parse_verification_url(text)
    if url_parsed is not None and url_parsed[0] != "generic_url":
        return url_parsed

    # 4. Income Tax e-PAN QR
    epan_fields = _parse_epan_payload(text)
    if epan_fields is not None:
        return "income_tax_epan_qr", epan_fields

    # 5. Standalone UK Home Office Share Code text QR
    if re.search(r"\bshare\s*code\b", text, re.IGNORECASE):
        sc_m = re.search(
            r"share\s*code\s*[:=#-]?\s*([A-Z0-9]{3}[-\s]?[A-Z0-9]{3}[-\s]?[A-Z0-9]{3})\b",
            text,
            re.IGNORECASE,
        )
        if sc_m:
            return "uk_evisa_share_code", {
                "uk_share_code": _normalize_share_code(sc_m.group(1)),
                "authority": "UK Home Office",
            }

    # 6. Generic URL fallback
    if url_parsed is not None:
        return url_parsed

    # 7. Unstructured fallback (always mask any 12-digit Aadhaar-like number if present)
    fallback_fields: dict[str, Any] = {"text": text[:500]}
    aadhaar_m = _AADHAAR_DIGITS_RE.search(text)
    if aadhaar_m:
        fallback_fields["uid"] = mask_aadhaar_uid(aadhaar_m.group(1))
    return "unstructured_barcode", fallback_fields


def _pixmap_to_bgr(pix: Any) -> Any:
    """Zero-copy conversion of a PyMuPDF Pixmap buffer to a BGR NumPy array."""
    buf = np.frombuffer(pix.samples, dtype=np.uint8)
    row_bytes = pix.width * pix.n
    if pix.stride == row_bytes:
        arr = buf.reshape(pix.height, pix.width, pix.n)
    else:
        arr = buf.reshape(pix.height, pix.stride)[:, :row_bytes].reshape(
            pix.height, pix.width, pix.n
        )

    if pix.n == 1:
        return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    if pix.n == 4:
        return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _normalize_barcode_format(raw_fmt: Any) -> str:
    name = getattr(raw_fmt, "name", None) or str(raw_fmt or "UNKNOWN")
    if "." in name:
        name = name.split(".")[-1]
    cleaned = name.replace(" ", "").upper()
    mapping = {
        "QRCODE": "QR_CODE",
        "QR_CODE": "QR_CODE",
        "PDF417": "PDF_417",
        "PDF_417": "PDF_417",
        "AZTEC": "AZTEC",
        "DATAMATRIX": "DATA_MATRIX",
        "DATA_MATRIX": "DATA_MATRIX",
        "CODE128": "CODE_128",
        "CODE_128": "CODE_128",
        "CODE39": "CODE_39",
        "EAN13": "EAN_13",
    }
    return mapping.get(cleaned, name)


def _decode_barcodes_from_bgr_image(img: Any, page_number: int) -> list[dict[str, Any]]:
    """Decode all 1D/2D barcodes from a BGR NumPy image using zxing-cpp and OpenCV fallbacks."""
    if img is None or getattr(img, "size", 0) == 0:
        return []

    raw_hits: list[tuple[str, str, float]] = []
    seen_texts: set[str] = set()

    def _record(fmt: str, text_val: str, conf: float) -> None:
        cleaned_text = (text_val or "").strip()
        if not cleaned_text or cleaned_text in seen_texts:
            return
        seen_texts.add(cleaned_text)
        raw_hits.append((fmt, cleaned_text, conf))

    # Pass 1: zxing-cpp (captures QR, PDF417, Aztec, DataMatrix, Code128, etc.)
    if zxingcpp is not None:
        try:
            zx_results = zxingcpp.read_barcodes(img)
            for item in zx_results or []:
                if getattr(item, "valid", True) and getattr(item, "text", ""):
                    _record(_normalize_barcode_format(item.format), item.text, 0.99)
        except Exception as exc:
            logger.debug("zxingcpp primary decode failed on page %d: %s", page_number, exc)

        # Low-contrast / small barcode second pass via grayscale Otsu threshold
        if not raw_hits and cv2 is not None:
            try:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
                h, w = gray.shape[:2]
                probe = (
                    cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
                    if min(h, w) < 360
                    else gray
                )
                _, thresh = cv2.threshold(probe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                zx_retry = zxingcpp.read_barcodes(thresh)
                for item in zx_retry or []:
                    if getattr(item, "valid", True) and getattr(item, "text", ""):
                        _record(_normalize_barcode_format(item.format), item.text, 0.96)
            except Exception as exc:
                logger.debug("zxingcpp threshold retry failed on page %d: %s", page_number, exc)

    # Pass 2: OpenCV fallback (always available when zxing-cpp is absent or misses a QR/1D barcode)
    if cv2 is not None and (zxingcpp is None or not raw_hits):
        try:
            qr_detector = cv2.QRCodeDetector()
            ok, decoded_info, *_ = qr_detector.detectAndDecodeMulti(img)
            if ok and decoded_info:
                for txt in decoded_info:
                    if txt:
                        _record("QR_CODE", txt, 0.94)
            if not raw_hits:
                single_txt, *_ = qr_detector.detectAndDecode(img)
                if single_txt:
                    _record("QR_CODE", single_txt, 0.94)
        except Exception as exc:
            logger.debug("OpenCV QRCodeDetector failed on page %d: %s", page_number, exc)

        if hasattr(cv2, "barcode") and hasattr(cv2.barcode, "BarcodeDetector"):
            try:
                bc_detector = cv2.barcode.BarcodeDetector()
                bc_res = bc_detector.detectAndDecodeWithType(img)
                if isinstance(bc_res, tuple) and len(bc_res) >= 3 and bc_res[0]:
                    decoded_info, decoded_types = bc_res[1], bc_res[2]
                    for txt, btype in zip(decoded_info or [], decoded_types or []):
                        if txt:
                            _record(_normalize_barcode_format(btype or "BARCODE_1D"), txt, 0.91)
            except Exception as exc:
                logger.debug("OpenCV BarcodeDetector failed on page %d: %s", page_number, exc)

    results: list[dict[str, Any]] = []
    for fmt, raw_txt, conf in raw_hits:
        parsed_type, parsed_fields = parse_barcode_payload(raw_txt)
        results.append(
            {
                "format": fmt,
                "raw_text": raw_txt,
                "page_number": page_number,
                "parsed_type": parsed_type,
                "parsed_fields": parsed_fields,
                "confidence": round(float(conf), 4),
            }
        )
    return results


def decode_document_barcodes(
    content: bytes,
    mime_type: str = "application/pdf",
    max_pages: int = 10,
) -> list[dict[str, Any]]:
    """Decode and deterministically parse QR & 1D/2D barcodes from PDF or image bytes.

    Each returned item conforms strictly to:
        ``{"format": str, "raw_text": str, "page_number": int, "parsed_type": str, "parsed_fields": dict, "confidence": float}``
    """
    if not content or np is None or cv2 is None:
        return []

    is_pdf = (mime_type or "").lower().strip() == "application/pdf" or content[:5] == b"%PDF-"
    all_barcodes: list[dict[str, Any]] = []

    if is_pdf:
        if fitz is None:
            return []
        doc = None
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            render_scale = 190.0 / 72.0
            mat = fitz.Matrix(render_scale, render_scale)
            page_limit = min(len(doc), max(1, int(max_pages)))
            for page_idx in range(page_limit):
                page = doc[page_idx]
                pix = page.get_pixmap(matrix=mat, alpha=False)
                bgr_img = _pixmap_to_bgr(pix)
                all_barcodes.extend(_decode_barcodes_from_bgr_image(bgr_img, page_idx + 1))
        except Exception as exc:
            logger.warning("Barcode PDF decoding failed cleanly: %s", exc)
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
        return all_barcodes

    # Standalone raster image decoding
    try:
        buf = np.frombuffer(content, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is not None:
            all_barcodes.extend(_decode_barcodes_from_bgr_image(img, 1))
    except Exception as exc:
        logger.warning("Barcode image decoding failed cleanly: %s", exc)

    return all_barcodes
