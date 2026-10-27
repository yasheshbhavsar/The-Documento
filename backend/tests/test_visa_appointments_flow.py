import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    VisaAppointment,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def setup_appointment_fixtures(db: Session):
    org = Organization(name="Global Migration Law LLP", slug=f"global-law-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    user = User(
        email=f"paralegal-{uuid.uuid4().hex[:6]}@globallaw.com",
        full_name="Priya Sharma",
        password_hash=hash_password("securepassword"),
        status="active",
    )
    db.add(user)
    db.flush()

    client_profile = ClientProfile(
        organization_id=org.id,
        first_name="Rohan",
        last_name="Mehta",
        email=f"rohan-{uuid.uuid4().hex[:6]}@example.com",
        nationality="IND",
    )
    db.add(client_profile)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"US-F1-{uuid.uuid4().hex[:4].upper()}",
        title="F-1 Academic Student Visa Petition",
        jurisdiction="US",
        visa_category="F-1 Student Visa",
        status="intake",
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


def test_visa_appointment_end_to_end_lifecycle(client: TestClient, db: Session):
    """Test full visa appointment lifecycle: scheduling, updating, 221(g) slip, and deletion."""
    fixtures = setup_appointment_fixtures(db)
    auth_ctx = AuthContext(
        user_id=fixtures["user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["user"].email,
        roles=("case_manager",),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth_ctx

    case_id = str(fixtures["case"].id)

    # 1. Schedule a new appointment via /api/v1/appointments
    create_payload = {
        "case_id": case_id,
        "vac_center": "Mumbai VAC (Bandra Kurla Complex)",
        "consular_post": "U.S. Consulate General Mumbai",
        "ofc_biometrics_slot": "2026-11-15T09:30:00Z",
        "consular_interview_slot": "2026-11-18T10:15:00Z",
        "dropbox_eligible": False,
        "tracking_number_blue_dart": "BD-123456789IN",
        "courier_status": "pending_pickup",
        "status_221g": False,
        "appointment_status": "scheduled",
        "notes": "Carry DS-160 confirmation, Form I-20, and passport photographs.",
    }
    create_res = client.post("/api/v1/appointments", json=create_payload)
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    appt_id = created["id"]
    assert created["vac_center"] == "Mumbai VAC (Bandra Kurla Complex)"
    assert created["consular_post"] == "U.S. Consulate General Mumbai"
    assert created["case_number"] == fixtures["case"].case_number
    assert created["client_name"] == "Rohan Mehta"
    assert created["appointment_status"] == "scheduled"

    # 2. List all organization appointments via /api/v1/appointments
    list_res = client.get("/api/v1/appointments")
    assert list_res.status_code == 200
    all_appts = list_res.json()
    assert len(all_appts) >= 1
    assert any(a["id"] == appt_id for a in all_appts)

    # 3. Retrieve specific appointment
    get_res = client.get(f"/api/v1/appointments/{appt_id}")
    assert get_res.status_code == 200
    assert get_res.json()["tracking_number_blue_dart"] == "BD-123456789IN"

    # 4. Patch appointment: Update slot and log 221(g) administrative processing slip
    patch_payload = {
        "status_221g": True,
        "status_221g_color": "pink",
        "appointment_status": "administrative_processing_221g",
        "courier_status": "in_transit",
        "notes": "221(g) Pink slip issued: Employer research narrative requested.",
    }
    patch_res = client.patch(f"/api/v1/appointments/{appt_id}", json=patch_payload)
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["status_221g"] is True
    assert patched["status_221g_color"] == "pink"
    assert patched["courier_status"] == "in_transit"

    # 5. Filter appointments by 221(g) status
    filtered_res = client.get("/api/v1/appointments?status_221g=true")
    assert filtered_res.status_code == 200
    assert any(a["id"] == appt_id for a in filtered_res.json())

    # 6. Delete appointment via /api/v1/cases/{case_id}/appointments/{appt_id}
    del_res = client.delete(f"/api/v1/cases/{case_id}/appointments/{appt_id}")
    assert del_res.status_code == 204

    # 7. Verify deletion
    verify_res = client.get(f"/api/v1/appointments/{appt_id}")
    assert verify_res.status_code == 404
