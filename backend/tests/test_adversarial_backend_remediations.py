import hashlib
import hmac
import io
import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.ai.identity_resolver import IdentityResolver
from backend.app.billing.service import BillingService
from backend.app.core.config import get_settings
from backend.app.domain.models import (
    AuditEvent,
    ClientProfile,
    Document,
    ImmigrationCase,
    Invoice,
    Notification,
    Organization,
    OrganizationMembership,
    User,
)
from backend.app.ocr.engine import PageExtractionResult
from backend.app.extraction.service import extract_structured_fields
from backend.app.security.rbac import RoleCode


# ==============================================================================
# AREA 1: CANADA IRCC SINGLE-NAME & STATUTORY IDENTITY PRESERVATION
# ==============================================================================


def test_adversarial_single_name_ircc_empty_string_preservation():
    """Adversarially verify that single-name resolution for Canada IRCC strictly preserves

    empty string (""), rather than falling back to "(Blank)" or None, and UKVI preserves ".".
    """
    doc_id = uuid.uuid4()
    org_id = uuid.uuid4()

    # Document where applicant has a single name "Gurpreet"
    page = PageExtractionResult(
        page_number=1,
        width=612.0,
        height=792.0,
        text="""
        REPUBLIC OF INDIA PASSPORT
        Type: P  Country Code: IND  Passport No: Z9876543
        Given Names:
        Surname: Gurpreet
        Nationality: INDIAN  Sex: M
        Date of Birth: 12/08/1994
        Place of Birth: PUNJAB, INDIA
        Date of Issue: 10/01/2020  Date of Expiry: 09/01/2030
        P<INDGURPREET<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        Z9876543<8IND9408125M3001098<<<<<<<<<<<<<<04
        """,
        blocks=[],
        ocr_applied=False,
        ocr_confidence=0.99,
    )

    fields = extract_structured_fields(
        document_id=doc_id,
        organization_id=org_id,
        category="civil_status_family",
        pages=[page],
    )
    field_map = {f.field_name: f for f in fields}

    # 1. Canada IRCC Given Name must strictly be empty string "" (not "(Blank)")
    assert "single_name_ircc_given" in field_map, "single_name_ircc_given must be extracted"
    assert (
        field_map["single_name_ircc_given"].normalized_value == ""
    ), f"Expected empty string '' for IRCC, got {field_map['single_name_ircc_given'].normalized_value!r}"
    assert field_map["single_name_ircc_given"].original_value == "(Blank)"

    # 2. UKVI Given Name must strictly be "." (not stripped or rejected)
    assert "single_name_ukvi_given" in field_map, "single_name_ukvi_given must be extracted"
    assert (
        field_map["single_name_ukvi_given"].normalized_value == "."
    ), f"Expected '.' for UKVI, got {field_map['single_name_ukvi_given'].normalized_value!r}"
    assert field_map["single_name_ukvi_given"].original_value == "."

    # 3. USCIS Given Name must be "FNU"
    assert "single_name_uscis_given" in field_map, "single_name_uscis_given must be extracted"
    assert field_map["single_name_uscis_given"].normalized_value == "FNU"


def test_adversarial_statutory_identity_field_vs_noise_cleaning():
    """Verify statutory identity fields bypass noise stripping, while regular fields still strip noise."""
    doc_id = uuid.uuid4()
    org_id = uuid.uuid4()

    # Construct synthetic text with dotted leader noise and marriage registration
    page = PageExtractionResult(
        page_number=1,
        width=612.0,
        height=792.0,
        text="""
        MEMORANDUM OF MARRIAGE
        GOVERNMENT OF GUJARAT
        Certify that Shri Aarav Patel Son of Shri Rajesh Patel residing at Ahmedabad and Priya Shah daughter of Shri Mohan Shah residing at Ahmedabad have solemnized marriage on 12/02/2021
        Name: ....................
        Registration No: GUJ/AHM/2021/84920 of 2021
        """,
        blocks=[],
        ocr_applied=False,
        ocr_confidence=0.98,
    )

    fields = extract_structured_fields(
        document_id=doc_id,
        organization_id=org_id,
        category="civil_status_family",
        pages=[page],
    )
    field_map = {f.field_name: f for f in fields}

    # Leader noise line "...................." must NOT be accepted as applicant name
    if "full_name" in field_map:
        assert field_map["full_name"].normalized_value not in (".", "..", "...", "....................")

    # Indian certificate registration number with slashes and long segments must be preserved in full
    assert "marriage_certificate_number" in field_map
    assert field_map["marriage_certificate_number"].normalized_value == "GUJ/AHM/2021/84920"


def test_adversarial_indian_certificate_number_regex_expanded_bounds():
    """Verify that certificate/registration numbers up to 40 characters with complex slashes

    (like GUJ/AHM/2021/84920 or DEL/SDM/VASANT-VIHAR/2024/004921) are parsed without truncation.
    """
    doc_id = uuid.uuid4()
    org_id = uuid.uuid4()

    page = PageExtractionResult(
        page_number=1,
        width=612.0,
        height=792.0,
        text="""
        MEMORANDUM OF MARRIAGE
        GOVERNMENT OF NCT OF DELHI
        Certify that Shri Rohan Sharma Son of Shri Vikram Sharma residing at Delhi and Ananya Verma daughter of Shri Ramesh Verma residing at Delhi have solemnized marriage on 18/02/2024
        Certificate No. DEL/SDM/VASANT-VIHAR/2024/004921 of volume IV
        """,
        blocks=[],
        ocr_applied=False,
        ocr_confidence=0.99,
    )

    fields = extract_structured_fields(
        document_id=doc_id,
        organization_id=org_id,
        category="civil_status_family",
        pages=[page],
    )
    field_map = {f.field_name: f for f in fields}

    assert "marriage_certificate_number" in field_map
    assert field_map["marriage_certificate_number"].normalized_value == "DEL/SDM/VASANT-VIHAR/2024/004921"


