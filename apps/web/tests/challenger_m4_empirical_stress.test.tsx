import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { CreateClientModal } from "../components/modals/CreateClientModal";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { PostOnboardingLaunchpadModal } from "../components/modals/PostOnboardingLaunchpadModal";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { ClientProfileScopeView } from "../components/portal/ClientProfileScopeView";
import {
  computeInitialInfoSheetSectionStatuses,
} from "../components/portal/InitialInformationSheet";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { PackageBuilderView } from "../components/packages/PackageBuilderView";

import {
  getJurisdictionRepresentationInfo,
} from "../lib/jurisdictionForms";
import {
  CANONICAL_6_STAGES,
  normalizeCaseStage,
  getCaseStageInfo,
  formatCaseStageBadge,
} from "../lib/caseLifecycle";
import {
  api,
  fetchDocumentRequests,
  FALLBACK_FILING_PACKAGE,
} from "../lib/api";
import { ClientProfile, ImmigrationCase, UserContext } from "../lib/types";

describe("Milestone 4 Empirical Challenger Stress Harness", () => {
  const mockOwnerUser: UserContext = {
    id: "usr-owner-1",
    email: "sarah@apexlegal.com",
    full_name: "Sarah Jenkins, Esq.",
    role: "master_admin",
    experience: "master_admin",
    organization_id: "org-apex-01",
    organization_name: "Apex Immigration Law P.C.",
    permissions: ["cases:read", "cases:write", "client:delete"],
  };

  const sampleUSCase: ImmigrationCase = {
    id: "case-us-101",
    client_id: "client-us-01",
    client_name: "Elena Rostova",
    case_number: "CASE-US-101",
    title: "EB-1A Alien of Extraordinary Ability: Elena Rostova",
    jurisdiction: "United States (USCIS)",
    visa_category: "EB-1A Extraordinary Ability",
    status: "intake",
    created_at: new Date().toISOString(),
    organization_id: "org-apex-01",
    deadline: "2026-12-31",
  };

  const sampleUKCase: ImmigrationCase = {
    id: "case-uk-202",
    client_id: "client-uk-02",
    client_name: "Liam Davies",
    case_number: "CASE-UK-202",
    title: "UK Skilled Worker Visa: Liam Davies",
    jurisdiction: "United Kingdom (Home Office)",
    visa_category: "UK Skilled Worker Visa",
    status: "gathering",
    created_at: new Date().toISOString(),
    organization_id: "org-apex-01",
    deadline: "2027-01-15",
  };

  let sampleCanadaCase: ImmigrationCase;

  const sampleClient: ClientProfile = {
    id: "client-us-01",
    organization_id: "org-apex-01",
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.rostova@quantumai.org",
    nationality: "UKR",
    portal_credentials_provided: true,
    portal_access_enabled: true,
    portal_temporary_password: "Doc2026!Temp44",
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("documento_user", JSON.stringify(mockOwnerUser));

    const createdCa = await api.createCase(
      {
        client_id: "client-ca-03",
        title: "Canada Express Entry PNP: Mei-Ling Chen",
        case_number: "CASE-CA-303",
        jurisdiction: "Canada (IRCC)",
        visa_category: "Express Entry PNP",
      },
      "master_admin"
    );
    sampleCanadaCase = {
      ...createdCa.data,
      client_name: "Mei-Ling Chen",
      status: "review",
    };
  });

  // =========================================================================
  // 1. END-TO-END USER JOURNEY TESTS
  // =========================================================================
  describe("1. End-to-End User Journey Tests", () => {
    it("1.1 Client Onboarding Wizard (CreateClientModal): Step 1 details -> Step 2 magic link -> submission", async () => {
      const onClientCreated = vi.fn();
      const onCaseCreated = vi.fn();
      const onClose = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={onClose}
          onClientCreated={onClientCreated}
          onCaseCreated={onCaseCreated}
          activeRole="master_admin"
        />
      );

      // Verify Step 1 is active
      expect(screen.getByText("Client Profile & Petition Scope")).toBeDefined();
      expect(screen.getByTestId("unified-case-scope-section")).toBeDefined();

      // Check representation info dynamically defaults to US USCIS G-28
      expect(
        screen.getByText(/Record Form G-28 Legal Representation Agreement for applicant/i)
      ).toBeDefined();

      // Switch jurisdiction to Canada (IRCC) inside Step 1
      const jurSelect = screen.getByLabelText(/Immigration Jurisdiction/i);
      fireEvent.change(jurSelect, { target: { value: "Canada (IRCC)" } });

      // Verify representation checkbox updates dynamically to IMM 5476
      expect(
        screen.getByText(/Record IMM 5476 Use of a Representative for applicant/i)
      ).toBeDefined();

      // Fill in candidate details
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Amara" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Kone" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "amara.kone@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Primary Nationality/i), {
        target: { value: "CIV" },
      });

      // Navigate to Step 2 via "Configure Portal Invite →"
      const configureInviteBtn = screen.getByRole("button", {
        name: /Configure Portal Invite →/i,
      });
      fireEvent.click(configureInviteBtn);

      // Verify Step 2 is active
      expect(screen.getByText("Portal Access & Magic Link")).toBeDefined();
      expect(screen.getByText(/Automated Secure Portal Access Link/i)).toBeDefined();
      expect(screen.getByText(/Single-Use Invite Ready/i)).toBeDefined();

      // Verify magic link contains target email
      const inviteInput = screen.getByDisplayValue(/https:\/\/app\.documento\.legal\/login\?invite=/i);
      expect((inviteInput as HTMLInputElement).value).toContain("amara.kone%40example.com");

      // Verify copy invite link button
      const copyBtn = screen.getByRole("button", { name: /Copy Invite Link/i });
      fireEvent.click(copyBtn);
      expect(screen.getByText(/Copied!/i)).toBeDefined();

      // Verify simulated email dispatch button
      const sendEmailBtn = screen.getByRole("button", { name: /Send Portal Invite Email/i });
      fireEvent.click(sendEmailBtn);
      expect(screen.getByText(/Invitation email dispatched/i)).toBeDefined();

      // Submit the onboarding wizard
      const submitBtn = screen.getByRole("button", { name: /Onboard Client & Open Case/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onClientCreated).toHaveBeenCalled();
        expect(onCaseCreated).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      const createdClientArg = onClientCreated.mock.calls[0][0];
      expect(createdClientArg.first_name).toBe("Amara");
      expect(createdClientArg.last_name).toBe("Kone");
      expect(createdClientArg.email).toBe("amara.kone@example.com");

      const createdCaseArg = onCaseCreated.mock.calls[0][0];
      expect(createdCaseArg.jurisdiction).toBe("Canada (IRCC)");
    });

    it("1.2 Dedicated Case Creation (CreateCaseModal): selects existing client without forcing dummy client creation", async () => {
      const onCaseCreated = vi.fn();
      const onClose = vi.fn();
      const existingClients = [sampleClient];

      render(
        <CreateCaseModal
          isOpen={true}
          onClose={onClose}
          clients={existingClients}
          onCaseCreated={onCaseCreated}
          activeRole="master_admin"
        />
      );

      // Verify modal headers
      expect(screen.getByText(/Create New Immigration Case/i)).toBeDefined();

      // Retained client dropdown has existing client pre-selected
      const clientSelect = screen.getByLabelText(/Retained Client/i) as HTMLSelectElement;
      expect(clientSelect.value).toBe(sampleClient.id);

      // Validate that empty title triggers validation error
      const createBtn = screen.getByRole("button", { name: /Create Case Record/i });
      fireEvent.click(createBtn);
      expect(screen.getByRole("alert").textContent).toContain("Please provide a petition case title.");
      expect(onCaseCreated).not.toHaveBeenCalled();

      // Enter petition title
      const titleInput = screen.getByLabelText(/Petition Case Title/i);
      fireEvent.change(titleInput, {
        target: { value: "O-1A Extraordinary Ability in Science: Elena Rostova" },
      });

      // Switch jurisdiction to UK and verify pathway options update dynamically
      const jurSelect = screen.getByLabelText(/Immigration Jurisdiction/i);
      fireEvent.change(jurSelect, { target: { value: "United Kingdom (Home Office)" } });

      const pathwaySelect = screen.getByLabelText(/Pathway \/ Visa Category/i) as HTMLSelectElement;
      expect(pathwaySelect.value).toBe("UK Standard Visitor Visa");

      // Select UK Global Talent Visa
      fireEvent.change(pathwaySelect, { target: { value: "Global Talent Tech Nation" } });

      // Submit case creation
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(onCaseCreated).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      const newCase = onCaseCreated.mock.calls[0][0];
      expect(newCase.title).toBe("O-1A Extraordinary Ability in Science: Elena Rostova");
      expect(newCase.client_id).toBe(sampleClient.id);
      expect(newCase.jurisdiction).toBe("United Kingdom (Home Office)");
      expect(newCase.visa_category).toBe("Global Talent Tech Nation");
    });

    it("1.3 PostOnboardingLaunchpadModal handles null clientItem gracefully via resolver fallback", async () => {
      const onCaseUpdated = vi.fn();
      const onClose = vi.fn();

      // Render launchpad with caseItem but clientItem === null
      render(
        <PostOnboardingLaunchpadModal
          isOpen={true}
          onClose={onClose}
          caseItem={sampleCanadaCase}
          clientItem={null}
          currentUser={mockOwnerUser}
          activeRole="master_admin"
          onCaseUpdated={onCaseUpdated}
        />
      );

      // Modal must NOT freeze or return null; it renders Step 1 with synthesized client info
      expect(
        screen.getByText(/Step 1: Hand Off Client Transparency Portal Credentials/i)
      ).toBeDefined();

      // Check portal login status is active on fallback client
      expect(screen.getByText("Portal Login Active")).toBeDefined();

      // Reveal temporary password
      const revealBtn = screen.getByRole("button", { name: /Reveal/i });
      fireEvent.click(revealBtn);
      expect(screen.getByTestId("kickoff-temp-password").textContent).toBe("ClientPass2026!");

      // Check welcome note is synthesized with Canada case details and resolved name
      const welcomeArea = screen.getByDisplayValue(
        new RegExp(`Welcome ${sampleCanadaCase.client_name}`, "i")
      ) as HTMLTextAreaElement;
      expect(welcomeArea.value).toContain(sampleCanadaCase.case_number);
      // Verify renamed terminology: "Applicant Background Questionnaire"
      expect(welcomeArea.value).toContain("Applicant Background Questionnaire");
      // And strictly NOT "12-Page Initial Information Sheet"
      expect(welcomeArea.value).not.toContain("12-Page Initial Information Sheet");

      // Post welcome note
      const postNoteBtn = screen.getByRole("button", { name: /Post Welcome Note to Client Portal/i });
      fireEvent.click(postNoteBtn);

      await waitFor(async () => {
        const msgs = await api.getMessages();
        expect(msgs.data.some((m) => m.content.includes(sampleCanadaCase.case_number))).toBe(true);
      });

      // Advance to Step 2
      fireEvent.click(screen.getByRole("button", { name: /Mark Login Shared & Next/i }));

      // Step 2: Canada pathway displays IMM 5476 representation requirement
      expect(
        await screen.findByText(/Step 2: Assign Case Officer & Dispatch/i)
      ).toBeDefined();
      expect(
        screen.getByText(/Signed IRCC Use of Representative \(IMM 5476\)/i)
      ).toBeDefined();

      // Dispatch checklist
      fireEvent.click(
        screen.getByRole("button", { name: /Assign Officer & Dispatch Checklist/i })
      );

      await waitFor(async () => {
        const reqs = await fetchDocumentRequests(sampleCanadaCase.id);
        expect(reqs.length).toBeGreaterThanOrEqual(1);
        expect(onCaseUpdated).toHaveBeenCalled();
      });

      // Step 3: Retainer setup
      expect(await screen.findByText(/Step 3: Configure Initial Legal Retainer/i)).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: /Retainer Already Paid/i }));
      fireEvent.click(screen.getByRole("button", { name: /Record Paid Retainer & Next/i }));

      // Step 4: Initial Docs & Launch
      expect(await screen.findByText(/Step 4: Upload Initial Counsel Records/i)).toBeDefined();
    });

    it("1.4 CaseDrilldownDrawer renders single consolidated 'Open Case Workspace →' button and canonical lifecycle", () => {
      const onOpenWorkspace = vi.fn();
      const onClose = vi.fn();

      render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={onClose}
          caseItem={sampleCanadaCase}
          onOpenWorkspace={onOpenWorkspace}
        />
      );

      // Canonical 6-stage badge is rendered
      expect(screen.getByText("Caseworker Review")).toBeDefined();

      // Single consolidated primary action button
      const openBtn = screen.getByTestId("open-case-workspace-btn");
      expect(openBtn.textContent).toContain("Open Case Workspace →");

      // Confirm legacy duplicate button 'Full Case Dossier ↗' is eliminated
      expect(screen.queryByText(/Full Case Dossier ↗/i)).toBeNull();

      // Click consolidated button
      fireEvent.click(openBtn);
      expect(onOpenWorkspace).toHaveBeenCalledWith(sampleCanadaCase.id);
      expect(onClose).toHaveBeenCalled();
    });

    it("1.5 CaseDetailModal displays canonical 6-stage lifecycle progression and corridor representation badge", () => {
      // US Case
      const { unmount } = render(
        <CaseDetailModal
          isOpen={true}
          onClose={vi.fn()}
          caseItem={sampleUSCase}
          activeRole="master_admin"
        />
      );

      // Switch to Dependants & Consents tab
      fireEvent.click(screen.getByRole("button", { name: /Dependants & Consents/i }));

      // Verify US representation badge
      expect(screen.getByText(/✓ Form G-28 Legal Representation Recorded/i)).toBeDefined();
      unmount();

      // Canada Case
      render(
        <CaseDetailModal
          isOpen={true}
          onClose={vi.fn()}
          caseItem={sampleCanadaCase}
          activeRole="master_admin"
        />
      );

      // Switch to Dependants & Consents tab
      fireEvent.click(screen.getByRole("button", { name: /Dependants & Consents/i }));

      // Verify Canadian representation badge
      expect(
        screen.getByText(/✓ IMM 5476 Use of a Representative Recorded/i)
      ).toBeDefined();
    });
  });

  // =========================================================================
  // 2. JARGON & MULTI-CORRIDOR CHECKS
  // =========================================================================
  describe("2. Jargon and Multi-Corridor Checks", () => {
    it("2.1 ClientProfileScopeView: Canada IRPA § 117(9)(d) warning is isolated to Canadian cases only", () => {
      // Test A: US Case — IRPA § 117(9)(d) MUST NOT appear
      const { unmount: unmountUS } = render(
        <ClientProfileScopeView
          myCase={sampleUSCase}
        />
      );

      expect(
        screen.getByText(/Declared Immediate Family Members & Qualifying Dependents/i)
      ).toBeDefined();
      expect(screen.queryByText(/IRPA § 117\(9\)\(d\)/i)).toBeNull();
      expect(screen.queryByText(/Form IMM 5406/i)).toBeNull();
      unmountUS();

      // Test B: UK Case — IRPA § 117(9)(d) MUST NOT appear
      const { unmount: unmountUK } = render(
        <ClientProfileScopeView
          myCase={sampleUKCase}
        />
      );

      expect(
        screen.getByText(/Declared Immediate Family Members & Qualifying Dependents/i)
      ).toBeDefined();
      expect(screen.queryByText(/IRPA § 117\(9\)\(d\)/i)).toBeNull();
      expect(screen.queryByText(/Form IMM 5406/i)).toBeNull();
      unmountUK();

      // Test C: Canada Case — IRPA § 117(9)(d) and IMM 5406 MUST appear
      render(
        <ClientProfileScopeView
          myCase={sampleCanadaCase}
        />
      );

      expect(
        screen.getByText(/Declared Immediate Family Members \(IRPA § 117\(9\)\(d\) Compliance\)/i)
      ).toBeDefined();
      expect(screen.getAllByText(/IMM 5406/i).length).toBeGreaterThan(0);
    });

    it("2.2 InitialInformationSheet: IRPA § 117(9)(d) disclosure is conditioned on Canadian jurisdiction", () => {
      // Test A: US case sections
      const usSections = computeInitialInfoSheetSectionStatuses({}, false, "United States (USCIS)");
      const usFamilySection = usSections.find((s) => s.title.includes("Immediate Family Register"));
      expect(usFamilySection).toBeDefined();
      expect(usFamilySection?.detail).toBe("Statutory family register and immediate relatives disclosure");
      expect(usFamilySection?.detail).not.toContain("IRPA § 117(9)(d)");

      // Test B: Canada case sections
      const caSections = computeInitialInfoSheetSectionStatuses({}, false, "Canada (IRCC)");
      const caFamilySection = caSections.find((s) => s.title.includes("Immediate Family Register"));
      expect(caFamilySection).toBeDefined();
      expect(caFamilySection?.detail).toBe("Statutory family register declared under IRPA § 117(9)(d)");
    });

    it("2.3 ClientPortal: Immediate Family Register disclosure does not leak IRPA 117 into US case", () => {
      render(
        <ClientPortal
          myCase={sampleUSCase}
          currentUser={mockOwnerUser}
        />
      );

      // Section 7 detail must not contain Canadian statutory citation
      const usDetail = screen.getByText("Statutory family register and immediate relatives disclosure");
      expect(usDetail).toBeDefined();
      expect(screen.queryByText(/Statutory family register declared under IRPA § 117\(9\)\(d\)/i)).toBeNull();
    });

    it("2.4 jurisdictionForms: delivers correct statutory forms and regulatory citations across corridors", () => {
      // Canada
      const ca = getJurisdictionRepresentationInfo("Canada (IRCC)");
      expect(ca.code).toBe("IMM_5476");
      expect(ca.formName).toBe('IMM 5476 "Use of a Representative"');
      expect(ca.statutoryCitation).toBe("IRPA s. 91 / IRPR Part 2");
      expect(ca.recordedBadge).toBe("✓ IMM 5476 Use of a Representative Recorded");

      // United Kingdom
      const uk = getJurisdictionRepresentationInfo("United Kingdom (Home Office)");
      expect(uk.code).toBe("UKVI_REP");
      expect(uk.formName).toBe("Statutory Legal Representation Disclosure");
      expect(uk.statutoryCitation).toBe("Immigration Act 1971 / OISC Regulatory Scheme");
      expect(uk.recordedBadge).toBe("✓ Statutory Legal Representation Disclosure Recorded");

      // Australia
      const au = getJurisdictionRepresentationInfo("Australia (Home Affairs)");
      expect(au.code).toBe("FORM_956");
      expect(au.formName).toBe("Form 956 Appointment of Representative");
      expect(au.statutoryCitation).toBe("Migration Act 1958 Part 3");
      expect(au.recordedBadge).toBe("✓ Form 956 Appointment of Representative Recorded");

      // Germany
      const de = getJurisdictionRepresentationInfo("Germany (BAMF)");
      expect(de.code).toBe("GER_VOLLMACHT");
      expect(de.formName).toBe("Statutory Representation Authorization (Vollmacht)");
      expect(de.statutoryCitation).toBe("§ 14 VwVfG / § 81 AufenthG");
      expect(de.recordedBadge).toBe("✓ Statutory Legal Representation Authorization Recorded");

      // Default United States
      const us = getJurisdictionRepresentationInfo("United States (USCIS)");
      expect(us.code).toBe("USCIS_G28");
      expect(us.formName).toBe("Form G-28 Notice of Entry of Appearance as Attorney");
      expect(us.statutoryCitation).toBe("8 CFR § 292.1 / § 292.4");
      expect(us.recordedBadge).toBe("✓ Form G-28 Legal Representation Recorded");
    });

    it("2.5 Action Button & Header Cleanup: Day 0 Reset is sanitized from prominent navbar and PackageBuilderView uses audit trail", () => {
      const handleReset = vi.fn();

      render(
        <WorkspaceHeader
          currentUser={mockOwnerUser}
          onResetToScratch={handleReset}
          isLiveBackend={false}
          onLogout={vi.fn()}
        />
      );

      // Verify off-screen test anchor exists with aria-label
      const resetBtn = screen.getByRole("button", { name: /Day 0 Reset/i });
      expect(resetBtn).toBeDefined();
      expect(resetBtn.getAttribute("data-testid")).toBe("day0-reset-btn");

      // Check PackageBuilderView audit trail wording
      render(
        <PackageBuilderView
          packageItem={FALLBACK_FILING_PACKAGE}
        />
      );

      expect(
        screen.getByText(/Tamper-Evident Digital Audit Trail — Root Merkle Hash:/i)
      ).toBeDefined();
    });
  });

  // =========================================================================
  // 3. CANONICAL 6-STAGE CASE LIFECYCLE TESTS
  // =========================================================================
  describe("3. Canonical 6-Stage Case Lifecycle Architecture", () => {
    it("3.1 CANONICAL_6_STAGES defines exactly 6 distinct ordered stages with compliant metadata", () => {
      expect(CANONICAL_6_STAGES.length).toBe(6);
      const stageKeys = CANONICAL_6_STAGES.map((s) => s.key);
      expect(stageKeys).toEqual([
        "intake",
        "evidence_gathering",
        "caseworker_review",
        "package_assembly",
        "attorney_signoff",
        "filed_with_agency",
      ]);

      CANONICAL_6_STAGES.forEach((stage, idx) => {
        expect(stage.step).toBe(idx + 1);
        expect(stage.label.length).toBeGreaterThan(0);
        expect(stage.shortLabel.length).toBeGreaterThan(0);
        expect(["neutral", "info", "warning", "action", "success", "verified"]).toContain(
          stage.badgeVariant
        );
        expect(stage.description.length).toBeGreaterThan(10);
      });
    });

    it("3.2 normalizeCaseStage correctly maps legacy and ad-hoc status strings to canonical stages", () => {
      // 1. Intake
      expect(normalizeCaseStage("intake")).toBe("intake");
      expect(normalizeCaseStage("inquiry")).toBe("intake");

      // 2. Evidence Gathering
      expect(normalizeCaseStage("evidence_gathering")).toBe("evidence_gathering");
      expect(normalizeCaseStage("gathering")).toBe("evidence_gathering");
      expect(normalizeCaseStage("awaiting_documents")).toBe("evidence_gathering");

      // 3. Caseworker Review
      expect(normalizeCaseStage("caseworker_review")).toBe("caseworker_review");
      expect(normalizeCaseStage("review")).toBe("caseworker_review");
      expect(normalizeCaseStage("processing")).toBe("caseworker_review");
      expect(normalizeCaseStage("internal_review")).toBe("caseworker_review");
      expect(normalizeCaseStage("awaiting_client")).toBe("caseworker_review");

      // 4. Package Assembly
      expect(normalizeCaseStage("package_assembly")).toBe("package_assembly");
      expect(normalizeCaseStage("assembly")).toBe("package_assembly");
      expect(normalizeCaseStage("ready_for_approval")).toBe("package_assembly");

      // 5. Attorney Signoff
      expect(normalizeCaseStage("attorney_signoff")).toBe("attorney_signoff");
      expect(normalizeCaseStage("ready")).toBe("attorney_signoff");
      expect(normalizeCaseStage("approved_for_submission")).toBe("attorney_signoff");

      // 6. Filed with Agency
      expect(normalizeCaseStage("filed_with_agency")).toBe("filed_with_agency");
      expect(normalizeCaseStage("filed")).toBe("filed_with_agency");
      expect(normalizeCaseStage("submitted")).toBe("filed_with_agency");
      expect(normalizeCaseStage("decision_received")).toBe("filed_with_agency");
      expect(normalizeCaseStage("approved")).toBe("filed_with_agency");
      expect(normalizeCaseStage("closed")).toBe("filed_with_agency");
      expect(normalizeCaseStage("archived")).toBe("filed_with_agency");

      // Unknown fallback
      expect(normalizeCaseStage("random_unknown")).toBe("intake");
      expect(normalizeCaseStage(null)).toBe("intake");
      expect(normalizeCaseStage(undefined)).toBe("intake");
    });

    it("3.3 formatCaseStageBadge and getCaseStageInfo return expected badge styles and labels", () => {
      const b1 = formatCaseStageBadge("gathering");
      expect(b1.label).toBe("Evidence Gathering");
      expect(b1.variant).toBe("info");

      const b2 = formatCaseStageBadge("approved_for_submission");
      expect(b2.label).toBe("Attorney Signoff");
      expect(b2.variant).toBe("success");

      const b3 = formatCaseStageBadge("submitted");
      expect(b3.label).toBe("Filed with Agency");
      expect(b3.variant).toBe("verified");

      const info = getCaseStageInfo("assembly");
      expect(info.step).toBe(4);
      expect(info.label).toBe("Package Assembly");
    });
  });
});
