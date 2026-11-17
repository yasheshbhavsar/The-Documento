import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { SplitScreenCaseStudio } from "../components/cases/SplitScreenCaseStudio";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { SmartDropzone } from "../components/common/SmartDropzone";
import { InitialInformationSheet, getSavedInitialInfoSheetRecord } from "../components/portal/InitialInformationSheet";
import SponsorContributePage from "../app/contribute/page";
import {
  createSponsorInviteLink,
  getSponsorInviteByToken,
} from "../lib/sponsorContributorStore";
import {
  getPendingRawPacketsForCase,
  getRawPacketsForCase,
  getMissingQuestionsRequest,
  clearRawPacketStoreInMemoryCache,
} from "../lib/rawClientPacketStore";
import { getAutoFillProvenance } from "../lib/documentAutoFillEngine";
import { clearBackgroundIntakeJobs } from "../lib/backgroundIntakeStore";
import { api } from "../lib/api";
import type {
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  UserContext,
} from "../lib/types";

const RETAINED_CASE: ImmigrationCase = {
  id: "case-raw-sv-501",
  case_number: "CASE-CA-SV-501",
  title: "Super Visa Family Intake — Bhavsar Family",
  client_id: "client-bhavsar-501",
  client_name: "Maheshkumar Bhavsar",
  organization_id: "org-maple-law",
  visa_category: "Canada Super Visa (Parents & Grandparents)",
  jurisdiction: "Canada (IRCC)",
  status: "gathering",
  assigned_manager: "Priya Nair, RCIC",
  readiness_score: 68,
  attention_required: false,
  created_at: "2026-11-01T10:00:00Z",
};

const RETAINED_CLIENT_PROFILE: ClientProfile = {
  id: "client-bhavsar-501",
  first_name: "Maheshkumar",
  last_name: "Bhavsar",
  email: "mahesh.bhavsar@example.com",
  nationality: "India",
  organization_id: "org-maple-law",
  created_at: "2026-11-01T09:30:00Z",
};

const RETAINED_CLIENT_USER: UserContext = {
  id: "client-bhavsar-501",
  email: "mahesh.bhavsar@example.com",
  full_name: "Maheshkumar Bhavsar",
  role: "retained_client",
  experience: "client_applicant",
  organization_id: "org-maple-law",
  organization_name: "Maple Legal Counsel LLP",
  permissions: [],
};

const PARALEGAL_USER: UserContext = {
  id: "staff-paralegal-01",
  email: "priya.nair@maplelaw.ca",
  full_name: "Priya Nair, RCIC",
  role: "case_worker",
  experience: "paralegal",
  organization_id: "org-maple-law",
  organization_name: "Maple Legal Counsel LLP",
  permissions: ["cases:read", "cases:write", "documents:verify"],
};

const MULTI_DOC_MERGED_PACKET_TEXT = `%PDF-1.4
--- PAGE 1 ---
REPUBLIC OF INDIA - PASSPORT
Surname: BHAVSAR
Given Names: MAHESHKUMAR RAMANLAL
Passport No: Z8834129
Date of Birth: 14/05/1964
Date of Issue: 10/03/2022
Date of Expiry: 09/03/2032
Place of Birth: AHMEDABAD, GUJARAT, INDIA
Sex: M
--- PAGE 2 ---
Address: 14 SHANTINIKETAN SOCIETY, NAVRANGPURA, AHMEDABAD 380009, INDIA
Father Name: RAMANLAL BHAVSAR
Mother Name: KANTABEN BHAVSAR
Spouse Name: REKHABEN MAHESHKUMAR BHAVSAR
--- PAGE 3 ---
GOVERNMENT OF GUJARAT - CERTIFICATE OF MARRIAGE
Husband: MAHESHKUMAR RAMANLAL BHAVSAR
Wife: REKHABEN PATEL
Date of Marriage: 22/11/1989
Place of Marriage: AHMEDABAD, INDIA
Registration No: AMC-MRG-1989-4412
--- PAGE 4 ---
CANADA REVENUE AGENCY - NOTICE OF ASSESSMENT
Taxpayer Name: AARAV BHAVSAR
Tax Year: 2025
Household Size: 4
Line 15000 - Total Income: $96,800.00 CAD
`;

