import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { VisaFileUpdatesView, FALLBACK_VISA_FILE_UPDATES } from "../components/portal/VisaFileUpdatesView";
import { DirectDocumentUploader } from "../components/portal/DirectDocumentUploader";
import { CaseOfficerChatBanner } from "../components/portal/CaseOfficerChatBanner";
import {
  FIXTURE_CASES,
  FIXTURE_DOCUMENTS,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_INVOICES,
} from "../lib/api";

describe("Retained Client Experience — Visa File Updates, Upload Document Tab & Case Officer Chat", () => {
  describe("1. Visa File Updates Component & Docket", () => {
    it("renders official USCIS petition details, receipt number, priority date, and service center", () => {
      const handleNavigate = vi.fn();
      render(
        <VisaFileUpdatesView
          myCase={FIXTURE_CASES[0]}
          onNavigateTab={handleNavigate}
        />
      );

      // Verify USCIS dossier details
      expect(screen.getByText(/Visa Application File Updates/i)).toBeDefined();
      expect(screen.getAllByText(/IOE-09-284-91823/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/August 10, 2026 \(Current\)/i)).toBeDefined();
      expect(screen.getAllByText(/Texas Service Center \(TSC\)/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Form I-140 Approved/i).length).toBeGreaterThan(0);
    });

    it("renders chronological visa file updates with statutory authority and official notice codes", () => {
      const handleNavigate = vi.fn();
      render(
        <VisaFileUpdatesView
          myCase={FIXTURE_CASES[0]}
          onNavigateTab={handleNavigate}
        />
      );

      // Verify biometrics appointment update
      expect(screen.getByText(/USCIS Biometrics Appointment Notice \(Form I-797C\) Issued/i)).toBeDefined();
      expect(screen.getByText(/ASC Notice #ASC-CA-88921/i)).toBeDefined();

      // Verify Form I-140 approval update
      expect(screen.getByText(/Form I-140 Immigrant Petition Approved \(Form I-797 Notice of Action\)/i)).toBeDefined();

      // Verify statutory significance
      expect(screen.getAllByText(/Legal Significance & Statutory Authority/i).length).toBeGreaterThan(0);
    });

    it("allows filtering and searching visa file updates", () => {
      render(
        <VisaFileUpdatesView
          myCase={FIXTURE_CASES[0]}
          onNavigateTab={vi.fn()}
        />
      );

      // Filter by Biometrics
      const biometricsFilterBtn = screen.getByRole("button", { name: /Biometrics/i });
      fireEvent.click(biometricsFilterBtn);

      expect(screen.getByText(/USCIS Biometrics Appointment Notice/i)).toBeDefined();

      // Reset to All Updates before searching
      const allFilterBtn = screen.getByRole("button", { name: /All Updates/i });
      fireEvent.click(allFilterBtn);

      // Search by keyword
      const searchInput = screen.getByPlaceholderText(/Search updates by notice # or keyword.../i);
      fireEvent.change(searchInput, { target: { value: "Kazarian" } });

      expect(screen.getByText(/Comprehensive Legal Brief & 1,420-Page Evidentiary Dossier Indexed/i)).toBeDefined();
    });
  });

  describe("2. Direct Document Uploader & Upload Document Tab", () => {
    it("renders in-tab drag and drop upload zone with magic-byte checks and category selection", () => {
      const handleUploaded = vi.fn();
      render(
        <DirectDocumentUploader
          caseId="case-01"
          onDocumentUploaded={handleUploaded}
        />
      );

      expect(screen.getByText(/Direct Document Upload to Case Processing Officer/i)).toBeDefined();
      expect(screen.getByText(/Drag & drop document here, or/i)).toBeDefined();
      expect(screen.getByText(/Document Title \/ Exhibit Description \*/i)).toBeDefined();
      expect(screen.getByText(/Evidentiary Category \*/i)).toBeDefined();
      expect(screen.getByText(/Confidential Note for Your Case Processing Officer/i)).toBeDefined();
    });

    it("calculates SHA-256 fingerprint when file is selected and enables upload button", async () => {
      const handleUploaded = vi.fn();
      const { container } = render(
        <DirectDocumentUploader
          caseId="case-01"
          onDocumentUploaded={handleUploaded}
        />
      );

      // Create a mock PDF file
      const file = new File(["%PDF-1.4 test file content"], "Degree_Diploma_Elena_Rostova.pdf", {
        type: "application/pdf",
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify SHA-256 calculation displayed
      await waitFor(() => {
        expect(screen.getByText(/SHA-256:/i)).toBeDefined();
      });

      // Submit document
      const submitBtn = screen.getByRole("button", { name: /Upload & Submit to Officer/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleUploaded).toHaveBeenCalled();
      });
    });
  });

  describe("3. Chat with Case Processing Officer Banner", () => {
    it("renders case processing officer credentials, direct line status, and privilege notice", () => {
      const handleSelectPrompt = vi.fn();
      render(
        <CaseOfficerChatBanner
          caseNumber="CASE-US-8841"
          visaCategory="EB-1A Extraordinary Ability"
          onSelectPrompt={handleSelectPrompt}
        />
      );

      expect(screen.getByText(/Officer Sarah Jenkins, Esq./i)).toBeDefined();
      expect(screen.getByText(/Lead Case Processing Officer/i)).toBeDefined();
      expect(screen.getByText(/Direct Case Processing Channel/i)).toBeDefined();
      expect(screen.getByText(/8 CFR § 292.1 Privileged/i)).toBeDefined();

      // Click suggested quick inquiry prompt chip
      const promptBtn = screen.getByText(/Can you confirm if my USCIS Form I-797 receipt notice has arrived\?/i);
      fireEvent.click(promptBtn);

      expect(handleSelectPrompt).toHaveBeenCalledWith(
        "Can you confirm if my USCIS Form I-797 receipt notice has arrived?"
      );
    });
  });

  describe("4. Integrated ClientPortal Tabs & Navigation", () => {
    it("seamlessly switches between Overview, Visa File Updates, Upload Documents, and Chat with Case Officer", async () => {
      const handleSendMessage = vi.fn();
      const handleDocumentUpdated = vi.fn();

      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={handleSendMessage}
          onMarkNotificationRead={vi.fn()}
          onDocumentUpdated={handleDocumentUpdated}
        />
      );

      // Verify Overview has Visa File Updates preview widget
      expect(screen.getByText(/Latest Visa Application File Updates & USCIS Status/i)).toBeDefined();

      // 1. Switch to Visa File Updates tab
      const updatesTabs = screen.getAllByRole("button", { name: /Visa File Updates/i });
      fireEvent.click(updatesTabs[0]);

      await waitFor(() => {
        expect(screen.getByText(/Official Case Docket/i)).toBeDefined();
        expect(screen.getAllByText(/IOE-09-284-91823/i).length).toBeGreaterThan(0);
      });

      // 2. Switch to Upload Documents tab
      const uploadTabs = screen.getAllByRole("button", { name: /Upload Documents/i });
      fireEvent.click(uploadTabs[0]);

      await waitFor(() => {
        expect(screen.getByText(/Direct Document Upload to Case Processing Officer/i)).toBeDefined();
        expect(screen.getByText(/Document & Evidence Requests/i)).toBeDefined();
      });

      // 3. Switch to Chat with Case Officer tab
      const chatTabs = screen.getAllByRole("button", { name: /Chat with Case Officer/i });
      fireEvent.click(chatTabs[0]);

      await waitFor(() => {
        expect(screen.getByText(/Officer Sarah Jenkins, Esq./i)).toBeDefined();
        expect(screen.getByText(/Secure Communications Hub/i)).toBeDefined();
      });
    });
  });
});