# ==============================================================================
# AREA 2: CONSULAR READINESS SAMPLE DOCUMENT VERIFICATION
# ==============================================================================


def test_adversarial_extractor_samples_catalog_and_expansion(client):
    """Verify /api/v1/extractor/samples returns >= 8 samples and handles catalog expansion gracefully."""
    resp = client.get("/api/v1/extractor/samples")
    assert resp.status_code == 200
    samples = resp.json()

    # The catalog must contain at least 8 samples (currently 10)
    assert len(samples) >= 8, f"Expected at least 8 samples, got {len(samples)}"

    # Each sample must have required structure
    for s in samples:
        assert "id" in s
        assert "filename" in s
        assert "category" in s
        assert "text_content" in s
        assert len(s["text_content"].strip()) > 0

    # Adversarial catalog expansion simulation:
    # Inject 3 synthetic new samples into the list to test resilience against future additions
    synthetic_samples = list(samples) + [
        {
            "id": "sample-future-uae-residence-visa",
            "filename": "uae_residence_visa.txt",
            "category": "travel_history",
            "text_content": "UNITED ARAB EMIRATES RESIDENCE VISA No 201/2024/99182 Name: Ahmed Al-Mansoor",
        },
        {
            "id": "sample-future-german-anerkennung",
            "filename": "anerkennung_urkunde.txt",
            "category": "education_and_employment",
            "text_content": "BUNDESREPUBLIK DEUTSCHLAND ANERKENNUNGSURKUNDE Berufsbezeichnung: Ingenieur",
        },
    ]

    expected_fields_by_id = {
        "sample-indian-passport": {"passport_number", "surname", "given_names", "date_of_birth", "expiry_date"},
        "sample-us-passport": {"passport_number", "surname", "given_names", "date_of_birth", "expiry_date"},
        "sample-marriage-certificate": {"marriage_certificate_number", "marriage_date", "groom_name", "bride_name"},
    }

    # Verify that the test loop logic from test_us_consular_readiness gracefully ignores
    # samples not in expected_fields_by_id without throwing KeyErrors or assertions
    processed_count = 0
    for sample in synthetic_samples:
        if sample["id"] not in expected_fields_by_id:
            continue
        analyze_res = client.post(
            "/api/v1/extractor/analyze-text",
            json={
                "text": sample["text_content"],
                "filename": sample["filename"],
                "declared_category": sample["category"],
            },
        )
        assert analyze_res.status_code == 200
        extracted = analyze_res.json()["extracted_fields"]
        extracted_keys = {f["field_name"] for f in extracted}
        for expected_key in expected_fields_by_id[sample["id"]]:
            assert expected_key in extracted_keys
        processed_count += 1

    assert processed_count == len(expected_fields_by_id)


# ==============================================================================
# AREA 3: STRIPE WEBHOOK SIGNATURE VALIDATION & ERROR PROPAGATION
# ==============================================================================


def test_adversarial_stripe_webhook_prod_staging_missing_signature(client):
    """In production or staging, omitting Stripe-Signature header MUST raise HTTP 400 Bad Request."""
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    payload = {"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_test"}}}

    try:
        # Test production
        settings.environment = "production"
        settings.stripe_webhook_secret = "whsec_test_secret_key"
        resp = client.post("/api/v1/billing/webhooks/stripe", json=payload)
        assert resp.status_code == 400
        assert "Missing required Stripe-Signature header" in resp.json()["detail"]

        # Test staging
        settings.environment = "staging"
        resp = client.post("/api/v1/billing/webhooks/stripe", json=payload)
        assert resp.status_code == 400
        assert "Missing required Stripe-Signature header" in resp.json()["detail"]
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


def test_adversarial_stripe_webhook_prod_missing_secret(client):
    """In production, if Stripe-Signature is sent but webhook secret is unconfigured, MUST raise HTTP 500."""
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    payload = {"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_test"}}}

    try:
        settings.environment = "production"
        settings.stripe_webhook_secret = ""
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            json=payload,
            headers={"stripe-signature": "t=1700000000,v1=abcdef1234567890"},
        )
        assert resp.status_code == 500
        assert "Stripe webhook secret is not configured" in resp.json()["detail"]
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


def test_adversarial_stripe_webhook_tampered_and_malformed_signature(client):
    """Verify forged or malformed Stripe-Signature headers are rejected with HTTP 400."""
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    payload = {"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_test"}}}

    try:
        settings.environment = "production"
        settings.stripe_webhook_secret = "whsec_correct_secret_value"

        # 1. Tampered / invalid HMAC
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            json=payload,
            headers={"stripe-signature": "t=1700000000,v1=bad_forged_signature_hex"},
        )
        assert resp.status_code == 400
        assert "Invalid Stripe signature" in resp.json()["detail"]

        # 2. Malformed signature header (no '=' delimiter)
        resp2 = client.post(
            "/api/v1/billing/webhooks/stripe",
            json=payload,
            headers={"stripe-signature": "completely_bogus_signature_header"},
        )
        assert resp2.status_code == 400
        assert "signature" in resp2.json()["detail"].lower()
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


