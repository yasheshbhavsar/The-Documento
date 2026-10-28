import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { DocumentUploadStandardsFAQ } from "../components/portal/DocumentUploadStandardsFAQ";
import { ClientProfileScopeView } from "../components/portal/ClientProfileScopeView";
import { InitialInformationSheet } from "../components/portal/InitialInformationSheet";
import {
  FIXTURE_CASES,
  FIXTURE_DOCUMENTS,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_INVOICES,
} from "../lib/api";
import { ImmigrationCase } from "../lib/types";

const SPOUSAL_CASE_FIXTURE: ImmigrationCase = {
  id: "case-ca-spousal",
  case_number: "CASE-CA-2026-SP",
  title: "In-Canada Spousal Sponsorship (Family Class / SCLPC)",
  client_id: "client-01",
  client_name: "Primary Applicant",
  jurisdiction: "Canada (IRCC)",
  visa_category: "In-Canada Spousal Sponsorship (Family Class / SCLPC)",
  status: "gathering",
  readiness_score: 85,
  assigned_manager: "Sarah Jenkins, Esq.",
  deadline: "2026-12-15",
  organization_id: "org-01",
  created_at: "2026-08-10T10:00:00Z",
};

describe("Retained Client Dashboard — Streamlined Overview, Scope, Intake & OCR FAQ", () => {
  describe("1. Overview Panel — Active Visa File Scope & Composition", () => {
    it("renders clean pending state when class of application has not been selected by owner/manager", () => {
      render(
        <ClientPortal
          myCase={null}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // Verify clean pending state is displayed
      expect(screen.getByTestId("overview-visa-scope-pending")).toBeDefined();
      expect(screen.getByText(/Class of Application Pending Selection/i)).toBeDefined();
      expect(screen.getByText(/Awaiting Owner \/ Manager Classification/i)).toBeDefined();
      expect(screen.queryByText(/STATUTORY FORMS COMPILED/i)).toBeNull();
      expect(screen.queryByText(/6 Government Petition Forms/i)).toBeNull();
    });

    it("renders the active visa file in preparation, processing office, and included family members once class of application is selected", () => {
      render(
        <ClientPortal
          myCase={SPOUSAL_CASE_FIXTURE}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // Verify Visa File Scope card is present with active category
      expect(screen.getByText(/Client Profile & Active Visa File Scope/i)).toBeDefined();
      expect(screen.getAllByText(/In-Canada Spousal Sponsorship \(Family Class \/ SCLPC\)/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Supervised by Sarah Jenkins, Esq\./i)).toBeDefined();

      // Verify matter composition (Family members)
      expect(screen.getAllByText(/Principal Applicant & Sponsor/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Principal Beneficiary \/ Retained Client/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Sponsor \/ Spouse/i).length).toBeGreaterThan(0);

      // Verify statutory forms compiled
      expect(screen.getAllByText(/IMM 0008/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/IMM 5532/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/IMM 5669/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/IMM 5406/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/IMM 1344/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/SOWP/i).length).toBeGreaterThan(0);
    });
  });

  describe("2. Overview Panel — Required Document List & Live Status", () => {
    it("renders clean zero-state when no evidentiary documents are uploaded", () => {
      const handleOpenUpload = vi.fn();
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={[]}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleOpenUpload}
        />
      );

      expect(screen.getAllByText(/Required Document List & Live Status/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/0 Documents Uploaded/i)).toBeDefined();
      expect(screen.getByTestId("no-documents-uploaded")).toBeDefined();
      expect(screen.getByText(/No Evidentiary Documents Uploaded Yet/i)).toBeDefined();

      const uploadBtn = screen.getByRole("button", { name: /\+ Upload First Evidence File/i });
      fireEvent.click(uploadBtn);
      expect(handleOpenUpload).toHaveBeenCalled();
    });

    it("renders uploaded documents list with live status indicators and 4-step pipeline", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      expect(screen.getAllByText(/Required Document List & Live Status/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/7 Documents Uploaded/i)).toBeDefined();

      // Verify actual uploaded document items
      expect(screen.getByText(/US_Passport_Biodata_Elena_Rostova.pdf/i)).toBeDefined();
      expect(screen.getByText(/Stanford_PhD_Diploma_Certificate.pdf/i)).toBeDefined();

      // Verify pipeline stepper
      expect(screen.getAllByText(/Pipeline:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/● 1\. Uploaded/i).length).toBeGreaterThan(0);
    });

    it("displays correction required alert and allows re-uploading flagged evidence", () => {
      const handleOpenUpload = vi.fn();
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleOpenUpload}
        />
      );

      // Verify rejection callout
      expect(screen.getAllByText(/CORRECTION REQUIRED/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Low scan resolution/i).length).toBeGreaterThan(0);

      // Click Re-Upload Document button
      const reuploadBtns = screen.getAllByText(/Re-Upload Document →/i);
      expect(reuploadBtns.length).toBeGreaterThan(0);
      fireEvent.click(reuploadBtns[0]);
      expect(handleOpenUpload).toHaveBeenCalled();
    });

    it("filters required documents by action needed, under review, and accepted", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // Filter by Correction Required
      const correctionFilterBtn = screen.getByRole("button", { name: /Correction Required/i });
      fireEvent.click(correctionFilterBtn);

      // Only rejected document should show
      expect(screen.getAllByText(/Certified_Apostille_Birth_Record.pdf/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/US_Passport_Biodata_Elena_Rostova.pdf/i)).toBeNull();
    });
  });

  describe("3. Overview Panel — Required / Pending Initial Information Sheet", () => {
    it("renders 95% completion meter and previews key sections from SkySail intake PDF", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      expect(screen.getAllByText(/Required \/ Pending Initial Information Sheet/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/95% Complete/i).length).toBeGreaterThan(0);

      // Check section previews
      expect(screen.getAllByText(/1\. Main Applicant Biodata/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/4\. 10-Yr Education History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5\. 10-Yr Employment History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/6\. 10-Yr Travel History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/10\. Sponsor & Relationship/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/11\. Statutory Declaration/i).length).toBeGreaterThan(0);
    });

    it("opens the Initial Information Sheet modal when clicking the action button", () => {
      render(
        <ClientPortal
          myCase={null}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      const openSheetBtn = screen.getByRole("button", { name: /Open \/ Complete Information Sheet →/i });
      fireEvent.click(openSheetBtn);

      // Modal should open with full 12-page digital intake form
      expect(screen.getAllByText(/Main Applicant Initial Information Sheet/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Applicant Intake In Progress/i).length).toBeGreaterThan(0);
    });
  });

  describe("4. Overview Panel — Chat with Assigned Case Processing Officer", () => {
    it("renders Officer Sarah Jenkins, Esq., online badge, and quick prompt chips", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      expect(screen.getAllByText(/Officer Sarah Jenkins, Esq\./i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ONLINE NOW/i).length).toBeGreaterThan(0);

      // Verify quick inquiry chips
      expect(screen.getAllByText(/How long will the IRCC AOR take after filing\?/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Does the spousal residential lease need both our signatures\?/i).length).toBeGreaterThan(0);
    });

    it("pre-populates message input when clicking prompt chip and sends message", () => {
      const handleSendMessage = vi.fn();
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onSendMessage={handleSendMessage}
        />
      );

      const promptChip = screen.getByText(/How long will the IRCC AOR take after filing\?/i);
      fireEvent.click(promptChip);

      // Verify input populated
      const chatInput = screen.getByPlaceholderText(/Type a direct message to Officer Sarah Jenkins, Esq/i) as HTMLInputElement;
      expect(chatInput.value).toContain("How long will the IRCC AOR take after filing?");

      // Click Send
      const sendBtn = screen.getByRole("button", { name: /Send Message →/i });
      fireEvent.click(sendBtn);

      expect(handleSendMessage).toHaveBeenCalledWith(expect.stringContaining("How long will the IRCC AOR take after filing?"));
      expect(screen.getAllByText(/Message delivered to Officer Sarah Jenkins, Esq/i).length).toBeGreaterThan(0);
    });

    it("renders unassigned state with pending allocation badge and firm intake desk when no officer has been assigned", () => {
      const unassignedCase: ImmigrationCase = {
        ...FIXTURE_CASES[0],
        assigned_manager: undefined,
      };

      render(
        <ClientPortal
          myCase={unassignedCase}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // Verify unassigned state in Overview Panel
      expect(screen.getByText("No Officer Assigned Yet")).toBeDefined();
      expect(screen.getAllByText(/Pending Allocation/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Officer Sarah Jenkins, Esq\./i)).toBeNull();
      expect(screen.queryByText(/ONLINE NOW/i)).toBeNull();

      // Verify placeholder directs to legal intake desk
      expect(screen.getByPlaceholderText(/Type a direct message to the firm legal intake desk \(Counsel pending allocation\)\.\.\./i)).toBeDefined();

      // Verify sidebar shows No Officer Assigned
      expect(screen.getByText("No Officer Assigned")).toBeDefined();
    });
  });

  describe("5. Overview Panel — Standards for Uploading Documents for Optimal OCR", () => {
    it("renders the 6 golden rules of document upload and pre-flight checklist", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      expect(screen.getAllByText(/Standards for Uploading Documents to the Portal \(Optimal AI OCR\)/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/300\+ DPI Resolution/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Uniform Diffused Lighting/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/90° Overhead Orientation/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/All 4 Corners Visible/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Zero Finger Occlusion/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Complete Multi-Page PDFs/i).length).toBeGreaterThan(0);
    });

    it("opens the full OCR standards modal when clicking the guide button", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      const guideBtn = screen.getByRole("button", { name: /Open Full Upload Standards & Pre-Flight FAQ →/i });
      fireEvent.click(guideBtn);

      // Verify DocumentUploadStandardsFAQ modal is mounted
      expect(screen.getAllByText(/Standards for Uploading Documents to the Portal/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Interactive Pre-Flight OCR Checklist/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DO: Ideal Upload Quality/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DON'T: Common Pitfalls That Fail OCR Processing/i).length).toBeGreaterThan(0);
    });
  });

  describe("6. Standalone Components Direct Unit Tests", () => {
    it("renders clean pending empty state in ClientProfileScopeView when class of application has not been selected by owner/manager", () => {
      render(<ClientProfileScopeView myCase={null} />);
      expect(screen.getByTestId("visa-scope-empty-state")).toBeDefined();
      expect(screen.getByText(/Class of Application Pending Selection/i)).toBeDefined();
      expect(screen.getByText(/Awaiting Owner \/ Manager Classification/i)).toBeDefined();
      expect(screen.queryByText(/Family Members Included in This Visa File/i)).toBeNull();
      expect(screen.queryByText(/Principal Applicant/i)).toBeNull();
    });

    it("renders ClientProfileScopeView with statutory forms and declared relatives once class of application is selected", () => {
      render(<ClientProfileScopeView myCase={SPOUSAL_CASE_FIXTURE} />);
      expect(screen.getAllByText(/Family Members Included in This Visa File/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Principal Applicant/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Sponsor & Co-Signer/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Official Government Application Forms Prepared/i).length).toBeGreaterThan(0);
    });

    it("renders DocumentUploadStandardsFAQ with interactive checklist checkboxes", () => {
      render(<DocumentUploadStandardsFAQ />);
      expect(screen.getAllByText(/Interactive Pre-Flight OCR Checklist/i).length).toBeGreaterThan(0);
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(5);

      // Toggle first checkbox
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      fireEvent.click(checkboxes[0]);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    });

    it("renders InitialInformationSheet with tabs for all 11 sections", () => {
      render(<InitialInformationSheet />);
      expect(screen.getAllByText(/Main Applicant/i).length).toBeGreaterThan(0);

      // Tab 4: Education History
      const eduTab = screen.getByRole("button", { name: /4\. Education History/i });
      fireEvent.click(eduTab);
      expect(screen.getAllByText(/Complete Education History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\+ Add Education Record/i).length).toBeGreaterThan(0);

      // Tab 5: Employment History
      const empTab = screen.getByRole("button", { name: /5\. Employment/i });
      fireEvent.click(empTab);
      expect(screen.getAllByText(/Employment History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\+ Add Employment Record/i).length).toBeGreaterThan(0);

      // Tab 10: Sponsor & Relationship Details
      const sponsorTab = screen.getByRole("button", { name: /10\. Sponsor/i });
      fireEvent.click(sponsorTab);
      expect(screen.getAllByText(/Sponsor Personal Details & Relationship History/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Sponsor Legal Identity & Status/i).length).toBeGreaterThan(0);
    });
  });
});
