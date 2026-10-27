"""Stage 4 Regression Test Suite: Multi-Family Document Intake & Applicant Reassignment Integrity.

Validates invariants from Documento Master Vision §4.1, §4.2, §4.3, §4.4, §4.5:
1. Multi-family entity separation:
   - Primary client (ClientProfile), individual dependants (ClientDependant), and family groups.
   - Documents accurately track client_id, applicant_dependant_id, proposed_applicant_name,
     is_assignment_confirmed, and assignment_confirmed_by_id.
2. Tenant isolation & entity validation on applicant reassignment:
   - Cross-tenant applicant or dependant reassignment is strictly rejected (404/403).
   - Only authorized firm staff/officers can reassign or confirm assignments (clients get 403).
3. Cross-document AI finding auto-resolution & anomaly clearance:
   - When a document is reassigned from one family member to another, prior cross-document
     consistency findings comparing it against the previous applicant are automatically resolved.
   - Document unresolved anomaly flag (has_unresolved_anomaly) is automatically cleared when all
     associated findings are resolved.
4. Immutable audit trail:
   - Every applicant reassignment records an immutable AuditEvent capturing previous and updated
     applicant IDs, names, actor ID, and resolved findings count.
5. Multi-family boundary splitting:
   - Combined multi-family submissions can be segmented with per-section applicant targeting.
"""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    ClientDependant,
    ClientProfile,
    Document,
    ImmigrationCase,
    Organization,
    OrganizationMembership,
    User,
    now_utc,
)


@pytest.fixture
def stage4_fixture(db):
    # Tenant A
    org_a_id = uuid.uuid4()
    org_a = Organization(
        id=org_a_id,
        name="Apex Immigration Legal LLP",
        slug=f"apex-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(org_a)

    # Tenant B (Adversary / separate tenant)
    org_b_id = uuid.uuid4()
    org_b = Organization(
        id=org_b_id,
        name="Rival Global Mobility Inc",
        slug=f"rival-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(org_b)

    # Staff Officer in Org A
    officer_id = uuid.uuid4()
    officer = User(
        id=officer_id,
        email="officer@apexlegal.com",
        full_name="Sarah Jenkins Esq",
        password_hash="hash",
        status="active",
    )
    officer.organization_id = org_a_id
    officer.role = "senior_reviewer"
    db.add(officer)
    db.flush()

    db.add(OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        user_id=officer_id,
        status="active",
    ))

    # Client user in Org A (Primary petitioner)
    client_user_id = uuid.uuid4()
    client_user = User(
        id=client_user_id,
        email="raj.patel@family.com",
        full_name="Raj Patel",
        password_hash="hash",
        status="active",
    )
    client_user.organization_id = org_a_id
    client_user.role = "client"
    db.add(client_user)
    db.flush()

    db.add(OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        user_id=client_user_id,
        status="active",
    ))

    # Primary client profile in Org A
    primary_client = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        user_id=client_user_id,
        first_name="Raj",
        last_name="Patel",
        email="raj.patel@family.com",
        nationality="IND",
    )
    db.add(primary_client)

    # Dependant 1: Spouse in Org A
    dep_spouse = ClientDependant(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        primary_client_id=primary_client.id,
        first_name="Priya",
        last_name="Patel",
        relationship_type="spouse",
        nationality="IND",
    )
    db.add(dep_spouse)

    # Dependant 2: Child in Org A
    dep_child = ClientDependant(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        primary_client_id=primary_client.id,
        first_name="Aarav",
        last_name="Patel",
        relationship_type="child",
        nationality="IND",
    )
    db.add(dep_child)

    # Immigration case in Org A
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        client_id=primary_client.id,
        case_number="STG4-FAM-2026",
        title="Patel Family Permanent Residency",
        jurisdiction="US",
        visa_category="EB-1A",
        status="in_progress",
        operational_state="ACTIVE",
    )
    db.add(case)

    # Tenant B Client & Dependant (for cross-tenant attacks)
    client_b = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_b_id,
        first_name="Alice",
        last_name="Smith",
        email="alice@rival.com",
        nationality="GBR",
    )
    db.add(client_b)

    dep_b = ClientDependant(
        id=uuid.uuid4(),
        organization_id=org_b_id,
        primary_client_id=client_b.id,
        first_name="Bob",
        last_name="Smith",
        relationship_type="spouse",
        nationality="GBR",
    )
    db.add(dep_b)

    db.commit()

    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "officer": officer,
        "client_user": client_user,
        "primary_client": primary_client,
        "dep_spouse": dep_spouse,
        "dep_child": dep_child,
        "case": case,
        "client_b": client_b,
        "dep_b": dep_b,
    }


