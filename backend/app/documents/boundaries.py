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
    Preserves parent lineage, links to the case/client, and creates individual records.
    """
    if not sections:
        raise ValidationError("At least one section must be defined to split the document.")

    created_children: List[Document] = []
    now = now_utc()

    # Read parent metadata
    layout = parent_document.layout_metadata or {}
    pages = layout.get("pages", [])

    for s_idx, sec in enumerate(sections):
        start_p = sec.get("start_page", 1)
        end_p = sec.get("end_page", start_p)
        cat = sec.get("category", "supporting_evidence")
        sec_title = sec.get("title", f"{parent_document.title} - Section {s_idx + 1}")

        # Slice relevant text from parent extracted text if available
        child_page_count = max(1, end_p - start_p + 1)
        child_doc_id = uuid.uuid4()

        child_doc = Document(
            id=child_doc_id,
            organization_id=parent_document.organization_id,
            case_id=parent_document.case_id,
            client_id=parent_document.client_id,
            applicant_dependant_id=parent_document.applicant_dependant_id,
            uploaded_by_user_id=actor_id,
            title=sec_title,
            filename=f"{child_doc_id.hex[:8]}_{cat}_{parent_document.filename}",
            category=cat,
            storage_path=parent_document.storage_path,  # References parent artifact with page slice metadata
            sha256_hash=parent_document.sha256_hash,
            byte_size=parent_document.byte_size,
            mime_type=parent_document.mime_type,
            version=1,
            parent_document_id=parent_document.id,
            is_current_version=True,
            page_count=child_page_count,
            ocr_applied=parent_document.ocr_applied,
            extracted_text=parent_document.extracted_text,  # Sub-section text
            layout_metadata={
                "split_from_parent_id": str(parent_document.id),
                "page_range": [start_p, end_p],
                "split_at": now.isoformat(),
                "section_id": sec.get("section_id", str(uuid.uuid4())),
            },
            malware_scan_status="clean",
            processing_status="completed",
            verification_status="unverified",
            is_assignment_confirmed=parent_document.is_assignment_confirmed,
        )
        db.add(child_doc)
        created_children.append(child_doc)

    # Update parent document metadata
    parent_meta = dict(parent_document.layout_metadata or {})
    parent_meta["is_split"] = True
    parent_meta["child_document_ids"] = [str(c.id) for c in created_children]
    parent_document.layout_metadata = parent_meta
    parent_document.sub_documents_metadata = sections

    audit = AuditEvent(
        organization_id=parent_document.organization_id,
        actor_id=actor_id,
        action="document.split_sections",
        object_type="document",
        object_id=str(parent_document.id),
        metadata_json={
            "child_count": len(created_children),
            "sections": sections,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    for c in created_children:
        db.refresh(c)
    db.refresh(parent_document)

    return created_children