def test_adversarial_stripe_webhook_valid_signature_success(db, client):
    """Verify that a correctly signed Stripe webhook succeeds in production mode."""
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    secret = "whsec_adversarial_valid_secret_key"
    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    invoice = Invoice(
        organization_id=org_id,
        client_id=client_id,
        invoice_number=f"INV-STRIPE-ADV-{uuid.uuid4().hex[:6]}",
        issue_date=now,
        due_date=now + timedelta(days=30),
        subtotal=1000.0,
        tax_amount=0.0,
        discount_amount=0.0,
        total_amount=1000.0,
        paid_amount=0.0,
        balance_due=1000.0,
        currency="USD",
        status="issued",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    payload_dict = {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": f"pi_adv_{uuid.uuid4().hex[:8]}",
                "amount": 100000,
                "currency": "usd",
                "metadata": {
                    "invoice_id": str(invoice.id),
                },
                "charges": {
                    "data": [
                        {
                            "payment_method_details": {
                                "card": {"brand": "visa", "last4": "1111"}
                            }
                        }
                    ]
                },
            }
        },
    }
    payload_bytes = str(payload_dict).replace("'", '"').encode("utf-8")

    t = str(int(time.time()))
    signed_payload = f"{t}.".encode("utf-8") + payload_bytes
    v1 = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    sig_header = f"t={t},v1={v1}"

    try:
        settings.environment = "production"
        settings.stripe_webhook_secret = secret

        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=payload_bytes,
            headers={"content-type": "application/json", "stripe-signature": sig_header},
        )
        assert resp.status_code == 200
        assert resp.json()["received"] is True

        db.refresh(invoice)
        assert invoice.paid_amount == 1000.0
        assert invoice.balance_due == 0.0
        assert invoice.status == "paid"
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


def test_adversarial_stripe_webhook_payment_recording_failure_returns_500(db, client):
    """Adversarially verify that if BillingService.record_payment fails (e.g., DB exception),

    the endpoint raises HTTP 500 so Stripe schedules a retry, rather than silently swallowing it.
    """
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    secret = "whsec_retry_test_secret"
    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    invoice = Invoice(
        organization_id=org_id,
        client_id=client_id,
        invoice_number=f"INV-STRIPE-FAIL-{uuid.uuid4().hex[:6]}",
        issue_date=now,
        due_date=now + timedelta(days=30),
        subtotal=250.0,
        tax_amount=0.0,
        discount_amount=0.0,
        total_amount=250.0,
        paid_amount=0.0,
        balance_due=250.0,
        currency="USD",
        status="issued",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    payload_dict = {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": f"pi_retry_{uuid.uuid4().hex[:8]}",
                "amount": 25000,
                "currency": "usd",
                "metadata": {"invoice_id": str(invoice.id)},
                "charges": {"data": []},
            }
        },
    }
    payload_bytes = str(payload_dict).replace("'", '"').encode("utf-8")

    t = str(int(time.time()))
    signed_payload = f"{t}.".encode("utf-8") + payload_bytes
    v1 = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    sig_header = f"t={t},v1={v1}"

    try:
        settings.environment = "production"
        settings.stripe_webhook_secret = secret

        with patch.object(
            BillingService,
            "record_payment",
            side_effect=RuntimeError("Simulated database write conflict during payment recording"),
        ):
            resp = client.post(
                "/api/v1/billing/webhooks/stripe",
                content=payload_bytes,
                headers={"content-type": "application/json", "stripe-signature": sig_header},
            )
            # Crucial: Must return 500 to signal Stripe webhook delivery failure
            assert resp.status_code == 500
            assert "Failed to record webhook transaction; scheduled for retry." in resp.json()["detail"]
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


def test_adversarial_stripe_webhook_invalid_invoice_uuid(client):
    """Verify that a malformed invoice_id in metadata raises HTTP 400 Bad Request."""
    settings = get_settings()
    orig_env = settings.environment
    orig_sec = settings.stripe_webhook_secret

    payload_dict = {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi_bad_uuid",
                "amount": 10000,
                "metadata": {"invoice_id": "not-a-valid-uuid-format"},
            }
        },
    }
    try:
        settings.environment = "development"
        settings.stripe_webhook_secret = ""
        resp = client.post("/api/v1/billing/webhooks/stripe", json=payload_dict)
        assert resp.status_code == 400
        assert "Invalid invoice_id format in Stripe metadata" in resp.json()["detail"]
    finally:
        settings.environment = orig_env
        settings.stripe_webhook_secret = orig_sec


# ==============================================================================
# AREA 4: UPLOAD SIZE BOUNDS GUARD (50MB / HTTP 413)
# ==============================================================================


def test_adversarial_analyze_document_exceeds_50mb(client):
    """Verify that uploading a file > 50MB to /api/v1/extractor/analyze

    triggers HTTP 413 Payload Too Large.
    """
    from backend.app.documents.security import MAX_ALLOWED_FILE_SIZE

    # Create 50MB + 1KB in-memory payload
    oversized_bytes = b"A" * (MAX_ALLOWED_FILE_SIZE + 1024)
    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("huge_packet.pdf", io.BytesIO(oversized_bytes), "application/pdf")},
    )
    assert resp.status_code == 413
    assert "exceeds maximum limit of 50MB" in resp.json()["detail"]


def test_adversarial_sort_and_split_packet_exceeds_50mb(client):
    """Verify that uploading a file > 50MB to /api/v1/extractor/sort-packet

    triggers HTTP 413 Payload Too Large.
    """
    from backend.app.documents.security import MAX_ALLOWED_FILE_SIZE

    oversized_bytes = b"B" * (MAX_ALLOWED_FILE_SIZE + 1024)
    resp = client.post(
        "/api/v1/extractor/sort-packet",
        files={"file": ("oversized_packet.pdf", io.BytesIO(oversized_bytes), "application/pdf")},
    )
    assert resp.status_code == 413
    assert "exceeds maximum limit of 50MB" in resp.json()["detail"]