describe("Zero-Stress Instant Raw Client/Sponsor Upload + Paralegal Workstation AI Lab + 'Only Ask What's Missing'", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearBackgroundIntakeJobs();
    clearRawPacketStoreInMemoryCache();
    window.history.pushState({}, "", "/");
  });

  describe("1. Retained Client Portal — Instant Raw Upload Without OCR/Sort Wait (EN / ગુજરાતી / हिन्दी)", () => {
    it("uploads a 42-page merged packet ONCE with raw_only=true, shows zero 'Sorting & extracting' progress bar, and queues raw packet for Paralegal AI Lab", async () => {
      let capturedFormData: FormData | null = null;
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockImplementation(async (fd: FormData) => {
        capturedFormData = fd;
        return {
          data: {
            id: "vault-raw-merged-1",
            title: "organized_1_merged.pdf",
            filename: "organized_1_merged.pdf",
            category: "supporting_evidence",
            file_size: "1.8 MB",
            sha256_hash: "sha256-raw-merged-1",
            status: "under_review",
            processing_status: "pending",
            verification_status: "unverified",
            uploaded_at: new Date().toISOString(),
          } as any,
          isLiveBackend: false,
        };
      });

      render(
        <ClientPortal
          myCase={RETAINED_CASE}
          documents={[]}
          messages={[]}
          currentUser={RETAINED_CLIENT_USER}
        />
      );

      const mergedPacket = new File([MULTI_DOC_MERGED_PACKET_TEXT], "organized_1_merged.pdf", {
        type: "application/pdf",
      });

      const dropzoneContainer = screen.getByTestId("client-home-smart-dropzone");
      const fileInput = within(dropzoneContainer).getByTestId("smart-dropzone-file-input");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mergedPacket] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("smart-dropzone-raw-receipt")).toBeDefined();
      });

      // Uploaded ONCE as raw untouched file — zero OCR/page-sorting wait on client's device!
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(capturedFormData?.get("raw_only")).toBe("true");
      expect(screen.queryByTestId("smart-dropzone-processing-bar")).toBeNull();
      expect(screen.queryByText(/Sorting & extracting/i)).toBeNull();
      expect(screen.queryByText(/Continue in Background/i)).toBeNull();
      expect(screen.queryByTestId("background-processing-tray")).toBeNull();

      // Reassuring queued banner visible to retained client
      expect(screen.getByTestId("client-raw-upload-queued-banner")).toBeDefined();

      // Switch language to Gujarati & Hindi and verify localized zero-stress confirmation
      fireEvent.click(screen.getByRole("button", { name: /ગુજરાતી/i }));
      expect(screen.getByTestId("client-raw-upload-queued-banner").textContent).toContain("અપલોડ પૂર્ણ");

      fireEvent.click(screen.getByRole("button", { name: /हिन्दी/i }));
      expect(screen.getByTestId("client-raw-upload-queued-banner").textContent).toContain("अपलोड पूर्ण");

      // Queued for Paralegal's local workstation AI Lab
      const pending = getPendingRawPacketsForCase(RETAINED_CASE.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].filename).toBe("organized_1_merged.pdf");
      expect(pending[0].uploaderRole).toBe("applicant");
      expect(pending[0].aiLabStatus).toBe("pending");
    });
  });

  describe("2. Sponsor Portal (/contribute) — Instant Raw Upload + Privacy Shield + Deferred Paralegal AI Lab", () => {
    it("uploads Sponsor CRA NOA directly as raw untouched file with Privacy Shield and zero OCR wait", async () => {
      const invite = createSponsorInviteLink({
        caseId: RETAINED_CASE.id,
        caseNumber: RETAINED_CASE.case_number,
        applicantName: RETAINED_CASE.client_name,
        pathway: RETAINED_CASE.visa_category,
        sponsorName: "Aarav Bhavsar",
        relationship: "child_grandchild",
        jurisdiction: "CA",
        privacyShield: true,
      });

      window.history.pushState({}, "", `/contribute?token=${invite.token}`);

      let capturedFormData: FormData | null = null;
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockImplementation(async (fd: FormData) => {
        capturedFormData = fd;
        return {
          data: {
            id: "vault-raw-sponsor-noa",
            title: "Aarav_CRA_NOA_2025.pdf",
            filename: "Aarav_CRA_NOA_2025.pdf",
            category: "financial_evidence",
            file_size: "420 KB",
            sha256_hash: "sha256-sponsor-noa",
            status: "under_review",
            processing_status: "pending",
            verification_status: "unverified",
            uploaded_at: new Date().toISOString(),
          } as any,
          isLiveBackend: false,
        };
      });

      render(<SponsorContributePage />);

      const sponsorNoa = new File(
        [
          `%PDF-1.4
          CANADA REVENUE AGENCY
          NOTICE OF ASSESSMENT
          Taxpayer Name: AARAV BHAVSAR
          Household Size: 4
          Line 15000 - Total Income: $96,800.00 CAD`,
        ],
        "Aarav_CRA_NOA_2025.pdf",
        { type: "application/pdf" }
      );

      const fileInput = screen.getByTestId("smart-dropzone-file-input");
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [sponsorNoa] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("smart-dropzone-raw-receipt")).toBeDefined();
      });

      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(capturedFormData?.get("raw_only")).toBe("true");
      expect(capturedFormData?.get("is_private_to_firm")).toBe("true");
      expect(screen.queryByTestId("smart-dropzone-processing-bar")).toBeNull();
      expect(screen.queryByTestId("background-processing-tray")).toBeNull();

      // Sponsor checklist item satisfied + Privacy Shield preserved
      const updatedInvite = getSponsorInviteByToken(invite.token);
      expect(updatedInvite?.uploadedItems.length).toBeGreaterThan(0);
      expect(updatedInvite?.uploadedItems[0].isPrivateToFirm).toBe(true);

      // Queued for Paralegal AI Lab
      const pending = getPendingRawPacketsForCase(RETAINED_CASE.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].uploaderRole).toBe("sponsor");
      expect(pending[0].privacyShield).toBe(true);
    });
  });

  describe("3. Firm Staff Immediate On-Workstation AI Lab Preserved (Q4)", () => {
    it("runs immediate local OCR & page-sorting when Firm Staff drops a file on a staff SmartDropzone", async () => {
      vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: {
          id: "vault-staff-1",
          title: "Staff_CRA_NOA.pdf",
          category: "financial_evidence",
          status: "verified",
          processing_status: "completed",
          verification_status: "verified",
          uploaded_at: new Date().toISOString(),
        } as any,
        isLiveBackend: false,
      });

      const onIntakeComplete = vi.fn();
      render(
        <SmartDropzone
          caseId={RETAINED_CASE.id}
          contributorRole="staff"
          uploadMode="immediate_ai"
          onIntakeComplete={onIntakeComplete}
        />
      );

      const file = new File(
        [
          `%PDF-1.4
          CANADA REVENUE AGENCY - NOTICE OF ASSESSMENT
          Line 15000 - Total Income: $91,200.00 CAD`,
        ],
        "Staff_CRA_NOA.pdf",
        { type: "application/pdf" }
      );

      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [file] },
        });
      });

      await waitFor(() => {
        expect(onIntakeComplete).toHaveBeenCalledTimes(1);
      });

      // Immediate AI Lab extraction summary rendered (not raw-only receipt)
      expect(screen.queryByTestId("smart-dropzone-raw-receipt")).toBeNull();
      expect(screen.getByTestId("smart-dropzone-results")).toBeDefined();
      expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(0);
    });
  });

  describe("4 & 5. Paralegal 3-Pane Studio AI Lab + Client 'Only Ask What's Missing' End-to-End Flow (Q1, Q2, Q3)", () => {
    it("processes untouched client & sponsor raw packets on Paralegal's workstation into Original + Sorted Sub-Documents with page ranges, bounding boxes, immediate Auto-Fill, and locked Client 'Only Ask What's Missing' flow", async () => {
      vi.spyOn(api, "uploadDocumentFile").mockImplementation(async (fd: FormData) => {
        const f = fd.get("file") as File;
        return {
          data: {
            id: `vault-${f.name.replace(/\W+/g, "-")}`,
            title: f.name,
            filename: f.name,
            category: "supporting_evidence",
            file_size: "1.2 MB",
            sha256_hash: `hash-${f.name}`,
            status: "under_review",
            processing_status: "pending",
            verification_status: "unverified",
            uploaded_at: new Date().toISOString(),
          } as any,
          isLiveBackend: false,
        };
      });

      // Step A: Retained Client uploads untouched merged family packet in ClientPortal
      const uploadedDocs: DocumentItem[] = [];
      const clientView = render(
        <ClientPortal
          myCase={RETAINED_CASE}
          documents={[]}
          messages={[]}
          currentUser={RETAINED_CLIENT_USER}
          onDocumentUpdated={(doc) => uploadedDocs.push(doc)}
        />
      );

      const mergedPacket = new File([MULTI_DOC_MERGED_PACKET_TEXT], "organized_1_merged.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(
          within(screen.getByTestId("client-home-smart-dropzone")).getByTestId(
            "smart-dropzone-file-input"
          ),
          { target: { files: [mergedPacket] } }
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("smart-dropzone-raw-receipt")).toBeDefined();
      });
      clientView.unmount();

      expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(1);

      // Step B: Assigned Paralegal opens SplitScreenCaseStudio on their workstation
      const onPushToForms = vi.fn();
      const onClientProfileAutoFilled = vi.fn();
      const studioAddedDocs: DocumentItem[] = [];

      const studioView = render(
        <SplitScreenCaseStudio
          caseItem={RETAINED_CASE}
          documents={uploadedDocs}
          client={RETAINED_CLIENT_PROFILE}
          onDocumentUploaded={(d) => studioAddedDocs.push(d)}
          onPushToForms={onPushToForms}
          onClientProfileAutoFilled={onClientProfileAutoFilled}
        />
      );

      // Top inbox banner shows pending raw upload + 1-click Run AI Lab button
      const rawBanner = screen.getByTestId("studio-raw-packets-banner");
      expect(rawBanner.textContent).toContain("organized_1_merged.pdf");

      const runAiLabBtn = screen.getByTestId("studio-run-ai-lab-btn");
      await act(async () => {
        fireEvent.click(runAiLabBtn);
      });

      await waitFor(() => {
        expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(0);
      });

      // Left Pane: Untouched Original Packet preserved alongside Child Sorted Sub-Documents with page ranges
      const leftPane = screen.getByTestId("studio-left-document-pane");
      const packetTree = within(leftPane).getByTestId("studio-packet-tree");
      expect(packetTree.textContent).toContain("organized_1_merged.pdf");
      expect(packetTree.textContent).toMatch(/Original/i);

      const processedPackets = getRawPacketsForCase(RETAINED_CASE.id);
      expect(processedPackets[0].aiLabStatus).toBe("completed");
      expect(processedPackets[0].sortedChildren.length).toBeGreaterThanOrEqual(2);

      // Verify child sub-documents render with explicit page ranges (e.g. Page 1 / Pages 1–2)
      const firstChild = processedPackets[0].sortedChildren[0];
      expect(screen.getByTestId(`sorted-subdoc-range-${firstChild.id}`).textContent).toMatch(
        /Page/i
      );

      // Center Pane: Renders live page + spatial OCR bounding boxes
      const centerPane = screen.getByTestId("studio-center-canvas-pane");
      expect(within(centerPane).getByTestId("studio-document-page")).toBeDefined();
      const bboxButtons = centerPane.querySelectorAll('[data-testid^="studio-bbox-"]');
      expect(bboxButtons.length).toBeGreaterThan(0);

      // Right Pane: Renders Auto-Filled Initial Information Sheet summary + Role Graph + Statutory Calculators
      const rightPane = screen.getByTestId("studio-right-intelligence-pane");
      expect(within(rightPane).getByTestId("studio-initial-sheet-summary")).toBeDefined();
      expect(within(rightPane).getByTestId("studio-role-graph")).toBeDefined();
      expect(within(rightPane).getByTestId("studio-statutory-calculators")).toBeDefined();

      // Immediate auto-fill persisted for Paralegal (Initial Information Sheet + Client Profile + Gov Forms)
      expect(onPushToForms).toHaveBeenCalled();
      expect(onClientProfileAutoFilled).toHaveBeenCalled();

      const savedSheet = getSavedInitialInfoSheetRecord(RETAINED_CASE.id);
      expect(savedSheet?.formData?.family_name).toBeTruthy();
      const provenance = getAutoFillProvenance(RETAINED_CASE.id);
      expect(provenance.family_name?.is_confirmed).toBe(true);
      expect(provenance.family_name?.locked_by_ai_lab).toBe(true);

      // Paralegal clicks 1-click "Ask Client Only What's Missing"
      const askMissingBtn = screen.getByTestId("studio-request-missing-gaps-btn");
      fireEvent.click(askMissingBtn);

      const missingReq = getMissingQuestionsRequest(RETAINED_CASE.id);
      expect(missingReq?.explicitlyPromptedByParalegal).toBe(true);
      expect(missingReq?.missingGaps.length).toBeGreaterThan(0);

      studioView.unmount();

      // Step C: Retained Client opens ClientPortal — all AI fields are already locked/verified,
      // and Client is ONLY prompted for remaining non-document gaps!
      render(
        <ClientPortal
          myCase={RETAINED_CASE}
          documents={[...uploadedDocs, ...studioAddedDocs]}
          messages={[]}
          currentUser={RETAINED_CLIENT_USER}
        />
      );

      const onlyMissingCard = screen.getByTestId("client-only-ask-whats-missing-card");
      expect(onlyMissingCard.textContent).toMatch(/Only Answer What's Missing/i);

      fireEvent.click(screen.getByTestId("client-open-missing-questions-btn"));

      // InitialInformationSheet opens directly in "Only Ask What's Missing" mode!
      const missingBanner = screen.getByTestId("sheet-only-missing-banner");
      expect(missingBanner.textContent).toMatch(/Only Ask What's Missing/i);

      // Expand all 11 sections briefly to verify AI-filled fields are pre-completed & locked (readOnly) unless unlocked
      fireEvent.click(screen.getByTestId("sheet-sidebar-show-all-btn"));
      fireEvent.click(screen.getByRole("button", { name: /1\. Main Applicant Biodata/i }));

      const surnameInput = screen.getByDisplayValue(
        savedSheet!.formData.family_name
      ) as HTMLInputElement;
      expect(surnameInput.readOnly).toBe(true);

      // Client can unlock to edit if needed, then re-lock
      const unlockSurnameBtn = screen.getByTestId("unlock-ai-field-family_name");
      fireEvent.click(unlockSurnameBtn);
      expect(surnameInput.readOnly).toBe(false);
      fireEvent.click(unlockSurnameBtn);
      expect(surnameInput.readOnly).toBe(true);

      // Complete the 3 non-document gaps cleanly (Refusals, Travel, E-Signature)
      fireEvent.click(screen.getByTestId("sheet-missing-gap-pill-entry_refusals"));
      fireEvent.click(screen.getByTestId("confirm-no-refusals-checkbox"));

      fireEvent.click(screen.getByTestId("sheet-missing-gap-pill-travel"));
      fireEvent.click(screen.getByTestId("confirm-no-travel-checkbox"));

      fireEvent.click(screen.getByTestId("sheet-missing-gap-pill-declaration"));
      const declCheckbox = screen.getByRole("checkbox", {
        name: /I confirm and agree to this statutory declaration/i,
      });
      fireEvent.click(declCheckbox);
      fireEvent.change(screen.getByPlaceholderText(/Type your full legal name to sign/i), {
        target: { value: "Maheshkumar Ramanlal Bhavsar" },
      });

      // All missing non-document gaps are now resolved!
      expect(screen.getByTestId("sheet-only-missing-banner").textContent).toMatch(
        /All non-document disclosures and your e-signature are complete/i
      );
    });
  });

  describe("6. Adversarial Edge Cases & Reload Persistence", () => {
    it("rejects 0-byte empty files cleanly without crashing or queuing corrupt raw packets", async () => {
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile");

      render(
        <SmartDropzone
          caseId={RETAINED_CASE.id}
          contributorRole="applicant"
          uploadMode="raw_only"
        />
      );

      const emptyFile = new File([], "empty_0_bytes.pdf", { type: "application/pdf" });
      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [emptyFile] },
        });
      });

      expect(uploadSpy).not.toHaveBeenCalled();
      expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(0);
      expect(screen.getByRole("alert").textContent).toMatch(/empty \(0 bytes\)/i);
    });

    it("handles empty file lists as a clean no-op and reconstructs raw packets from localStorage after browser reload", async () => {
      vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: {
          id: "vault-reload-pkt",
          title: "Reload_Passport_Packet.pdf",
          filename: "Reload_Passport_Packet.pdf",
          category: "identity_passport",
          status: "under_review",
          processing_status: "pending",
          verification_status: "unverified",
          uploaded_at: new Date().toISOString(),
        } as any,
        isLiveBackend: false,
      });

      const dz = render(
        <SmartDropzone
          caseId={RETAINED_CASE.id}
          contributorRole="applicant"
          uploadMode="raw_only"
        />
      );

      // Empty file list no-op
      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [] },
        });
      });
      expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(0);

      // Upload valid raw passport packet
      const passportPacket = new File([MULTI_DOC_MERGED_PACKET_TEXT], "Reload_Passport_Packet.pdf", {
        type: "application/pdf",
      });
      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [passportPacket] },
        });
      });

      await waitFor(() => {
        expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(1);
      });
      dz.unmount();

      // Simulate full browser reload / separate Paralegal device session by clearing in-memory File cache!
      clearRawPacketStoreInMemoryCache();

      // Render EmployeeWorkspace in Studio view and verify badge + AI Lab reconstruction works!
      render(
        <EmployeeWorkspace
          cases={[RETAINED_CASE]}
          clients={[RETAINED_CLIENT_PROFILE]}
          documents={[]}
          currentUser={PARALEGAL_USER}
        />
      );

      // Navigate to Case Studio inside EmployeeWorkspace
      const studioBtns = screen.getAllByRole("button", { name: /Case Studio|Studio/i });
      fireEvent.click(studioBtns[0]);

      await waitFor(() => {
        expect(screen.getByTestId("studio-run-ai-lab-btn")).toBeDefined();
      });
      expect(screen.getByTestId("workspace-pending-raw-packets-badge")).toBeDefined();

      // Rapid double-click on Run AI Lab should process cleanly once without duplicating
      const runBtn = screen.getByTestId("studio-run-ai-lab-btn");
      await act(async () => {
        fireEvent.click(runBtn);
        fireEvent.click(runBtn);
      });

      await waitFor(() => {
        expect(getPendingRawPacketsForCase(RETAINED_CASE.id)).toHaveLength(0);
      });
      expect(screen.queryByTestId("workspace-pending-raw-packets-badge")).toBeNull();
      expect(getRawPacketsForCase(RETAINED_CASE.id)[0].sortedChildren.length).toBeGreaterThanOrEqual(2);
    });
  });
});
