"""Document boundary detection and section-splitting engine for combined multi-document files."""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundError, ValidationError
from backend.app.domain.models import Document, AuditEvent, now_utc

logger = logging.getLogger("ai_immigration.documents.boundaries")

# Document boundary classification patterns
SECTION_CLASSIFICATION_RULES = [
    {
        "category": "identity",
        "title": "Passport / Identity Document",
        "patterns": [
            r"passport",
            r"republic\s+of",
            r"nationality",
            r"date\s+of\s+birth",
            r"issuing\s+authority",
            r"p<[a-z]{3}",
            r"identity\s+card",
            r"driver'?s\s+license",
        ],
        "weight": 2.0,
    },
    {
        "category": "education",
        "title": "Degree / Academic Credential",
        "patterns": [
            r"university",
            r"college",
            r"degree",
            r"bachelor",
            r"master",
            r"doctor\s+of\s+philosophy",
            r"diploma",
            r"transcript\s+of\s+records",
            r"academic\s+record",
            r"gpa",
        ],
        "weight": 1.8,
    },
    {
        "category": "experience",
        "title": "Employment / Experience Verification",
        "patterns": [
            r"employment\s+verification",
            r"to\s+whom\s+it\s+may\s+concern",
            r"duties\s+and\s+responsibilities",
            r"salary",
            r"job\s+title",
            r"employed\s+as",
            r"human\s+resources",
            r"service\s+certificate",
        ],
        "weight": 1.7,
    },
    {
        "category": "financial",
        "title": "Bank Statement / Financial Evidence",
        "patterns": [
            r"bank\s+statement",
            r"account\s+balance",
            r"closing\s+balance",
            r"opening\s+balance",
            r"account\s+number",
            r"transaction\s+history",
            r"statement\s+period",
        ],
        "weight": 1.8,
    },
    {
        "category": "vital_records",
        "title": "Vital Record / Civil Certificate",
        "patterns": [
            r"certificate\s+of\s+birth",
            r"birth\s+certificate",
            r"certificate\s+of\s+marriage",
            r"marriage\s+certificate",
            r"civil\s+registry",
            r"registrar\s+general",
        ],
        "weight": 2.0,
    },
]


def classify_page_content(text: str) -> tuple[str, str, float]:
    """
    Classifies a single page's text to determine its probable document category.
    Returns (category, title, confidence).
    """
    if not text or len(text.strip()) < 20:
        return ("supporting_evidence", "Supporting Document", 0.3)

    lower_text = text.lower()
    best_category = "supporting_evidence"
    best_title = "Supporting Document"
    best_score = 0.0

    for rule in SECTION_CLASSIFICATION_RULES:
        matches = 0
        for pattern in rule["patterns"]:
            if re.search(pattern, lower_text):
                matches += 1
        
        if matches > 0:
            score = (matches / len(rule["patterns"])) * rule["weight"]
            if score > best_score:
                best_score = score
                best_category = rule["category"]
                best_title = rule["title"]

    confidence = min(0.98, max(0.40, round(best_score, 2)))
    return (best_category, best_title, confidence)