def test_adversarial_analyze_document_valid_size_accepted(client):
    """Verify that a normal sized upload (< 50MB) does NOT trigger 413."""
    small_content = b"%PDF-1.4 Mock valid small pdf"
    resp = client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("small_doc.pdf", io.BytesIO(small_content), "application/pdf")},
    )
    # Status code should not be 413
    assert resp.status_code != 413


# ==============================================================================
# AREA 5: CLIENT DELETION CASCADES & MULTI-TENANCY ISOLATION
# ==============================================================================


def test_adversarial_client_deletion_cascade_flow(db, client):
    """Adversarially verify:

    1. cascade=False (default) returns 409 Conflict if cases exist.
    2. cascade=True deletes the client AND all associated cases cleanly.
    3. Multi-tenancy isolation: deletion of client in Org A does not touch Org B records.
    4. Unauthorized role (case_worker/paralegal) is rejected with 403.
    """
    # 1. Setup Organizations and Users
    org_a = Organization(name="Law Firm Alpha", slug=f"alpha-{uuid.uuid4().hex[:6]}", status="active")
    org_b = Organization(name="Law Firm Beta", slug=f"beta-{uuid.uuid4().hex[:6]}", status="active")
    db.add_all([org_a, org_b])
    db.commit()

    admin_a_id = uuid.uuid4()
    worker_a_id = uuid.uuid4()

    # 2. Setup Client A in Org A with 2 cases
    client_a = ClientProfile(
        organization_id=org_a.id,
        first_name="Ramesh",
        last_name="Chauhan",
        email=f"ramesh_{uuid.uuid4().hex[:6]}@example.com",
        nationality="IND",
        date_of_birth=datetime(1988, 4, 12, tzinfo=timezone.utc),
    )
    db.add(client_a)
    db.commit()
    db.refresh(client_a)

    case_a1 = ImmigrationCase(
        organization_id=org_a.id,
        client_id=client_a.id,
        case_number=f"CAS-A1-{uuid.uuid4().hex[:4]}",
        title="EB-2 NIW",
        jurisdiction="US",
        visa_category="EB-2",
    )
    case_a2 = ImmigrationCase(
        organization_id=org_a.id,
        client_id=client_a.id,
        case_number=f"CAS-A2-{uuid.uuid4().hex[:4]}",
        title="O-1A",
        jurisdiction="US",
        visa_category="O-1A",
    )
    db.add_all([case_a1, case_a2])
    db.commit()

    # Setup Client B in Org B with 1 case (Tenant isolation control)
    client_b = ClientProfile(
        organization_id=org_b.id,
        first_name="Elena",
        last_name="Rostova",
        email=f"elena_{uuid.uuid4().hex[:6]}@example.com",
        nationality="RUS",
        date_of_birth=datetime(1992, 9, 20, tzinfo=timezone.utc),
    )
    db.add(client_b)
    db.commit()
    db.refresh(client_b)

    case_b1 = ImmigrationCase(
        organization_id=org_b.id,
        client_id=client_b.id,
        case_number=f"CAS-B1-{uuid.uuid4().hex[:4]}",
        title="H-1B Transfer",
        jurisdiction="US",
        visa_category="H-1B",
    )
    db.add(case_b1)
    db.commit()

    admin_headers = {
        "X-User-Id": str(admin_a_id),
        "X-Organization-Id": str(org_a.id),
        "X-User-Role": RoleCode.ORGANIZATION_ADMIN.value,
    }

    # STEP 1: Attempt deletion without cascade (cascade=False)
    # Must fail with 409 Conflict
    resp_no_cascade = client.delete(f"/api/v1/clients/{client_a.id}", headers=admin_headers)
    assert resp_no_cascade.status_code == 409
    assert "associated case(s)" in resp_no_cascade.json()["detail"]

    # Verify both client and cases are still intact in DB
    assert db.query(ClientProfile).filter(ClientProfile.id == client_a.id).first() is not None
    assert db.query(ImmigrationCase).filter(ImmigrationCase.client_id == client_a.id).count() == 2

    # STEP 2: Unauthorized deletion attempt by case worker / paralegal
    worker_headers = {
        "X-User-Id": str(worker_a_id),
        "X-Organization-Id": str(org_a.id),
        "X-User-Role": RoleCode.CASE_WORKER.value,
    }
    resp_unauth = client.delete(f"/api/v1/clients/{client_a.id}?cascade=true", headers=worker_headers)
    assert resp_unauth.status_code == 403
    assert db.query(ClientProfile).filter(ClientProfile.id == client_a.id).first() is not None

    # STEP 3: Authorized deletion with cascade=true
    resp_cascade = client.delete(f"/api/v1/clients/{client_a.id}?cascade=true", headers=admin_headers)
    assert resp_cascade.status_code == 200
    cascade_data = resp_cascade.json()
    assert cascade_data["status"] == "success"
    assert cascade_data["cascaded_cases"] == 2

    # Verify Client A and Case A1, A2 are deleted
    assert db.query(ClientProfile).filter(ClientProfile.id == client_a.id).first() is None
    assert db.query(ImmigrationCase).filter(ImmigrationCase.client_id == client_a.id).count() == 0

    # STEP 4: Verify Multi-Tenancy Isolation
    # Client B and Case B1 in Org B MUST NOT be deleted
    assert db.query(ClientProfile).filter(ClientProfile.id == client_b.id).first() is not None
    assert db.query(ImmigrationCase).filter(ImmigrationCase.id == case_b1.id).first() is not None


