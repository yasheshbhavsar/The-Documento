import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { SplitScreenCaseStudio } from "../components/cases/SplitScreenCaseStudio";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import {
  recordSponsorContributionUpload,
  getSponsorInvitesForCase,
  SPONSOR_INVITES_STORAGE_KEY,
} from "../lib/sponsorContributorStore";
import { getAutoFillProvenance } from "../lib/documentAutoFillEngine";
import type {
  ImmigrationCase,
  DocumentItem,
  ClientProfile,
  UserContext,
} from "../lib/types";

const SUPER_VISA_CASE: ImmigrationCase = {
  id: "case-sv-901",
  case_number: "CASE-CA-SV-901",
  title: "Parents Super Visa Application — Patel Family",
  client_id: "client-patel-01",
  client_name: "Kiranben Patel",
  organization_id: "org-maple-law",
  visa_category: "Canada Super Visa (Parents & Grandparents)",
  jurisdiction: "Canada (IRCC)",
  status: "gathering",
  assigned_manager: "Priya Nair, RCIC",
  readiness_score: 76,
  attention_required: false,
  created_at: "2026-10-01T10:00:00Z",
};

const STUDIO_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-applicant-passport",
    case_id: "case-sv-901",
    case_number: "CASE-CA-SV-901",
    title: "Kiranben Patel — Indian Passport Bio Page",
    filename: "kiranben_passport.pdf",
    category: "identity",
    status: "verified",
    processing_status: "completed",
    verification_status: "verified",
    file_size: "1.4 MB",
    sha256_hash: "sha256-doc-applicant-passport-901",
    uploaded_at: "2026-10-02T12:00:00Z",
    extracted_fields: [
      {
        field_name: "passport_number",
        label: "Passport Number",
        value: "Z4498120",
        confidence: 0.99,
        page_number: 1,
        bounding_box: [0.18, 0.55, 0.28, 0.92],
      } as any,
      {
        field_name: "expiry_date",
        label: "Date of Expiry",
        value: "2032-08-15",
        confidence: 0.98,
        page_number: 1,
        bounding_box: [0.34, 0.55, 0.44, 0.92],
      } as any,
      {
        field_name: "shared_parent_name",
        label: "Father / Shared Parent Name",
        value: "govindbhai patel",
        confidence: 0.96,
        page_number: 2,
        bounding_box: [0.22, 0.12, 0.32, 0.78],
      } as any,
    ],
  },
  {
    id: "doc-sponsor-noa",
    case_id: "case-sv-901",
    case_number: "CASE-CA-SV-901",
    title: "Rohan Patel — CRA Notice of Assessment (Line 15000) & $100,000 Medical Insurance",
    filename: "rohan_cra_noa_2025_insurance.pdf",
    category: "financial",
    status: "verified",
    processing_status: "completed",
    verification_status: "verified",
    file_size: "920 KB",
    sha256_hash: "sha256-doc-sponsor-noa-901",
    uploaded_at: "2026-10-03T15:00:00Z",
    extracted_fields: [
      {
        field_name: "line_15000_income",
        label: "CRA NOA Line 15000 Total Income",
        value: "$92,400",
        confidence: 0.99,
        page_number: 1,
        bounding_box: [0.48, 0.15, 0.58, 0.85],
      } as any,
      {
        field_name: "closing_balance_28_day",
        label: "28-Day Continuous Closing Balance",
        value: "£18,500",
        confidence: 0.97,
        page_number: 1,
        bounding_box: [0.64, 0.15, 0.74, 0.85],
      } as any,
    ],
  },
  {
    id: "doc-sibling-pr",
    case_id: "case-sv-901",
    case_number: "CASE-CA-SV-901",
    title: "Canadian Sibling PR Card & Toronto Hydro Utility Bill (+15 CRS)",
    filename: "sibling_pr_card_hydro.pdf",
    category: "civil_status",
    status: "verified",
    processing_status: "completed",
    verification_status: "verified",
    file_size: "840 KB",
    sha256_hash: "sha256-doc-sibling-pr-901",
    uploaded_at: "2026-10-04T09:00:00Z",
    extracted_fields: [
      {
        field_name: "sibling_pr_uci",
        label: "Sibling PR Card UCI",
        value: "1109-4421",
        confidence: 0.98,
        page_number: 1,
        bounding_box: [0.25, 0.2, 0.36, 0.8],
      } as any,
    ],
  },
];

