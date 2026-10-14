import logging
import uuid
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.documents.storage import get_storage_backend
from backend.app.domain.models import (
    Document,
    DocumentExtractedField,
    AuditEvent,
    DocumentProcessingRun,
    now_utc,
)
from backend.app.extraction.classifier import classify_document
from backend.app.extraction.service import extract_structured_fields
from backend.app.ocr.engine import OCREngine, detect_language

logger = logging.getLogger("ai_immigration.documents.processor")


def process_document_pipeline(db: Session, document_id: UUID) -> Document:
    """
    Executes the full asynchronous document processing and extraction pipeline:
    1. Status update to 'processing' and track DocumentProcessingRun stage
    2. Private storage retrieval with SHA-256 integrity verification
    3. Multi-page text extraction and OCR layout analysis
    4. Language detection
    5. Category classification
    6. Structured field extraction with data provenance
    7. Preservation of existing manual human corrections
    8. Completion status update (verification status remains decoupled)
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found for processing.")

    doc.processing_status = "processing"
    doc.processing_error = None

    # Track processing run
    run = (
        db.query(DocumentProcessingRun)
        .filter(
            DocumentProcessingRun.document_id == doc.id,
            DocumentProcessingRun.status.in_(["queued", "processing"]),
        )
        .order_by(DocumentProcessingRun.created_at.desc())
        .first()
    )
    if not run:
        run = DocumentProcessingRun(
            id=uuid.uuid4(),
            organization_id=doc.organization_id,
            document_id=doc.id,
            run_number=doc.version,
            idempotency_key=f"run-{doc.id}-{uuid.uuid4().hex[:8]}",
            stage="preprocessing",
            status="processing",
            trigger_type="sync_call",
            progress_percent=10,
            started_at=now_utc(),
        )
        db.add(run)
    else:
        run.status = "processing"
        run.stage = "preprocessing"
        if not run.started_at:
            run.started_at = now_utc()
        run.progress_percent = 10
    db.commit()

    try:
        storage = get_storage_backend()
        content, actual_hash = storage.read_file(
            organization_id=doc.organization_id,
            file_id=doc.id,
            filename=f"v{doc.version}_{doc.filename}",
            expected_hash=doc.sha256_hash,
        )

        # 1. OCR & Layout Extraction
        run.stage = "ocr"
        run.progress_percent = 25
        db.commit()

        pages = OCREngine.extract_document(content=content, mime_type=doc.mime_type)
        page_texts = [p.text for p in pages if p.text]
        full_extracted_text = "\n\n".join(page_texts)

        doc.page_count = len(pages)
        doc.ocr_applied = any(p.ocr_applied for p in pages)
        doc.extracted_text = full_extracted_text

        # 2. Language Detection
        detected_lang = detect_language(full_extracted_text)
        doc.detected_language = detected_lang

        # 3. Document Classification
        run.stage = "classification"
        run.progress_percent = 50
        db.commit()

        detected_category, class_confidence = classify_document(
            text=full_extracted_text,
            filename=doc.filename,
            declared_category=doc.category,
        )
        if doc.category in ("supporting_evidence", "other") and detected_category != "supporting_evidence":
            doc.category = detected_category

        # 4. Layout Metadata Packaging
        layout_pages = []
        for p in pages:
            layout_pages.append(
                {
                    "page_number": p.page_number,
                    "width": p.width,
                    "height": p.height,
                    "ocr_applied": p.ocr_applied,
                    "ocr_confidence": p.ocr_confidence,
                    "blocks_count": len(p.blocks),
                    "blocks": [
                        {
                            "x0": b.x0,
                            "y0": b.y0,
                            "x1": b.x1,
                            "y1": b.y1,
                            "text": b.text,
                            "confidence": b.confidence,
                        }
                        for b in p.blocks[:50]  # Cap summary blocks for metadata storage
                    ],
                }
            )
        doc.layout_metadata = {
            "page_count": len(pages),
            "detected_language": detected_lang,
            "classification_confidence": class_confidence,
            "pages": layout_pages,
        }

        # 5. Structured Field Extraction & Data Provenance
        run.stage = "extraction"
        run.progress_percent = 75
        db.commit()

        # Retain any previously human-corrected fields during reprocessing
        existing_corrected = {
            f.field_name: f
            for f in db.query(DocumentExtractedField)
            .filter(
                DocumentExtractedField.document_id == doc.id,
                DocumentExtractedField.is_manually_corrected.is_(True),
            )
            .all()
        }

        # Remove previous uncorrected fields for clean re-extraction
        db.query(DocumentExtractedField).filter(
            DocumentExtractedField.document_id == doc.id,
            DocumentExtractedField.is_manually_corrected.is_(False),
        ).delete()

        new_extracted_fields = extract_structured_fields(
            document_id=doc.id,
            organization_id=doc.organization_id,
            category=doc.category,
            pages=pages,
            document_bytes=content,
            mime_type=doc.mime_type,
            filename=doc.filename,
        )

        for field in new_extracted_fields:
            if field.field_name in existing_corrected:
                # Keep human correction active on the field
                corrected = existing_corrected[field.field_name]
                field.is_manually_corrected = True
                field.corrected_value = corrected.corrected_value
                field.corrected_by_user_id = corrected.corrected_by_user_id
                field.corrected_at = corrected.corrected_at
                field.correction_reason = corrected.correction_reason
                field.correction_history = corrected.correction_history
                field.validation_status = "corrected"

            db.add(field)

        # 6. Mark Processing Completed
        doc.processing_status = "completed"

        # Update run completion
        run.stage = "completed"
        run.status = "completed"
        run.progress_percent = 100
        run.completed_at = now_utc()
        run.metrics = {
            "page_count": doc.page_count,
            "detected_language": detected_lang,
            "classification_confidence": class_confidence,
            "fields_extracted": len(new_extracted_fields),
            "ocr_applied": doc.ocr_applied,
        }

        # CRITICAL: verification_status remains decoupled from processing_status!
        # Do not automatically mark verified.
        if doc.verification_status not in ("verified", "rejected"):
            doc.verification_status = "unverified"

        # Record audit event
        audit = AuditEvent(
            organization_id=doc.organization_id,
            actor_id=doc.uploaded_by_user_id,
            action="document.processed",
            object_type="document",
            object_id=str(doc.id),
            metadata_json={
                "page_count": doc.page_count,
                "detected_language": detected_lang,
                "category": doc.category,
                "fields_extracted": len(new_extracted_fields),
                "ocr_applied": doc.ocr_applied,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(doc)
        return doc

    except Exception as e:
        logger.error(f"Document processing failed for {doc.id}: {e}", exc_info=True)
        doc.processing_status = "failed"
        doc.processing_error = str(e)
        doc.retry_count += 1

        if run:
            run.stage = "failed"
            run.status = "failed"
            run.error_code = type(e).__name__
            run.error_message = str(e)
            run.completed_at = now_utc()

        audit = AuditEvent(
            organization_id=doc.organization_id,
            actor_id=doc.uploaded_by_user_id,
            action="document.processing_failed",
            object_type="document",
            object_id=str(doc.id),
            metadata_json={"error": str(e), "retry_count": doc.retry_count},
        )
        db.add(audit)
        db.commit()
        db.refresh(doc)
        return doc


def process_document_background_task(document_id: UUID) -> None:
    """
    Executes the document processing pipeline inside a dedicated session.
    Safe for FastAPI background_tasks and standalone worker execution,
    eliminating request-scoped session connection leaks.
    """
    from backend.app.db.session import SessionLocal

    session = SessionLocal()
    try:
        process_document_pipeline(session, document_id)
    finally:
        session.close()
