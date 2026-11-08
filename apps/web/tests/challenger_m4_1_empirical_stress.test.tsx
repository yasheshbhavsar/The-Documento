import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import {
  getJurisdictionRepresentationInfo,
  JurisdictionRepresentationInfo,
} from "../lib/jurisdictionForms";
import {
  normalizeCaseStage,
  getCaseStageInfo,
  formatCaseStageBadge,
  CANONICAL_6_STAGES,
  CanonicalStageKey,
} from "../lib/caseLifecycle";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { api, FIXTURE_CASES, FIXTURE_CLIENTS } from "../lib/api";
import { ImmigrationCase, ClientProfile, UserContext } from "../lib/types";
import { initCaseKickoffRecord, updateCaseKickoffRecord } from "../lib/caseKickoffStore";

describe("Milestone 4 Challenger 1 Empirical Adversarial Stress Harness", () => {
  /* ==========================================================================
   * 1. Multi-Corridor Representation Stress Test
   * ========================================================================== */
  describe("1. Multi-Corridor Representation Normalizer Adversarial Stress Test", () => {
    it("empirically verifies corridor-specific statutory forms for all supported regions", () => {
      // Canada (IRCC)
      const canadaCases = [
        "Canada (IRCC)",
        "canada",
        "CANADA",
        "IRCC - Canada",
        "IRCC Express Entry",
        "ircc",
        "Canada Study Permit",
        "\n  Canada (IRCC) \t",
        "cAnAdA (IrCc)",
      ];
      for (const c of canadaCases) {
        const info = getJurisdictionRepresentationInfo(c);
        expect(info.code).toBe("IMM_5476");
        expect(info.formName).toContain("IMM 5476");
        expect(info.checkboxLabel).toContain("IMM 5476");
        expect(info.recordedBadge).toContain("IMM 5476");
        expect(info.statutoryCitation).toBe("IRPA s. 91 / IRPR Part 2");
        expect(info.authorityDescription).toContain("IRCC");
        expect(info.formsListEntry).toContain("IMM 5476");
      }

      // United Kingdom (Home Office / UKVI)
      const ukCases = [
        "United Kingdom (Home Office)",
        "united kingdom",
        "UNITED KINGDOM",
        "UK Home Office",
        "uk",
        "gb",
        "UK",
        "GB",
        "Home Office Immigration",
        "  united kingdom  ",
        "uNiTeD kInGdOm",
      ];
      for (const u of ukCases) {
        const info = getJurisdictionRepresentationInfo(u);
        expect(info.code).toBe("UKVI_REP");
        expect(info.formName).toContain("Statutory Legal Representation Disclosure");
        expect(info.checkboxLabel).toContain("Statutory Legal Representation Disclosure");
        expect(info.recordedBadge).toContain("Statutory Legal Representation Disclosure");
        expect(info.statutoryCitation).toBe("Immigration Act 1971 / OISC Regulatory Scheme");
        expect(info.authorityDescription).toContain("UKVI");
        expect(info.formsListEntry).toBe("Statutory Legal Representation Disclosure");
      }

      // Australia (Home Affairs)
      const auCases = [
        "Australia (Home Affairs)",
        "australia",
        "AUSTRALIA",
        "Department of Home Affairs - Australia",
        "au",
        "AU",
        "home affairs",
        "Australia Subclass 189",
        "  Australia (Home Affairs) \n",
      ];
      for (const a of auCases) {
        const info = getJurisdictionRepresentationInfo(a);
        expect(info.code).toBe("FORM_956");
        expect(info.formName).toContain("Form 956");
        expect(info.checkboxLabel).toContain("Form 956");
        expect(info.recordedBadge).toContain("Form 956");
        expect(info.statutoryCitation).toBe("Migration Act 1958 Part 3");
        expect(info.authorityDescription).toContain("Department of Home Affairs");
        expect(info.formsListEntry).toContain("Form 956");
      }

      // Germany (BAMF)
      const deCases = [
        "Germany (BAMF)",
        "germany",
        "GERMANY",
        "Federal Republic of Germany",
        "bamf",
        "de",
        "DE",
        "BAMF Chancenkarte",
        "  Germany (BAMF)  ",
      ];
      for (const g of deCases) {
        const info = getJurisdictionRepresentationInfo(g);
        expect(info.code).toBe("GER_VOLLMACHT");
        expect(info.formName).toContain("Vollmacht");
        expect(info.checkboxLabel).toContain("Vollmacht");
        expect(info.recordedBadge).toContain("Statutory Legal Representation Authorization");
        expect(info.statutoryCitation).toBe("§ 14 VwVfG / § 81 AufenthG");
        expect(info.authorityDescription).toContain("Aufenthaltsgesetz");
        expect(info.formsListEntry).toContain("Vollmacht");
      }
    });

    it("empirically verifies Form G-28 remains safe default for US, null, undefined, unknown, and adversarial inputs", () => {
      const fallbackInputs = [
        "United States (USCIS)",
        "united states",
        "UNITED STATES",
        "USCIS",
        "usa",
        "us",
        undefined,
        null,
        "",
        "   ",
        "Brazil",
        "Japan",
        "India",
        "France",
        "Nigeria",
        "Mexico",
        "Random Unknown Country 123",
        "<script>alert(1)</script>",
        "'; DROP TABLE cases; --",
        "UKVI Skilled Worker", // sub-string without 'home office' or 'united kingdom'
      ];

      for (const input of fallbackInputs) {
        const info = getJurisdictionRepresentationInfo(input as any);
        expect(info.code).toBe("USCIS_G28");
        expect(info.formName).toBe("Form G-28 Notice of Entry of Appearance as Attorney");
        expect(info.checkboxLabel).toBe("Record Form G-28 Legal Representation Agreement for applicant");
        expect(info.recordedBadge).toBe("✓ Form G-28 Legal Representation Recorded");
        expect(info.statutoryCitation).toBe("8 CFR § 292.1 / § 292.4");
        expect(info.authorityDescription).toBe("DHS authorized legal representative authority under 8 CFR § 292.1");
        expect(info.formsListEntry).toBe("Form G-28 (Notice of Attorney Representation)");
      }
    });

    it("verifies structural contract completeness for all representation returns", () => {
      const testInputs = [
        "Canada (IRCC)",
        "United Kingdom (Home Office)",
        "Australia (Home Affairs)",
        "Germany (BAMF)",
        "United States (USCIS)",
        "Unknown",
        "",
      ];

      for (const jur of testInputs) {
        const info = getJurisdictionRepresentationInfo(jur);
        expect(typeof info.code).toBe("string");
        expect(info.code.length).toBeGreaterThan(0);
        expect(typeof info.formName).toBe("string");
        expect(info.formName.length).toBeGreaterThan(0);
        expect(typeof info.checkboxLabel).toBe("string");
        expect(info.checkboxLabel.length).toBeGreaterThan(0);
        expect(typeof info.recordedBadge).toBe("string");
        expect(info.recordedBadge.length).toBeGreaterThan(0);
        expect(typeof info.statutoryCitation).toBe("string");
        expect(info.statutoryCitation.length).toBeGreaterThan(0);
        expect(typeof info.authorityDescription).toBe("string");
        expect(info.authorityDescription.length).toBeGreaterThan(0);
        expect(typeof info.formsListEntry).toBe("string");
        expect(info.formsListEntry.length).toBeGreaterThan(0);

        // Disallow undefined/null literals leaked into strings
        expect(info.code).not.toContain("undefined");
        expect(info.formName).not.toContain("undefined");
        expect(info.checkboxLabel).not.toContain("undefined");
        expect(info.recordedBadge).not.toContain("undefined");
      }
    });
  });

  /* ==========================================================================
   * 2. Canonical 6-Stage Lifecycle Normalizer Stress Test
   * ========================================================================== */
  describe("2. Canonical 6-Stage Lifecycle Normalizer Stress Test", () => {
    it("empirically maps all 13 legacy states and aliases into canonical 6 stages", () => {
      // Step 1: intake
      expect(normalizeCaseStage("intake")).toBe("intake");
      expect(normalizeCaseStage("inquiry")).toBe("intake");
      expect(normalizeCaseStage("INQUIRY")).toBe("intake");
      expect(normalizeCaseStage("  intake  ")).toBe("intake");

      // Step 2: evidence_gathering
      expect(normalizeCaseStage("evidence_gathering")).toBe("evidence_gathering");
      expect(normalizeCaseStage("gathering")).toBe("evidence_gathering");
      expect(normalizeCaseStage("awaiting_documents")).toBe("evidence_gathering");
      expect(normalizeCaseStage("AWAITING_DOCUMENTS")).toBe("evidence_gathering");

      // Step 3: caseworker_review
      expect(normalizeCaseStage("caseworker_review")).toBe("caseworker_review");
      expect(normalizeCaseStage("review")).toBe("caseworker_review");
      expect(normalizeCaseStage("processing")).toBe("caseworker_review");
      expect(normalizeCaseStage("internal_review")).toBe("caseworker_review");
      expect(normalizeCaseStage("awaiting_client")).toBe("caseworker_review");

      // Step 4: package_assembly
      expect(normalizeCaseStage("package_assembly")).toBe("package_assembly");
      expect(normalizeCaseStage("assembly")).toBe("package_assembly");
      expect(normalizeCaseStage("ready_for_approval")).toBe("package_assembly");

      // Step 5: attorney_signoff
      expect(normalizeCaseStage("attorney_signoff")).toBe("attorney_signoff");
      expect(normalizeCaseStage("ready")).toBe("attorney_signoff");
      expect(normalizeCaseStage("approved_for_submission")).toBe("attorney_signoff");

      // Step 6: filed_with_agency
      expect(normalizeCaseStage("filed_with_agency")).toBe("filed_with_agency");
      expect(normalizeCaseStage("filed")).toBe("filed_with_agency");
      expect(normalizeCaseStage("submitted")).toBe("filed_with_agency");
      expect(normalizeCaseStage("decision_received")).toBe("filed_with_agency");
      expect(normalizeCaseStage("approved")).toBe("filed_with_agency");
      expect(normalizeCaseStage("closed")).toBe("filed_with_agency");
      expect(normalizeCaseStage("archived")).toBe("filed_with_agency");
      expect(normalizeCaseStage("ARCHIVED")).toBe("filed_with_agency");
      expect(normalizeCaseStage("CLOSED")).toBe("filed_with_agency");
    });

    it("falls back safely to 'intake' for boundary, null, undefined, empty, and invalid strings", () => {
      const boundaryInputs = [null, undefined, "", "   ", "unknown_xyz", "STAGE_9_RELEASE", "STAGE_10", "12345", "!@#$%"];
      for (const input of boundaryInputs) {
        expect(normalizeCaseStage(input as any)).toBe("intake");
        const stageInfo = getCaseStageInfo(input as any);
        expect(stageInfo.key).toBe("intake");
        expect(stageInfo.step).toBe(1);
        expect(stageInfo.label).toBe("Intake");
      }
    });

    it("stress-tests fuzzy input generator: 100 arbitrary inputs never throw unhandled exceptions", () => {
      const fuzzyInputs = Array.from({ length: 100 }, (_, i) => `fuzzy_state_${i}_${Math.random().toString(36).slice(2)}`);
      for (const str of fuzzyInputs) {
        expect(() => normalizeCaseStage(str)).not.toThrow();
        expect(() => getCaseStageInfo(str)).not.toThrow();
        expect(() => formatCaseStageBadge(str)).not.toThrow();

        const badge = formatCaseStageBadge(str);
        expect(badge.label).toBe("Intake");
        expect(badge.variant).toBe("neutral");
      }
    });

    it("verifies getCaseStageInfo and formatCaseStageBadge contract consistency across all 6 stages", () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      const validBadgeVariants = ["neutral", "info", "warning", "action", "success", "verified"];

      expect(CANONICAL_6_STAGES.length).toBe(6);

      CANONICAL_6_STAGES.forEach((stageDef, index) => {
        expect(stageDef.step).toBe(index + 1);
        expect(stageDef.shortLabel).toMatch(new RegExp(`^${index + 1}\\. `));
        expect(validBadgeVariants).toContain(stageDef.badgeVariant);
        expect(stageDef.badgeBg).toMatch(hexColorRegex);
        expect(stageDef.badgeColor).toMatch(hexColorRegex);
        expect(stageDef.badgeBorder).toMatch(hexColorRegex);
        expect(stageDef.description.length).toBeGreaterThan(10);

        // Test consistency via getCaseStageInfo
        const fetched = getCaseStageInfo(stageDef.key);
        expect(fetched).toEqual(stageDef);

        // Test consistency via formatCaseStageBadge
        const badge = formatCaseStageBadge(stageDef.key);
        expect(badge.label).toBe(stageDef.label);
        expect(badge.variant).toBe(stageDef.badgeVariant);
      });
    });
  });

  /* ==========================================================================
   * 3. 2-Step Onboarding Modal Interaction Test
   * ========================================================================== */
  describe("3. 2-Step Onboarding Modal Interaction Test", () => {
    let originalClipboard: any;

    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      originalClipboard = navigator.clipboard;
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
    });

    afterEach(() => {
      Object.assign(navigator, { clipboard: originalClipboard });
    });

    it("tests step transitions (Step 1 -> Step 2 -> Step 1) with data preservation", async () => {
      const handleClose = vi.fn();
      const handleClientCreated = vi.fn();
      const handleCaseCreated = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={handleClose}
          onClientCreated={handleClientCreated}
          onCaseCreated={handleCaseCreated}
          clients={[]}
          activeRole="master_admin"
        />
      );

      // Verify initial Step 1 elements
      expect(screen.getByText("Client Profile & Petition Scope")).toBeDefined();
      expect(screen.getByText("Portal Access & Magic Link")).toBeDefined();
      expect(screen.getByTestId("unified-case-scope-section")).toBeDefined();

      // Enter client details in Step 1 using label selectors
      const firstNameInput = screen.getByLabelText(/First Name/i);
      const lastNameInput = screen.getByLabelText(/Last Name/i);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const nationalityInput = screen.getByLabelText(/Primary Nationality/i);

      fireEvent.change(firstNameInput, { target: { value: "Elena" } });
      fireEvent.change(lastNameInput, { target: { value: "Rostova" } });
      fireEvent.change(emailInput, { target: { value: "elena.rostova@example.com" } });
      fireEvent.change(nationalityInput, { target: { value: "UKR" } });

      // Click "Configure Portal Invite →"
      const configureBtn = screen.getByRole("button", { name: /Configure Portal Invite →/i });
      fireEvent.click(configureBtn);

      // Verify Step 2 is active
      expect(screen.getByText("Automated Secure Portal Access Link")).toBeDefined();
      expect(screen.getByRole("button", { name: /← Back to Client Details/i })).toBeDefined();

      // Verify invite URL contains encoded email
      const inviteUrlInput = screen.getByDisplayValue(/https:\/\/app\.documento\.legal\/login\?invite=inv_.*&email=elena\.rostova%40example\.com/);
      expect(inviteUrlInput).toBeDefined();

      // Click "← Back to Client Details" to transition back to Step 1
      const backBtn = screen.getByRole("button", { name: /← Back to Client Details/i });
      fireEvent.click(backBtn);

      // Verify Step 1 is rendered again and fields are intact
      expect(screen.getByTestId("unified-case-scope-section")).toBeDefined();
      expect((screen.getByLabelText(/First Name/i) as HTMLInputElement).value).toBe("Elena");
      expect((screen.getByLabelText(/Last Name/i) as HTMLInputElement).value).toBe("Rostova");
      expect((screen.getByLabelText(/Email Address/i) as HTMLInputElement).value).toBe("elena.rostova@example.com");
      expect((screen.getByLabelText(/Primary Nationality/i) as HTMLInputElement).value).toBe("UKR");
    });

    it("tests 1-click invite link copying, email simulation, and password generation accordion", async () => {
      render(
        <CreateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onClientCreated={vi.fn()}
          onCaseCreated={vi.fn()}
          clients={[]}
          activeRole="master_admin"
        />
      );

      // Fill basic details and navigate to Step 2
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "David" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Chen" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "david.chen@law.com" } });
      fireEvent.change(screen.getByLabelText(/Primary Nationality/i), { target: { value: "SGP" } });

      fireEvent.click(screen.getByRole("button", { name: /Configure Portal Invite →/i }));

      // Test 1-click Copy Invite Link
      const copyBtn = screen.getByRole("button", { name: /📋 Copy Invite Link/i });
      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const copiedTextCall = (navigator.clipboard.writeText as any).mock.calls[0][0];
      expect(copiedTextCall).toContain("https://app.documento.legal/login?invite=inv_");
      expect(copiedTextCall).toContain("email=david.chen%40law.com");
      expect(screen.getByText("✓ Copied!")).toBeDefined();

      // Test Simulated Send Email button
      const sendEmailBtn = screen.getByRole("button", { name: /✉️ Send Portal Invite Email/i });
      fireEvent.click(sendEmailBtn);
      expect(screen.getByText(/✓ Invitation email dispatched to david\.chen@law\.com/i)).toBeDefined();

      // Test Advanced Fallback Accordion
      const accordionBtn = screen.getByRole("button", { name: /⚙️ Advanced: Fallback Temporary Password & Access Controls/i });
      fireEvent.click(accordionBtn);

      // Accordion expanded: credentials toggle exists and is checked
      const credToggle = document.getElementById("provision-portal-credentials-toggle") as HTMLInputElement;
      expect(credToggle).not.toBeNull();
      expect(credToggle.checked).toBe(true);

      // Initial temporary password
      const passwordInput = screen.getByPlaceholderText("Set temporary password") as HTMLInputElement;
      expect(passwordInput.value).toBe("ClientPass2026!");

      // Toggle Show/Hide password
      const showHideBtn = screen.getByRole("button", { name: /Show/i });
      fireEvent.click(showHideBtn);
      expect(passwordInput.type).toBe("text");
      const hideBtn = screen.getByRole("button", { name: /Hide/i });
      fireEvent.click(hideBtn);
      expect(passwordInput.type).toBe("password");

      // Generate random password
      const generateBtn = screen.getByRole("button", { name: /🎲 Generate/i });
      fireEvent.click(generateBtn);
      expect(passwordInput.value).toMatch(/^Doc2026![A-Za-z0-9!@#$%]{6}$/);
    });

    it("tests immediate submission from Step 1 vs submission from Step 2", async () => {
      const handleClientCreated1 = vi.fn();
      const handleCaseCreated1 = vi.fn();
      const handleClose1 = vi.fn();

      // Case A: Immediate submission directly from Step 1
      const { unmount } = render(
        <CreateClientModal
          isOpen={true}
          onClose={handleClose1}
          onClientCreated={handleClientCreated1}
          onCaseCreated={handleCaseCreated1}
          clients={[]}
          activeRole="master_admin"
        />
      );

      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Lucas" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Moura" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "lucas.moura@brazil.br" } });
      fireEvent.change(screen.getByLabelText(/Primary Nationality/i), { target: { value: "BRA" } });

      // Click "Onboard Client & Open Case" from Step 1
      const submitBtn1 = screen.getByRole("button", { name: /Onboard Client & Open Case/i });
      fireEvent.click(submitBtn1);

      await waitFor(() => {
        expect(handleClientCreated1).toHaveBeenCalledTimes(1);
        expect(handleCaseCreated1).toHaveBeenCalledTimes(1);
        expect(handleClose1).toHaveBeenCalledTimes(1);
      });
      unmount();

      // Case B: Submission from Step 2
      const handleClientCreated2 = vi.fn();
      const handleCaseCreated2 = vi.fn();
      const handleClose2 = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={handleClose2}
          onClientCreated={handleClientCreated2}
          onCaseCreated={handleCaseCreated2}
          clients={[]}
          activeRole="master_admin"
        />
      );

      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Klara" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Novak" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "klara.novak@prague.cz" } });
      fireEvent.change(screen.getByLabelText(/Primary Nationality/i), { target: { value: "CZE" } });

      // Advance to Step 2
      fireEvent.click(screen.getByRole("button", { name: /Configure Portal Invite →/i }));

      // Click submit from Step 2
      const submitBtn2 = screen.getByRole("button", { name: /Onboard Client & Open Case/i });
      fireEvent.click(submitBtn2);

      await waitFor(() => {
        expect(handleClientCreated2).toHaveBeenCalledTimes(1);
        expect(handleCaseCreated2).toHaveBeenCalledTimes(1);
        expect(handleClose2).toHaveBeenCalledTimes(1);
      });
    });

    it("verifies validation errors when required fields are missing and dynamic representation updates", async () => {
      const handleClientCreated = vi.fn();
      const handleCaseCreated = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onClientCreated={handleClientCreated}
          onCaseCreated={handleCaseCreated}
          clients={[]}
          activeRole="master_admin"
        />
      );

      // Attempt to submit with empty fields
      const submitBtn = screen.getByRole("button", { name: /Onboard Client & Open Case/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Please fill in all required fields/i)).toBeDefined();
      expect(handleClientCreated).not.toHaveBeenCalled();

      // Test dynamic representation checkbox updating based on jurisdiction select
      // Initial: US -> G-28
      expect(screen.getByText("Record Form G-28 Legal Representation Agreement for applicant")).toBeDefined();

      // Change jurisdiction to Canada
      const jurisdictionSelect = screen.getByDisplayValue("United States (USCIS)");
      fireEvent.change(jurisdictionSelect, { target: { value: "Canada (IRCC)" } });

      expect(screen.getByText("Record IMM 5476 Use of a Representative for applicant")).toBeDefined();

      // Change jurisdiction to United Kingdom
      fireEvent.change(jurisdictionSelect, { target: { value: "United Kingdom (Home Office)" } });
      expect(screen.getByText("Record Statutory Legal Representation Disclosure for applicant")).toBeDefined();

      // Change jurisdiction to Germany
      fireEvent.change(jurisdictionSelect, { target: { value: "Germany (BAMF)" } });
      expect(screen.getByText("Record Statutory Legal Representation Authorization (Vollmacht) for applicant")).toBeDefined();
    });

    it("tests Dependant addition workflow and Existing Client mode switching", async () => {
      const mockClients: ClientProfile[] = [
        {
          id: "cli-existing-99",
          first_name: "Rohan",
          last_name: "Verma",
          email: "rohan.verma@example.com",
          nationality: "IND",
          organization_id: "org-test",
          portal_access_enabled: true,
          created_at: new Date().toISOString(),
        },
      ];

      render(
        <CreateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onClientCreated={vi.fn()}
          onCaseCreated={vi.fn()}
          clients={mockClients}
          activeRole="master_admin"
        />
      );

      // 1. Toggle Dependant section
      const depCheckbox = screen.getByLabelText(/Add Principal Dependant \/ Family Member/i);
      expect(depCheckbox).toBeDefined();
      fireEvent.click(depCheckbox);

      expect(screen.getByLabelText(/Relationship Type/i)).toBeDefined();
      expect(screen.getByLabelText(/Dependant First Name/i)).toBeDefined();
      expect(screen.getByLabelText(/Dependant Last Name/i)).toBeDefined();

      // 2. Switch to Existing Client mode
      const existingClientTab = screen.getByRole("tab", { name: /Existing Client/i });
      fireEvent.click(existingClientTab);

      // Step indicator is hidden for existing client case creation
      expect(screen.queryByText("Portal Access & Magic Link")).toBeNull();
      expect(screen.getByText(/Open Case Record/i)).toBeDefined();
    });
  });

  /* ==========================================================================
   * 4. Drawer & Header Stress Test
   * ========================================================================== */
  describe("4. Drawer & Header Stress Test", () => {
    const mockCase: ImmigrationCase = {
      id: "case-challenger-401",
      client_id: "client-test-1",
      client_name: "Dr. Aris Thorne",
      case_number: "CASE-4010",
      title: "EB-1A: Dr. Aris Thorne",
      jurisdiction: "United States (USCIS)",
      visa_category: "EB-1A Extraordinary Ability",
      status: "gathering",
      organization_id: "org-challenger",
      created_at: new Date().toISOString(),
    };

    it("verifies CaseDrilldownDrawer single 'Open Case Workspace →' action button and canonical badge", () => {
      const handleClose = vi.fn();
      const handleOpenWorkspace = vi.fn();
      const handleOpenDetailModal = vi.fn();

      const { rerender } = render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={handleClose}
          caseItem={mockCase}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenDetailModal={handleOpenDetailModal}
        />
      );

      // Verify canonical badge displays "Evidence Gathering" for "gathering" status
      expect(screen.getByText("Evidence Gathering")).toBeDefined();

      // Verify single primary button exists with exact text and testid
      const workspaceBtn = screen.getByTestId("open-case-workspace-btn");
      expect(workspaceBtn).toBeDefined();
      expect(workspaceBtn.textContent).toContain("Open Case Workspace →");

      // Verify NO old competing button "Full Case Dossier ↗" exists
      expect(screen.queryByRole("button", { name: /Full Case Dossier ↗/i })).toBeNull();

      // Click "Open Case Workspace →"
      fireEvent.click(workspaceBtn);
      expect(handleOpenWorkspace).toHaveBeenCalledWith(mockCase.id);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Test fallback to onOpenDetailModal when onOpenWorkspace is not provided
      handleClose.mockClear();
      rerender(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={handleClose}
          caseItem={mockCase}
          onOpenDetailModal={handleOpenDetailModal}
        />
      );

      const workspaceBtn2 = screen.getByTestId("open-case-workspace-btn");
      fireEvent.click(workspaceBtn2);
      expect(handleOpenDetailModal).toHaveBeenCalledWith(mockCase);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("verifies CaseDrilldownDrawer returns null when caseItem is null or closed", () => {
      const { container } = render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={vi.fn()}
          caseItem={null}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("verifies CaseDrilldownDrawer renders kickoff banner when kickoff is incomplete and hides when complete", () => {
      initCaseKickoffRecord({
        caseId: mockCase.id,
        caseNumber: mockCase.case_number,
        clientId: mockCase.client_id,
      });

      const handleOpenKickoff = vi.fn();

      const { rerender } = render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={vi.fn()}
          caseItem={mockCase}
          onOpenCaseKickoff={handleOpenKickoff}
        />
      );

      expect(screen.getByTestId("drawer-kickoff-banner")).toBeDefined();

      // Mark all 4 steps complete
      updateCaseKickoffRecord(mockCase.id, {
        step1CredentialsShared: true,
        step2ChecklistDispatched: true,
        step3RetainerConfigured: true,
        step4InitialDocsOrWorkspace: true,
      });

      rerender(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={vi.fn()}
          caseItem={mockCase}
          onOpenCaseKickoff={handleOpenKickoff}
        />
      );

      expect(screen.queryByTestId("drawer-kickoff-banner")).toBeNull();
    });

    it("verifies WorkspaceHeader Day 0 Reset button in profile menu and accessible clipped anchor", () => {
      const handleReset = vi.fn();
      const confirmSpy = vi.spyOn(window, "confirm");

      const testUser: UserContext = {
        id: "user-admin-1",
        email: "superadmin@documento.legal",
        full_name: "Super Admin Yashesh",
        role: "master_admin",
        organization_id: "org-pilot",
        organization_name: "Pilot Practice",
        experience: "master_admin",
        permissions: ["cases:read", "cases:write", "client:delete"],
      };

      render(
        <WorkspaceHeader
          currentUser={testUser}
          onLogout={vi.fn()}
          onResetToScratch={handleReset}
          isLiveBackend={true}
        />
      );

      // 1. Verify accessible clipped anchor exists for test automation & a11y
      const clippedAnchor = screen.getByTestId("day0-reset-btn");
      expect(clippedAnchor).toBeDefined();
      expect(clippedAnchor.getAttribute("aria-label")).toBe("Day 0 Reset");

      // When confirm returns false, reset is aborted
      confirmSpy.mockReturnValueOnce(false);
      fireEvent.click(clippedAnchor);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(handleReset).not.toHaveBeenCalled();

      // When confirm returns true, reset is triggered
      confirmSpy.mockReturnValueOnce(true);
      fireEvent.click(clippedAnchor);
      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(handleReset).toHaveBeenCalledTimes(1);

      // 2. Verify Day 0 Reset in User Profile menu dropdown
      handleReset.mockClear();
      const profileButton = screen.getByRole("button", { name: /Super Admin Yashesh - User profile menu/i });
      fireEvent.click(profileButton);

      // Profile menu is now visible
      const profileResetBtn = screen.getByTestId("profile-day0-reset-btn");
      expect(profileResetBtn).toBeDefined();
      expect(profileResetBtn.textContent).toContain("Reset Workspace (Day 0 Clean Slate)");

      // Click Day 0 Reset in profile dropdown
      confirmSpy.mockReturnValueOnce(true);
      fireEvent.click(profileResetBtn);
      expect(handleReset).toHaveBeenCalledTimes(1);

      confirmSpy.mockRestore();
    });

    it("verifies safe behavior when onResetToScratch is omitted from WorkspaceHeader", () => {
      const testUser: UserContext = {
        id: "user-staff-1",
        email: "staff@documento.legal",
        full_name: "Staff Caseworker",
        role: "case_worker",
        organization_id: "org-pilot",
        organization_name: "Pilot Practice",
        experience: "paralegal",
        permissions: ["cases:read"],
      };

      render(
        <WorkspaceHeader
          currentUser={testUser}
          onLogout={vi.fn()}
          isLiveBackend={false}
        />
      );

      expect(screen.queryByTestId("day0-reset-btn")).toBeNull();

      // Open profile menu
      const profileButton = screen.getByRole("button", { name: /Staff Caseworker - User profile menu/i });
      fireEvent.click(profileButton);

      expect(screen.queryByTestId("profile-day0-reset-btn")).toBeNull();
    });
  });
});