def _headers(user: User) -> dict:
    return {
        "X-User-Id": str(user.id),
        "X-Organization-Id": str(user.organization_id),
        "X-User-Role": user.role,
    }


class TestStage4MultiFamilyIntake:
    def test_reassign_to_dependant_updates_association_and_audit(self, client: TestClient, db, stage4_fixture):
        """
        Master Vision §4.1 & §4.3:
        Authorized staff reassigns document from primary client to spouse dependant.
        Enforces:
        - client_id points to primary client profile
        - applicant_dependant_id points to spouse
        - proposed_applicant_name is updated to dependant's name
        - is_assignment_confirmed is True and assignment_confirmed_by_id records staff ID
        - AuditEvent created with exact previous and updated applicant metadata.
        """
        data = stage4_fixture
        officer = data["officer"]
        primary = data["primary_client"]
        spouse = data["dep_spouse"]
        case = data["case"]

        doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            proposed_applicant_name="Raj Patel",
            is_assignment_confirmed=False,
            title="Spouse Foreign Passport",
            filename="passport_priya.pdf",
            category="identity_passport",
            storage_path="tenants/a/passport_priya.pdf",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=1024,
            mime_type="application/pdf",
        )
        db.add(doc)
        db.commit()

        # Reassign to spouse dependant
        resp = client.put(
            f"/api/v1/documents/{doc.id}/applicant-association",
            headers=_headers(officer),
            json={
                "applicant_dependant_id": str(spouse.id),
                "reason": "Document visually and cryptographically matches spouse passport biodata",
            },
        )

        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["applicant_dependant_id"] == str(spouse.id)
        assert res_data["client_id"] == str(primary.id)
        assert res_data["proposed_applicant_name"] == "Priya Patel"
        assert res_data["is_assignment_confirmed"] is True

        # Database verification
        db.refresh(doc)
        assert doc.applicant_dependant_id == spouse.id
        assert doc.client_id == primary.id
        assert doc.proposed_applicant_name == "Priya Patel"
        assert doc.is_assignment_confirmed is True
        assert doc.assignment_confirmed_by_id == officer.id

        # Audit Event Verification
        audit = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.object_id == str(doc.id),
                AuditEvent.action == "document.applicant_association_corrected",
            )
            .order_by(AuditEvent.occurred_at.desc())
            .first()
        )
        assert audit is not None
        assert audit.actor_id == officer.id
        assert audit.metadata_json["previous_applicant_dependant_id"] is None
        assert audit.metadata_json["new_applicant_dependant_id"] == str(spouse.id)
        assert audit.metadata_json["previous_applicant_name"] == "Raj Patel"
        assert audit.metadata_json["new_applicant_name"] == "Priya Patel"
        assert audit.metadata_json["is_assignment_confirmed"] is True
        assert audit.metadata_json["assignment_confirmed_by_id"] == str(officer.id)

    def test_cross_tenant_dependant_reassignment_rejected(self, client: TestClient, db, stage4_fixture):
        """
        Master Vision §4.1 Invariant:
        Attempting to reassign a document to a dependant from another organization
        must be strictly rejected with 404 (not found in tenant).
        """
        data = stage4_fixture
        officer = data["officer"]
        primary = data["primary_client"]
        dep_b = data["dep_b"]
        case = data["case"]

        doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            proposed_applicant_name="Raj Patel",
            title="Tax Return 2025",
            filename="tax.pdf",
            category="financial_evidence",
            storage_path="tenants/a/tax.pdf",
            sha256_hash="1111c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=2048,
            mime_type="application/pdf",
        )
        db.add(doc)
        db.commit()

        # Officer in Org A attempts to associate with Dependant in Org B
        resp = client.put(
            f"/api/v1/documents/{doc.id}/applicant-association",
            headers=_headers(officer),
            json={
                "applicant_dependant_id": str(dep_b.id),
                "reason": "Malicious cross-tenant association injection attempt",
            },
        )

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

        # Verify document association remains unchanged
        db.refresh(doc)
        assert doc.applicant_dependant_id is None
        assert doc.client_id == primary.id

    def test_auto_resolve_cross_document_findings_on_reassignment(self, client: TestClient, db, stage4_fixture):
        """
        Master Vision §4.4 & §4.5:
        When a document is reassigned between family members, prior cross-document
        consistency findings comparing it against the previous applicant are invalid
        and must be automatically resolved with audit reason, and doc.has_unresolved_anomaly cleared.
        """
        data = stage4_fixture
        officer = data["officer"]
        primary = data["primary_client"]
        spouse = data["dep_spouse"]
        case = data["case"]

        doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            proposed_applicant_name="Raj Patel",
            is_assignment_confirmed=False,
            title="Spouse Degree Certificate",
            filename="degree_priya.pdf",
            category="educational_records",
            storage_path="tenants/a/degree_priya.pdf",
            sha256_hash="2222c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=4096,
            mime_type="application/pdf",
            has_unresolved_anomaly=True,
            anomaly_notes="Discrepancy: Candidate name 'Priya Patel' does not match primary petitioner 'Raj Patel'",
        )
        db.add(doc)
        db.flush()

        # Open cross-document AI finding comparing doc against primary applicant
        finding = CaseAIFinding(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            document_id=doc.id,
            finding_type="consistency_discrepancy",
            severity="major",
            status="needs_review",
            title="Candidate name mismatch against petitioner",
            description="Document names 'Priya Patel' but petitioner on record is 'Raj Patel'",
            recommended_action="Reassign to spouse or verify relationship evidence",
            uncertainty_limitations="Automated cross-document concordance check",
        )
        db.add(finding)
        db.commit()

        # Reassign to spouse
        resp = client.put(
            f"/api/v1/documents/{doc.id}/applicant-association",
            headers=_headers(officer),
            json={
                "applicant_dependant_id": str(spouse.id),
                "reason": "Reassigned to spouse Priya Patel. Mismatch against Raj is now obsolete.",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["has_unresolved_anomaly"] is False

        # Database verification: finding is resolved
        db.refresh(finding)
        assert finding.status == "resolved"
        assert finding.resolution_action == "resolve"
        assert finding.reviewer_id == officer.id
        assert "Auto-resolved upon document reassignment to applicant 'Priya Patel'" in finding.resolution_reason
        assert len(finding.resolution_history) >= 1
        assert finding.resolution_history[-1]["by"] == str(officer.id)

        # Document anomaly flag cleared
        db.refresh(doc)
        assert doc.has_unresolved_anomaly is False
        assert doc.anomaly_notes is None

        # Audit Event records auto-resolved findings count
        audit = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.object_id == str(doc.id),
                AuditEvent.action == "document.applicant_association_corrected",
            )
            .first()
        )
        assert audit.metadata_json["auto_resolved_findings_count"] == 1

    def test_retained_client_cannot_reassign_or_confirm_assignment(self, client: TestClient, db, stage4_fixture):
        """
        Master Vision §3 & §4.1:
        Retained clients cannot reassign applicant associations or confirm assignments.
        Must return 403 Forbidden.
        """
        data = stage4_fixture
        client_user = data["client_user"]
        primary = data["primary_client"]
        spouse = data["dep_spouse"]
        case = data["case"]

        doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            title="Marriage Certificate",
            filename="marriage.pdf",
            category="civil_status",
            storage_path="tenants/a/marriage.pdf",
            sha256_hash="3333c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=3000,
            mime_type="application/pdf",
        )
        db.add(doc)
        db.commit()

        # Client attempts applicant reassignment
        resp_assoc = client.put(
            f"/api/v1/documents/{doc.id}/applicant-association",
            headers=_headers(client_user),
            json={
                "applicant_dependant_id": str(spouse.id),
                "reason": "Client self-reassignment attempt",
            },
        )
        assert resp_assoc.status_code == 403

        # Client attempts confirm assignment endpoint
        resp_confirm = client.post(
            f"/api/v1/documents/{doc.id}/confirm-assignment",
            headers=_headers(client_user),
            json={
                "applicant_dependant_id": str(spouse.id),
            },
        )
        assert resp_confirm.status_code == 403

    def test_confirm_assignment_endpoint_dependant_and_finding_resolution(self, client: TestClient, db, stage4_fixture):
        """
        Tests POST /api/v1/documents/{document_id}/confirm-assignment:
        - Validates tenant isolation on applicant_dependant_id
        - Reassigns document to dependant
        - Auto-resolves cross-document discrepancy findings
        - Records immutable audit trail
        """
        data = stage4_fixture
        officer = data["officer"]
        primary = data["primary_client"]
        child = data["dep_child"]
        dep_b = data["dep_b"]
        case = data["case"]

        doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            proposed_applicant_name="Raj Patel",
            is_assignment_confirmed=False,
            title="Child Birth Certificate",
            filename="birth_cert_child.pdf",
            category="civil_status",
            storage_path="tenants/a/birth_cert_child.pdf",
            sha256_hash="4444c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=5000,
            mime_type="application/pdf",
            has_unresolved_anomaly=True,
        )
        db.add(doc)
        db.flush()

        finding = CaseAIFinding(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            document_id=doc.id,
            finding_type="applicant_association_ambiguity",
            severity="major",
            status="needs_review",
            title="Uncertain applicant assignment on birth certificate",
            description="Document belongs to minor child Aarav, not Raj",
            recommended_action="Confirm assignment to child",
            uncertainty_limitations="Automated rule check",
        )
        db.add(finding)
        db.commit()

        # 1. Attempt confirmation with cross-tenant dependant ID -> 404
        bad_resp = client.post(
            f"/api/v1/documents/{doc.id}/confirm-assignment",
            headers=_headers(officer),
            json={"applicant_dependant_id": str(dep_b.id)},
        )
        assert bad_resp.status_code == 404

        # 2. Confirm assignment to child
        good_resp = client.post(
            f"/api/v1/documents/{doc.id}/confirm-assignment",
            headers=_headers(officer),
            json={
                "applicant_dependant_id": str(child.id),
                "confirmed_category": "civil_status",
            },
        )
        assert good_resp.status_code == 200
        assert good_resp.json()["applicant_dependant_id"] == str(child.id)
        assert good_resp.json()["proposed_applicant_name"] == "Aarav Patel"
        assert good_resp.json()["is_assignment_confirmed"] is True
        assert good_resp.json()["has_unresolved_anomaly"] is False

        # Database verification
        db.refresh(finding)
        assert finding.status == "resolved"
        db.refresh(doc)
        assert doc.has_unresolved_anomaly is False

    def test_multi_family_boundary_splitting_per_section_assignment(self, client: TestClient, db, stage4_fixture):
        """
        Master Vision §4.2 & §4.3:
        Splits a combined multi-family PDF into distinct child documents with
        per-section applicant assignment (Primary, Spouse, Child).
        """
        data = stage4_fixture
        officer = data["officer"]
        primary = data["primary_client"]
        spouse = data["dep_spouse"]
        child = data["dep_child"]
        case = data["case"]

        # Combined 6-page parent document
        parent_doc = Document(
            id=uuid.uuid4(),
            organization_id=data["org_a_id"],
            case_id=case.id,
            client_id=primary.id,
            applicant_dependant_id=None,
            proposed_applicant_name="Family Dossier Combined",
            is_assignment_confirmed=False,
            title="Combined Family Passports and Certificates",
            filename="family_bundle.pdf",
            category="supporting_evidence",
            storage_path="tenants/a/family_bundle.pdf",
            sha256_hash="5555c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=12000,
            mime_type="application/pdf",
            page_count=6,
            extracted_text="Page 1: Primary Passport\nPage 3: Spouse Passport\nPage 5: Child Birth Certificate",
        )
        db.add(parent_doc)
        db.commit()

        # Split request with per-section applicant targeting
        split_payload = {
            "sections": [
                {
                    "title": "Primary Applicant Passport",
                    "category": "identity_passport",
                    "start_page": 1,
                    "end_page": 2,
                    "applicant_dependant_id": None,
                    "client_id": str(primary.id),
                    "proposed_applicant_name": "Raj Patel",
                },
                {
                    "title": "Spouse Passport",
                    "category": "identity_passport",
                    "start_page": 3,
                    "end_page": 4,
                    "applicant_dependant_id": str(spouse.id),
                    "client_id": str(primary.id),
                    "proposed_applicant_name": "Priya Patel",
                },
                {
                    "title": "Child Birth Certificate",
                    "category": "civil_status",
                    "start_page": 5,
                    "end_page": 6,
                    "applicant_dependant_id": str(child.id),
                    "client_id": str(primary.id),
                    "proposed_applicant_name": "Aarav Patel",
                },
            ]
        }

        resp = client.post(
            f"/api/v1/documents/{parent_doc.id}/split-sections",
            headers=_headers(officer),
            json=split_payload,
        )

        assert resp.status_code == 200
        split_res = resp.json()
        assert split_res["sections_count"] == 3
        created_docs = split_res["created_documents"]
        assert len(created_docs) == 3

        # Child 1: Primary
        assert created_docs[0]["applicant_dependant_id"] is None
        assert created_docs[0]["proposed_applicant_name"] == "Raj Patel"
        assert created_docs[0]["category"] == "identity_passport"
        assert created_docs[0]["page_count"] == 2

        # Child 2: Spouse
        assert created_docs[1]["applicant_dependant_id"] == str(spouse.id)
        assert created_docs[1]["proposed_applicant_name"] == "Priya Patel"
        assert created_docs[1]["category"] == "identity_passport"
        assert created_docs[1]["page_count"] == 2

        # Child 3: Child
        assert created_docs[2]["applicant_dependant_id"] == str(child.id)
        assert created_docs[2]["proposed_applicant_name"] == "Aarav Patel"
        assert created_docs[2]["category"] == "civil_status"
        assert created_docs[2]["page_count"] == 2
