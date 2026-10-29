import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.documents.security import MalwareScanner, EICAR_SIGNATURE
from backend.app.ai.quality_detector import detect_document_quality_issues
from backend.app.domain.case_service import detect_client_duplicates
from backend.app.domain.case_lifecycle import CaseLifecycleEngine, PreparationStatus
from backend.app.domain.models import (
    User,
    Organization,
    OrganizationMembership,
    ClientProfile,
    ImmigrationCase,
    VisaAppointment,
    Notification,
    Invoice,
    now_utc,
)
from backend.app.security.auth import AuthContext
from backend.app.security.rbac import RoleCode
from backend.app.packages.local_archive import build_package_local_zip_archive


def test_production_jwt_secret_validation():
    # Attempting to start in production with default/insecure key raises ValueError
    with pytest.raises(ValueError, match="Insecure JWT secret key"):
        Settings(
            environment="production",
            jwt_secret_key="local_development_secret_key_change_in_production_min_32_chars",
            database_url="postgresql+psycopg://user:strong_pass@localhost:5432/db",
        )

    # Valid secret in production works
    valid_settings = Settings(
        environment="production",
        jwt_secret_key="extremely_secure_random_production_jwt_key_9876543210",
        database_url="postgresql+psycopg://user:strong_pass@localhost:5432/db",
    )
    assert valid_settings.environment == "production"