def test_adversarial_client_deletion_zero_cases_succeeds(db, client):
    """Verify that deleting a client with 0 cases succeeds regardless of cascade flag."""
    org = Organization(name="Zero Case Firm", slug=f"zerofirm-{uuid.uuid4().hex[:6]}", status="active")
    db.add(org)
    db.commit()

    admin_id = uuid.uuid4()
    client_zero = ClientProfile(
        organization_id=org.id,
        first_name="Solo",
        last_name="Applicant",
        email=f"solo_{uuid.uuid4().hex[:6]}@example.com",
        nationality="IND",
    )
    db.add(client_zero)
    db.commit()
    db.refresh(client_zero)

    headers = {
        "X-User-Id": str(admin_id),
        "X-Organization-Id": str(org.id),
        "X-User-Role": RoleCode.ORGANIZATION_ADMIN.value,
    }

    # Deleting without cascade flag when len(cases) == 0 succeeds
    resp = client.delete(f"/api/v1/clients/{client_zero.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["cascaded_cases"] == 0
    assert db.query(ClientProfile).filter(ClientProfile.id == client_zero.id).first() is None


# ==============================================================================
# AREA 6: NOTIFICATION READ HTTP METHOD PARITY & IDEMPOTENCY
# ==============================================================================


def test_adversarial_notification_read_post_and_patch_parity(db, client):
    """Verify that /{notification_id}/read succeeds via BOTH POST and PATCH methods."""
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    # Create two unread notifications for user_id
    n_patch = Notification(
        organization_id=org_id,
        user_id=user_id,
        title="Urgent Document Request",
        body="Please upload W-2 for FY2024",
        type="task_assignment",
        read_at=None,
    )
    n_post = Notification(
        organization_id=org_id,
        user_id=user_id,
        title="Biometrics Appointment Scheduled",
        body="ASC appointment scheduled for next Tuesday",
        type="status_change",
        read_at=None,
    )
    db.add_all([n_patch, n_post])
    db.commit()
    db.refresh(n_patch)
    db.refresh(n_post)

    headers = {
        "X-User-Id": str(user_id),
        "X-Organization-Id": str(org_id),
        "X-User-Role": "retained_client",
    }

    # 1. PATCH method marks n_patch read
    patch_resp = client.patch(f"/api/v1/notifications/{n_patch.id}/read", headers=headers)
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert patch_data["read_at"] is not None
    db.refresh(n_patch)
    assert n_patch.read_at is not None

    # 2. POST method marks n_post read
    post_resp = client.post(f"/api/v1/notifications/{n_post.id}/read", headers=headers)
    assert post_resp.status_code == 200
    post_data = post_resp.json()
    assert post_data["read_at"] is not None
    db.refresh(n_post)
    assert n_post.read_at is not None

    # 3. Idempotency: calling POST again on an already read notification returns 200 without error
    first_read_at = n_post.read_at
    post_again_resp = client.post(f"/api/v1/notifications/{n_post.id}/read", headers=headers)
    assert post_again_resp.status_code == 200
    db.refresh(n_post)
    assert n_post.read_at == first_read_at

    # 4. Cross-user isolation: Another user cannot mark this user's notification as read
    other_headers = {
        "X-User-Id": str(other_user_id),
        "X-Organization-Id": str(org_id),
        "X-User-Role": "retained_client",
    }
    forbidden_resp = client.post(f"/api/v1/notifications/{n_post.id}/read", headers=other_headers)
    assert forbidden_resp.status_code == 403
    assert "Cannot mark another user's notification as read" in forbidden_resp.json()["detail"]

    # 5. Non-existent notification ID returns 404
    non_existent_id = uuid.uuid4()
    not_found_resp = client.post(f"/api/v1/notifications/{non_existent_id}/read", headers=headers)
    assert not_found_resp.status_code == 404



# ==============================================================================
# AREA 7: H1 / HIGH-09 SHORT-LIVED DOWNLOAD TOKEN & OPTIONAL AUTH
# ==============================================================================


def test_adversarial_download_token_optional_auth(db, client):
    """Verifies that download_document permits unauthenticated access when a valid signed

    download token is present, strictly rejects unauthenticated requests lacking a token
    with HTTP 401, rejects quarantined files with HTTP 403, and allows authenticated downloads.
    """
    from backend.app.documents.storage import get_storage_backend
    from backend.app.documents.upload_service import generate_download_token

    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    # Seed file content in object/temporary storage
    storage = get_storage_backend()
    raw_content = b"%PDF-1.4\nAdversarial test PDF content for token download verification"
    sha256 = hashlib.sha256(raw_content).hexdigest()
    filename = "legal_affidavit.pdf"

    storage.store_file(
        organization_id=org_id,
        file_id=doc_id,
        filename=f"v1_{filename}",
        content=raw_content,
        content_type="application/pdf",
    )

    doc = Document(
        id=doc_id,
        organization_id=org_id,
        case_id=None,
        uploaded_by_user_id=user_id,
        title="Legal Affidavit",
        filename=filename,
        category="supporting_evidence",
        storage_path=f"storage/{org_id}/{doc_id}/v1_{filename}",
        sha256_hash=sha256,
        byte_size=len(raw_content),
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        malware_scan_status="clean",
    )
    db.add(doc)
    db.commit()

    # 1. Valid short-lived token without ANY auth headers / cookies succeeds (HTTP 200)
    token = generate_download_token(
        user_id=user_id,
        document_id=doc_id,
        organization_id=org_id,
        expires_in_seconds=120,
    )
    resp = client.get(f"/api/v1/documents/{doc_id}/download?token={token}")
    assert resp.status_code == 200
    assert resp.content == raw_content
    assert 'filename="legal_affidavit.pdf"' in resp.headers.get("Content-Disposition", "")
    assert resp.headers.get("X-SHA256") == sha256

    # 2. Unauthenticated request WITHOUT token or auth headers fails (HTTP 401)
    unauth_resp = client.get(f"/api/v1/documents/{doc_id}/download")
    assert unauth_resp.status_code == 401
    assert "Authentication required" in unauth_resp.json().get("detail", "")

    # 3. Forged/invalid token without auth fails (HTTP 403 PermissionDeniedError)
    forged_resp = client.get(f"/api/v1/documents/{doc_id}/download?token=forged.invalid.token")
    assert forged_resp.status_code == 403
    assert "Invalid or forged download token" in forged_resp.json().get("detail", "")

    # 4. Token generated for a DIFFERENT document is rejected (HTTP 403)
    wrong_doc_id = uuid.uuid4()
    wrong_token = generate_download_token(
        user_id=user_id,
        document_id=wrong_doc_id,
        organization_id=org_id,
        expires_in_seconds=120,
    )
    wrong_resp = client.get(f"/api/v1/documents/{doc_id}/download?token={wrong_token}")
    assert wrong_resp.status_code == 403
    assert "does not match requested document" in wrong_resp.json().get("detail", "")

    # 5. Quarantined or infected document download blocked even with valid token (HTTP 403)
    doc.verification_status = "quarantined"
    db.commit()
    quarantine_resp = client.get(f"/api/v1/documents/{doc_id}/download?token={token}")
    assert quarantine_resp.status_code == 403
    assert "Cannot download quarantined or infected document" in quarantine_resp.json().get("detail", "")

    # Restore clean status
    doc.verification_status = "verified"
    db.commit()

    # 5b. Infected document download blocked even with valid token (HTTP 403)
    doc.malware_scan_status = "infected"
    db.commit()
    infected_resp = client.get(f"/api/v1/documents/{doc_id}/download?token={token}")
    assert infected_resp.status_code == 403
    assert "Cannot download quarantined or infected document" in infected_resp.json().get("detail", "")
    doc.malware_scan_status = "clean"
    db.commit()

    # 5c. Expired token download blocked (HTTP 403)
    expired_token = generate_download_token(
        user_id=user_id,
        document_id=doc_id,
        organization_id=org_id,
        expires_in_seconds=-10,
    )
    expired_resp = client.get(f"/api/v1/documents/{doc_id}/download?token={expired_token}")
    assert expired_resp.status_code == 403
    assert "Download access URL has expired" in expired_resp.json().get("detail", "")

    # 6. Authenticated user without token succeeds via assert_document_access
    auth_headers = {
        "X-User-Id": str(user_id),
        "X-Organization-Id": str(org_id),
        "X-User-Role": "admin",
    }
    auth_resp = client.get(f"/api/v1/documents/{doc_id}/download", headers=auth_headers)
    assert auth_resp.status_code == 200
    assert auth_resp.content == raw_content


# ==============================================================================
# AREA 8: M1 / INT-SEC-05 RATE LIMITER PROXY CLIENT IP RESOLUTION & TTL EVICTION
# ==============================================================================


def test_adversarial_rate_limiter_proxy_ip_resolution():
    """Verifies that SimpleRateLimiterMiddleware resolves client IP properly prioritizing

    X-Forwarded-For (first hop) and X-Real-IP before falling back to request.client.host.
    """
    from backend.app.core.middleware import SimpleRateLimiterMiddleware
    from starlette.requests import Request

    middleware = SimpleRateLimiterMiddleware(app=None, max_requests=10, window_seconds=60)

    # 1. X-Forwarded-For with multiple proxy hops: must extract the first (client) IP
    scope_xff = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/cases",
        "headers": [
            (b"x-forwarded-for", b"203.0.113.195, 198.51.100.1, 10.0.0.1"),
            (b"x-real-ip", b"198.51.100.1"),
        ],
        "client": ("127.0.0.1", 54321),
    }
    req_xff = Request(scope_xff)
    assert middleware._get_client_ip(req_xff) == "203.0.113.195"

    # 2. X-Real-IP without X-Forwarded-For
    scope_xreal = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/cases",
        "headers": [
            (b"x-real-ip", b"198.51.100.42"),
        ],
        "client": ("127.0.0.1", 54321),
    }
    req_xreal = Request(scope_xreal)
    assert middleware._get_client_ip(req_xreal) == "198.51.100.42"

    # 3. Direct connection without proxy headers: falls back to request.client.host
    scope_direct = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/cases",
        "headers": [],
        "client": ("192.0.2.77", 12345),
    }
    req_direct = Request(scope_direct)
    assert middleware._get_client_ip(req_direct) == "192.0.2.77"