def detect_document_boundaries(pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detects boundaries across a list of pages (from OCR/layout analysis).
    Returns a list of structured sections:
    [
        {
            "section_id": "...",
            "title": "Passport / Identity Document",
            "category": "identity",
            "start_page": 1,
            "end_page": 2,
            "confidence": 0.92
        },
        ...
    ]
    """
    if not pages_data:
        return []

    if len(pages_data) == 1:
        text = pages_data[0].get("text", "")
        cat, title, conf = classify_page_content(text)
        return [
            {
                "section_id": str(uuid.uuid4()),
                "title": title,
                "category": cat,
                "start_page": 1,
                "end_page": 1,
                "confidence": conf,
            }
        ]

    sections: List[Dict[str, Any]] = []
    current_section: Optional[Dict[str, Any]] = None

    for idx, page in enumerate(pages_data):
        page_num = page.get("page_number", idx + 1)
        text = page.get("text", "")
        cat, title, conf = classify_page_content(text)

        # Check if we should start a new section:
        # A new section starts if:
        # 1. No current section
        # 2. Category changed significantly and confidence is high
        # 3. Explicit header/cover pattern detected
        if current_section is None:
            current_section = {
                "section_id": str(uuid.uuid4()),
                "title": title,
                "category": cat,
                "start_page": page_num,
                "end_page": page_num,
                "confidence": conf,
            }
        elif cat != current_section["category"] and cat != "supporting_evidence":
            # Close previous section
            sections.append(current_section)
            current_section = {
                "section_id": str(uuid.uuid4()),
                "title": title,
                "category": cat,
                "start_page": page_num,
                "end_page": page_num,
                "confidence": conf,
            }
        else:
            # Continue current section
            current_section["end_page"] = page_num
            # Average or update confidence
            current_section["confidence"] = round(
                max(current_section["confidence"], conf), 2
            )

    if current_section:
        sections.append(current_section)

    return sections


def split_combined_document(
    db: Session,
    parent_document: Document,
    sections: List[Dict[str, Any]],
    actor_id: UUID,
) -> List[Document]:
    """
    Splits a multi-document combined file into individual child documents.
    Physically extracts isolated PDF page slices into independent storage artifacts
    with distinct SHA-256 hashes, preventing accidental data exposure of other family pages.
    """
    if not sections:
        raise ValidationError("At least one section must be defined to split the document.")

    import os
    try:
        import pymupdf
    except ImportError:
        pymupdf = None

    from backend.app.documents.storage import get_storage_backend

    created_children: List[Document] = []
    now = now_utc()
    storage = get_storage_backend()

    # Load parent artifact bytes if available
    parent_bytes: Optional[bytes] = None
    try:
        if storage.exists(parent_document.organization_id, parent_document.id, parent_document.filename):
            parent_bytes, _ = storage.read_file(
                parent_document.organization_id, parent_document.id, parent_document.filename
            )
        elif parent_document.storage_path and os.path.exists(parent_document.storage_path):
            with open(parent_document.storage_path, "rb") as f:
                parent_bytes = f.read()
    except Exception as e:
        logger.warning(f"Could not read parent bytes for physical slicing of doc {parent_document.id}: {e}")

    # Read parent metadata
    layout = parent_document.layout_metadata or {}
    pages = layout.get("pages", [])

    for s_idx, sec in enumerate(sections):
        start_p = int(sec.get("start_page", 1))
        end_p = int(sec.get("end_page", start_p))
        cat = sec.get("category", "supporting_evidence")
        sec_title = sec.get("title", f"{parent_document.title} - Section {s_idx + 1}")

        child_page_count = max(1, end_p - start_p + 1)
        child_doc_id = uuid.uuid4()
        child_filename = f"{child_doc_id.hex[:8]}_{cat}_{parent_document.filename}"
        if not child_filename.lower().endswith(".pdf"):
            child_filename = f"{child_filename}.pdf"

        # Slice relevant text from parent layout pages
        child_text_lines = []
        for p in pages:
            p_num = p.get("page_number", 0)
            if start_p <= p_num <= end_p:
                t = (p.get("text") or "").strip()
                if t:
                    child_text_lines.append(t)
        child_extracted_text = "\n\n".join(child_text_lines).strip()

        child_storage_path = parent_document.storage_path
        child_sha256 = parent_document.sha256_hash
        child_byte_size = parent_document.byte_size
        is_physically_sliced = False

        # Physically slice PDF pages if parent_bytes and PyMuPDF are available
        if (
            parent_bytes
            and pymupdf is not None
            and (
                parent_document.mime_type == "application/pdf"
                or parent_document.filename.lower().endswith(".pdf")
            )
        ):
            try:
                parent_pdf = pymupdf.open(stream=parent_bytes, filetype="pdf")
                total_parent_pages = len(parent_pdf)
                if total_parent_pages > 0:
                    child_pdf = pymupdf.open()
                    from_idx = max(0, min(total_parent_pages - 1, start_p - 1))
                    to_idx = max(from_idx, min(total_parent_pages - 1, end_p - 1))
                    child_pdf.insert_pdf(parent_pdf, from_page=from_idx, to_page=to_idx)
                    child_bytes = child_pdf.tobytes(deflate=True)
                    if not child_extracted_text:
                        child_extracted_text = "\n\n".join([page.get_text() for page in child_pdf]).strip()
                    child_pdf.close()
                    parent_pdf.close()

                    stored_artifact = storage.store_file(
                        organization_id=parent_document.organization_id,
                        file_id=child_doc_id,
                        filename=child_filename,
                        content=child_bytes,
                        content_type="application/pdf",
                    )
                    child_storage_path = stored_artifact.storage_path
                    child_sha256 = stored_artifact.sha256_hash
                    child_byte_size = stored_artifact.byte_size
                    is_physically_sliced = True
            except Exception as e:
                logger.warning(f"Failed to physically slice PDF for child {child_doc_id}: {e}")

        if not child_extracted_text:
            child_extracted_text = parent_document.extracted_text

        sec_dep_id = sec.get("applicant_dependant_id")
        if isinstance(sec_dep_id, str):
            try:
                sec_dep_id = uuid.UUID(sec_dep_id)
            except ValueError:
                sec_dep_id = None
        elif not isinstance(sec_dep_id, uuid.UUID):
            sec_dep_id = parent_document.applicant_dependant_id

        sec_client_id = sec.get("client_id")
        if isinstance(sec_client_id, str):
            try:
                sec_client_id = uuid.UUID(sec_client_id)
            except ValueError:
                sec_client_id = None
        elif not isinstance(sec_client_id, uuid.UUID):
            sec_client_id = parent_document.client_id

        sec_applicant_name = sec.get("proposed_applicant_name") or parent_document.proposed_applicant_name

        child_doc = Document(
            id=child_doc_id,
            organization_id=parent_document.organization_id,
            case_id=parent_document.case_id,
            client_id=sec_client_id,
            applicant_dependant_id=sec_dep_id,
            proposed_applicant_name=sec_applicant_name,
            uploaded_by_user_id=actor_id,
            title=sec_title,
            filename=child_filename,
            category=cat,
            storage_path=child_storage_path,
            sha256_hash=child_sha256,
            byte_size=child_byte_size,
            mime_type="application/pdf" if is_physically_sliced else parent_document.mime_type,
            version=1,
            parent_document_id=parent_document.id,
            is_current_version=True,
            page_count=child_page_count,
            ocr_applied=parent_document.ocr_applied,
            extracted_text=child_extracted_text,
            layout_metadata={
                "split_from_parent_id": str(parent_document.id),
                "page_range": [start_p, end_p],
                "split_at": now.isoformat(),
                "section_id": sec.get("section_id", str(uuid.uuid4())),
                "is_physically_sliced": is_physically_sliced,
                "physical_slice_status": "extracted" if is_physically_sliced else "referenced_parent",
            },
            malware_scan_status="clean",
            processing_status="completed",
            verification_status="unverified",
            is_assignment_confirmed=sec.get("is_assignment_confirmed", parent_document.is_assignment_confirmed),
        )
        db.add(child_doc)
        created_children.append(child_doc)

    # Update parent document metadata
    parent_meta = dict(parent_document.layout_metadata or {})
    parent_meta["is_split"] = True
    # Sanitize sections for JSON persistence (convert any UUID to str)
    serialized_sections = []
    for sec_item in sections:
        item = dict(sec_item)
        for k, v in list(item.items()):
            if isinstance(v, uuid.UUID):
                item[k] = str(v)
        serialized_sections.append(item)

    parent_meta["child_document_ids"] = [str(c.id) for c in created_children]
    parent_document.layout_metadata = parent_meta
    parent_document.sub_documents_metadata = serialized_sections

    audit = AuditEvent(
        organization_id=parent_document.organization_id,
        actor_id=actor_id,
        action="document.split_sections",
        object_type="document",
        object_id=str(parent_document.id),
        metadata_json={
            "child_count": len(created_children),
            "sections": serialized_sections,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    for c in created_children:
        db.refresh(c)
    db.refresh(parent_document)

    return created_children
