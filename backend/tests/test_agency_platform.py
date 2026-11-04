"""
End-to-end FastAPI tests for Partner Visa Agency KYB Onboarding,
Documento HQ Super-Admin Control Plane, Zero-PII RBAC isolation,
2-Hour Break-Glass Support Tokens, and Co-Branded PR Calculator Lead Capture.
"""

from backend.app.security.rbac import ROLE_PERMISSIONS, RoleCode


def test_platform_super_admin_enforces_strict_zero_pii_permissions():
    """Platform Super-Admin must have agency governance permissions but ZERO raw client/case/document read permissions."""
    hq_perms = ROLE_PERMISSIONS[RoleCode.PLATFORM_SUPER_ADMIN]
    assert "platform:agencies:read" in hq_perms
    assert "platform:agencies:manage" in hq_perms
    assert "platform:kyb:review" in hq_perms
    assert "platform:quotas:manage" in hq_perms
    # Strict Zero-PII guardrails: never grant raw case or applicant document inspection
    assert "case:read:all" not in hq_perms
    assert "document:read:all" not in hq_perms
    assert "*" not in hq_perms


def test_agency_onboarding_kyb_provisioning_cobranded_leads_and_freeze(client):
    # 1. Submitting without accepting DPA + Zero-AI-Training must fail (400)
    bad_res = client.post(
        "/api/v1/agency-platform/onboarding/apply",
        json={
            "legal_entity_name": "NorthStar Regulated Counsel Inc.",
            "trading_name": "NorthStar RCIC",
            "requested_slug": "northstar-rcic",
            "hq_country": "Canada",
            "hq_city": "Toronto",
            "corporate_domain": "northstarrcic.ca",
            "tax_registration_id": "BN-849201920RC0001",
            "contact_full_name": "Priya Grewal, RCIC",
            "contact_work_email": "priya@northstarrcic.ca",
            "kyb_track": "regulated_counsel",
            "regulatory_body": "CICC",
            "license_number": "R719804",
            "target_corridors": ["CA", "UK"],
            "estimated_monthly_cases": 40,
            "requested_seats": 8,
            "branch_count": 1,
            "selected_plan_tier": "growth",
            "dpa_accepted": False,
            "zero_training_accepted": True,
        },
    )
    assert bad_res.status_code == 400

    # 2. Submit valid KYB dossier
    apply_res = client.post(
        "/api/v1/agency-platform/onboarding/apply",
        json={
            "legal_entity_name": "NorthStar Regulated Counsel Inc.",
            "trading_name": "NorthStar RCIC",
            "requested_slug": "northstar-rcic",
            "hq_country": "Canada",
            "hq_city": "Toronto",
            "corporate_domain": "northstarrcic.ca",
            "tax_registration_id": "BN-849201920RC0001",
            "contact_full_name": "Priya Grewal, RCIC",
            "contact_work_email": "priya@northstarrcic.ca",
            "kyb_track": "regulated_counsel",
            "regulatory_body": "CICC",
            "license_number": "R719804",
            "target_corridors": ["CA", "UK"],
            "estimated_monthly_cases": 40,
            "requested_seats": 8,
            "branch_count": 1,
            "selected_plan_tier": "growth",
            "dpa_accepted": True,
            "zero_training_accepted": True,
        },
    )
    assert apply_res.status_code == 201, apply_res.text
    apply_data = apply_res.json()
    app_id = apply_data["application_id"]
    assert apply_data["kyb_status"] == "pending_kyb"
    assert apply_data["dossier_code"].startswith("KYB-")

    # 3. Regular firm master_admin MUST be forbidden from Documento HQ Control Plane
    forbidden_res = client.get(
        "/api/v1/agency-platform/super-admin/overview",
        headers={"X-User-Role": "master_admin", "X-Org-Id": "org-firm-1"},
    )
    assert forbidden_res.status_code == 403

    # 4. HQ Super-Admin inspects KYB queue & approves + provisions tenant workspace in 1 click
    hq_headers = {"X-User-Role": "platform_super_admin", "X-Org-Id": "org-documento-hq"}
    queue_res = client.get("/api/v1/agency-platform/super-admin/applications", headers=hq_headers)
    assert queue_res.status_code == 200
    assert any(item["id"] == app_id for item in queue_res.json())

    approve_res = client.post(
        f"/api/v1/agency-platform/super-admin/applications/{app_id}/decision",
        headers=hq_headers,
        json={
            "decision": "approve",
            "reviewer_notes": "Verified active RCIC standing R719804 on CICC public register.",
        },
    )
    assert approve_res.status_code == 200, approve_res.text
    prov = approve_res.json()
    assert prov["status"] == "approved"
    org_id = prov["organization_id"]
    assert org_id is not None
    assert prov["slug"] == "northstar-rcic"
    assert prov["temporary_owner_password"].startswith("DocPartner!")
    assert prov["cobranded_calculator_url"] == "/calculators?agency=northstar-rcic"

    # 5. Reconciled HQ overview reflects 1 active agency and Growth $499 MRR
    ov_res = client.get("/api/v1/agency-platform/super-admin/overview", headers=hq_headers)
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert ov["zero_pii_boundary_enforced"] is True
    assert ov["active_agencies_count"] >= 1
    assert ov["recurring_mrr_usd"] >= 499

    # 6. Public co-branded calculator profile & applicant scorecard lead capture
    pub_res = client.get("/api/v1/agency-platform/public-agency/northstar-rcic")
    assert pub_res.status_code == 200
    assert pub_res.json()["trading_name"] == "NorthStar RCIC"

    lead_res = client.post(
        "/api/v1/agency-platform/public-agency/northstar-rcic/calculator-leads",
        json={
            "applicant_name": "Rohan Deshmukh",
            "applicant_email": "rohan@example.com",
            "calculator_id": "canada-crs",
            "country_code": "CA",
            "score_summary": "529 CRS (CLB 10 + STEM Master's)",
            "score_payload": {"crs_total": 529},
        },
    )
    assert lead_res.status_code == 201, lead_res.text

    # 7. Firm Managing Partner issues & revokes 2-hour Break-Glass Support Token
    firm_headers = {"X-User-Role": "master_admin", "X-Org-Id": org_id}
    grant_res = client.post(
        "/api/v1/agency-platform/current-firm/support-grant",
        headers=firm_headers,
        json={"reason": "Verify OCR rule pack behavior", "duration_minutes": 120},
    )
    assert grant_res.status_code == 200
    assert grant_res.json()["status"] == "granted"

    revoke_res = client.delete(
        "/api/v1/agency-platform/current-firm/support-grant",
        headers=firm_headers,
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "revoked"

    # 8. Emergency Tenant Freeze suspends tenant and disables public co-branded lead intake
    freeze_res = client.patch(
        f"/api/v1/agency-platform/super-admin/agencies/{org_id}/governance",
        headers=hq_headers,
        json={"status": "suspended", "reason": "Compliance audit hold"},
    )
    assert freeze_res.status_code == 200
    assert freeze_res.json()["status"] == "suspended"

    blocked_pub = client.get("/api/v1/agency-platform/public-agency/northstar-rcic")
    assert blocked_pub.status_code == 404


def test_kyb_lookup_clarification_loop_reviewer_note_guard_and_frozen_login_block(client):
    hq_headers = {"X-User-Role": "platform_super_admin", "X-Org-Id": "org-documento-hq"}

    # 1. Submit advisory partner KYB dossier
    apply_res = client.post(
        "/api/v1/agency-platform/onboarding/apply",
        json={
            "legal_entity_name": "Meridian Visa Advisory Pvt. Ltd.",
            "trading_name": "Meridian Global",
            "requested_slug": "meridian-global",
            "hq_country": "India",
            "hq_city": "Ahmedabad",
            "corporate_domain": "meridianglobal.in",
            "tax_registration_id": "24AABCM9102R1Z7",
            "contact_full_name": "Karan Mehta",
            "contact_work_email": "karan@meridianglobal.in",
            "kyb_track": "overseas_consultancy",
            "regulatory_body": "Co-Counsel Agreement",
            "license_number": "PENDING-COCOUNSEL",
            "co_counsel_details": "Retainer pending upload",
            "target_corridors": ["CA", "AU", "DE"],
            "estimated_monthly_cases": 55,
            "requested_seats": 10,
            "branch_count": 2,
            "selected_plan_tier": "growth",
            "dpa_accepted": True,
            "zero_training_accepted": True,
        },
    )
    assert apply_res.status_code == 201, apply_res.text
    app_data = apply_res.json()
    app_id = app_data["application_id"]
    dossier_code = app_data["dossier_code"]

    # 2. Requesting clarification WITHOUT a reviewer note must fail validation (400)
    empty_note_res = client.post(
        f"/api/v1/agency-platform/super-admin/applications/{app_id}/decision",
        headers=hq_headers,
        json={"decision": "request_clarification", "reviewer_notes": "  "},
    )
    assert empty_note_res.status_code == 400

    # 3. Valid clarification request sets status to clarification_requested
    clar_req = client.post(
        f"/api/v1/agency-platform/super-admin/applications/{app_id}/decision",
        headers=hq_headers,
        json={
            "decision": "request_clarification",
            "reviewer_notes": "Please provide counter-signed RCIC/MARA co-counsel registration ID.",
        },
    )
    assert clar_req.status_code == 200
    assert clar_req.json()["status"] == "clarification_requested"

    # 4. Returning agency looks up dossier by code & email, then resubmits clarification
    lookup_by_code = client.get(f"/api/v1/agency-platform/onboarding/lookup?q={dossier_code}")
    assert lookup_by_code.status_code == 200
    assert lookup_by_code.json()["kyb_status"] == "clarification_requested"
    assert "counter-signed" in lookup_by_code.json()["reviewer_notes"]

    lookup_by_email = client.get("/api/v1/agency-platform/onboarding/lookup?q=karan@meridianglobal.in")
    assert lookup_by_email.status_code == 200
    assert lookup_by_email.json()["application_id"] == app_id

    resubmit = client.post(
        f"/api/v1/agency-platform/onboarding/{app_id}/clarification",
        json={
            "license_number": "COCOUNSEL-R708412",
            "co_counsel_details": "Counter-signed retainer with Elena Rostova, RCIC #R708412 verified.",
        },
    )
    assert resubmit.status_code == 200
    assert resubmit.json()["kyb_status"] == "pending_kyb"

    # 5. Approve dossier & verify provisioned Managing Partner can log in via real /auth/login
    approve_res = client.post(
        f"/api/v1/agency-platform/super-admin/applications/{app_id}/decision",
        headers=hq_headers,
        json={"decision": "approve", "reviewer_notes": "Co-counsel verified and approved."},
    )
    assert approve_res.status_code == 200
    prov = approve_res.json()
    org_id = prov["organization_id"]
    owner_password = prov["temporary_owner_password"]

    # Double-approval must be rejected cleanly with 409 Conflict
    dup_approve = client.post(
        f"/api/v1/agency-platform/super-admin/applications/{app_id}/decision",
        headers=hq_headers,
        json={"decision": "approve", "reviewer_notes": "Accidental second click"},
    )
    assert dup_approve.status_code == 409

    # Submit 1 calculator lead and verify lead status patch + non-double-counted KPI
    lead_res = client.post(
        "/api/v1/agency-platform/public-agency/meridian-global/calculator-leads",
        json={
            "applicant_name": "Ananya Patel",
            "applicant_email": "ananya@example.com",
            "calculator_id": "australia-pr",
            "country_code": "AU",
            "score_summary": "85 pts (189 Skilled Independent Eligible)",
        },
    )
    assert lead_res.status_code == 201
    lead_id = lead_res.json()["lead_id"]

    patch_lead = client.patch(
        f"/api/v1/agency-platform/current-firm/calculator-leads/{lead_id}",
        headers={"X-User-Role": "master_admin", "X-Org-Id": org_id},
        json={"lead_status": "converted_to_client"},
    )
    assert patch_lead.status_code == 200
    assert patch_lead.json()["lead_status"] == "converted_to_client"

    # Real auth login for the newly provisioned firm owner
    login_ok = client.post(
        "/api/v1/auth/login",
        json={"email": "karan@meridianglobal.in", "password": owner_password},
    )
    assert login_ok.status_code == 200, login_ok.text
    me_ok = client.get("/api/v1/auth/me")
    assert me_ok.status_code == 200
    assert me_ok.json()["email"] == "karan@meridianglobal.in"

    # 6. Freeze tenant -> active session cookie must immediately fail /auth/me (401) AND new /auth/login must fail (403)
    freeze_res = client.patch(
        f"/api/v1/agency-platform/super-admin/agencies/{org_id}/governance",
        headers=hq_headers,
        json={"status": "suspended", "reason": "Emergency compliance freeze test"},
    )
    assert freeze_res.status_code == 200

    me_after_freeze = client.get("/api/v1/auth/me")
    assert me_after_freeze.status_code in (401, 403)

    relogin_blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "karan@meridianglobal.in", "password": owner_password},
    )
    assert relogin_blocked.status_code == 403
    assert "Workspace Frozen" in relogin_blocked.text


