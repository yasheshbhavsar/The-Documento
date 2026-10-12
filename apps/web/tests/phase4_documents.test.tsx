import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentUploadModal } from "../components/modals/DocumentUploadModal";
import { DocumentInspectorModal } from "../components/modals/DocumentInspectorModal";
import { FIXTURE_DOCUMENTS } from "../lib/api";

describe("Phase 4 — Document Management, OCR & Structured Extraction Workflows", () => {
  const samplePassportDoc = FIXTURE_DOCUMENTS[0]; // US_Passport_Biodata_Elena_Rostova.pdf

  it("renders DocumentUploadModal with 12 configurable categories and security notes", () => {
    const handleClose = vi.fn();
    const handleUploaded = vi.fn();

    render(
      <DocumentUploadModal
        isOpen={true}
        onClose={handleClose}
        caseId="case-01"
        onDocumentUploaded={handleUploaded}
        activeRole="case_manager"
      />
    );

    expect(screen.getByText(/Secure Evidence Upload & OCR Intake/i)).toBeDefined();
    expect(screen.getByText(/Passports and Identity Documents/i)).toBeDefined();

    // Verify presence of configurable categories
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.options.length).toBe(12);

    expect(screen.getByText(/Magic-byte verification ensures zero executable disguises/i)).toBeDefined();
    expect(screen.getByText(/Automated PyMuPDF & OCR extraction records full data provenance/i)).toBeDefined();
  });

  it("renders DocumentInspectorModal with extracted fields, original vs normalized values, and OCR confidence", () => {
    const handleClose = vi.fn();
    const handleUpdated = vi.fn();

    render(
      <DocumentInspectorModal
        isOpen={true}
        onClose={handleClose}
        document={samplePassportDoc}
        onDocumentUpdated={handleUpdated}
        activeRole="case_manager"
      />
    );

    // Header metadata
    expect(screen.getByText(/US_Passport_Biodata_Elena_Rostova\.pdf/i)).toBeDefined();
    expect(screen.getByText(/v1 \(Current\)/i)).toBeDefined();
    expect(screen.getByText(/Identity Passport/i)).toBeDefined();
    expect(screen.getByText(/COMPLETED/i)).toBeDefined();

    // Extracted fields
    expect(screen.getByText(/Passport Number/i)).toBeDefined();
    expect(screen.getAllByText(/C09812491/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Full Name/i)).toBeDefined();
    expect(screen.getAllByText(/Elena Rostova/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Date of Birth/i)).toBeDefined();
    expect(screen.getAllByText(/1988-04-12/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/UNITED STATES OF AMERICA/i)).toBeDefined();
    expect(screen.getByText(/USA/i)).toBeDefined();

    // Provenance metrics
    expect(screen.getAllByText(/Page 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/99%/i).length).toBeGreaterThan(0);
  });

  it("allows legal staff to make manual field corrections with required audit justification", async () => {
    const handleUpdated = vi.fn();

    render(
      <DocumentInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        document={samplePassportDoc}
        onDocumentUpdated={handleUpdated}
        activeRole="case_manager"
      />
    );

    // Click "Edit" on the first field (passport number)
    const editButtons = screen.getAllByRole("button", { name: /Edit/i });
    fireEvent.click(editButtons[0]);

    // Check modal correction panel opened
    expect(screen.getByText(/Manual Field Correction: Passport Number/i)).toBeDefined();

    const valueInput = screen.getByPlaceholderText(/Enter legal \/ standard value\.\.\./i) as HTMLInputElement;
    const reasonInput = screen.getByPlaceholderText(/e\.g\., Standardized date format/i) as HTMLInputElement;

    fireEvent.change(valueInput, { target: { value: "C09812491-CORRECTED" } });
    fireEvent.change(reasonInput, { target: { value: "Verified against State Department original certificate" } });

    const saveButton = screen.getByRole("button", { name: /Save Correction & Record Provenance/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleUpdated).toHaveBeenCalled();
    });
  });

  it("enforces decoupled legal verification policy and records caseworker notes", async () => {
    const handleUpdated = vi.fn();

    render(
      <DocumentInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        document={samplePassportDoc}
        onDocumentUpdated={handleUpdated}
        activeRole="case_manager"
      />
    );

    // Navigate to Verification tab
    const verifyTabButton = screen.getByRole("button", { name: /Human Verification & Audit Trail/i });
    fireEvent.click(verifyTabButton);

    // Verify decoupled policy notice
    expect(screen.getByText(/Decoupled Verification Policy/i)).toBeDefined();
    expect(screen.getByText(/automated OCR and structured LLM extraction do not automatically certify a document as verified/i)).toBeDefined();

    // Verification controls for caseworker
    expect(screen.getByText(/Update Document Certification/i)).toBeDefined();
    const notesTextarea = screen.getByPlaceholderText(/e\.g\., Physical biometric passport matched/i) as HTMLTextAreaElement;
    fireEvent.change(notesTextarea, { target: { value: "Biometric chip verified and attested by senior reviewer." } });

    const submitVerifyButton = screen.getByRole("button", { name: /Save Verification Decision/i });
    fireEvent.click(submitVerifyButton);

    await waitFor(() => {
      expect(handleUpdated).toHaveBeenCalled();
    });
  });

  it("displays version history and integrity lineage", async () => {
    render(
      <DocumentInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        document={samplePassportDoc}
        onDocumentUpdated={vi.fn()}
        activeRole="case_manager"
      />
    );

    // Navigate to Version History tab
    const versionsTabButton = screen.getByRole("button", { name: /Version History/i });
    fireEvent.click(versionsTabButton);

    expect(screen.getByText(/Document revisions and lineage tracking/i)).toBeDefined();
    expect(screen.getByText(/Current Active/i)).toBeDefined();
    expect(screen.getAllByText(/v1/i).length).toBeGreaterThan(0);
  });
});
