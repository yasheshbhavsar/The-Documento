import uuid
from datetime import datetime, timezone

from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseTask,
    ClientProfile,
    Document,
    ImmigrationCase,
    Organization,
    User,
)
from backend.app.security.rbac import RoleCode


def test_delete_case_rbac_isolation_and_cascade(client, db):
    now = datetime.now(timezone.utc)
    org_a = Organization(name="Maple North Immigration", slug=f"maple-{uuid.uuid4().hex[:6]}")
    org_b = Organization(name="Rival Legal Corp", slug=f"rival-{uuid.uuid4().hex[:6]}")
    db.add_all([org_a, org_b])
    db.flush()

    owner_user = User(email=f"owner-{uuid.uuid4().hex[:5]}@maple.ca", full_name="Managing Partner", status="active")
    manager_user = User(email=f"mgr-{uuid.uuid4().hex[:5]}@maple.ca", full_name="Case Manager", status="active")
    paralegal_user = User(email=f"para-{uuid.uuid4().hex[:5]}@maple.ca", full_name="Case Worker", status="active")
    db.add_all([owner_user, manager_user, paralegal_user])
    db.flush()

    client_profile = ClientProfile(
        organization_id=org_a.id,
        first_name="Yashesh",
        last_name="Bhavsar",
        email="yashesh@example.com",
        nationality="IND",
    )
    db.add(client_profile)
    db.flush()

    case_primary = ImmigrationCase(
        organization_id=org_a.id,
        client_id=client_profile.id,
        case_number=f"CASE-6021-{uuid.uuid4().hex[:4]}",
        title="EB-1A Extraordinary Ability: YASHESH BHAVSAR",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
    )
    case_secondary = ImmigrationCase(
        organization_id=org_a.id,
        client_id=client_profile.id,
        case_number=f"CASE-3031-{uuid.uuid4().hex[:4]}",
        title="Canada Visitor Visa (TRV): YASHESH BHAVSAR",
        jurisdiction="CA",
        visa_category="Visitor Visa (TRV)",
        status="intake",
    )
    db.add_all([case_primary, case_secondary])
    db.flush()

    # Follow-up case pointing to case_primary via prior_case_id
    case_secondary.prior_case_id = case_primary.id

    child_assignment = CaseAssignment(
        case_id=case_primary.id,
        user_id=paralegal_user.id,
        role_in_case="lead_attorney",
    )
    child_task = CaseTask(
        organization_id=org_a.id,
        case_id=case_primary.id,
        title="Collect passport scan",
        priority="high",
        status="pending",
        is_completed=False,
        created_at=now,
    )
    child_doc = Document(
        organization_id=org_a.id,
        case_id=case_primary.id,
        client_id=client_profile.id,
        uploaded_by_user_id=owner_user.id,
        title="Passport.pdf",
        filename="passport.pdf",
        category="identity_passport",
        storage_path="s3://bucket/passport.pdf",
        sha256_hash="a" * 64,
        byte_size=1024,
        mime_type="application/pdf",
        processing_status="completed",
        verification_status="unverified",
        created_at=now,
    )
    db.add_all([child_assignment, child_task, child_doc])
    db.commit()

    def make_headers(org_id, user_id, role: RoleCode):
        return {
            "X-Organization-Id": str(org_id),
            "X-User-Id": str(user_id),
            "X-User-Role": role.value,
        }

    # 1. Retained client -> 403 Forbidden
    res_client = client.delete(
        f"/api/v1/cases/{case_primary.id}",
        headers=make_headers(org_a.id, uuid.uuid4(), RoleCode.RETAINED_CLIENT),
    )
    assert res_client.status_code == 403

    # 2. Paralegal (case_worker), Document Reviewer, and Finance Staff -> 403 Forbidden
    for denied_role in (
        RoleCode.CASE_WORKER,
        RoleCode.DOCUMENT_REVIEWER,
        RoleCode.FINANCE_STAFF,
    ):
        res_denied = client.delete(
            f"/api/v1/cases/{case_primary.id}",
            headers=make_headers(org_a.id, uuid.uuid4(), denied_role),
        )
        assert res_denied.status_code == 403

    # 3. Cross-tenant Owner cannot delete Org A's case -> 403 Forbidden
    res_cross = client.delete(
        f"/api/v1/cases/{case_primary.id}",
        headers=make_headers(org_b.id, uuid.uuid4(), RoleCode.MASTER_ADMIN),
    )
    assert res_cross.status_code == 403

    # Case still exists before authorized delete
    assert db.query(ImmigrationCase).filter(ImmigrationCase.id == case_primary.id).first() is not None

    # 4. Same-org Case Manager deletes case_primary -> 200 OK
    res_mgr = client.delete(
        f"/api/v1/cases/{case_primary.id}",
        headers=make_headers(org_a.id, manager_user.id, RoleCode.CASE_MANAGER),
    )
    assert res_mgr.status_code == 200
    body = res_mgr.json()
    assert body["status"] == "success"
    assert body["id"] == str(case_primary.id)
    assert body["client_id"] == str(client_profile.id)

    # Verify case_primary and its child records were deleted
    assert db.query(ImmigrationCase).filter(ImmigrationCase.id == case_primary.id).first() is None
    assert db.query(CaseTask).filter(CaseTask.case_id == case_primary.id).first() is None
    assert db.query(Document).filter(Document.case_id == case_primary.id).first() is None
    assert db.query(CaseAssignment).filter(CaseAssignment.case_id == case_primary.id).first() is None

    # Verify retained client AND sibling case remain intact with prior_case_id cleared
    db.expire_all()
    assert db.query(ClientProfile).filter(ClientProfile.id == client_profile.id).first() is not None
    surviving = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_secondary.id).first()
    assert surviving is not None
    assert surviving.prior_case_id is None

    # Verify audit trail event recorded
    audit = (
        db.query(AuditEvent)
        .filter(AuditEvent.action == "case.deleted", AuditEvent.object_id == str(case_primary.id))
        .first()
    )
    assert audit is not None
    assert audit.metadata_json["case_number"] == case_primary.case_number

    # 5. Same-org Managing Partner (COMPANY_ADMIN) deletes case_secondary -> 200 OK
    res_owner = client.delete(
        f"/api/v1/cases/{case_secondary.id}",
        headers=make_headers(org_a.id, owner_user.id, RoleCode.COMPANY_ADMIN),
    )
    assert res_owner.status_code == 200
    assert db.query(ImmigrationCase).filter(ImmigrationCase.id == case_secondary.id).first() is None
    # Client profile remains intact until explicitly deleted
    assert db.query(ClientProfile).filter(ClientProfile.id == client_profile.id).first() is not None

    # 6. Deleting unknown UUID -> 404 Not Found
    res_missing = client.delete(
        f"/api/v1/cases/{uuid.uuid4()}",
        headers=make_headers(org_a.id, owner_user.id, RoleCode.MASTER_ADMIN),
    )
    assert res_missing.status_code == 404