def test_adversarial_rate_limiter_ttl_eviction():
    """Verifies that SimpleRateLimiterMiddleware periodically evicts expired IP records,

    preventing unbounded memory growth over long-running processes.
    """
    from backend.app.core.middleware import SimpleRateLimiterMiddleware

    middleware = SimpleRateLimiterMiddleware(
        app=None,
        max_requests=5,
        window_seconds=60,
        cleanup_interval=10,
    )

    now = time.time()
    middleware.last_cleanup = now - 20  # Trigger cleanup on next check

    # Seed expired timestamps (> 60 seconds old)
    middleware.request_counts["old_ip_1"] = [now - 120, now - 90]
    middleware.request_counts["old_ip_2"] = [now - 80]
    middleware.auth_request_counts["auth_old_ip"] = [now - 150]

    # Seed active timestamps (< 60 seconds old)
    middleware.request_counts["active_ip"] = [now - 10, now - 5]
    middleware.auth_request_counts["auth_active_ip"] = [now - 2]

    # Run eviction
    middleware._evict_expired(now)

    # Expired IPs must be completely pruned
    assert "old_ip_1" not in middleware.request_counts
    assert "old_ip_2" not in middleware.request_counts
    assert "auth_old_ip" not in middleware.auth_request_counts

    # Active IPs must remain retained
    assert "active_ip" in middleware.request_counts
    assert len(middleware.request_counts["active_ip"]) == 2
    assert "auth_active_ip" in middleware.auth_request_counts
    assert len(middleware.auth_request_counts["auth_active_ip"]) == 1


