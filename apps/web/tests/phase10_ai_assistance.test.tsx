import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { DeterministicReadinessChecklist } from "../components/packages/DeterministicReadinessChecklist";
import { CaseDiscrepancyAlertCenter } from "../components/cases/CaseDiscrepancyAlertCenter";
import { DocumentDossierWorkbench } from "../components/documents/DocumentDossierWorkbench";
import {
  PackageReadinessChecklist,
  PackageBlockerReport,
  AIFinding,
  DocumentItem,
  ApprovedRequestTemplate,
} from "../lib/types";
import * as apiModule from "../lib/api";

// Mock the API module
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getPackageBlockersExplanation: vi.fn(),
    getApprovedRequestTemplates: vi.fn(),
    draftClientRequest: vi.fn(),
    approveAndSendDraftRequest: vi.fn(),
    splitDocumentSections: vi.fn(),
    getDocumentExtractions: vi.fn().mockResolvedValue({ data: { items: [] } }),
    getDocumentReviewDimensions: vi.fn().mockResolvedValue({ data: null }),
    getDocumentRuns: vi.fn().mockResolvedValue({ data: [] }),
    getDocument: vi.fn().mockResolvedValue({ data: null }),
    getDocumentVersions: vi.fn().mockResolvedValue({ data: [] }),
  };
});

