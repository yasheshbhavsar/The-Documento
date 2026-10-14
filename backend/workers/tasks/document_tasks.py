import logging
from uuid import UUID

from backend.app.db.session import SessionLocal
from backend.app.documents.processor import process_document_pipeline

logger = logging.getLogger("ai_immigration.workers.document_tasks")


def execute_document_processing_task(document_id: UUID) -> None:
    """
    Executes a document processing task in an isolated worker session.
    Manages session lifecycle with deterministic cleanup.
    """
    session = SessionLocal()
    try:
        logger.info(f"Worker task starting for document {document_id}")
        process_document_pipeline(session, document_id)
        logger.info(f"Worker task completed for document {document_id}")
    except Exception as e:
        logger.error(f"Worker task failed for document {document_id}: {e}", exc_info=True)
        raise
    finally:
        session.close()
