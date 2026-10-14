import uuid
import pytest
from sqlalchemy.exc import IntegrityError

from backend.app.domain.models import (
    Organization,
    Document,
    DocumentProcessingRun,
    OutboxEvent,
)


def _create_test_org(db, name="Acme Immigration Law"):
    org = Organization(
        id=uuid.uuid4(),
        name=name,
        slug=f"org-{uuid.uuid4().hex[:8]}",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _create_test_document(db, org_id, title="Passport"):
    doc = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        title=title,
        filename=f"{title.lower()}.pdf",
        category="identification",
        storage_path=f"storage_data/{org_id}/mock.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def test_document_processing_run_creation_and_defaults(db):
    org = _create_test_org(db)
    doc = _create_test_document(db, org.id)

    run = DocumentProcessingRun(
        organization_id=org.id,
        document_id=doc.id,
        idempotency_key=f"run-{uuid.uuid4()}",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    assert run.id is not None
    assert run.organization_id == org.id
    assert run.document_id == doc.id
    assert run.run_number == 1
    assert run.stage == "queued"
    assert run.status == "queued"
    assert run.trigger_type == "upload"
    assert run.progress_percent == 0
    assert run.metrics == {}
    assert run.error_code is None
    assert run.error_message is None
    assert run.started_at is None
    assert run.completed_at is None
    assert run.created_at is not None
    assert run.updated_at is not None


def test_document_processing_run_relationships(db):
    org = _create_test_org(db)
    doc = _create_test_document(db, org.id)

    run = DocumentProcessingRun(
        organization_id=org.id,
        document_id=doc.id,
        idempotency_key=f"rel-run-{uuid.uuid4()}",
    )
    db.add(run)
    db.commit()
    db.refresh(org)
    db.refresh(doc)

    assert run in org.processing_runs
    assert run in doc.processing_runs
    assert run.organization.id == org.id
    assert run.document.id == doc.id


def test_document_processing_run_idempotency_uniqueness(db):
    org = _create_test_org(db)
    doc = _create_test_document(db, org.id)
    shared_key = f"idempotent-key-{uuid.uuid4()}"

    run1 = DocumentProcessingRun(
        organization_id=org.id,
        document_id=doc.id,
        idempotency_key=shared_key,
    )
    db.add(run1)
    db.commit()

    run2 = DocumentProcessingRun(
        organization_id=org.id,
        document_id=doc.id,
        idempotency_key=shared_key,
    )
    db.add(run2)

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_document_processing_run_cascade_deletion(db):
    org = _create_test_org(db)
    doc = _create_test_document(db, org.id)

    run = DocumentProcessingRun(
        organization_id=org.id,
        document_id=doc.id,
        idempotency_key=f"cascade-{uuid.uuid4()}",
    )
    db.add(run)
    db.commit()
    run_id = run.id

    # Deleting document must cascade and delete run
    db.delete(doc)
    db.commit()

    deleted_run = db.query(DocumentProcessingRun).filter_by(id=run_id).first()
    assert deleted_run is None


def test_outbox_event_creation_and_defaults(db):
    org = _create_test_org(db)
    aggregate_id = uuid.uuid4()

    event = OutboxEvent(
        organization_id=org.id,
        event_type="document.processing.requested",
        aggregate_type="document",
        aggregate_id=aggregate_id,
        payload={"stage": "queued", "priority": "high"},
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    assert event.id is not None
    assert event.organization_id == org.id
    assert event.event_type == "document.processing.requested"
    assert event.aggregate_type == "document"
    assert event.aggregate_id == aggregate_id
    assert event.payload == {"stage": "queued", "priority": "high"}
    assert event.status == "pending"
    assert event.retry_count == 0
    assert event.error_message is None
    assert event.published_at is None
    assert event.created_at is not None
    assert event.updated_at is not None
    assert event in org.outbox_events


def test_multi_tenant_scoping_and_cross_tenant_idempotency(db):
    org_a = _create_test_org(db, name="Firm A")
    org_b = _create_test_org(db, name="Firm B")
    doc_a = _create_test_document(db, org_a.id, title="Doc A")
    doc_b = _create_test_document(db, org_b.id, title="Doc B")

    same_key = f"tenant-shared-key-{uuid.uuid4()}"

    # Same idempotency key in two different organizations MUST be allowed
    run_a = DocumentProcessingRun(
        organization_id=org_a.id,
        document_id=doc_a.id,
        idempotency_key=same_key,
    )
    run_b = DocumentProcessingRun(
        organization_id=org_b.id,
        document_id=doc_b.id,
        idempotency_key=same_key,
    )
    db.add_all([run_a, run_b])
    db.commit()

    runs_org_a = db.query(DocumentProcessingRun).filter_by(organization_id=org_a.id).all()
    runs_org_b = db.query(DocumentProcessingRun).filter_by(organization_id=org_b.id).all()

    assert len(runs_org_a) == 1
    assert runs_org_a[0].id == run_a.id
    assert len(runs_org_b) == 1
    assert runs_org_b[0].id == run_b.id
