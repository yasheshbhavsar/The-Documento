import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.documents.processor import (
    process_document_pipeline,
    process_document_background_task,
)
from backend.app.documents.upload_service import process_document_upload
from backend.app.domain.models import (
    Organization,
    User,
    Document,
    DocumentProcessingRun,
    OutboxEvent,
)
from backend.workers.runner import process_outbox_batch, run_worker


def _setup_test_entities(db):
    org = Organization(
        id=uuid.uuid4(),
        name="Apex Immigration",
        slug=f"apex-{uuid.uuid4().hex[:8]}",
    )
    user = User(
        id=uuid.uuid4(),
        email=f"attorney-{uuid.uuid4().hex[:6]}@apex.com",
        full_name="Sarah Jenkins",
        status="active",
    )
    db.add_all([org, user])
    db.commit()
    db.refresh(org)
    db.refresh(user)
    return org, user


def _sample_pdf_bytes():
    # Minimal valid PDF file
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    )


def test_upload_records_outbox_event_and_initial_run(db):
    org, user = _setup_test_entities(db)
    pdf_content = _sample_pdf_bytes()

    doc = process_document_upload(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        content=pdf_content,
        filename="passport_test.pdf",
        category="identification",
        title="Valid Passport",
        declared_mime_type="application/pdf",
    )

    # 1. Verify DocumentProcessingRun was atomically created
    run = (
        db.query(DocumentProcessingRun)
        .filter(DocumentProcessingRun.document_id == doc.id)
        .first()
    )
    assert run is not None
    assert run.organization_id == org.id
    assert run.run_number == 1
    assert run.status == "queued"
    assert run.stage == "queued"
    assert run.trigger_type == "upload"
    assert run.progress_percent == 0

    # 2. Verify OutboxEvent was atomically created
    outbox = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.aggregate_id == doc.id)
        .first()
    )
    assert outbox is not None
    assert outbox.organization_id == org.id
    assert outbox.event_type == "document.processing.requested"
    assert outbox.status == "pending"
    assert outbox.payload["document_id"] == str(doc.id)
    assert outbox.payload["run_id"] == str(run.id)


def test_worker_processes_outbox_batch_successfully(db):
    org, user = _setup_test_entities(db)
    pdf_content = _sample_pdf_bytes()

    doc = process_document_upload(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        content=pdf_content,
        filename="resume_test.pdf",
        category="supporting_evidence",
        title="Curriculum Vitae",
        declared_mime_type="application/pdf",
    )

    # Process pending events via worker batch
    processed_count = process_outbox_batch(db, batch_size=10)
    assert processed_count >= 1

    # Verify OutboxEvent status transitioned to published
    outbox = db.query(OutboxEvent).filter(OutboxEvent.aggregate_id == doc.id).first()
    assert outbox.status == "published"
    assert outbox.published_at is not None
    assert outbox.error_message is None

    # Verify DocumentProcessingRun completed
    db.refresh(doc)
    assert doc.processing_status == "completed"

    run = (
        db.query(DocumentProcessingRun)
        .filter(DocumentProcessingRun.document_id == doc.id)
        .first()
    )
    assert run.status == "completed"
    assert run.stage == "completed"
    assert run.progress_percent == 100
    assert run.completed_at is not None
    assert "page_count" in run.metrics


def test_worker_handles_missing_document_error_and_retries(db):
    org, _ = _setup_test_entities(db)
    missing_doc_id = uuid.uuid4()

    event = OutboxEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        event_type="document.processing.requested",
        aggregate_type="document",
        aggregate_id=missing_doc_id,
        payload={"document_id": str(missing_doc_id)},
        status="pending",
        retry_count=0,
    )
    db.add(event)
    db.commit()

    processed_count = process_outbox_batch(db, batch_size=10)
    assert processed_count == 0

    db.refresh(event)
    assert event.status == "pending"
    assert event.retry_count == 1
    assert "not found" in event.error_message.lower()


def test_worker_marks_outbox_failed_after_max_retries(db):
    org, _ = _setup_test_entities(db)
    missing_doc_id = uuid.uuid4()

    event = OutboxEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        event_type="document.processing.requested",
        aggregate_type="document",
        aggregate_id=missing_doc_id,
        payload={"document_id": str(missing_doc_id)},
        status="pending",
        retry_count=4,  # Next failure hits threshold 5
    )
    db.add(event)
    db.commit()

    process_outbox_batch(db, batch_size=10)

    db.refresh(event)
    assert event.status == "failed"
    assert event.retry_count == 5


def test_run_worker_once_mode(db):
    org, user = _setup_test_entities(db)
    doc = process_document_upload(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        content=_sample_pdf_bytes(),
        filename="single_test.pdf",
    )

    # run_worker with once=True should process pending items and exit cleanly
    total = run_worker(poll_interval=0.1, batch_size=5, once=True)
    assert total >= 1

    outbox = db.query(OutboxEvent).filter(OutboxEvent.aggregate_id == doc.id).first()
    assert outbox.status == "published"


def test_get_document_runs_api_endpoint(client, db):
    org, user = _setup_test_entities(db)
    doc = process_document_upload(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        content=_sample_pdf_bytes(),
        filename="api_runs_test.pdf",
    )

    # Process it so run has completed
    process_document_pipeline(db, doc.id)

    headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user.id),
        "X-User-Role": "admin",
    }

    res = client.get(f"/api/v1/documents/{doc.id}/runs", headers=headers)
    assert res.status_code == 200
    runs_data = res.json()
    assert len(runs_data) >= 1
    first_run = runs_data[0]
    assert first_run["document_id"] == str(doc.id)
    assert first_run["stage"] == "completed"
    assert first_run["status"] == "completed"
    assert first_run["progress_percent"] == 100
    assert "metrics" in first_run


def test_reprocess_document_creates_sequential_run(client, db):
    org, user = _setup_test_entities(db)
    doc = process_document_upload(
        db=db,
        organization_id=org.id,
        user_id=user.id,
        content=_sample_pdf_bytes(),
        filename="reprocess_target.pdf",
    )

    headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user.id),
        "X-User-Role": "admin",
    }

    # Trigger reprocess
    res = client.post(f"/api/v1/documents/{doc.id}/reprocess", headers=headers)
    assert res.status_code == 200

    # Query runs list
    res_runs = client.get(f"/api/v1/documents/{doc.id}/runs", headers=headers)
    assert res_runs.status_code == 200
    runs = res_runs.json()

    # There should now be at least 2 runs (original upload + reprocess)
    assert len(runs) >= 2
    reprocess_run = next(r for r in runs if r["trigger_type"] == "reprocess")
    assert reprocess_run["run_number"] >= 2
    assert reprocess_run["stage"] == "completed"