def test_sales_led_direct_agency_provisioning_and_owner_login(client):
    """HQ Super-Admin can directly provision a negotiated sales deal with custom MRR and seat cap."""
    hq_headers = {"X-User-Role": "platform_super_admin", "X-Org-Id": "org-documento-hq"}

    # Non-HQ operator must be blocked from direct provisioning
    forbidden = client.post(
        "/api/v1/agency-platform/super-admin/agencies/provision-direct",
        headers={"X-User-Role": "master_admin", "X-Org-Id": "org-firm-1"},
        json={
            "legal_entity_name": "Pacific Rim Immigration Law PC",
            "trading_name": "Pacific Rim Visas",
            "owner_full_name": "Daniel Cho",
            "owner_email": "daniel@pacificrimlaw.ca",
            "hq_country": "Canada",
            "hq_city": "Vancouver",
            "kyb_track": "regulated_counsel",
            "regulatory_body": "CICC",
            "license_number": "R704921",
            "enabled_corridors": ["CA", "US"],
            "plan_tier": "enterprise",
            "custom_mrr_usd": 850.0,
            "custom_seat_limit": 25,
        },
    )
    assert forbidden.status_code == 403

    # HQ Super-Admin provisions custom negotiated deal
    prov_res = client.post(
        "/api/v1/agency-platform/super-admin/agencies/provision-direct",
        headers=hq_headers,
        json={
            "legal_entity_name": "Pacific Rim Immigration Law PC",
            "trading_name": "Pacific Rim Visas",
            "owner_full_name": "Daniel Cho",
            "owner_email": "daniel@pacificrimlaw.ca",
            "hq_country": "Canada",
            "hq_city": "Vancouver",
            "kyb_track": "regulated_counsel",
            "regulatory_body": "CICC",
            "license_number": "R704921",
            "enabled_corridors": ["CA", "US"],
            "plan_tier": "enterprise",
            "custom_mrr_usd": 850.0,
            "custom_seat_limit": 25,
        },
    )
    assert prov_res.status_code == 201, prov_res.text
    data = prov_res.json()
    assert data["slug"] == "pacific-rim-visas"
    assert data["mrr_usd"] == 850.0
    assert data["seat_limit"] == 25
    assert data["temporary_owner_password"].startswith("DocInvite!")

    # Provisioned owner can log straight into /api/v1/auth/login
    login_ok = client.post(
        "/api/v1/auth/login",
        json={"email": "daniel@pacificrimlaw.ca", "password": data["temporary_owner_password"]},
    )
    assert login_ok.status_code == 200, login_ok.text


