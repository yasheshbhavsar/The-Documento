"""Test Phase 2 Commercial and Operational Expansions

Covers:
1. Multi-currency and Indian 18% GST (SAC 998311) invoicing
2. Financial Sponsor / Guarantor model & Indian KYC fields
3. Visa Appointment & VAC Logistics Desk (Blue Dart courier, OFC/Consular slots, 221(g))
4. High-volume Form Schemas catalog (DOS DS-160 and IRCC IMM 5257)
"""
import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.billing.service import BillingService
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    FinancialSponsor,
    VisaAppointment,
    Invoice,
    FormSchema,
)
from backend.app.forms.service import FormService
from backend.app.forms.schemas_catalog import DOS_DS160_SCHEMA, IRCC_IMM5257_SCHEMA
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def setup_test_context(db: Session):
    org = Organization(name="Global Visa Counsel", slug=f"visa-counsel-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    user = User(
        email=f"admin-{uuid.uuid4().hex[:6]}@counsel.com",
        full_name="Senior Counsel",
        password_hash=hash_password("securepassword"),
        status="active",
    )
    db.add(user)
    db.flush()

    client_profile = ClientProfile(
        organization_id=org.id,
        first_name="Aarav",
        last_name="Patel",
        email=f"aarav-{uuid.uuid4().hex[:6]}@example.com",
        phone="+919876543210",
        nationality="IND",
        pan_number="ABCDE1234F",
        aadhaar_number_masked="XXXX-XXXX-1234",
        voter_id="ABC1234567",
        passport_ecr_status="NON_ECR",
    )
    db.add(client_profile)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"IN-STUDY-{uuid.uuid4().hex[:4].upper()}",
        title="Canada Post-Graduate Student Visa & Co-Op Permit",
        jurisdiction="CA",
        visa_category="Study Permit",
        status="active",
    )
    db.add(case)
    db.commit()
    db.refresh(org)
    db.refresh(user)
    db.refresh(client_profile)
    db.refresh(case)

    return {
        "org": org,
        "user": user,
        "client": client_profile,
        "case": case,
    }


def test_gst_calculation_intra_and_interstate():
    """Verify statutory 18% GST math for SAC 998311 legal consulting."""
    # Intra-state: CGST 9% + SGST 9% = 18%, IGST = 0
    res_intra = BillingService.calculate_gst(subtotal=100000.0, is_interstate=False, gst_rate=0.18)
    assert res_intra["subtotal"] == 100000.0
    assert res_intra["gst_rate"] == 0.18
    assert res_intra["cgst_amount"] == 9000.0
    assert res_intra["sgst_amount"] == 9000.0
    assert res_intra["igst_amount"] == 0.0
    assert res_intra["tax_amount"] == 18000.0
    assert res_intra["total_amount"] == 118000.0

    # Inter-state: IGST 18% = 18%, CGST = 0, SGST = 0
    res_inter = BillingService.calculate_gst(subtotal=50000.0, is_interstate=True, gst_rate=0.18)
    assert res_inter["subtotal"] == 50000.0
    assert res_inter["gst_rate"] == 0.18
    assert res_inter["cgst_amount"] == 0.0
    assert res_inter["sgst_amount"] == 0.0
    assert res_inter["igst_amount"] == 9000.0
    assert res_inter["tax_amount"] == 9000.0
    assert res_inter["total_amount"] == 59000.0


