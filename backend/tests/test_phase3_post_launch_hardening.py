"""Phase 3 Comprehensive Post-Launch Hardening Test Suite

Validates:
1. Cultural naming conventions and Single Name / FNU consular conventions in comparators.py
2. Statement of Purpose (SOP) statutory evaluation (IRPA s.22(2), INA § 214(b), home ties, gaps)
3. Endpoints for standalone and case-contextualized SOP auditing
4. Claude 3.5 Sonnet multimodal client and AI provider routing
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.ai.comparators import compare_names
from backend.app.ai.sop_auditor import SOPAuditor, SOPAuditResult
from backend.app.ai.llm_client import ClaudeSonnetClient, get_ai_client
from backend.app.security.auth import get_auth_context, AuthContext
from backend.app.security.rbac import RoleCode
from backend.app.domain.models import ImmigrationCase, ClientProfile, FinancialSponsor
from backend.app.db.session import get_db


# --- Fixtures ---

@pytest.fixture
def mock_auth_context():
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    return AuthContext(
        user_id=user_id,
        email="compliance.officer@documento.io",
        organization_id=org_id,
        roles=("company_admin",),
    )


# --- 1. Cultural Naming & Single-Name FNU Tests ---

def test_single_name_fnu_matching():
    """Consular conventions for single-name applicants with FNU prefix/suffix."""
    # Prefix FNU
    res1 = compare_names("Pooja", "FNU Pooja")
    assert res1.is_concordant is True
    assert res1.variation_type == "cultural_single_name_fnu"
    assert res1.similarity_score == 0.98

    # Suffix FNU
    res2 = compare_names("Pooja FNU", "Pooja")
    assert res2.is_concordant is True
    assert res2.variation_type == "cultural_single_name_fnu"
    assert res2.similarity_score == 0.98

    # LNU convention
    res3 = compare_names("LNU Ramesh", "Ramesh")
    assert res3.is_concordant is True
    assert res3.variation_type == "cultural_single_name_fnu"


def test_reversed_name_order_matching():
    """East Asian and South Asian surname-first vs given-name-first order."""
    res = compare_names("Zhang Wei", "Wei Zhang")
    assert res.is_concordant is True
    assert res.variation_type == "reversed_name_order"
    assert res.similarity_score == 0.95


def test_arabic_particle_assimilation():
    """Middle Eastern / Arabic naming conventions with Al, El, Bin, etc."""
    res = compare_names("Ahmed Al Mansoori", "Ahmed Mansoori")
    assert res.is_concordant is True
    assert res.variation_type == "cultural_particle_variation"
    assert res.similarity_score == 0.93


def test_patronymic_initial_matching():
    """South Indian / Slavic patronymic initial expansions."""
    res = compare_names("K. Ramesh", "Kumar Ramesh")
    assert res.is_concordant is True
    assert res.variation_type == "patronymic_initial_variant"
    assert res.similarity_score == 0.90


def test_discordant_names():
    """Completely different names must fail concordance."""
    res = compare_names("Johnathan Doe", "Alice Smith")
    assert res.is_concordant is False
    assert res.similarity_score < 0.50


# --- 2. SOP Statutory Auditor Unit Tests ---

def test_sop_auditor_insufficient_length():
    """Short or empty SOP must immediately return CRITICAL_STATUTORY_DEFICIENCY."""
    res = SOPAuditor.audit_statement("Too short SOP")
    assert res.overall_score == 0.0
    assert res.is_statutorily_sound is False
    assert res.verdict == "CRITICAL_STATUTORY_DEFICIENCY"
    assert any(f.issue_code == "SOP_TEXT_INSUFFICIENT" for f in res.findings)


def test_sop_auditor_high_scoring_canada():
    """Robust SOP with clear curriculum progression, ties to India, temporary stay covenant, and sponsor."""
    sop = (
        "I am writing this statement of purpose to pursue the Master of Science degree at University of Toronto. "
        "The curriculum and advanced modules in artificial intelligence will equip me with technical knowledge "
        "and research skills necessary for career advancement in Bangalore, India. "
        "My elderly parents reside in Ahmedabad where our family owns ancestral agricultural land and estate property. "
        "I have strong family ties to my home country and will return to India immediately upon completion of studies. "
        "I will fully comply with IRPA regulations and respect the conditions of authorized stay as a temporary resident. "
        "My father will act as my financial sponsor, having sanctioned an education bank loan and deposited liquid funds "
        "in addition to my guaranteed investment certificate (GIC) covering tuition and living expenses."
    )
    res = SOPAuditor.audit_statement(sop, jurisdiction="CA")
    assert res.overall_score >= 80.0
    assert res.is_statutorily_sound is True
    assert res.verdict == "HIGH_APPROVAL_POTENTIAL"
    assert len(res.strengths) >= 3


def test_sop_auditor_us_immigrant_intent_rejection():
    """US F-1 applicant explicitly mentioning permanent residence must trigger INA 214(b) critical deficiency."""
    sop = (
        "I intend to enroll in the bachelor program at New York University to build my career. "
        "After my degree, my primary ambition is to obtain a green card and secure permanent residence in the US "
        "to permanently immigrate. My family is supporting my tuition through bank savings and loans."
    )
    res = SOPAuditor.audit_statement(sop, jurisdiction="US")
    assert res.is_statutorily_sound is False
    assert res.verdict == "CRITICAL_STATUTORY_DEFICIENCY"
    assert any(f.issue_code == "INA_214B_IMMIGRANT_INTENT" for f in res.findings)


def test_sop_auditor_unexplained_study_gap():
    """Applicant with declared study gap who omits justification in SOP must receive critical finding."""
    sop = (
        "I completed my bachelor in engineering in 2020. I now wish to join the master program. "
        "My parents in India will fund my education through property and savings. I will return to India."
    )
    res = SOPAuditor.audit_statement(sop, applicant_profile={"has_study_gap": True}, jurisdiction="CA")
    assert any(f.issue_code == "UNEXPLAINED_STUDY_GAP" for f in res.findings)


# --- 3. SOP Audit API Endpoint Tests ---

def test_standalone_sop_audit_endpoint(mock_auth_context):
    """POST /api/v1/cases/sop/audit endpoint evaluates SOP payload without case binding."""
    app.dependency_overrides[get_auth_context] = lambda: mock_auth_context
    client = TestClient(app)

    payload = {
        "sop_text": (
            "I am applying for a master degree program in Canada. My father is sponsoring my tuition with "
            "bank loan sanction and savings. I have strong ties to my parents and family property in India, "
            "and I will leave Canada upon the expiration of my authorized temporary stay."
        ),
        "jurisdiction": "CA",
    }
    response = client.post("/api/v1/cases/sop/audit", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert "verdict" in data
    assert "dimension_scores" in data
    assert data["jurisdiction"] == "CA"


def test_case_contextualized_sop_audit_endpoint(mock_auth_context):
    """POST /api/v1/cases/{case_id}/sop/audit enriches analysis with case jurisdiction and sponsors."""
    app.dependency_overrides[get_auth_context] = lambda: mock_auth_context
    mock_db = MagicMock()

    test_case_id = uuid.uuid4()
    mock_case = ImmigrationCase(
        id=test_case_id,
        organization_id=mock_auth_context.organization_id,
        client_id=uuid.uuid4(),
        case_number="CAS-SOP-9999",
        title="Study Permit - Canada",
        jurisdiction="CA",
        visa_category="STUDY_PERMIT",
        status="INTAKE",
    )
    mock_sponsor = FinancialSponsor(
        id=uuid.uuid4(),
        organization_id=mock_auth_context.organization_id,
        case_id=test_case_id,
        client_id=mock_case.client_id,
        name="Sunil Kumar",
        relationship="FATHER",
        sponsor_type="INDIVIDUAL",
        liquid_funds=2500000.0,
        currency="INR",
    )

    def mock_query(model):
        q = MagicMock()
        if model == ImmigrationCase:
            q.filter.return_value.first.return_value = mock_case
        elif model == FinancialSponsor:
            q.filter.return_value.all.return_value = [mock_sponsor]
        return q

    mock_db.query.side_effect = mock_query
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    payload = {
        "sop_text": (
            "Statement of purpose for master degree curriculum. My parents and agricultural property "
            "are located in India. I will return home to India following my temporary authorized stay. "
            "My father is providing full sponsor funding and living expenses."
        ),
        "jurisdiction": "CA",
    }
    response = client.post(f"/api/v1/cases/{test_case_id}/sop/audit", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] in ("HIGH_APPROVAL_POTENTIAL", "NEEDS_REVISION")
    assert data["dimension_scores"]["academic_progression"] > 0


# --- 4. Claude 3.5 Sonnet Integration & Factory Tests ---

def test_claude_sonnet_client_factory_resolution():
    """Verifies get_ai_client() instantiates ClaudeSonnetClient when configured."""
    with patch("backend.app.ai.llm_client.get_settings") as mock_get_settings:
        mock_settings = MagicMock()
        mock_settings.ai_provider = "anthropic"
        mock_settings.anthropic_api_key = "sk-ant-test-key-12345"
        mock_settings.anthropic_model = "claude-3-5-sonnet-20241022"
        mock_get_settings.return_value = mock_settings

        client = get_ai_client()
        assert isinstance(client, ClaudeSonnetClient)
        assert client.model == "claude-3-5-sonnet-20241022"


def test_claude_sonnet_client_fallback_without_key():
    """ClaudeSonnetClient without API key falls back smoothly to deterministic local vision."""
    client = ClaudeSonnetClient(api_key="")
    dummy_content = b"Passport Number: Z9876543 Name: Priya Patel"
    res = client.extract_document_entities(dummy_content, "passport.pdf", "identity_passport", mime_type="application/pdf")
    assert res.detected_category == "identity_passport"
    assert any(e.field_name == "passport_number" for e in res.entities)
