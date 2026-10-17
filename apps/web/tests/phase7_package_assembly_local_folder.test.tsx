import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PackageBuilderView } from "../components/packages/PackageBuilderView";
import { FALLBACK_FILING_PACKAGE } from "../lib/api";

describe("Phase 7 — Package Assembly and Local-Folder Workflow (Frontend)", () => {
  it("renders firm-configured package folders and supports switching to Canada template", () => {
    render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

    // Invariant: Permanent records notice
    expect(screen.getByText(/Local Record Retention:/i)).toBeDefined();
    expect(screen.getByText(/Permanent case files remain in firm-controlled local folders/i)).toBeDefined();

    // Invariant: Folder names are configuration
    expect(
      screen.getByText(/Folder template names are configuration, not universal legal requirements/i)
    ).toBeDefined();

    // Default template is USCIS
    expect(screen.getByText("00 Case Summary & Exhibits Index")).toBeDefined();
    expect(screen.getByText("01 Identity and Civil Status")).toBeDefined();

    // Switch to Canada (CIC / IRCC 5-Folder)
    const templateSelect = screen.getByTestId("package-folder-template-selector");
    fireEvent.change(templateSelect, { target: { value: "canada" } });

    // Verify Canada firm folders are displayed
    expect(screen.getByText(/CIC CORRESPONDENCE \(IRCC \/ Provincial Letters\)/i)).toBeDefined();
    expect(screen.getByText(/DOCUMENTS \(Identity, Civil & Supporting Evidence\)/i)).toBeDefined();
    expect(screen.getByText(/FORMS \(Statutory IMM Forms & Schedules\)/i)).toBeDefined();
    expect(screen.getByText(/EXTRA \(Firm Notes, Affidavits & Supplements\)/i)).toBeDefined();
    expect(screen.getByText(/UPLOAD \(Client Portal Staging & Final Receipts\)/i)).toBeDefined();
  });

  it("previews excluded documents with exact reason codes and prevents including blocked anomalies", () => {
    render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

    // Switch to Excluded Documents tab
    const excludedTab = screen.getByTestId("tab-excluded-documents");
    fireEvent.click(excludedTab);

    // Verify blocker warning
    expect(screen.getByText(/Strict Blocker Invariant:/i)).toBeDefined();

    // Verify reason codes are visible
    expect(screen.getByText("UNRESOLVED_ANOMALY")).toBeDefined();
    expect(screen.getByText("APPLICANT_UNASSIGNED")).toBeDefined();
    expect(screen.getByText("HUMAN_VERIFICATION_REQUIRED")).toBeDefined();

    // Attempting to include document with UNRESOLVED_ANOMALY shows blocker error
    const blockedButton = screen.getByTestId("include-doc-doc-anom-01");
    expect(blockedButton).toBeDefined();
    fireEvent.click(blockedButton);

    // Verify blocker invariant feedback
    expect(
      screen.getByText(/STRICT BLOCKER INVARIANT: No document with an unresolved anomaly or failed mandatory check can be included/i)
    ).toBeDefined();
  });

  it("allows officer to open exclude dialog and select reason code", () => {
    render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

    // Default tab is included
    const excludeBtn = screen.getByTestId("exclude-doc-0");
    fireEvent.click(excludeBtn);

    // Modal opens
    expect(screen.getByTestId("officer-exclusion-modal")).toBeDefined();
    expect(screen.getByText("Officer Document Exclusion")).toBeDefined();
    expect(screen.getByTestId("exclusion-reason-code-select")).toBeDefined();
    expect(screen.getByTestId("exclusion-notes-input")).toBeDefined();

    // Select reason code
    const select = screen.getByTestId("exclusion-reason-code-select");
    fireEvent.change(select, { target: { value: "OFFICER_REDUNDANT_EVIDENCE" } });

    // Enter notes
    const notesInput = screen.getByTestId("exclusion-notes-input");
    fireEvent.change(notesInput, { target: { value: "Superseded by updated bio scan." } });

    // Cancel closes modal
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId("officer-exclusion-modal")).toBeNull();
  });

  it("opens canonical Phase 7 manifest JSON inspector modal with deterministic schema", async () => {
    render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

    const inspectBtn = screen.getByTestId("inspect-manifest-json-button");
    fireEvent.click(inspectBtn);

    // Modal opens
    expect(screen.getByTestId("canonical-manifest-modal")).toBeDefined();
    expect(screen.getByText(/Deterministic Manifest JSON \(Phase 7 Canonical Schema\)/i)).toBeDefined();

    // Wait for content to render
    await waitFor(() => {
      const jsonPre = screen.getByTestId("canonical-manifest-json-content");
      expect(jsonPre.textContent).toContain("case_reference");
      expect(jsonPre.textContent).toContain("package_template_version");
      expect(jsonPre.textContent).toContain("checklist_rule_version");
      expect(jsonPre.textContent).toContain("documents");
      expect(jsonPre.textContent).toContain("exclusions");
    });

    // Copy JSON button exists
    expect(screen.getByTestId("copy-manifest-json-button")).toBeDefined();
  });

  it("renders local ZIP and interim multi-format reports options", () => {
    render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

    // Local ZIP button
    expect(screen.getByTestId("download-local-zip-button")).toBeDefined();

    // Reports menu
    const reportsBtn = screen.getByTestId("interim-reports-menu-button");
    fireEvent.click(reportsBtn);

    expect(screen.getByText(/PDF Manifest Report/i)).toBeDefined();
    expect(screen.getByText(/Word Report \(\.doc\)/i)).toBeDefined();
    expect(screen.getByText(/Text Report \(\.txt\)/i)).toBeDefined();
    expect(screen.getByText(/Reassignment Dossier \(PDF\)/i)).toBeDefined();
  });
});
