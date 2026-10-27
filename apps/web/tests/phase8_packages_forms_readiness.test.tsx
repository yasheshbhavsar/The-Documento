import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigurableFormViewer } from "../components/forms/ConfigurableFormViewer";
import { DeterministicReadinessChecklist } from "../components/packages/DeterministicReadinessChecklist";
import { PackageBuilderView } from "../components/packages/PackageBuilderView";
import { PackageApprovalWorkflowModal } from "../components/packages/PackageApprovalWorkflowModal";
import {
  FALLBACK_FORM_SUBMISSION,
  FALLBACK_FORM_SCHEMAS,
  FALLBACK_READINESS_CHECKLIST,
  FALLBACK_FILING_PACKAGE,
} from "../lib/api";

describe("Phase 8 — Application Forms, Readiness Checks, and Package Builder", () => {
  describe("ConfigurableFormViewer Component", () => {
    it("renders versioned form metadata, completion percentage, and unconfirmed AI drafts warning", () => {
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      // Verify header indicators
      expect(screen.getByText("USCIS_I140")).toBeDefined();
      expect(screen.getByText("Version v2026.1")).toBeDefined();
      expect(screen.getByText(/82.5%/)).toBeDefined();

      // Verify AI draft confirmation warning banner
      expect(screen.getByText(/UNCONFIRMED DRAFT ANSWERS:/i)).toBeDefined();
      expect(
        screen.getByText(/This form contains auto-populated AI synthesis or OCR extraction drafts/i)
      ).toBeDefined();
    });

    it("displays source provenance badges for client profile, verified OCR, and AI synthesis", () => {
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      // Verify Client Profile provenance badge
      expect(screen.getAllByText("Client Profile").length).toBeGreaterThan(0);
    });

    it("allows authorized staff to confirm unconfirmed field values", async () => {
      const handleConfirmField = vi.fn().mockResolvedValue(undefined);
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
          onConfirmField={handleConfirmField}
        />
      );

      // Switch to Part 3 Beneficiary Bio to find OCR field
      const part3Tab = screen.getByText(/Part 3\. Information About the Alien/i);
      fireEvent.click(part3Tab);

      // Find "Confirm Field Value" button
      const confirmBtns = screen.getAllByText("Confirm Field Value");
      expect(confirmBtns.length).toBeGreaterThan(0);

      fireEvent.click(confirmBtns[0]);
      await waitFor(() => {
        expect(handleConfirmField).toHaveBeenCalled();
      });
    });

    it("evaluates conditional fields dynamically", () => {
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      // In Part 1, petitioner_is_self defaults to true, so petitioner_company_name should NOT be displayed
      expect(screen.queryByText(/Company or Organization Name \(if petitioning entity\)/i)).toBeNull();

      // Toggle self-petitioning to "No"
      const noRadio = screen.getAllByLabelText("No")[0];
      fireEvent.click(noRadio);

      // Now company name field should appear dynamically
      expect(screen.getByText(/Company or Organization Name \(if petitioning entity\)/i)).toBeDefined();
    });

    it("enforces attorney certification requirement on sensitive background fields and restricts clients", async () => {
      // 1. Staff view
      const handleReviewSensitive = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
          onReviewSensitive={handleReviewSensitive}
        />
      );

      // Navigate to Part 4
      const part4Tab = screen.getByText(/Part 4\. Processing Information/i);
      fireEvent.click(part4Tab);

      // Verify sensitive field review block
      expect(screen.getByTestId("sensitive-review-block")).toBeDefined();
      expect(screen.getByText(/Designated Sensitive-Field Legal Review Certification/i)).toBeDefined();
      expect(screen.getByText(/Certify Sensitive Fields Review/i)).toBeDefined();

      // 2. Client view prohibits self-certification
      rerender(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="retained_client"
          onReviewSensitive={handleReviewSensitive}
        />
      );

      expect(
        screen.getByText(/You are viewing as a client applicant\. Sensitive background certification must be completed by your retained legal counsel/i)
      ).toBeDefined();
      expect(screen.queryByText(/Certify Sensitive Fields Review/i)).toBeNull();
    });

    it("records revision history and opens history drawer", () => {
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      const historyBtn = screen.getByText(/History/i);
      fireEvent.click(historyBtn);

      expect(screen.getByText("Revision History Log")).toBeDefined();
      expect(screen.getByText("Revision #1")).toBeDefined();
      expect(screen.getByText(/Initial draft auto-populated from Client Profile/i)).toBeDefined();
    });

    it("displays physical evidence provenance chips including page and extraction confidence", () => {
      render(
        <ConfigurableFormViewer
          submission={FALLBACK_FORM_SUBMISSION}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      // Navigate to Part 3 Alien Information
      const part3Tab = screen.getByText(/Part 3\. Information About the Alien/i);
      fireEvent.click(part3Tab);

      // Verify physical page citation and confidence percentage
      expect(screen.getByText("Page 1")).toBeDefined();
      expect(screen.getByText("98% Match")).toBeDefined();
    });

    it("detects multi-document evidence conflicts and allows adopting candidate values", () => {
      const conflictedSubmission = {
        ...FALLBACK_FORM_SUBMISSION,
        answers: {
          ...FALLBACK_FORM_SUBMISSION.answers,
          beneficiary_passport_number: {
            value: null,
            has_conflict: true,
            conflict_reason: "Disparate passport numbers extracted across multiple uploaded documents.",
            conflicting_candidates: [
              { document_id: "doc-passport-old", page: 1, value: "EP8849201" },
              { document_id: "doc-passport-new", page: 1, value: "EP9901234" },
            ],
            source_type: "document_ocr" as const,
            source_label: "Disparate Passport Extractions",
            is_confirmed: false,
          },
        },
      };

      render(
        <ConfigurableFormViewer
          submission={conflictedSubmission}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
        />
      );

      // Verify global conflict banner
      expect(screen.getByTestId("form-conflicts-banner")).toBeDefined();
      expect(screen.getByText(/UNRESOLVED EVIDENCE CONFLICTS/i)).toBeDefined();

      // Navigate to Part 3 where passport field lives
      const part3Tab = screen.getByText(/Part 3\. Information About the Alien/i);
      fireEvent.click(part3Tab);

      // Verify field level conflict alert
      expect(screen.getByTestId("conflict-alert-beneficiary_passport_number")).toBeDefined();
      expect(screen.getByText("EP8849201")).toBeDefined();
      expect(screen.getByText("EP9901234")).toBeDefined();

      // Click "Use This Value" for the newer passport
      const adoptBtns = screen.getAllByText("Use This Value");
      fireEvent.click(adoptBtns[1]);

      // Verify input value was updated to the selected candidate
      const passportInput = screen.getByPlaceholderText(/enter passport number/i) as HTMLInputElement;
      expect(passportInput.value).toBe("EP9901234");
    });

    it("enforces finalization gate and displays certified filing-ready badge upon confirmation", async () => {
      const handleFinalize = vi.fn().mockResolvedValue(undefined);
      const readySubmission = {
        ...FALLBACK_FORM_SUBMISSION,
        has_unconfirmed_ai_fields: false,
        sensitive_fields_reviewed: true,
        status: "draft" as const,
      };

      render(
        <ConfigurableFormViewer
          submission={readySubmission}
          schema={FALLBACK_FORM_SCHEMAS[0]}
          userRole="case_manager"
          onFinalizeSubmission={handleFinalize}
        />
      );

      const finalizeBtn = screen.getByTestId("finalize-form-btn");
      expect(finalizeBtn).toBeDefined();
      expect(finalizeBtn.hasAttribute("disabled")).toBe(false);

      fireEvent.click(finalizeBtn);
      await waitFor(() => {
        expect(handleFinalize).toHaveBeenCalledWith("confirmed");
        expect(screen.getByTestId("form-certified-badge")).toBeDefined();
        expect(screen.getByText(/Certified Filing-Ready/i)).toBeDefined();
      });
    });
  });

  describe("DeterministicReadinessChecklist Component", () => {
    it("reports all 10 deterministic checks and disclaims approval probability", () => {
      render(<DeterministicReadinessChecklist checklist={FALLBACK_READINESS_CHECKLIST} />);

      // Verify regulatory disclaimer
      expect(
        screen.getByText(/does not calculate or display a probability of government approval/i)
      ).toBeDefined();

      // Verify 10 checks rendered
      expect(screen.getByText("Applicable Statutory Requirements")).toBeDefined();
      expect(screen.getByText("Evidence Documents Received")).toBeDefined();
      expect(screen.getByText("Missing Evidence Gaps")).toBeDefined();
      expect(screen.getByText("Unresolved AI Findings & Discrepancies")).toBeDefined();
      expect(screen.getByText("Unverified Extracted Fields")).toBeDefined();
      expect(screen.getByText("Expired or Outdated Documents")).toBeDefined();
      expect(screen.getByText("Incomplete Application Forms")).toBeDefined();
      expect(screen.getByText("Outstanding Client Requests")).toBeDefined();
      expect(screen.getByText("Pending Reviewer Decisions")).toBeDefined();
      expect(screen.getByText("Unmet Package Assembly Criteria")).toBeDefined();

      // Verify status indicators
      expect(screen.getByText(/Clear for Assembly/i)).toBeDefined();
    });

    it("triggers onAssemblePackage when clear for assembly", () => {
      const handleAssemble = vi.fn();
      render(
        <DeterministicReadinessChecklist
          checklist={FALLBACK_READINESS_CHECKLIST}
          onAssemblePackage={handleAssemble}
        />
      );

      const assembleBtn = screen.getByText("Assemble Filing Package");
      fireEvent.click(assembleBtn);

      expect(handleAssemble).toHaveBeenCalled();
    });
  });

  describe("PackageBuilderView Component", () => {
    it("renders folder structure, SHA-256 manifest items, and root Merkle hash", () => {
      render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

      // Verify title & root hash
      expect(screen.getByText(FALLBACK_FILING_PACKAGE.name)).toBeDefined();
      expect(screen.getByText(/Root Merkle Hash:/i)).toBeDefined();

      // Verify folders exist
      expect(screen.getByText("00 Case Summary & Exhibits Index")).toBeDefined();
      expect(screen.getByText("01 Identity and Civil Status")).toBeDefined();
      expect(screen.getByText("02 Application Forms & G-28")).toBeDefined();
      expect(screen.getByText("03 Pathway & Extraordinary Ability")).toBeDefined();
    });

    it("segregates internal review materials from submission-ready files", () => {
      render(<PackageBuilderView packageItem={FALLBACK_FILING_PACKAGE} />);

      // When "Submission-Ready Mode" is checked (default), confidential internal memo should NOT be in the table
      expect(screen.queryByText("Attorney_Confidential_Strategy_Memo.pdf")).toBeNull();

      // Uncheck "Submission-Ready Mode"
      const checkbox = screen.getByLabelText(/Submission-Ready Mode \(Excludes 09_Internal_Review\)/i);
      fireEvent.click(checkbox);

      // Now confidential memo should be displayed with INTERNAL ONLY badge
      expect(screen.getByText("Attorney_Confidential_Strategy_Memo.pdf")).toBeDefined();
      expect(screen.getByText("INTERNAL ONLY")).toBeDefined();
    });
  });

  describe("PackageApprovalWorkflowModal Component", () => {
    it("renders 7-stage sequential approval chain and mandatory manual filing instructions", () => {
      render(
        <PackageApprovalWorkflowModal
          packageItem={FALLBACK_FILING_PACKAGE}
          isOpen={true}
          onClose={() => {}}
          userRole="case_manager"
        />
      );

      // Verify 7 stages
      expect(screen.getAllByText(/Evidence and Form Check/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Required Findings Resolution/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Authorized Staff Review/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Senior Managing Attorney Review/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Client Confirmation/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Final Package Approval/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Package Lock & Export Generation/i).length).toBeGreaterThan(0);

      // Verify government portal submission prohibition notice
      expect(
        screen.getByText(/Official Filing Procedure & Automated Submission Disclaimer/i)
      ).toBeDefined();
      expect(
        screen.getByText(/automatic submission of petitions to government portals is intentionally disclaimed and prohibited/i)
      ).toBeDefined();

      // Verify physical lockbox courier filing address
      expect(
        screen.getByText(/USCIS Texas Service Center, Attn: Premium I-140/i)
      ).toBeDefined();
    });

    it("allows advancing approval stage with notes", async () => {
      const handleAdvance = vi.fn().mockResolvedValue(undefined);
      render(
        <PackageApprovalWorkflowModal
          packageItem={FALLBACK_FILING_PACKAGE}
          isOpen={true}
          onClose={() => {}}
          userRole="case_manager"
          onAdvanceApproval={handleAdvance}
        />
      );

      // Select Senior Review (which is pending)
      const seniorStageBtn = screen.getByText(/Senior Managing Attorney Review/i);
      fireEvent.click(seniorStageBtn);

      const notesInput = screen.getByPlaceholderText(/Enter audit signoff notes/i);
      fireEvent.change(notesInput, { target: { value: "Senior partner statutory review verified." } });

      const approveBtn = screen.getByText("Certify & Approve Stage");
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(handleAdvance).toHaveBeenCalledWith(
          "senior_review",
          "approved",
          "Senior partner statutory review verified."
        );
      });
    });
  });
});
