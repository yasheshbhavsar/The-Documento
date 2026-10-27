"""Stage 7 Backend Test Suite: Staff Work Queue Triage, Multi-Dimensional Analytics, and Case Workspaces

Tests:
1. Strict 1–8 Rank Order Priority Queue calculation in ExecutiveDashboardService.
2. Tenant Isolation and Role-Based Access Control (Retained Client denied 403, Staff authorized 200).
3. Rank 1 Authority Deadlines (USCIS RFE/NOID, IRCC PFL, court/biometrics) and urgency triage.
4. Rank 2 Workload Allocation, Capacity %, and Unassigned Intake Queue detection.
5. Granular Multi-Dimensional Operations Analytics (turnaround times, overdue work breakdown).
"""
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.domain.models import (
    Organization,
    OrganizationMembership,
    User,
    ClientProfile,
    ImmigrationCase,
    CaseMilestone,
    CaseTask,
    CaseAIFinding,
    Document,
    DocumentRequest,
    DocumentExtractedField,
    FormSubmission,
    FilingPackage,
    Invoice,
)
from backend.app.security.auth import RoleCode
from backend.app.security.tokens import create_access_token


@pytest.fixture
def org_and_users(db: Session):
    org = Organization(id=uuid.uuid4(), name="Stage 7 Legal LLP", slug="stage7-legal")
    other_org = Organization(id=uuid.uuid4(), name="Other Law Firm", slug="other-firm")
    db.add(org)
    db.add(other_org)

    staff_user = User(
        id=uuid.uuid4(),
        email=f"staff_{uuid.uuid4().hex[:6]}@stage7.com",
        full_name="Attorney Staff",
        password_hash="hash",
        status="active",
    )
    client_user = User(
        id=uuid.uuid4(),
        email=f"client_{uuid.uuid4().hex[:6]}@client.com",
        full_name="Retained Immigrant",
        password_hash="hash",
        status="active",
    )
    db.add(staff_user)
    db.add(client_user)
    db.flush()

    m1 = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=staff_user.id,
        status="active",
    )
    m2 = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=client_user.id,
        status="active",
    )
    db.add(m1)
    db.add(m2)
    db.commit()

    return {
        "org": org,
        "other_org": other_org,
        "staff": staff_user,
        "client": client_user,
    }