describe("Phase 10 — AI Assistance, Traceability & Guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. DETERMINISTIC PACKAGE BLOCKER EXPLAINER TESTS
  // ============================================================================
  describe("DeterministicReadinessChecklist — Blocker Explainer", () => {
    const mockChecklist: PackageReadinessChecklist = {
      case_id: "case-phase10-01",
      case_number: "CASE-US-1001",
      is_ready_for_package_assembly: false,
      total_checks_evaluated: 10,
      passed_checks_count: 7,
      warnings_count: 1,
      blocking_failures_count: 2,
      evaluated_at: "2026-10-17T12:00:00Z",
      prohibition_disclaimer: "Deterministic statutory readiness rules apply.",
      checks: [
        {
          code: "CHK_01_ONBOARDING_CLEARANCE",
          name: "Tripartite Onboarding Clearance Gate",
          status: "passed",
          summary: "Onboarding clearances verified.",
          is_blocking: true,
        },
        {
          code: "CHK_02_SUBMISSION_HOLD",
          name: "Submission Authorization & Holds",
          status: "failed",
          summary: "Accounts receivable hold active on case.",
          is_blocking: true,
        },
      ],
    };

    const mockBlockerReport: PackageBlockerReport = {
      case_id: "case-phase10-01",
      case_number: "CASE-US-1001",
      organization_id: "org-01",
      is_blocked: true,
      total_blockers_count: 2,
      critical_blockers_count: 2,
      warning_blockers_count: 0,
      blockers: [
        {
          blocker_code: "BLOCKER_HOLD_ACCOUNTS",
          status_code: "HELD_ACCOUNTS",
          category: "compliance_hold",
          severity: "CRITICAL_BLOCKER",
          title: "Submission Hold: Outstanding Retainer / Billing Arrears",
          explanation: "Package submission is frozen due to overdue accounts receivable or unreplenished trust retainer.",
          statutory_context: "Firm Financial Compliance Policy Section 4.2",
          remediation_action: "Clear accounts balance or record client payment receipt to lift billing hold.",
          action_url: "/billing/cases/case-phase10-01",
        },
        {
          blocker_code: "BLOCKER_CRITICAL_FINDINGS",
          status_code: "FINDINGS_CRITICAL",
          category: "quality_anomaly",
          severity: "CRITICAL_BLOCKER",
          title: "Unresolved Critical Finding: Direct Date Contradiction",
          explanation: "W-2 wage records claim 2021-2023, while employer letter states 2018-2024.",
          statutory_context: "8 CFR § 204.5(h)(3)(ix)",
          remediation_action: "Resolve date conflict or upload corroborating tax return transcript.",
        },
      ],
      guardrail_notice: "AI systems do not decide legal eligibility, document authenticity, fraud, or legal sufficiency. All model inferences represent automated assistance and must be independently adjudicated by licensed legal professionals.",
      evaluated_at: "2026-10-17T12:00:00Z",
    };

    it("renders deterministic blocker section with status codes, reason codes, and remediation actions", async () => {
      vi.mocked(apiModule.getPackageBlockersExplanation).mockResolvedValue(mockBlockerReport);

      render(
        <DeterministicReadinessChecklist
          checklist={mockChecklist}
          caseId="case-phase10-01"
          blockerReport={mockBlockerReport}
        />
      );

      // Verify section header and blocker counts
      expect(screen.getByTestId("deterministic-blockers-section")).toBeDefined();
      expect(screen.getByText(/Deterministic Blocker Explanations/i)).toBeDefined();
      expect(screen.getByText(/2 Critical Blocker\(s\)/i)).toBeDefined();

      // Verify exact status and blocker codes
      expect(screen.getByText("BLOCKER_HOLD_ACCOUNTS")).toBeDefined();
      expect(screen.getByText("STATUS: HELD_ACCOUNTS")).toBeDefined();
      expect(screen.getByText("compliance hold")).toBeDefined();
      expect(screen.getAllByText("⛔ CRITICAL BLOCKER").length).toBe(2);

      // Verify remediation action
      expect(screen.getByText(/Clear accounts balance or record client payment receipt/i)).toBeDefined();

      // Verify statutory guardrail notice is prominently displayed
      expect(
        screen.getByText(/AI systems do not decide legal eligibility, document authenticity, fraud, or legal sufficiency/i)
      ).toBeDefined();
    });

    it("triggers onBlockerAction callback when clicking resolve navigation", () => {
      const handleAction = vi.fn();
      render(
        <DeterministicReadinessChecklist
          checklist={mockChecklist}
          caseId="case-phase10-01"
          blockerReport={mockBlockerReport}
          onBlockerAction={handleAction}
        />
      );

      const navBtn = screen.getByRole("button", { name: /Navigate to Resolve →/i });
      fireEvent.click(navBtn);
      expect(handleAction).toHaveBeenCalledWith("/billing/cases/case-phase10-01");
    });
  });

  // ============================================================================
  // 2. CLIENT REQUEST DRAFTING & PRIVACY GUARDRAIL TESTS
  // ============================================================================
  describe("CaseDiscrepancyAlertCenter — Draft Client Request from Approved Templates", () => {
    const mockTemplates: ApprovedRequestTemplate[] = [
      {
        template_code: "NAME_DISCREPANCY_CLARIFICATION",
        title: "One-and-the-Same Name Affidavit / Gazette Notification",
        category: "identity_verification",
        default_instructions: "Please provide a notarized one-and-the-same affidavit.",
        legal_context: "Passport bio page with official observation endorsement.",
        suggested_days_to_due: 14,
        required_review_role: "case_manager",
      },
      {
        template_code: "FINANCIAL_SUFFICIENT_FUNDS",
        title: "Official Bank Statement with Branch Verification Seal",
        category: "financial_evidence",
        default_instructions: "Upload stamped continuous monthly statements.",
        legal_context: "Continuous 6-month proof of unencumbered liquid funds.",
        suggested_days_to_due: 10,
        required_review_role: "case_manager",
      },
    ];

    const mockFinding: AIFinding = {
      id: "finding-phase10-01",
      case_id: "case-phase10-01",
      finding_type: "direct_contradiction",
      category: "contradiction",
      severity: "critical",
      status: "needs_review",
      title: "Name discrepancy between Identity Record and Degree Certificate",
      description: "Identity record states 'Alexander Hamilton', degree states 'Alex Hamilton'.",
      recommended_action: "Draft one-and-the-same affidavit request",
    };

    it("renders draft client request button for authorized staff and opens drafting drawer", async () => {
      vi.mocked(apiModule.getApprovedRequestTemplates).mockResolvedValue(mockTemplates);

      render(
        <CaseDiscrepancyAlertCenter
          caseId="case-phase10-01"
          findings={[mockFinding]}
          currentUserRole="case_manager"
        />
      );

      // Verify the Draft Client Request button is available
      const draftBtn = screen.getByTestId("draft-request-btn-finding-phase10-01");
      expect(draftBtn).toBeDefined();

      // Click to open draft drawer
      fireEvent.click(draftBtn);

      await waitFor(() => {
        expect(screen.getByTestId("draft-client-request-drawer")).toBeDefined();
      });

      // Verify Phase 10 Privacy Guardrail callout is rendered
      expect(screen.getByText(/Phase 10 Privacy Guardrail:/i)).toBeDefined();
      expect(screen.getByText(/Internal fraud & risk notes remain strictly private/i)).toBeDefined();
      expect(screen.getByText(/Requires Staff Review Before Send/i)).toBeDefined();
    });

    it("submits draft client request payload with draft status and default instructions", async () => {
      vi.mocked(apiModule.getApprovedRequestTemplates).mockResolvedValue(mockTemplates);
      vi.mocked(apiModule.draftClientRequest).mockResolvedValue({
        id: "req-draft-001",
        status: "draft",
        requires_staff_review: true,
      } as any);

      render(
        <CaseDiscrepancyAlertCenter
          caseId="case-phase10-01"
          findings={[mockFinding]}
          currentUserRole="case_manager"
        />
      );

      const draftBtn = screen.getByTestId("draft-request-btn-finding-phase10-01");
      fireEvent.click(draftBtn);

      await waitFor(() => {
        expect(screen.getByTestId("draft-client-request-drawer")).toBeDefined();
      });

      // Enter instructions to enable submit button
      const instructionsInput = screen.getByPlaceholderText(/Enter specific instructions/i);
      fireEvent.change(instructionsInput, {
        target: { value: "Please provide notarized name affidavit." },
      });

      // Submit the draft
      const submitBtn = screen.getByRole("button", { name: /Create Staff Draft Request/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiModule.draftClientRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            case_id: "case-phase10-01",
            finding_id: "finding-phase10-01",
            template_code: "NAME_DISCREPANCY_CLARIFICATION",
            custom_instructions: "Please provide notarized name affidavit.",
          })
        );
      });
    });
  });

  // ============================================================================
  // 3. THREE-TIER PROVENANCE & UNCERTAIN CANDIDATE TESTS
  // ============================================================================
  describe("DocumentDossierWorkbench — Evidence Traceability & Applicant Association", () => {
    const mockDocument: DocumentItem = {
      id: "doc-phase10-01",
      case_id: "case-phase10-01",
      filename: "Alexander_Passport_and_Degree.pdf",
      title: "Alexander Passport and Degree Combined",
      category: "identity_passport",
      status: "under_review",
      processing_status: "completed",
      sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      uploaded_at: "2026-10-17T10:00:00Z",
      page_count: 4,
      verification_status: "under_review",
      proposed_applicant_name: "", // Uncertain candidate -> leaves unassigned
      suggested_boundaries: [
        {
          section_index: 1,
          start_page: 1,
          end_page: 2,
          category: "identity",
          title: "Personal Identity (Passport)",
          confidence: 0.96,
        },
        {
          section_index: 2,
          start_page: 3,
          end_page: 4,
          category: "education",
          title: "Academic Degree Record",
          confidence: 0.92,
        },
      ],
      three_tier_extractions: [
        {
          field_name: "passport_number",
          field_label: "Passport Number",
          tier: "EXTRACTED_FACT",
          tier_number: 1,
          tier_label: "Tier 1: Extracted Fact",
          tier_badge_color: "emerald",
          value: "Z1234567",
          confidence: 0.98,
          source_page: 1,
          bounding_box: [0.1, 0.2, 0.15, 0.4],
          model_or_method: "neural-ocr-v10",
          statutory_disclaimer: "Typographical scan fact. Does not constitute legal sufficiency.",
        },
        {
          field_name: "expiry_date",
          field_label: "Expiration Date",
          tier: "MODEL_INFERENCE",
          tier_number: 2,
          tier_label: "Tier 2: Model Inference",
          tier_badge_color: "amber",
          value: "2028-08-12",
          confidence: 0.91,
          source_page: 1,
          model_or_method: "neural-ocr-v10",
          statutory_disclaimer: "AI inferences do not decide legal eligibility.",
        },
        {
          field_name: "given_name",
          field_label: "Given Name",
          tier: "PROFESSIONAL_DECISION",
          tier_number: 3,
          tier_label: "Tier 3: Professional Decision",
          tier_badge_color: "indigo",
          value: "Alexander",
          confidence: 1.0,
          decision_notes: "Confirmed full legal name 'Alexander' with government authority database.",
          decided_by: "usr-lawyer-01",
          decided_at: "2026-10-17T11:00:00Z",
          statutory_disclaimer: "Human professional determination governing filing readiness.",
        },
      ],
      provenance_extractions: [
        {
          field: "passport_number",
          value: "Z1234567",
          source_document_version_id: "ver-1",
          page_number: 1,
          confidence: 0.98,
          extractor_version: "neural-ocr-v10",
          bounding_box: [0.1, 0.2, 0.15, 0.4],
          review_status: "VERIFIED",
        },
      ],
      extracted_fields: [
        {
          id: "fld-1",
          field_name: "passport_number",
          field_label: "Passport Number",
          original_value: "Z1234567",
          normalized_value: "Z1234567",
          source_page: 1,
          validation_status: "verified",
          is_manually_corrected: false,
          extraction_method: "ocr_model",
          ocr_confidence: 0.98,
          extraction_confidence: 0.98,
        },
      ],
      review_dimensions: {
        document_id: "doc-phase10-01",
        document_version: 1,
        overall_review_status: "needs_review",
        high_ocr_confidence_notice: "High OCR confidence reflects typographical fidelity only.",
        readability: {
          dimension: "readability",
          label: "Readability & Scan Quality",
          status: "passed",
          score: 0.95,
          summary: "Scan is high resolution.",
          details: {},
          high_priority_flags: [],
        },
        document_type: {
          dimension: "document_type",
          label: "Document Classification Type",
          status: "passed",
          score: 0.96,
          summary: "Identified as passport booklet.",
          details: { suggested_category: "identity_passport" },
          high_priority_flags: [],
        },
        applicant_association: {
          dimension: "applicant_association",
          label: "Applicant Association",
          status: "warning",
          score: 0.52,
          summary: "Candidate confidence below 70% threshold. Left unassigned.",
          details: { associated_applicant: null, association_confidence: 0.52 },
          high_priority_flags: [],
        },
        consistency: {
          dimension: "consistency",
          label: "Cross-Field Data Consistency",
          status: "passed",
          score: 1.0,
          summary: "Fields consistent internally.",
          details: { contradictions: [] },
          high_priority_flags: [],
        },
        evidentiary_sufficiency: {
          dimension: "evidentiary_sufficiency",
          label: "Evidentiary Sufficiency",
          status: "passed",
          score: 0.9,
          summary: "Evidence satisfies baseline criterion.",
          details: {},
          high_priority_flags: [],
        },
        human_verification: {
          dimension: "human_verification",
          label: "Human Caseworker Certification",
          status: "under_review",
          score: 0.0,
          summary: "Pending human review.",
          details: {},
          high_priority_flags: [],
        },
      },
    };

    it("displays 'Unassigned (Uncertain candidate)' when applicant association confidence is below threshold", () => {
      render(
        <DocumentDossierWorkbench
          document={mockDocument}
          onDocumentUpdated={vi.fn()}
          activeRole="case_manager"
        />
      );

      // Switch to intelligence tab
      const intelTab = screen.getByRole("tab", { name: /6-Dimension Intelligence/i });
      fireEvent.click(intelTab);

      // Verify uncertain association fallback
      expect(screen.getByText(/Unassigned \(Uncertain candidate\)/i)).toBeDefined();

      // Verify page boundary section and split action
      expect(screen.getByTestId("page-boundary-section")).toBeDefined();
      expect(screen.getByText(/4 Pages Detected/i)).toBeDefined();
      expect(screen.getByText(/Split Document Sections/i)).toBeDefined();
    });

    it("renders Three-Tier Provenance tab and filters between Tier 1 Facts, Tier 2 Inferences, and Tier 3 Decisions", () => {
      render(
        <DocumentDossierWorkbench
          document={mockDocument}
          onDocumentUpdated={vi.fn()}
          activeRole="case_manager"
        />
      );

      // Switch to provenance tab
      const provTab = screen.getByRole("tab", { name: /Provenance \(JSON\)/i });
      fireEvent.click(provTab);

      expect(screen.getByTestId("three-tier-provenance-view")).toBeDefined();
      expect(screen.getByText(/Phase 10 Three-Tier Evidence Traceability Architecture/i)).toBeDefined();

      // Verify all 3 tier filter buttons are rendered
      expect(screen.getByTestId("filter-tier-1")).toBeDefined();
      expect(screen.getByTestId("filter-tier-2")).toBeDefined();
      expect(screen.getByTestId("filter-tier-3")).toBeDefined();

      // Filter to Tier 1: Facts
      fireEvent.click(screen.getByTestId("filter-tier-1"));
      expect(screen.getByTestId("three-tier-card-passport_number")).toBeDefined();
      expect(screen.queryByTestId("three-tier-card-given_name")).toBeNull();

      // Filter to Tier 3: Professional Decisions
      fireEvent.click(screen.getByTestId("filter-tier-3"));
      expect(screen.getByTestId("three-tier-card-given_name")).toBeDefined();
      expect(screen.queryByTestId("three-tier-card-passport_number")).toBeNull();
      expect(screen.getByText(/Confirmed full legal name 'Alexander'/i)).toBeDefined();
    });
  });
});