def test_gst_calculation_api_endpoint(client: TestClient, db: Session):
    """Verify POST /api/v1/billing/calculate-gst endpoint."""
    fixtures = setup_test_context(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    # Intra-state
    resp = client.post("/api/v1/billing/calculate-gst", json={
        "subtotal": 10000.0,
        "is_interstate": False,
        "gst_rate": 0.18,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["cgst_amount"] == 900.0
    assert data["sgst_amount"] == 900.0
    assert data["igst_amount"] == 0.0
    assert data["tax_amount"] == 1800.0
    assert data["total_amount"] == 11800.0

    # Inter-state
    resp_inter = client.post("/api/v1/billing/calculate-gst", json={
        "subtotal": 20000.0,
        "is_interstate": True,
        "gst_rate": 0.18,
    })
    assert resp_inter.status_code == 200
    inter_data = resp_inter.json()
    assert inter_data["cgst_amount"] == 0.0
    assert inter_data["sgst_amount"] == 0.0
    assert inter_data["igst_amount"] == 3600.0
    assert inter_data["tax_amount"] == 3600.0
    assert inter_data["total_amount"] == 23600.0


def test_invoicing_with_inr_auto_gst(client: TestClient, db: Session):
    """Verify INR invoice creation auto-calculates CGST/SGST with SAC 998311."""
    fixtures = setup_test_context(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    resp = client.post("/api/v1/billing/invoices", json={
        "client_id": str(fixtures["client"].id),
        "case_id": str(fixtures["case"].id),
        "currency": "INR",
        "sac_code": "998311",
        "gstin": "24AAACG1234A1Z5",
        "place_of_supply": "24-Gujarat",
        "is_interstate": False,
        "line_items": [
            {
                "description": "Student Visa Legal Advisory & Documentation",
                "quantity": 1.0,
                "unit_price": 45000.0,
                "sac_code": "998311",
                "line_type": "service_fee",
            }
        ],
    })
    assert resp.status_code == 201
    inv = resp.json()
    assert inv["currency"] == "INR"
    assert inv["subtotal"] == 45000.0
    assert inv["cgst_amount"] == 4050.0  # 9% of 45,000
    assert inv["sgst_amount"] == 4050.0  # 9% of 45,000
    assert inv["igst_amount"] == 0.0
    assert inv["tax_amount"] == 8100.0   # 18% GST
    assert inv["total_amount"] == 53100.0
    assert inv["sac_code"] == "998311"
    assert inv["gstin"] == "24AAACG1234A1Z5"
    assert inv["place_of_supply"] == "24-Gujarat"


def test_financial_sponsor_lifecycle_api(client: TestClient, db: Session):
    """Verify adding, fetching, and deleting financial sponsors on an immigration case."""
    fixtures = setup_test_context(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    case_id = str(fixtures["case"].id)

    # 1. Add Financial Sponsor (Father sponsoring student with ₹35 Lakh liquid funds & loan)
    create_resp = client.post(f"/api/v1/cases/{case_id}/sponsors", json={
        "name": "Ramesh Patel",
        "relationship": "Father",
        "sponsor_type": "parent",
        "pan": "ABCDE5678G",
        "itr_gross_income": 1250000.0,
        "liquid_funds": 3500000.0,
        "currency": "INR",
        "bank_name": "State Bank of India",
        "loan_sanction_amount": 2000000.0,
        "notes": "Fixed deposit certificates and property valuation attached.",
    })
    assert create_resp.status_code == 201
    sponsor_data = create_resp.json()
    assert sponsor_data["name"] == "Ramesh Patel"
    assert sponsor_data["relationship"] == "Father"
    assert sponsor_data["liquid_funds"] == 3500000.0
    assert sponsor_data["loan_sanction_amount"] == 2000000.0
    assert sponsor_data["bank_name"] == "State Bank of India"
    sponsor_id = sponsor_data["id"]

    # 2. Fetch Sponsors
    get_resp = client.get(f"/api/v1/cases/{case_id}/sponsors")
    assert get_resp.status_code == 200
    sponsors = get_resp.json()
    assert len(sponsors) == 1
    assert sponsors[0]["id"] == sponsor_id
    assert sponsors[0]["pan"] == "ABCDE5678G"

    # 3. Delete Sponsor
    del_resp = client.delete(f"/api/v1/cases/{case_id}/sponsors/{sponsor_id}")
    assert del_resp.status_code == 204

    # Verify deleted
    get_resp_after = client.get(f"/api/v1/cases/{case_id}/sponsors")
    assert get_resp_after.status_code == 200
    assert len(get_resp_after.json()) == 0


def test_visa_appointment_vac_logistics_api(client: TestClient, db: Session):
    """Verify scheduling and tracking visa appointment slots and Blue Dart courier status."""
    fixtures = setup_test_context(db)
    from backend.app.main import app

    auth_ctx = AuthContext(
        user_id=fixtures["user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["user"].email,
        roles=("company_admin",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    case_id = str(fixtures["case"].id)

    # 1. Create Visa Appointment (US F-1 / Canada VAC appointment)
    create_resp = client.post(f"/api/v1/cases/{case_id}/appointments", json={
        "vac_center": "VFS Ahmedabad VAC",
        "consular_post": "US Consulate General Mumbai",
        "ofc_biometrics_slot": "2026-11-15T09:30:00Z",
        "consular_interview_slot": "2026-11-20T10:00:00Z",
        "dropbox_eligible": False,
        "appointment_status": "scheduled",
        "notes": "Biometrics appointment confirmed at Ahmedabad VAC.",
    })
    assert create_resp.status_code == 201
    appt_data = create_resp.json()
    assert appt_data["vac_center"] == "VFS Ahmedabad VAC"
    assert appt_data["consular_post"] == "US Consulate General Mumbai"
    assert appt_data["appointment_status"] == "scheduled"
    appt_id = appt_data["id"]

    # 2. Patch appointment with Blue Dart courier tracking number and dispatched status
    patch_resp = client.patch(f"/api/v1/cases/{case_id}/appointments/{appt_id}", json={
        "tracking_number_blue_dart": "BD8899112233IN",
        "courier_status": "in_transit_blue_dart",
        "appointment_status": "completed",
    })
    assert patch_resp.status_code == 200
    patched = patch_resp.json()
    assert patched["tracking_number_blue_dart"] == "BD8899112233IN"
    assert patched["courier_status"] == "in_transit_blue_dart"
    assert patched["appointment_status"] == "completed"

    # 3. Retrieve appointments list
    list_resp = client.get(f"/api/v1/cases/{case_id}/appointments")
    assert list_resp.status_code == 200
    appts = list_resp.json()
    assert len(appts) == 1
    assert appts[0]["tracking_number_blue_dart"] == "BD8899112233IN"


def test_form_schemas_catalog_seeding(db: Session):
    """Verify default schemas catalog seeds USCIS I-140, DOS DS-160, and IRCC IMM 5257."""
    fixtures = setup_test_context(db)
    FormService.ensure_default_schemas(db, fixtures["org"].id)
    schemas = db.query(FormSchema).filter(FormSchema.organization_id == fixtures["org"].id).all()
    form_codes = [s.form_code for s in schemas]
    assert "USCIS_I140" in form_codes
    assert "DOS_DS160" in form_codes
    assert "IRCC_IMM5257" in form_codes

    # Verify DOS DS-160 content structure
    assert "sections" in DOS_DS160_SCHEMA
    assert len(DOS_DS160_SCHEMA["sections"]) >= 5
    section_ids = [s["id"] for s in DOS_DS160_SCHEMA["sections"]]
    assert "ds160_part1_personal" in section_ids
    assert "ds160_part2_travel" in section_ids
    assert "ds160_part6_security" in section_ids

    # Verify IRCC IMM 5257 content structure
    assert "sections" in IRCC_IMM5257_SCHEMA
    assert len(IRCC_IMM5257_SCHEMA["sections"]) >= 4
    ircc_ids = [s["id"] for s in IRCC_IMM5257_SCHEMA["sections"]]
    assert "imm5257_part1_personal" in ircc_ids
    assert "imm5257_part3_visit_details" in ircc_ids