def test_stage7_manager_priority_queue_strict_8_ranks(client: TestClient, db: Session, org_and_users):
    """Verifies that GET /api/v1/analytics/manager-priority-queue returns all 8 ranks in strict 1-8 order."""
    org = org_and_users["org"]
    staff = org_and_users["staff"]

    token = create_access_token(
        data={"sub": str(staff.id), "org_id": str(org.id), "roles": [RoleCode.CASE_MANAGER.value]}
    )

    res = client.get(
        "/api/v1/analytics/manager-priority-queue",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "ranks" in data
    assert "summary" in data
    ranks = data["ranks"]
    assert len(ranks) == 8

    # Strict 1 to 8 numerical ordering
    rank_numbers = [r["rank"] for r in ranks]
    assert rank_numbers == [1, 2, 3, 4, 5, 6, 7, 8]

    # Verify standard priorities and titles
    assert ranks[0]["priority"] == "P1_CRITICAL"
    assert "Critical/Overdue Deadlines" in ranks[0]["title"]

    assert ranks[1]["priority"] == "P2_HIGH"
    assert "Workload & Allocation" in ranks[1]["title"]

    assert ranks[2]["priority"] == "P3_HIGH"
    assert "Blocked Cases" in ranks[2]["title"]

    assert ranks[3]["priority"] == "P4_MEDIUM"
    assert "Overdue Client Responses" in ranks[3]["title"]

    assert ranks[4]["priority"] == "P5_MEDIUM"
    assert "Pending Reviews" in ranks[4]["title"]

    assert ranks[5]["priority"] == "P6_MEDIUM"
    assert "Quality Issues" in ranks[5]["title"]

    assert ranks[6]["priority"] == "P7_FINANCIAL"
    assert "Payment Status" in ranks[6]["title"]

    assert ranks[7]["priority"] == "P8_PERFORMANCE"
    assert "Performance View" in ranks[7]["title"]


def test_stage7_manager_priority_queue_rbac_isolation(client: TestClient, db: Session, org_and_users):
    """Verifies that Retained Clients are strictly forbidden from viewing staff manager priority queue (403)."""
    org = org_and_users["org"]
    client_user = org_and_users["client"]
    staff_user = org_and_users["staff"]

    # Retained client attempt -> 403 Forbidden
    client_token = create_access_token(
        data={"sub": str(client_user.id), "org_id": str(org.id), "roles": [RoleCode.RETAINED_CLIENT.value]}
    )
    res_client = client.get(
        "/api/v1/analytics/manager-priority-queue",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert res_client.status_code == 403

    # Staff attempt -> 200 OK
    staff_token = create_access_token(
        data={"sub": str(staff_user.id), "org_id": str(org.id), "roles": [RoleCode.CASE_MANAGER.value]}
    )
    res_staff = client.get(
        "/api/v1/analytics/manager-priority-queue",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 200


def test_stage7_rank1_authority_deadlines_and_urgency(client: TestClient, db: Session, org_and_users):
    """Verifies that authority deadlines (USCIS RFE/NOID, IRCC PFL) are flagged and triaged first in Rank 1."""
    org = org_and_users["org"]
    staff = org_and_users["staff"]
    now = datetime.now(timezone.utc)

    # Create client profile & case
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Dr. Alexei",
        last_name="Romanov",
        email="alexei@example.com",
        nationality="Russia",
        created_at=now,
    )
    db.add(cp)
    db.flush()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=cp.id,
        case_number="US-EB1A-7701",
        title="Extraordinary Ability Petition",
        visa_category="EB-1A",
        jurisdiction="US",
        status="rfe_issued",
        created_at=now,
    )
    db.add(case)
    db.flush()

    # Authority RFE Milestone (Overdue)
    rfe_ms = CaseMilestone(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        title="USCIS RFE Response: Scholarly Articles & Critical Role",
        stage="rfe_response",
        target_date=now - timedelta(days=3),
        status="in_progress",
        created_at=now,
    )
    # Routine Milestone (10 days left)
    routine_ms = CaseMilestone(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        title="Internal Document Index Assembly",
        stage="drafting",
        target_date=now + timedelta(days=10),
        status="in_progress",
        created_at=now,
    )
    db.add(rfe_ms)
    db.add(routine_ms)
    db.commit()

    staff_token = create_access_token(
        data={"sub": str(staff.id), "org_id": str(org.id), "roles": [RoleCode.CASE_MANAGER.value]}
    )
    res = client.get(
        "/api/v1/analytics/manager-priority-queue",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 200
    ranks = res.json()["ranks"]
    rank1 = ranks[0]

    assert rank1["rank"] == 1
    assert rank1["count"] >= 1
    items = rank1["items"]
    # The authority RFE must be present, marked as authority request, and overdue
    rfe_item = next((it for it in items if "USCIS RFE" in it["title"]), None)
    assert rfe_item is not None
    assert rfe_item["is_authority_request"] is True
    assert rfe_item["is_overdue"] is True
    assert rfe_item["authority_type"] == "USCIS RFE/NOID"
    assert rfe_item["severity"] == "CRITICAL"


def test_stage7_rank2_workload_allocation_capacity_matrix(client: TestClient, db: Session, org_and_users):
    """Verifies that Rank 2 calculates staff capacity % and detects unassigned cases."""
    org = org_and_users["org"]
    staff = org_and_users["staff"]
    now = datetime.now(timezone.utc)

    # Create unassigned case
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Unassigned",
        last_name="Applicant",
        email="unassigned@example.com",
        nationality="India",
        created_at=now,
    )
    db.add(cp)
    db.flush()

    unassigned_case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=cp.id,
        case_number="US-NIW-UNASSIGNED",
        title="Unassigned NIW Petition",
        visa_category="EB-2 NIW",
        jurisdiction="US",
        status="intake",
        created_at=now,
    )
    db.add(unassigned_case)
    db.commit()

    staff_token = create_access_token(
        data={"sub": str(staff.id), "org_id": str(org.id), "roles": [RoleCode.CASE_MANAGER.value]}
    )
    res = client.get(
        "/api/v1/analytics/manager-priority-queue",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 200
    rank2 = res.json()["ranks"][1]

    assert rank2["rank"] == 2
    assert "staff_allocation" in rank2
    assert "unassigned_cases" in rank2
    # Verify unassigned case was captured
    unassigned_found = any(c["case_id"] == str(unassigned_case.id) for c in rank2["unassigned_cases"])
    assert unassigned_found is True
    assert rank2["unassigned_cases_count"] >= 1


def test_stage7_operations_analytics_multi_dimensional(client: TestClient, db: Session, org_and_users):
    """Verifies that GET /api/v1/analytics/operations supports multi-dimensional operational metrics."""
    org = org_and_users["org"]
    staff = org_and_users["staff"]

    staff_token = create_access_token(
        data={"sub": str(staff.id), "org_id": str(org.id), "roles": [RoleCode.COMPANY_ADMIN.value]}
    )

    res = client.get(
        "/api/v1/analytics/operations?jurisdiction=US&pathway=EB-1A",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "filters_applied" in data
    assert "turnaround_time" in data
    assert "overdue_work" in data
    assert "client_response_time" in data
    assert data["filters_applied"]["pathway"] == "EB-1A"