def test_password_reset_not_leaked_in_prod(db, client):
    # In production-like environment, dev_reset_token is never returned
    from backend.app.core.config import get_settings
    settings = get_settings()
    orig_env = settings.environment
    try:
        settings.environment = "production"
        resp = client.post("/api/v1/auth/password-reset/request", json={"email": "nobody@example.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert "dev_reset_token" not in data
    finally:
        settings.environment = orig_env


def test_organization_archive_soft_delete(db, client):
    # Setup test org
    org = Organization(name="Firm to Archive", slug=f"firm-archive-{uuid.uuid4().hex[:6]}", status="active")
    db.add(org)
    db.commit()
    db.refresh(org)

    # Call archive endpoint
    headers = {
        "X-User-Id": str(uuid.uuid4()),
        "X-Organization-Id": str(org.id),
        "X-User-Role": "organization_admin",
    }
    resp = client.post("/api/v1/organizations/current/archive?reason=Firm+merger", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "archived"

    # Verify db status is archived
    db.refresh(org)
    assert org.status == "archived"


def test_client_duplicate_fuzzy_detection(db):
    org_id = uuid.uuid4()
    dob = datetime(1990, 5, 15, tzinfo=timezone.utc)

    # Existing client
    c1 = ClientProfile(
        organization_id=org_id,
        first_name="Jonathan",
        last_name="Smith",
        email="jonathan.smith@example.com",
        nationality="USA",
        date_of_birth=dob,
    )
    db.add(c1)
    db.commit()

    # Query with a typo in name ("Jonathon" instead of "Jonathan") but same DOB
    matches = detect_client_duplicates(
        db=db,
        organization_id=org_id,
        first_name="Jonathon",
        last_name="Smith",
        nationality="USA",
        date_of_birth=dob,
    )
    assert len(matches) > 0
    fuzzy_match = [m for m in matches if "fuzzy" in m.match_type or m.match_type == "name_and_dob"]
    assert len(fuzzy_match) > 0
    assert fuzzy_match[0].confidence == "high"


def test_stage_regression_safeguard(db):
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    case = ImmigrationCase(
        organization_id=org_id,
        client_id=uuid.uuid4(),
        case_number=f"REG-{uuid.uuid4().hex[:6]}",
        title="EB-1A Case",
        jurisdiction="US",
        visa_category="EB-1A",
        preparation_status=PreparationStatus.READY_FOR_FINAL_REVIEW.value,
        operational_state="ACTIVE",
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # Standard caseworker attempting regression without supervisor permission raises PermissionDeniedError
    caseworker_ctx = AuthContext(
        user_id=user_id,
        organization_id=org_id,
        email="worker@law.com",
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    with pytest.raises(Exception, match="supervisor or administrator approval"):
        CaseLifecycleEngine.transition_preparation_status(
            db=db,
            case=case,
            target_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
            ctx=caseworker_ctx,
        )

    # Senior reviewer or org admin succeeds
    supervisor_ctx = AuthContext(
        user_id=user_id,
        organization_id=org_id,
        email="supervisor@law.com",
        roles=(RoleCode.SENIOR_REVIEWER.value,),
    )
    updated_case = CaseLifecycleEngine.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
        ctx=supervisor_ctx,
    )
    assert updated_case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS.value


def test_clamav_and_eicar_malware_scanner():
    # EICAR detection
    is_clean, details = MalwareScanner.scan_content(EICAR_SIGNATURE)
    assert is_clean is False
    assert "EICAR" in details

    # Clean text
    clean_bytes = b"Sample immigration evidence document content."
    is_clean, details = MalwareScanner.scan_content(clean_bytes)
    assert is_clean is True
    assert "Clean" in details


def test_quality_detector_low_dpi():
    findings = detect_document_quality_issues(
        document_id=str(uuid.uuid4()),
        title="Applicant Passport Scan.jpg",
        category="identity_passport",
        page_count=1,
        extracted_text="REPUBLIC OF PASSPORT JONATHAN SMITH",
        extracted_fields=[],
        ocr_applied=True,
        image_dpi=100,  # Below 150 DPI threshold
    )
    dpi_findings = [f for f in findings if "DPI" in f.title]
    assert len(dpi_findings) == 1
    assert dpi_findings[0].severity == "major"
    assert "100 DPI" in dpi_findings[0].title


def test_notification_retention_cleanup(db, client):
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    old_time = now - timedelta(days=120)

    # Create old read notification
    old_notif = Notification(
        organization_id=org_id,
        user_id=user_id,
        title="Old Alert",
        body="This is an old read alert",
        type="info",
        channel="in_app",
        delivery_status="delivered",
        read_at=old_time,
        created_at=old_time,
    )
    # Create recent unread notification
    new_notif = Notification(
        organization_id=org_id,
        user_id=user_id,
        title="New Alert",
        body="This is a fresh alert",
        type="info",
        channel="in_app",
        delivery_status="delivered",
        read_at=None,
        created_at=now,
    )
    db.add_all([old_notif, new_notif])
    db.commit()
    old_notif_id = old_notif.id
    new_notif_id = new_notif.id

    headers = {
        "X-User-Id": str(user_id),
        "X-Organization-Id": str(org_id),
        "X-User-Role": "case_manager",
    }
    resp = client.post("/api/v1/notifications/cleanup?older_than_days=90", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["cleaned_count"] >= 1

    # Verify old notification was purged while new notification remains
    assert db.query(Notification).filter(Notification.id == old_notif_id).first() is None
    assert db.query(Notification).filter(Notification.id == new_notif_id).first() is not None


def test_appointment_calendar_invite(db, client):
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    client_id = uuid.uuid4()

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client_id,
        case_number=f"CAL-{uuid.uuid4().hex[:6]}",
        title="H-1B Case",
        jurisdiction="US",
        visa_category="H-1B",
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    appt = VisaAppointment(
        organization_id=org_id,
        case_id=case.id,
        client_id=client_id,
        vac_center="New Delhi VAC",
        consular_post="US Embassy New Delhi",
        consular_interview_slot=datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc),
        appointment_status="scheduled",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    headers = {
        "X-User-Id": str(user_id),
        "X-Organization-Id": str(org_id),
        "X-User-Role": "case_manager",
    }
    resp = client.get(f"/api/v1/appointments/{appt.id}/calendar-invite", headers=headers)
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    assert "BEGIN:VCALENDAR" in resp.text
    assert "New Delhi VAC" in resp.text
    assert f"UID:{appt.id}@documento.immigration" in resp.text


def test_package_local_archive_disk_streaming():
    doc_entry = {
        "document_id": str(uuid.uuid4()),
        "file_name": "passport_scan.pdf",
        "folder_code": "01_Identity_and_Civil_Status",
        "binary_content": b"%PDF-1.4 Mock Dossier Document Content",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "review_status": "HUMAN_VERIFIED",
    }
    folder_structure = [
        {"folder_code": "01_Identity_and_Civil_Status", "folder_name": "Identity"},
    ]
    zip_bytes, manifest = build_package_local_zip_archive(
        case_reference="CASE-TEST-DISK",
        package_name="Test Package",
        package_template_version="1.0",
        checklist_rule_version="1.0",
        folder_structure=folder_structure,
        document_entries=[doc_entry],
        excluded_entries=[],
        generated_by="Test Auditor",
        jurisdiction="US",
    )
    assert len(zip_bytes) > 0
    assert manifest["case_reference"] == "CASE-TEST-DISK"


def test_stripe_webhook_receiver(db, client):
    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    invoice = Invoice(
        organization_id=org_id,
        client_id=client_id,
        invoice_number=f"INV-STRIPE-{uuid.uuid4().hex[:6]}",
        issue_date=now,
        due_date=now + timedelta(days=30),
        subtotal=500.0,
        tax_amount=0.0,
        discount_amount=0.0,
        total_amount=500.0,
        paid_amount=0.0,
        balance_due=500.0,
        currency="USD",
        status="issued",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    event_payload = {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": f"pi_test_{uuid.uuid4().hex[:8]}",
                "amount": 50000,  # 500.00 USD in cents
                "currency": "usd",
                "metadata": {
                    "invoice_id": str(invoice.id),
                },
                "charges": {
                    "data": [
                        {
                            "payment_method_details": {
                                "card": {
                                    "brand": "mastercard",
                                    "last4": "8888",
                                }
                            }
                        }
                    ]
                },
            }
        },
    }

    resp = client.post("/api/v1/billing/webhooks/stripe", json=event_payload)
    assert resp.status_code == 200
    assert resp.json()["received"] is True

    # Check invoice was marked paid
    db.refresh(invoice)
    assert invoice.paid_amount == 500.0
    assert invoice.balance_due == 0.0
    assert invoice.status == "paid"
