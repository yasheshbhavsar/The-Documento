import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SmartDropzone } from "../components/common/SmartDropzone";
import { BackgroundProcessingTray } from "../components/common/BackgroundProcessingTray";
import {
  clearBackgroundIntakeJobs,
  completeBackgroundIntakeJob,
  enqueueBackgroundIntakeJob,
} from "../lib/backgroundIntakeStore";
import {
  buildSponsorShareUrl,
  createSponsorInviteLink,
  getSponsorInviteByToken,
  getSponsorInvitesForCase,
} from "../lib/sponsorContributorStore";
import SponsorContributePage from "../app/contribute/page";
import { DocumentUploadModal } from "../components/modals/DocumentUploadModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { JURISDICTION_PATHWAYS } from "../components/modals/CreateCaseModal";
import * as documentAutoFillEngine from "../lib/documentAutoFillEngine";
import { api } from "../lib/api";

describe("Workstream C: SmartDropzone, Background Tray, Sponsor /contribute Portal & 1-Click Express Onboarding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearBackgroundIntakeJobs();
    window.history.pushState({}, "", "/");
  });

  describe("1. BackgroundProcessingTray & backgroundIntakeStore", () => {
    it("renders null when idle and displays live progress, completion summary, and dismiss action when active", async () => {
      const { container } = render(<BackgroundProcessingTray />);
      expect(container.firstChild).toBeNull();

      let jobId = "";
      act(() => {
        const job = enqueueBackgroundIntakeJob({
          caseId: "case-bg-1",
          filename: "Family_Sponsor_Packet.pdf",
          currentPage: 18,
          totalPages: 42,
          progressText: "Sorting & extracting Family_Sponsor_Packet.pdf — Page 18 of 42...",
        });
        jobId = job.id;
      });

      expect(screen.getByTestId("background-processing-tray")).toBeDefined();
      expect(
        screen.getByText(/Sorting & extracting Family_Sponsor_Packet\.pdf — Page 18 of 42\.\.\./i)
      ).toBeDefined();

      act(() => {
        completeBackgroundIntakeJob(jobId, {
          completionSummary:
            "✓ 6 documents sorted across Applicant & Canadian Sponsor — Ready for 1-Click Pre-Fill",
          documentsProduced: 6,
          pendingPrefillCount: 5,
          totalPages: 42,
        });
      });

      expect(
        screen.getByText(
          /✓ 6 documents sorted across Applicant & Canadian Sponsor — Ready for 1-Click Pre-Fill/i
        )
      ).toBeDefined();
      expect(screen.getByText(/✨ Apply 5 Extracted Fields/i)).toBeDefined();

      fireEvent.click(screen.getByTestId(`dismiss-bg-job-${jobId}`));
      await waitFor(() => {
        expect(screen.queryByTestId("background-processing-tray")).toBeNull();
      });
    });
  });

  describe("2. Unified SmartDropzone (Single File, Multi-File, Merged Packet, 1-Click Auto-Fill & GU/HI Localization)", () => {
    it("recognizes CRA NOA Line 15000, uploads ONCE, stages auto-fill for 1-click confirmation, and opens Forensics drawer", async () => {
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: {
          id: "vault-doc-cra-1",
          title: "CRA Notice of Assessment (Line 15000)",
          category: "financial_evidence",
          file_size: "120 KB",
          sha256_hash: "abc123def456",
          version: 1,
          is_current_version: true,
          status: "verified",
          processing_status: "completed",
          verification_status: "verified",
          uploaded_at: new Date().toISOString(),
        } as any,
        isLiveBackend: false,
      });
      const persistSpy = vi.spyOn(documentAutoFillEngine, "persistAndBroadcastAutoFill");
      const onIntakeComplete = vi.fn();
      const onDocumentUploaded = vi.fn();

      render(
        <SmartDropzone
          caseId="case-sv-101"
          pathway="Canada Super Visa (Parents & Grandparents)"
          onIntakeComplete={onIntakeComplete}
          onDocumentUploaded={onDocumentUploaded}
        />
      );

      const craFile = new File(
        [
          `%PDF-1.4
          CANADA REVENUE AGENCY
          NOTICE OF ASSESSMENT
          Taxpayer Name: ROHAN DESHMUKH
          Household Size: 4
          Line 15000 - Total Income: $88,400.00 CAD`,
        ],
        "CRA_NOA_2024_Rohan_Deshmukh.pdf",
        { type: "application/pdf" }
      );

      const fileInput = screen.getByTestId("smart-dropzone-file-input");
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [craFile] } });
      });

      await waitFor(() => {
        expect(onIntakeComplete).toHaveBeenCalledTimes(1);
      });

      // Single upload invariant — never double-uploaded!
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(onDocumentUploaded).toHaveBeenCalledTimes(1);

      // Should NOT silently overwrite confirmed profile before user clicks 1-click confirm button
      expect(persistSpy).not.toHaveBeenCalled();

      expect(screen.getByText(/Super Visa LICO Met \(\+\$29,806 CAD surplus\)/i)).toBeDefined();
      expect(screen.getByText(/Overseas Sponsor \/ Host \(CA\)/i)).toBeDefined();

      // Click 1-click confirmed auto-fill button
      const applyBtn = screen.getByTestId("smart-dropzone-apply-autofill-btn");
      expect(applyBtn.textContent).toMatch(/✨ Apply \d+ Extracted Fields to Profile & Forms/);
      fireEvent.click(applyBtn);

      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("smart-dropzone-autofill-confirmed")).toBeDefined();

      // Open power-user Forensics & Bounding Boxes drawer
      fireEvent.click(screen.getByTestId("smart-dropzone-forensics-toggle"));
      expect(screen.getByTestId("smart-dropzone-forensics-drawer")).toBeDefined();
      expect(screen.getByText(/QR_CODE/i)).toBeDefined();
      expect(screen.getAllByText(/bbox \[/i).length).toBeGreaterThan(0);
    });

    it("sorts multiple loose files (Applicant Passport + Canadian Sibling PR Card + Hydro Bill) and verifies +15 CRS Sibling", async () => {
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockImplementation(async (fd: FormData) => {
        const f = fd.get("file") as File;
        return {
          data: {
            id: `doc-${f?.name}`,
            title: f?.name || "Doc",
            category: "identity_passport",
            file_size: "90 KB",
            sha256_hash: "sha256mock",
            version: 1,
            is_current_version: true,
            status: "verified",
            processing_status: "completed",
            verification_status: "verified",
            uploaded_at: new Date().toISOString(),
          } as any,
          isLiveBackend: false,
        };
      });

      const onIntakeComplete = vi.fn();
      render(<SmartDropzone caseId="case-ee-202" onIntakeComplete={onIntakeComplete} />);

      const passportFile = new File(
        ["%PDF-1.4\nPASSPORT\nPassport No: Z8492014\nSurname: SHARMA\nGiven Names: AARAV"],
        "Aarav_Sharma_Passport.pdf",
        { type: "application/pdf" }
      );
      const siblingPrFile = new File(
        ["%PDF-1.4\nPERMANENT RESIDENT CARD\nName: PRIYA SHARMA\nCanadian Sibling +15 CRS\nShared Parent: RAJESH SHARMA"],
        "Sibling_Canadian_PR_Card.pdf",
        { type: "application/pdf" }
      );
      const hydroFile = new File(
        ["%PDF-1.4\nToronto Hydro Utility Bill\nName: PRIYA SHARMA\nCanadian Sibling Residency"],
        "Toronto_Hydro_Sibling_Bill.pdf",
        { type: "application/pdf" }
      );

      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [passportFile, siblingPrFile, hydroFile] },
        });
      });

      await waitFor(() => {
        expect(onIntakeComplete).toHaveBeenCalledTimes(1);
      });

      expect(uploadSpy).toHaveBeenCalledTimes(3);
      const summary = onIntakeComplete.mock.calls[0][0];
      expect(summary.totalFilesDropped).toBe(3);
      expect(summary.totalDocumentsProduced).toBe(3);
      expect(summary.statutoryHighlights).toContain("+15 CRS Canadian Sibling Verified");
    });

    it("splits a merged multi-person family + sponsor PDF packet and renders Gujarati & Hindi UI localization", async () => {
      vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: { id: "doc-pkt", title: "Split Doc", category: "identity_passport" } as any,
        isLiveBackend: false,
      });

      const onIntakeComplete = vi.fn();
      const { rerender } = render(
        <SmartDropzone caseId="case-pkt-1" language="gu" onIntakeComplete={onIntakeComplete} />
      );

      expect(screen.getByText(/ફાઇલો પસંદ કરો/)).toBeDefined();

      rerender(
        <SmartDropzone caseId="case-pkt-1" language="hi" onIntakeComplete={onIntakeComplete} />
      );
      expect(screen.getByText(/फ़ाइलें चुनें/)).toBeDefined();

      const mergedPacket = new File(
        [
          [
            "--- PAGE 1 ---",
            "REPUBLIC OF INDIA - PASSPORT",
            "Type: P Code: IND Passport No: M4455667",
            "Surname: DESHMUKH",
            "Given Names: RAJESH",
            "Nationality: IND",
            "--- PAGE 2 ---",
            "GOVERNMENT OF MAHARASHTRA - CERTIFICATE OF MARRIAGE",
            "Registration No: MH-MRG-2019-9012",
            "Husband: RAJESH DESHMUKH",
            "Wife: MEERA DESHMUKH",
            "Date of Marriage: 14 NOV 2019",
            "--- PAGE 3 ---",
            "CANADA REVENUE AGENCY - NOTICE OF ASSESSMENT",
            "Taxpayer Name: PRIYA DESHMUKH",
            "Household Size: 4",
            "Line 15000 - Total Income: $98,400.00 CAD",
            "--- PAGE 4 ---",
            "SUPER VISA $100,000 CAD MEDICAL INSURANCE POLICY",
            "Sponsor Name: PRIYA DESHMUKH",
            "Coverage Amount: $150,000 CAD for 365 days",
          ].join("\n"),
        ],
        "Deshmukh_Family_Sponsor_Packet.pdf",
        { type: "application/pdf" }
      );

      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [mergedPacket] },
        });
      });

      await waitFor(() => {
        expect(onIntakeComplete).toHaveBeenCalledTimes(1);
      });

      const summary = onIntakeComplete.mock.calls[0][0];
      expect(summary.totalFilesDropped).toBe(1);
      expect(summary.totalDocumentsProduced).toBeGreaterThanOrEqual(4);
      expect(summary.documents.some((d: any) => d.personRole === "principal_applicant")).toBe(true);
      expect(summary.documents.some((d: any) => d.personRole === "spouse_partner")).toBe(true);
      expect(summary.documents.some((d: any) => d.personRole === "overseas_sponsor_host")).toBe(true);
    });
  });

  describe("3. Sponsor Contributor Store & Passwordless /contribute Privacy-Shield Portal", () => {
    it("creates jurisdiction-specific checklists, defaults Privacy Shield ON, and marks checklist items Verified when Sponsor uploads", async () => {
      vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: { id: "spn-vault-1", title: "CRA NOA", category: "financial_evidence" } as any,
        isLiveBackend: false,
      });

      const invite = createSponsorInviteLink({
        caseId: "case-supervisa-77",
        caseNumber: "CASE-SV-7701",
        applicantName: "Rameshbhai Deshmukh",
        pathway: "Canada Super Visa (Parents & Grandparents)",
        sponsorName: "Rohan Deshmukh",
        relationship: "child_grandchild",
        jurisdiction: "CA",
      });

      expect(invite.privacyShield).toBe(true);
      expect(invite.requestedItems.some((i) => i.label.includes("CRA Notice of Assessment"))).toBe(true);
      expect(buildSponsorShareUrl(invite.token)).toContain(`/contribute?token=${encodeURIComponent(invite.token)}`);

      // Also verify UK and AU templates populate smart checklist items
      const ukInvite = createSponsorInviteLink({
        caseId: "case-uk-1",
        sponsorName: "Devesh Patel",
        relationship: "uk_sponsor",
        jurisdiction: "UK",
      });
      expect(ukInvite.requestedItems.some((i) => i.label.includes("HMRC P60"))).toBe(true);

      const auInvite = createSponsorInviteLink({
        caseId: "case-au-1",
        sponsorName: "Meera Patel",
        relationship: "au_sponsor",
        jurisdiction: "AU",
      });
      expect(auInvite.requestedItems.some((i) => i.label.includes("VEVO"))).toBe(true);

      // Navigate to /contribute?token=...
      window.history.pushState({}, "", `/contribute?token=${invite.token}`);
      render(<SponsorContributePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Supporting Documents for Rameshbhai's Canada Super Visa/i)
        ).toBeDefined();
      });

      // Privacy Shield is ON by default with exact counsel-only encryption notice
      expect(
        screen.getByText(
          /🔒 Privacy Shield Active: Your raw CRA NOA, tax slips, and bank statements are encrypted for licensed legal counsel only\. Family members see only '✓ Verified'\./i
        )
      ).toBeDefined();

      // Switch to Gujarati and back to English
      fireEvent.click(screen.getByTestId("contribute-lang-gu"));
      expect(screen.getAllByText(/પ્રાઇવસી શિલ્ડ સક્રિય/).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByTestId("contribute-lang-en"));

      // Sponsor drops CRA NOA into embedded SmartDropzone
      const craNoaFile = new File(
        ["%PDF-1.4\nCANADA REVENUE AGENCY\nNOTICE OF ASSESSMENT\nLine 15000: $94,000 CAD"],
        "Rohan_CRA_NOA_2024.pdf",
        { type: "application/pdf" }
      );
      await act(async () => {
        fireEvent.change(screen.getByTestId("smart-dropzone-file-input"), {
          target: { files: [craNoaFile] },
        });
      });

      await waitFor(() => {
        const updated = getSponsorInviteByToken(invite.token);
        expect(updated?.uploadedItems.length).toBe(1);
        expect(updated?.uploadedItems[0].isPrivateToFirm).toBe(true);
        const noaChecklist = updated?.requestedItems.find((i) => i.id === "ca-cra-noa");
        expect(noaChecklist?.satisfied).toBe(true);
      });

      expect(screen.getByTestId("sponsor-uploaded-receipts")).toBeDefined();
      expect(screen.getByText(/🔒 Counsel-Only Encrypted/i)).toBeDefined();
    });
  });

  describe("4. DocumentUploadModal Single-Upload Fix & Auto-Category Detection", () => {
    it("auto-detects UK HMRC P60 financial category and uploads file ONCE without double HTTP requests", async () => {
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockResolvedValue({
        data: {
          id: "doc-uk-p60",
          title: "UK_Sponsor_HMRC_P60",
          category: "financial_evidence",
          file_size: "64 KB",
          sha256_hash: "ab12cd34",
          version: 1,
          is_current_version: true,
          status: "verified",
          processing_status: "completed",
          verification_status: "verified",
          uploaded_at: new Date().toISOString(),
        } as any,
        isLiveBackend: false,
      });
      const fetchSpy = vi.spyOn(global, "fetch");
      const onUploaded = vi.fn();
      const onClose = vi.fn();

      render(
        <DocumentUploadModal
          isOpen={true}
          onClose={onClose}
          caseId="case-uk-99"
          onDocumentUploaded={onUploaded}
        />
      );

      const p60File = new File(
        ["%PDF-1.4\nHMRC P60 End of Year Certificate\nTotal Gross Pay £54,200.00 GBP"],
        "UK_Sponsor_HMRC_P60.pdf",
        { type: "application/pdf" }
      );

      const input = document.getElementById("file-upload-input") as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [p60File] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("upload-autodetected-summary")).toBeDefined();
      });

      const uploadBtn = screen.getByRole("button", { name: /Upload & Run Extraction/i });
      await act(async () => {
        fireEvent.click(uploadBtn);
      });

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledTimes(1);
        expect(onUploaded).toHaveBeenCalledTimes(1);
      });
      // Confirm no duplicate HTTP POST to /extractor/analyze occurred!
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("5. CreateCaseModal New Pathways & CreateClientModal 1-Click Express Launch", () => {
    it("exposes CA Super Visa, UK Family Sponsored, and AU Subclass 600 Sponsored pathways while preserving default order", () => {
      expect(
        JURISDICTION_PATHWAYS["Canada (IRCC)"].some(
          (p) => p.value === "Canada Super Visa (Parents & Grandparents)"
        )
      ).toBe(true);
      expect(JURISDICTION_PATHWAYS["United Kingdom (Home Office)"][0].value).toBe(
        "UK Standard Visitor Visa"
      );
      expect(
        JURISDICTION_PATHWAYS["United Kingdom (Home Office)"].some(
          (p) => p.value === "UK Standard Visitor (Family Sponsored)"
        )
      ).toBe(true);
      expect(
        JURISDICTION_PATHWAYS["Australia (Home Affairs)"].some(
          (p) => p.value === "Australia Visitor Visa (Subclass 600 Sponsored)"
        )
      ).toBe(true);
    });

    it("attaches all dropped onboarding files to Case Vault, auto-creates Sponsor Invite Link, and passes skipKickoffModal on 1-Click Express Launch", async () => {
      const uploadSpy = vi.spyOn(api, "uploadDocumentFile").mockImplementation(async (fd: FormData) => {
        const f = fd.get("file") as File;
        return {
          data: {
            id: `vault-${f?.name}`,
            case_id: String(fd.get("case_id") || ""),
            title: String(fd.get("title") || f?.name),
            category: "identity_passport",
            file_size: "80 KB",
            sha256_hash: "hash123",
            version: 1,
            is_current_version: true,
            status: "verified",
            processing_status: "completed",
            verification_status: "verified",
            uploaded_at: new Date().toISOString(),
          } as any,
          isLiveBackend: false,
        };
      });

      const onClientCreated = vi.fn();
      const onCaseCreated = vi.fn();
      const onClose = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={onClose}
          onClientCreated={onClientCreated}
          onCaseCreated={onCaseCreated}
          clients={[]}
        />
      );

      const passportFile = new File(
        [
          `%PDF-1.4
          PASSPORT
          Type: P Country Code: IND Passport No: Z7744112
          Surname: PATEL
          Given Names: HARISHBHAI`,
        ],
        "Harishbhai_Passport.pdf",
        { type: "application/pdf" }
      );
      const sponsorNoaFile = new File(
        [
          `%PDF-1.4
          CANADA REVENUE AGENCY - NOTICE OF ASSESSMENT
          Taxpayer Name: KRUNAL PATEL
          Line 15000 - Total Income: $92,000.00 CAD`,
        ],
        "Krunal_Sponsor_CRA_NOA.pdf",
        { type: "application/pdf" }
      );

      const fileInput = screen.getByTestId("client-autofill-file-input");
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [passportFile, sponsorNoaFile] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("onboarding-queued-vault-badge").textContent).toContain(
          "2 files queued for Case Vault"
        );
        expect(screen.getByDisplayValue("PATEL")).toBeDefined();
      });

      // Click 1-Click Express Launch right from Step 1!
      const expressBtn = screen.getByTestId("express-launch-client-case-btn");
      await act(async () => {
        fireEvent.click(expressBtn);
      });

      await waitFor(() => {
        expect(onClientCreated).toHaveBeenCalledTimes(1);
        expect(onCaseCreated).toHaveBeenCalledTimes(1);
      });

      // Verify both dropped onboarding files were automatically uploaded into the new Case Vault!
      expect(uploadSpy).toHaveBeenCalledTimes(2);

      const [createdCase, , isNewOnboarding, expressOpts] = onCaseCreated.mock.calls[0];
      expect(isNewOnboarding).toBe(true);
      expect(createdCase.jurisdiction).toBe("Canada (IRCC)");
      expect(createdCase.visa_category).toBe("Canada Super Visa (Parents & Grandparents)");
      expect(expressOpts?.skipKickoffModal).toBe(true);
      expect(expressOpts?.uploadedDocs?.length).toBe(2);

      // Verify Shareable Sponsor Upload Link was auto-created for the case!
      const invites = getSponsorInvitesForCase(createdCase.id);
      expect(invites.length).toBe(1);
      expect(invites[0].jurisdiction).toBe("CA");
      expect(invites[0].privacyShield).toBe(true);
    });
  });
});
