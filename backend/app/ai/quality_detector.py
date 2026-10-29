"""Document quality and integrity detector.

Detects missing pages, unreadable scans, apparent expiration dates,
incomplete date ranges, and truncated/unclear evidentiary information.
"""
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import re


@dataclass
class QualityFinding:
    finding_type: str  # document_quality, unclear_information, apparent_expiration
    severity: str  # critical, major, minor, informational
    title: str
    description: str
    evidence_text: Optional[str]
    page_number: int
    recommended_action: str
    uncertainty_limitations: str
    suggested_clarification: Optional[str]


def detect_document_quality_issues(
    document_id: str,
    title: str,
    category: str,
    page_count: int,
    extracted_text: Optional[str],
    extracted_fields: List[Dict[str, Any]],
    ocr_applied: bool,
    now: Optional[datetime] = None,
    image_dpi: Optional[int] = None,
) -> List[QualityFinding]:
    """Inspects an uploaded document for quality, completeness, and validity period issues."""
    findings: List[QualityFinding] = []
    current_time = now or datetime.now(timezone.utc)
    text = extracted_text or ""

    # 1. Detect Missing Pages from Text Indicators
    # Checks for "Page X of Y", "Sheet X of Y", "Continued on page X"
    page_total_match = re.search(r"(?:page|sheet|p\.)\s*(\d+)\s*(?:of|/)\s*(\d+)", text, re.IGNORECASE)
    if page_total_match:
        cur_p = int(page_total_match.group(1))
        tot_p = int(page_total_match.group(2))
        if tot_p > page_count and tot_p <= 100:  # Sensible upper bound to avoid false positives
            findings.append(
                QualityFinding(
                    finding_type="document_quality",
                    severity="critical" if category in ["identity_passport", "civil_status", "educational_record"] else "major",
                    title=f"Potential Missing Pages: Stated {tot_p} Pages but Only {page_count} Uploaded",
                    description=f"Evidence document '{title}' contains pagination header '{page_total_match.group(0)}' indicating {tot_p} total pages, but only {page_count} page(s) were extracted.",
                    evidence_text=page_total_match.group(0),
                    page_number=cur_p,
                    recommended_action=f"Request complete {tot_p}-page uncropped document scan from client.",
                    uncertainty_limitations="Pagination header parsed via regex. Verify whether trailing pages contain substantive endorsements or blank visa pages.",
                    suggested_clarification=f"Please upload all {tot_p} pages of '{title}', including any back pages or apostille certifications.",
                )
            )

    # 1b. Check for Low Resolution / DPI Advisory
    if image_dpi is not None and image_dpi < 150:
        findings.append(
            QualityFinding(
                finding_type="document_quality",
                severity="major",
                title=f"Low Resolution Scan Advisory ({image_dpi} DPI < 150 DPI Recommended)",
                description=f"Evidence document '{title}' has a scan resolution of approximately {image_dpi} DPI. Mobile camera scans under 150 DPI frequently suffer character confusion (e.g. '0' vs 'O', '1' vs 'I') during automated OCR extraction and consular review.",
                evidence_text=f"Estimated image resolution: {image_dpi} DPI",
                page_number=1,
                recommended_action="Obtain a high-resolution replacement scan (minimum 300 DPI or uncompressed mobile capture) with all corners visible.",
                uncertainty_limitations="Calculated based on image raster pixel density.",
                suggested_clarification="Please retake the photo in good lighting without zooming or cropping, or scan using a flatbed scanner at 300 DPI.",
            )
        )

    # 2. Check for Low OCR Quality / Poor, Torn, or Faded Scans
    scan_defect_matches = re.findall(r"\b(poor quality|faded|torn|illegible|blurred|creased|scan cut off|unreadable|faint print)\b", text, re.IGNORECASE)
    low_conf_fields = [f for f in extracted_fields if f.get("ocr_confidence") is not None and f["ocr_confidence"] < 0.70]
    
    if scan_defect_matches or low_conf_fields:
        defect_desc = ", ".join(set(m.lower() for m in scan_defect_matches)) if scan_defect_matches else "low OCR character confidence"
        field_names = ", ".join([f.get("field_label", f.get("field_name", "unknown")) for f in low_conf_fields[:3]]) if low_conf_fields else "optical scan"
        findings.append(
            QualityFinding(
                finding_type="document_quality",
                severity="critical" if (category in ["identity_passport", "civil_status_family"] or len(scan_defect_matches) >= 2) else "major",
                title=f"High Priority: Low OCR Quality / Poor, Torn, or Faded Scan Detected ({defect_desc})",
                description=f"Automated quality inspection detected optical scan defects ({defect_desc}) affecting {field_names} in '{title}'. Degraded scan quality presents significant risk of immigration authority RFE or rejection.",
                evidence_text=f"Detected defects: {defect_desc}; Fields: {field_names}",
                page_number=low_conf_fields[0].get("source_page", 1) if low_conf_fields else 1,
                recommended_action="Inspect source document. Obtain a pristine, high-resolution (300+ DPI color flatbed) replacement scan with all 4 corners visible.",
                uncertainty_limitations="Automated contrast and typographical quality assessment. Review physical scan legibility.",
                suggested_clarification="The uploaded scan appears faded, torn, or low resolution. Please provide a clear, color replacement scan with all four corners visible.",
            )
        )

    # 3. Detect Apparent Expiration Dates
    # Passport expiration check
    exp_fields = [f for f in extracted_fields if f.get("field_name") in ["expiration_date", "passport_expiry", "valid_until"]]
    for f in exp_fields:
        val = f.get("normalized_value") or f.get("original_value") or ""
        # Try parsing YYYY-MM-DD
        date_match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", val)
        if date_match:
            try:
                y, m, d = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
                exp_date = datetime(y, m, d, tzinfo=timezone.utc)
                six_months_out = current_time + timedelta(days=180)

                if exp_date < current_time:
                    findings.append(
                        QualityFinding(
                            finding_type="apparent_expiration",
                            severity="critical",
                            title=f"Expired Identification / Evidence Document: Expired {y}-{m:02d}-{d:02d}",
                            description=f"Document '{title}' indicates an expiration date of {y}-{m:02d}-{d:02d}, which has already elapsed.",
                            evidence_text=f"Expiration Date: {val}",
                            page_number=f.get("source_page", 1),
                            recommended_action="Obtain current, renewed identification document before filing petition with immigration authority.",
                            uncertainty_limitations="Expiration date extracted from document biodata. Confirm whether an official passport renewal or extension is in progress.",
                            suggested_clarification="Your passport/document indicates expiration on {y}-{m:02d}-{d:02d}. Please upload the renewed document or receipt notice.",
                        )
                    )
                elif exp_date < six_months_out:
                    findings.append(
                        QualityFinding(
                            finding_type="apparent_expiration",
                            severity="major",
                            title=f"Passport Expiring Within 6 Months: {y}-{m:02d}-{d:02d}",
                            description=f"Passport '{title}' expires on {y}-{m:02d}-{d:02d} (less than 6 months validity remaining). Most destination jurisdictions (including US 6-Month Club rules) require 6 months validity beyond petition duration.",
                            evidence_text=f"Expiration Date: {val}",
                            page_number=f.get("source_page", 1),
                            recommended_action="Advise applicant to initiate passport renewal immediately to avoid consular visa issuance delays.",
                            uncertainty_limitations="Validity rules depend on applicant nationality and bilateral six-month club treaty exemptions.",
                            suggested_clarification="Your passport expires within 6 months. We recommend initiating a renewal with your embassy or consulate promptly.",
                        )
                    )
            except ValueError:
                pass

    # 4. Incomplete Date Ranges in Employment / Financial Records
    if category in ["employment_record", "financial_evidence"]:
        # Check if text contains "from [Date]" without "to [Date]" or "present"
        start_without_end = re.search(r"(?:employed|worked|from|since)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}/\d{4}|\d{4})\b", text, re.IGNORECASE)
        has_end = re.search(r"\b(?:to|until|through|present|current|date)\b", text, re.IGNORECASE)

        if start_without_end and not has_end and len(text) < 400:
            findings.append(
                QualityFinding(
                    finding_type="unclear_information",
                    severity="minor",
                    title="Incomplete Employment / Experience Date Range",
                    description=f"Document '{title}' states employment inception without explicitly specifying whether position has concluded or is presently ongoing.",
                    evidence_text=start_without_end.group(0),
                    page_number=1,
                    recommended_action="Request updated verification letter confirming exact employment tenure and whether currently employed.",
                    uncertainty_limitations="Heuristic scan of employment letter text snippet. Review full letter context.",
                    suggested_clarification="Please ask the employer to clarify whether this employment is ongoing or provide the concluding termination date.",
                )
            )

    return findings