const MOCK_APPLICANT_USER: UserContext = {
  id: "client-patel-01",
  email: "kiranben@example.com",
  full_name: "Kiranben Patel",
  role: "retained_client",
  experience: "client_applicant",
  organization_id: "org-maple-law",
  organization_name: "Maple Legal Counsel LLP",
  permissions: [],
};

describe("Workstream D — Guided 3-Tab Client Portal, Split-Screen Case Studio & Express Launch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("1. Guided 3-Tab Plain-Language ClientPortal (EN / ગુજરાતી / हिन्दी)", () => {
    it("renders 3-Step Guided Journey Bar, Plain-Language Next Step, 1-Click Auto-Fill, Sponsor Link + Privacy Shield, and EN/GU/HI switching", () => {
      render(
        <ClientPortal
          myCase={SUPER_VISA_CASE}
          documents={STUDIO_DOCUMENTS}
          messages={[]}
          currentUser={MOCK_APPLICANT_USER}
        />
      );

      // 1. Verify Guided 3-Step Journey Bar
      const journeyBar = screen.getByTestId("client-guided-journey-bar");
      expect(within(journeyBar).getByTestId("journey-step-home-upload").textContent).toContain(
        "1. Home & Upload"
      );
      expect(within(journeyBar).getByTestId("journey-step-my-details").textContent).toContain(
        "2. My Details"
      );
      expect(within(journeyBar).getByTestId("journey-step-messages-status").textContent).toContain(
        "3. Messages & Status"
      );

      // 2. Verify Plain-Language Next Step card & 1-Click Auto-Fill Confirmation
      const nextStepCard = screen.getByTestId("client-guided-next-step");
      expect(nextStepCard.textContent).toContain("Your Next Step");
      expect(screen.getByTestId("client-home-smart-dropzone")).toBeDefined();

      const confirmAutoFillBtn = screen.getByTestId("client-confirm-autofill-btn");
      fireEvent.click(confirmAutoFillBtn);
      expect(screen.getByTestId("client-autofill-confirmed-badge").textContent).toContain(
        "Confirmed"
      );

      // 3. Verify Overseas Sponsor Upload Link generator + Privacy-Shield status badge
      const sponsorCard = screen.getByTestId("client-sponsor-link-card");
      const nameInput = within(sponsorCard).getByTestId("sponsor-name-input");
      fireEvent.change(nameInput, { target: { value: "Rohan Patel" } });
      fireEvent.click(within(sponsorCard).getByTestId("generate-sponsor-link-btn"));

      const invites = getSponsorInvitesForCase(SUPER_VISA_CASE.id);
      expect(invites.length).toBe(1);
      expect(sponsorCard.textContent).toContain(`/contribute?token=${invites[0].token}`);

      // Simulate overseas sponsor uploading CRA NOA under Privacy Shield
      act(() => {
        recordSponsorContributionUpload(invites[0].token, {
          subtypeLabel: "CRA Notice of Assessment (Line 15000)",
          category: "financial",
          verified: true,
          sha256: "sha256-demo-sponsor-noa",
          filename: "private_rohan_tax_2025.pdf",
          statutoryBadge: "CRA NOA Line 15000 Verified",
          isPrivateToFirm: true,
        });
      });

      const verifiedShieldBadge = screen.getByTestId("sponsor-verified-privacy-shield-badge");
      expect(verifiedShieldBadge.textContent).toContain("Verified (Privacy Shield Active)");
      // Private sponsor filename is NOT exposed to the parent applicant
      expect(sponsorCard.textContent).not.toContain("private_rohan_tax_2025.pdf");

      // 4. Switch across English -> Gujarati (ગુજરાતી) -> Hindi (हिन्दी)
      const guBtn = screen.getByRole("button", { name: /ગુજરાતી/i });
      fireEvent.click(guBtn);
      expect(screen.getByTestId("journey-step-home-upload").textContent).toContain(
        "૧. મુખ્ય પૃષ્ઠ અને અપલોડ"
      );
      expect(screen.getByTestId("client-guided-next-step").textContent).toContain(
        "તમારું આગામી પગલું"
      );

      const hiBtn = screen.getByRole("button", { name: /हिन्दी/i });
      fireEvent.click(hiBtn);
      expect(screen.getByTestId("journey-step-home-upload").textContent).toContain(
        "१. मुख्य पृष्ठ और अपलोड"
      );
      expect(screen.getByTestId("client-guided-next-step").textContent).toContain(
        "आपका अगला कदम"
      );

      // 5. Navigate to Step 2: My Details and verify provenance-backed pre-filled review
      fireEvent.click(screen.getByTestId("journey-step-my-details"));
      const myDetailsCard = screen.getByTestId("client-my-details-prefilled-card");
      expect(myDetailsCard.textContent).toContain("Z4498120");
    });
  });

  describe("2. Split-Screen Case Studio, Statutory Rule Calculators & Staff/Owner Streamlining", () => {
    it("renders Document/BBox canvas + Role Graph + Super Visa LICO / CRS Sibling calculators + 1-Click Confirm & Push to Forms", () => {
      window.localStorage.removeItem(SPONSOR_INVITES_STORAGE_KEY);
      const onPushToForms = vi.fn();

      render(
        <SplitScreenCaseStudio
          caseItem={SUPER_VISA_CASE}
          documents={STUDIO_DOCUMENTS}
          onPushToForms={onPushToForms}
        />
      );

      // Left Pane: Document selector, zoom, page switcher, bounding-box overlays
      expect(screen.getByTestId("split-screen-case-studio")).toBeDefined();
      expect(screen.getByTestId("studio-left-document-pane")).toBeDefined();
      expect(screen.getByTestId("studio-bbox-passport_number")).toBeDefined();
      expect(screen.getByTestId("studio-page-indicator").textContent).toContain("Page 1 of 2");

      // Right Pane: Role Graph buckets (Applicant, Spouse/Dependant, CA/UK/AU Sponsor, +15 CRS Sibling)
      const roleGraph = screen.getByTestId("studio-role-graph");
      expect(within(roleGraph).getByTestId("role-node-applicant").textContent).toContain(
        "Principal Applicant"
      );
      expect(within(roleGraph).getByTestId("role-node-spouse_dependant").textContent).toContain(
        "Spouse / Dependant"
      );
      expect(within(roleGraph).getByTestId("role-node-sponsor_host").textContent).toContain(
        "CA/UK/AU Sponsor / Host"
      );
      expect(within(roleGraph).getByTestId("role-node-crs_sibling").textContent).toContain(
        "+15 CRS Canadian Sibling"
      );

      // Clicking a page-2 entity row automatically switches the left document canvas to Page 2
      fireEvent.click(screen.getByTestId("studio-entity-row-shared_parent_name"));
      expect(screen.getByTestId("studio-page-indicator").textContent).toContain("Page 2 of 2");
      expect(screen.getByTestId("studio-bbox-shared_parent_name")).toBeDefined();

      // Live Statutory Calculators: Super Visa LICO, +15 CRS Sibling, UKVI 28-Day, 6-Month Passport
      const licoCard = screen.getByTestId("calc-super-visa-lico");
      expect(licoCard.textContent).toContain("$92,400 CAD");
      expect(licoCard.textContent).toContain("LICO Met");
      expect(licoCard.textContent).toContain("$100k / 365d Medical Policy on File");

      const crsCard = screen.getByTestId("calc-crs-sibling");
      expect(crsCard.textContent).toContain("+15 CRS Verified");

      const ukviCard = screen.getByTestId("calc-ukvi-28day");
      expect(ukviCard.textContent).toContain("£18,500");

      const passportCard = screen.getByTestId("calc-passport-validity");
      expect(passportCard.textContent).toContain("Valid ≥ 6 Mos");

      // 1-Click Confirm & Push to Forms
      fireEvent.click(screen.getByTestId("studio-confirm-autofill-btn"));
      expect(onPushToForms).toHaveBeenCalledTimes(1);
      expect(onPushToForms.mock.calls[0][0]).toMatchObject({
        passport_number: "Z4498120",
        line_15000_income: "$92,400",
      });
      expect(screen.getByTestId("studio-autofill-audit-banner").textContent).toContain(
        "Confirmed & Pushed to Forms"
      );
      expect(Object.keys(getAutoFillProvenance(SUPER_VISA_CASE.id)).length).toBeGreaterThan(0);
    });

    it("provides 1-click Open in Split-Screen Studio in EmployeeWorkspace and Express Drop-to-Create bar in OwnerMasterDashboard", async () => {
      const onOpenCreateClient = vi.fn();
      render(
        <OwnerMasterDashboard
          cases={[SUPER_VISA_CASE]}
          clients={[]}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
          onOpenCreateClient={onOpenCreateClient}
        />
      );

      const expressBar = screen.getByTestId("owner-express-drop-create-bar");
      expect(expressBar.textContent).toContain("Express Drop-to-Create Client & Case");
      fireEvent.click(screen.getByTestId("owner-express-drop-create-btn"));
      expect(onOpenCreateClient).toHaveBeenCalledTimes(1);

      const { unmount } = render(
        <EmployeeWorkspace
          cases={[SUPER_VISA_CASE]}
          clients={[]}
          documents={STUDIO_DOCUMENTS}
          tasks={[]}
          aiFindings={[]}
          messages={[]}
        />
      );

      // Navigate to Assigned Cases and click "Open in Split-Screen Studio"
      fireEvent.click(screen.getByTestId("tab-btn-assigned_cases"));
      const openStudioBtn = screen.getByRole("button", {
        name: /Open in Split-Screen Studio/i,
      });
      fireEvent.click(openStudioBtn);
      expect(screen.getByTestId("split-screen-case-studio")).toBeDefined();
      unmount();
    });
  });

  describe("3. WorkspaceContext Express Launch (skipKickoffModal & uploadedDocs)", () => {
    function ExpressHarness() {
      const {
        cases,
        documents,
        selectedCaseForKickoff,
        handleCaseCreated,
      } = useWorkspace();

      const sampleClient: ClientProfile = {
        id: "cl-express-1",
        first_name: "Meera",
        last_name: "Desai",
        email: "meera@example.com",
        phone: "+1-416-555-0192",
        nationality: "India",
        organization_id: "org-maple-law",
        portal_access_enabled: true,
        created_at: "2026-11-11T00:00:00Z",
      };

      return (
        <div>
          <span data-testid="ctx-cases-count">{cases.length}</span>
          <span data-testid="ctx-docs-count">{documents.length}</span>
          <span data-testid="ctx-kickoff-case">
            {selectedCaseForKickoff ? selectedCaseForKickoff.case_number : "NONE"}
          </span>
          <button
            type="button"
            data-testid="trigger-express-create"
            onClick={() =>
              handleCaseCreated(SUPER_VISA_CASE, sampleClient, true, {
                skipKickoffModal: true,
                uploadedDocs: STUDIO_DOCUMENTS,
              })
            }
          >
            Express Launch
          </button>
          <button
            type="button"
            data-testid="trigger-legacy-create"
            onClick={() =>
              handleCaseCreated(
                { ...SUPER_VISA_CASE, id: "case-legacy-2", case_number: "CASE-LEGACY-002" },
                sampleClient,
                true
              )
            }
          >
            Legacy Launch
          </button>
        </div>
      );
    }

    it("prepends uploadedDocs immediately and skips kickoff modal when skipKickoffModal is true, while preserving legacy behavior", async () => {
      await act(async () => {
        render(
          <WorkspaceProvider initialUser={null}>
            <ExpressHarness />
          </WorkspaceProvider>
        );
      });

      expect(screen.getByTestId("ctx-kickoff-case").textContent).toBe("NONE");

      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger-express-create"));
      });

      expect(Number(screen.getByTestId("ctx-cases-count").textContent)).toBeGreaterThanOrEqual(1);
      expect(Number(screen.getByTestId("ctx-docs-count").textContent)).toBe(
        STUDIO_DOCUMENTS.length
      );
      // Express launch MUST NOT pop open the 4-step kickoff modal
      expect(screen.getByTestId("ctx-kickoff-case").textContent).toBe("NONE");

      // Legacy callers without skipKickoffModal still open kickoff modal as before
      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger-legacy-create"));
      });
      expect(screen.getByTestId("ctx-kickoff-case").textContent).toBe("CASE-LEGACY-002");
    });
  });
});