# ==============================================================================
# AREA 9: INT-DOC-01 OPENAPI SPEC SECURITY SCHEMES (BEARERAUTH)
# ==============================================================================


def test_adversarial_openapi_spec_bearer_auth():
    """Verifies that app.openapi() registers the BearerAuth security scheme in components

    and declares global security requirement, enabling Swagger UI's Authorize button.
    """
    from backend.app.main import app

    # Force regeneration
    app.openapi_schema = None
    schema = app.openapi()

    assert "components" in schema
    assert "securitySchemes" in schema["components"]
    assert "BearerAuth" in schema["components"]["securitySchemes"]

    bearer_auth = schema["components"]["securitySchemes"]["BearerAuth"]
    assert bearer_auth["type"] == "http"
    assert bearer_auth["scheme"] == "bearer"
    assert bearer_auth["bearerFormat"] == "JWT"

    assert "security" in schema
    assert [{"BearerAuth": []}] == schema["security"]


# ==============================================================================
# AREA 10: M2 MUTABLE DEFAULT ARGUMENT ISOLATION & L2 STATUS CODE
# ==============================================================================


def test_adversarial_pydantic_mutable_defaults_isolation():
    """Verifies that Pydantic models using default_factory maintain independent collections

    across instances without sharing or leaking mutated state.
    """
    from backend.app.schemas.cases import CaseDetailResponse
    from backend.app.schemas.documents import DocumentDetailResponse, ApplicantDocumentSummary, RetentionEvaluationItem
    from backend.app.api.v1.clients import ClientProfileCreate
    from backend.app.api.v1.findings import AIFindingOut

    # 1. DocumentDetailResponse default_factory fields
    d1 = DocumentDetailResponse(
        id=uuid.uuid4(),
        title="Doc 1",
        filename="d1.pdf",
        category="identity",
        storage_path="path/1",
        sha256_hash="hash1",
        byte_size=100,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        malware_scan_status="clean",
        detected_language="en",
        page_count=1,
        ocr_applied=False,
        case_id=None,
        client_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    d2 = DocumentDetailResponse(
        id=uuid.uuid4(),
        title="Doc 2",
        filename="d2.pdf",
        category="identity",
        storage_path="path/2",
        sha256_hash="hash2",
        byte_size=200,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        malware_scan_status="clean",
        detected_language="en",
        page_count=1,
        ocr_applied=False,
        case_id=None,
        client_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    # Mutate instance d1
    d1.layout_metadata["test_key"] = "test_val"
    d1.sub_documents_metadata.append({"sub": 1})
    d1.provenance_extractions.append({"prov": 1})
    d1.three_tier_extractions.append({"tier": 1})

    # d2 must remain unmutated and empty
    assert "test_key" not in d2.layout_metadata
    assert len(d2.sub_documents_metadata) == 0
    assert len(d2.provenance_extractions) == 0
    assert len(d2.three_tier_extractions) == 0

    # 2. ApplicantDocumentSummary default_factory fields
    a1 = ApplicantDocumentSummary(applicant_id=uuid.uuid4(), applicant_name="John", relationship="self")
    a2 = ApplicantDocumentSummary(applicant_id=uuid.uuid4(), applicant_name="Jane", relationship="spouse")
    assert a1.outstanding is not a2.outstanding
    assert a1.received is not a2.received
    assert a1.correction_required is not a2.correction_required

    # 3. ClientProfileCreate default_factory fields
    c1 = ClientProfileCreate(first_name="Raj", last_name="Patel", email="raj@example.com", nationality="IND")
    c2 = ClientProfileCreate(first_name="Priya", last_name="Patel", email="priya@example.com", nationality="IND")
    assert c1.dependants is not c2.dependants
    assert c1.consents is not c2.consents

    # 4. AIFindingOut default_factory fields
    f1 = AIFindingOut(
        id=str(uuid.uuid4()),
        case_id=str(uuid.uuid4()),
        finding_type="mismatch",
        severity="medium",
        status="open",
        title="Name Mismatch",
        description="Description",
        recommended_action="Review",
        uncertainty_limitations="None",
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    f2 = AIFindingOut(
        id=str(uuid.uuid4()),
        case_id=str(uuid.uuid4()),
        finding_type="mismatch",
        severity="medium",
        status="open",
        title="Name Mismatch",
        description="Description",
        recommended_action="Review",
        uncertainty_limitations="None",
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    assert f1.related_documents is not f2.related_documents
    assert f1.related_fields is not f2.related_fields
    assert f1.resolution_history is not f2.resolution_history

    # 5. CaseDetailResponse default_factory fields
    cd1 = CaseDetailResponse(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        client_name="Test Client",
        client_email="client@test.com",
        client_nationality="USA",
        case_number="CASE-001",
        title="O-1A Petition",
        jurisdiction="USA",
        visa_category="O-1A",
        status="INTAKE",
        priority_date=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    cd2 = CaseDetailResponse(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        client_name="Test Client 2",
        client_email="client2@test.com",
        client_nationality="CAN",
        case_number="CASE-002",
        title="EB-1A Petition",
        jurisdiction="USA",
        visa_category="EB-1A",
        status="INTAKE",
        priority_date=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    assert cd1.substantive_authorizations is not cd2.substantive_authorizations
    assert cd1.progressive_reviews is not cd2.progressive_reviews
    assert cd1.pinned_firm_config_snapshot is not cd2.pinned_firm_config_snapshot
    assert cd1.assignments is not cd2.assignments
    assert cd1.milestones is not cd2.milestones

    # 6. RetentionEvaluationItem default_factory fields
    r1 = RetentionEvaluationItem(
        document_id=str(uuid.uuid4()),
        title="Doc",
        created_at="2026-01-01",
        age_days=100.0,
        retention_threshold_days=90,
        is_eligible=True,
        legal_hold=False,
        status="eligible",
    )
    r2 = RetentionEvaluationItem(
        document_id=str(uuid.uuid4()),
        title="Doc 2",
        created_at="2026-01-01",
        age_days=100.0,
        retention_threshold_days=90,
        is_eligible=True,
        legal_hold=False,
        status="eligible",
    )
    assert r1.blocking_reasons is not r2.blocking_reasons


def test_adversarial_status_422_deprecation_resolved(client):
    """Verifies that RequestValidationError returns HTTP status 422 using

    status.HTTP_422_UNPROCESSABLE_CONTENT without emitting StarletteDeprecationWarning.
    """
    import warnings

    with warnings.catch_warnings(record=True) as recorded_warnings:
        warnings.simplefilter("always")
        # Send an invalid payload to trigger RequestValidationError
        resp = client.post("/api/v1/clients", json={"invalid": "payload"})
        assert resp.status_code == 422
        data = resp.json()
        assert data.get("error") == "RequestValidationError"

        deprecation_warnings = [
            w for w in recorded_warnings
            if "HTTP_422_UNPROCESSABLE_ENTITY" in str(w.message)
        ]
        assert len(deprecation_warnings) == 0, f"Found deprecated 422 warnings: {deprecation_warnings}"


# ==============================================================================
# AREA 11: M1 MULTI-IP BUCKET INDEPENDENCE & PROXY HEADER PARSING
# ==============================================================================


def test_adversarial_rate_limiter_multi_ip_bucket_independence():
    """Verifies that SimpleRateLimiterMiddleware tracks rate limits independently
    per client IP, ensuring high request volumes from IP A do not throttle IP B,
    and that multi-hop X-Forwarded-For headers properly track against client IP.
    """
    from starlette.applications import Starlette
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route
    from starlette.testclient import TestClient
    from backend.app.core.middleware import SimpleRateLimiterMiddleware

    async def endpoint(request):
        return PlainTextResponse("OK")

    test_app = Starlette(routes=[Route("/api/test-rate-limit", endpoint)])
    test_app.add_middleware(SimpleRateLimiterMiddleware, max_requests=2, window_seconds=60)
    tc = TestClient(test_app)

    ip_a = "203.0.113.10"
    ip_b = "198.51.100.20"

    # 1. IP A consumes its quota (2 requests)
    r1 = tc.get("/api/test-rate-limit", headers={"X-Forwarded-For": ip_a})
    r2 = tc.get("/api/test-rate-limit", headers={"X-Forwarded-For": ip_a})
    assert r1.status_code == 200
    assert r2.status_code == 200

    # 2. IP A makes 3rd request -> throttled with HTTP 429
    r3 = tc.get("/api/test-rate-limit", headers={"X-Forwarded-For": ip_a})
    assert r3.status_code == 429
    assert r3.json().get("error") == "RateLimitExceeded"
    assert r3.headers.get("Retry-After") == "60"

    # 3. IP B makes a request -> HTTP 200 (proves independent bucket tracking)
    rb = tc.get("/api/test-rate-limit", headers={"X-Forwarded-For": ip_b})
    assert rb.status_code == 200
    assert rb.text == "OK"

    # 4. Multi-hop X-Forwarded-For from IP A through upstream proxies -> throttled with HTTP 429
    r_multi_hop = tc.get(
        "/api/test-rate-limit",
        headers={"X-Forwarded-For": f"{ip_a}, 10.0.0.1, 172.16.0.1"},
    )
    assert r_multi_hop.status_code == 429


# ==============================================================================
# AREA 12: M4 BACKGROUNDTASKS PER-REQUEST DEPENDENCY INJECTION
# ==============================================================================


def test_adversarial_background_tasks_dependency_injection():
    """Verifies that upload_document declares BackgroundTasks without a default singleton,
    ensuring FastAPI's dependency injection provides a fresh per-request instance.
    """
    import inspect
    from fastapi import BackgroundTasks
    from backend.app.api.v1.documents import upload_document

    sig = inspect.signature(upload_document)
    assert "background_tasks" in sig.parameters, "upload_document must have 'background_tasks' parameter"
    param = sig.parameters["background_tasks"]

    # Parameter must NOT have a default value (e.g. BackgroundTasks())
    assert param.default is inspect.Parameter.empty, (
        f"background_tasks must not have default argument; found {param.default}"
    )
    assert param.annotation == BackgroundTasks, (
        f"Expected BackgroundTasks type annotation, got {param.annotation}"
    )


# ==============================================================================
# AREA 13: INT-CFG-04 MINIO DEFAULT SETTINGS VERIFICATION
# ==============================================================================


def test_adversarial_minio_default_settings():
    """Verifies that Settings defines default MinIO object storage credentials
    matching docker-compose.yml (localadmin / local_dev_only_change_me).
    """
    from backend.app.core.config import Settings

    settings = Settings(_env_file=None)
    assert settings.object_storage_access_key == "localadmin", (
        f"Expected 'localadmin', got {settings.object_storage_access_key!r}"
    )
    assert settings.object_storage_secret_key == "local_dev_only_change_me", (
        f"Expected 'local_dev_only_change_me', got {settings.object_storage_secret_key!r}"
    )
    assert settings.object_storage_bucket == "ai-immigration", (
        f"Expected 'ai-immigration', got {settings.object_storage_bucket!r}"
    )
