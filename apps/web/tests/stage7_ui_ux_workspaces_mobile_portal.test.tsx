import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ManagerPriorityQueueView,
  FALLBACK_PRIORITY_QUEUE,
} from "../components/dashboards/ManagerPriorityQueueView";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { DocumentProgressionStepper } from "../components/dashboards/ClientPortal";
import { DocumentInspectorModal } from "../components/modals/DocumentInspectorModal";
import {
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  CaseTask,
  AIFinding,
  MessageItem,
} from "../lib/types";

// Mock API calls
vi.mock("../lib/api", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchManagerPriorityQueue: vi.fn().mockResolvedValue(FALLBACK_PRIORITY_QUEUE),
    getDocumentVersions: vi.fn().mockResolvedValue({ success: true, data: [] }),
    correctExtractedField: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: "field-1",
        field_name: "alien_number",
        field_label: "Alien Number",
        normalized_value: "A099881122",
        corrected_value: "A099881122",
        is_manually_corrected: true,
      },
    }),
  };
});

const mockCase: ImmigrationCase = {
  id: "case-01",
  case_number: "US-EB1A-8841",
  title: "EB-1A Extraordinary Ability Petition",
  visa_category: "EB-1A",
  jurisdiction: "US",
  status: "gathering",
  client_id: "client-01",
  client_name: "Dr. Aris Thorne",
  readiness_score: 92,
  organization_id: "org-01",
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-20T10:00:00Z",
  attention_required: true,
  attention_reason: "USCIS RFE response target date approaches",
};

const mockClient: ClientProfile = {
  id: "client-01",
  organization_id: "org-01",
  first_name: "Aris",
  last_name: "Thorne",
  email: "aris.thorne@example.com",
  phone: "+1-555-0199",
  nationality: "United Kingdom",
  cases_count: 1,
  created_at: "2026-01-15T10:00:00Z",
};

const mockDoc: DocumentItem = {
  id: "doc-01",
  title: "Foreign Passport Identity Page",
  filename: "passport_bio.pdf",
  file_size: "2.4 MB",
  mime_type: "application/pdf",
  category: "identity",
  case_id: "case-01",
  case_number: "US-EB1A-8841",
  status: "verified",
  verification_status: "verified",
  processing_status: "completed",
  sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  uploaded_at: "2026-01-15T10:00:00Z",
  page_count: 3,
  has_unresolved_anomaly: false,
  extracted_fields: [
    {
      id: "f-1",
      field_name: "passport_number",
      field_label: "Passport Number",
      original_value: "987654321",
      normalized_value: "987654321",
      confidence: 0.99,
      ocr_confidence: 0.99,
      extraction_confidence: 0.99,
      extraction_method: "pymupdf_regex_parser",
      validation_status: "verified",
      source_page: 1,
      is_manually_corrected: false,
    },
  ],
};

const mockTasks: CaseTask[] = [
  {
    id: "task-01",
    case_id: "case-01",
    title: "Draft Kazarian scholarly contribution brief",
    is_completed: false,
    due_date: "2026-02-01",
    priority: "high",
  },
];

const mockFindings: AIFinding[] = [
  {
    id: "finding-01",
    case_id: "case-01",
    title: "Citation Count Benchmark Exceeded",
    description: "Google Scholar citation index in top 1% for field.",
    severity: "informational",
    citation: "8 CFR § 204.5(h)(3)(vi)",
    status: "open",
  },
];

const mockMessages: MessageItem[] = [
  {
    id: "msg-01",
    sender: "Adv. Sarah Jenkins",
    sender_role: "caseworker",
    content: "Please upload the revised employer endorsement letter.",
    timestamp: "2026-01-22T14:30:00Z",
  },
];

describe("Stage 7 — UI/UX Staff Work Queues, Case Workspaces, and Mobile Client Portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Manager Priority Queue View (§7.3)", () => {
    it("renders all 8 ranks in strict 1-8 numerical sequence with proper priority tags", () => {
      render(<ManagerPriorityQueueView data={FALLBACK_PRIORITY_QUEUE} />);

      // Verify Header
      expect(screen.getByText(/Strict 1–8 Rank Order Management Protocol/i)).toBeDefined();

      // Verify each rank card 1 through 8 is present
      for (let r = 1; r <= 8; r++) {
        expect(screen.getByTestId(`priority-rank-${r}`)).toBeDefined();
        expect(screen.getByText(new RegExp(`Rank ${r}:`, "i"))).toBeDefined();
      }

      // Verify Rank 1 Authority Deadlines
      expect(screen.getByText(/Critical\/Overdue Deadlines/i)).toBeDefined();
      expect(screen.getByText(/USCIS RFE Response:/i)).toBeDefined();
      expect(screen.getByText(/IRCC Procedural Fairness Letter/i)).toBeDefined();

      // Verify Rank 2 Workload Allocation
      expect(screen.getByText(/Workload & Allocation/i)).toBeDefined();
      expect(screen.getByText(/Adv. Sarah Jenkins/i)).toBeDefined();
      expect(screen.getByText(/Unassigned Intake Queue:/i)).toBeDefined();

      // Verify Rank 3 Blocked Cases
      expect(screen.getByText(/Blocked Cases/i)).toBeDefined();
      expect(screen.getByText(/Statutory Ineligibility: Unlawful Presence/i)).toBeDefined();

      // Verify Rank 4 Overdue Client Responses
      expect(screen.getByText(/Overdue Client Responses/i)).toBeDefined();
      expect(screen.getByText(/Rajesh Patel/i)).toBeDefined();

      // Verify Rank 5 Pending Reviews
      expect(screen.getByText(/Pending Reviews/i)).toBeDefined();
      expect(screen.getByText(/Form I-140 Immigrant Petition/i)).toBeDefined();

      // Verify Rank 6 Quality Issues & Escalations
      expect(screen.getByText(/Quality Issues, Corrections & Escalations/i)).toBeDefined();
      expect(screen.getByText(/Unreadable Passport Bio Page Scan/i)).toBeDefined();

      // Verify Rank 7 Payment Status
      expect(screen.getByText(/Payment Status/i)).toBeDefined();
      expect(screen.getByText(/PAID IN FULL/i)).toBeDefined();
      expect(screen.getByText(/PENDING INVOICES/i)).toBeDefined();

      // Verify Rank 8 Continuous Quality Improvement
      expect(screen.getByText(/Performance View & Quality Improvement/i)).toBeDefined();
      expect(screen.getByText(/Continuous Quality Improvement Focus/i)).toBeDefined();
      expect(screen.getByText(/Recommended Quality Coaching Areas/i)).toBeDefined();
    });

    it("triggers action callbacks when clicking dispatch buttons across ranks", () => {
      const mockAction = vi.fn();
      render(<ManagerPriorityQueueView data={FALLBACK_PRIORITY_QUEUE} onAction={mockAction} />);

      // Rank 1: Dispatch Action
      const dispatchBtn = screen.getAllByRole("button", { name: /Dispatch Action/i })[0];
      fireEvent.click(dispatchBtn);
      expect(mockAction).toHaveBeenCalledWith(1, "dispatch_action", expect.any(Object));

      // Rank 2: Assign Caseworker
      const assignBtn = screen.getByRole("button", { name: /Assign Caseworker/i });
      fireEvent.click(assignBtn);
      expect(mockAction).toHaveBeenCalledWith(2, "assign_caseworker", expect.any(Array));

      // Rank 3: Inspect Blocker
      const inspectBtn = screen.getAllByRole("button", { name: /Inspect Blocker/i })[0];
      fireEvent.click(inspectBtn);
      expect(mockAction).toHaveBeenCalledWith(3, "inspect_blocker", expect.any(Object));

      // Rank 4: Dispatch Nudge via Chat
      const nudgeBtn = screen.getAllByRole("button", { name: /Dispatch Nudge via Chat/i })[0];
      fireEvent.click(nudgeBtn);
      expect(mockAction).toHaveBeenCalledWith(4, "dispatch_nudge", expect.any(Object));

      // Rank 5: Review & Sign Off
      const signoffBtn = screen.getAllByRole("button", { name: /Review (and|&) Sign Off/i })[0];
      fireEvent.click(signoffBtn);
      expect(mockAction).toHaveBeenCalledWith(5, "review_signoff", expect.any(Object));

      // Rank 6: Supervisor Adjudication
      const adjudicateBtn = screen.getAllByRole("button", { name: /Supervisor Adjudication/i })[0];
      fireEvent.click(adjudicateBtn);
      expect(mockAction).toHaveBeenCalledWith(6, "adjudicate_quality", expect.any(Object));
    });

    it("handles rank filtering tabs properly", () => {
      render(<ManagerPriorityQueueView data={FALLBACK_PRIORITY_QUEUE} />);

      // Filter to Rank 1 only
      const rank1Tab = screen.getByRole("tab", { name: /Rank 1/i });
      fireEvent.click(rank1Tab);

      // Rank 1 is visible
      expect(screen.getByTestId("priority-rank-1")).toBeDefined();
      // Other ranks are not rendered when filtered to Rank 1
      expect(screen.queryByTestId("priority-rank-2")).toBeNull();
      expect(screen.queryByTestId("priority-rank-7")).toBeNull();

      // Return to All 8 Ranks
      const allTab = screen.getByRole("tab", { name: /All 8 Ranks/i });
      fireEvent.click(allTab);
      expect(screen.getByTestId("priority-rank-1")).toBeDefined();
      expect(screen.getByTestId("priority-rank-2")).toBeDefined();
    });

    it("renders Day 0 clean state message when no items are pending", () => {
      render(
        <ManagerPriorityQueueView
          data={{
            summary: {},
            ranks: [],
          }}
        />
      );

      expect(screen.getByText(/Zero Priority Exceptions Pending • Day 0 Clean Slate/i)).toBeDefined();
      expect(screen.getByText(/All client filings, authority deadlines, and quality reviews are completely up to date/i)).toBeDefined();
    });
  });

  describe("2. Employee Workspace & All-in-One Studio Integration (§7.4)", () => {
    it("renders ManagerPriorityQueueView when team_queues tab is active", () => {
      render(
        <EmployeeWorkspace
          cases={[mockCase]}
          clients={[mockClient]}
          documents={[mockDoc]}
          tasks={mockTasks}
          aiFindings={mockFindings}
          messages={mockMessages}
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      // Switch to Team Queues tab
      const teamQueuesBtn = screen.getByRole("button", { name: /Team Queues/i });
      fireEvent.click(teamQueuesBtn);

      // The 8-rank manager priority queue should now be rendered
      expect(screen.getByText(/Strict 1–8 Rank Order Management Protocol/i)).toBeDefined();
      expect(screen.getByTestId("priority-rank-1")).toBeDefined();
      expect(screen.getByTestId("priority-rank-2")).toBeDefined();
    });

    it("renders All-in-One Case Studio with sub-views (Checklist, Tasks, Notes, Timeline)", () => {
      render(
        <EmployeeWorkspace
          cases={[mockCase]}
          clients={[mockClient]}
          documents={[mockDoc]}
          tasks={mockTasks}
          aiFindings={mockFindings}
          messages={mockMessages}
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      // Switch to All-in-One Studio tab
      const studioBtn = screen.getByRole("button", { name: /All-in-One Studio/i });
      fireEvent.click(studioBtn);

      expect(screen.getByText(/Active Case:/i)).toBeDefined();
      expect(screen.getByText(/Unified Studio \(All 5 Panels\)/i)).toBeDefined();
      expect(screen.getByText(/Per-Applicant Evidentiary Checklist/i)).toBeDefined();
    });
  });

  describe("3. Document Progression Stepper: Receipt != Acceptance != Package Readiness (§4.5, §7.5)", () => {
    it("shows Step 1 (Uploaded) on raw receipt", () => {
      render(
        <DocumentProgressionStepper
          status="uploaded"
          processingStatus="processing"
          verificationStatus="unverified"
        />
      );

      const stepper = screen.getByLabelText(/Document progression stage: Uploaded/i);
      expect(stepper).toBeDefined();
      expect(screen.getByTitle("Receipt confirmed")).toBeDefined();
      expect(screen.getByText("Uploaded")).toBeDefined();
    });

    it("shows Step 2 (Under Review) when extraction is complete but awaiting human verification", () => {
      render(
        <DocumentProgressionStepper
          status="under_review"
          processingStatus="completed"
          verificationStatus="pending"
        />
      );

      const stepper = screen.getByLabelText(/Document progression stage: Under Review/i);
      expect(stepper).toBeDefined();
      expect(screen.getByTitle("Human review in progress")).toBeDefined();
      expect(screen.getByText("Under Review")).toBeDefined();
    });

    it("shows Step 2 (Correction Required) when document was rejected with structured reason", () => {
      render(
        <DocumentProgressionStepper
          status="correction_required"
          processingStatus="completed"
          verificationStatus="rejected"
        />
      );

      const stepper = screen.getByLabelText(/Document progression stage: Correction Req\./i);
      expect(stepper).toBeDefined();
      expect(screen.getByTitle("Revise & resubmit")).toBeDefined();
      expect(screen.getByText("Correction Req.")).toBeDefined();
    });

    it("shows Step 3 (Accepted) when human verification succeeds", () => {
      render(
        <DocumentProgressionStepper
          status="accepted"
          processingStatus="completed"
          verificationStatus="verified"
        />
      );

      const stepper = screen.getByLabelText(/Document progression stage: Accepted/i);
      expect(stepper).toBeDefined();
      expect(screen.getByTitle("Verification passed")).toBeDefined();
      expect(screen.getByText("Accepted")).toBeDefined();
    });

    it("shows Step 4 (Package-Ready) when all 6 dimensions are satisfied", () => {
      render(
        <DocumentProgressionStepper
          status="package_ready"
          processingStatus="completed"
          verificationStatus="verified"
        />
      );

      const stepper = screen.getByLabelText(/Document progression stage: Package-Ready/i);
      expect(stepper).toBeDefined();
      expect(screen.getByTitle(/All 6 dimensions passed; ready for filing/i)).toBeDefined();
      expect(screen.getByText("Package-Ready")).toBeDefined();
    });
  });

  describe("4. Evidence-First Review in DocumentInspectorModal (§4.5, §7.4)", () => {
    it("renders document inspector modal with workbench split-screen mode and page navigation", () => {
      render(
        <DocumentInspectorModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          onDocumentUpdated={vi.fn()}
          defaultViewMode="workbench"
        />
      );

      // Verify Modal Title
      expect(screen.getByText(/Document Dossier & (Forensic OCR Workbench|Provenance)/i)).toBeDefined();

      // Verify physical document citation & completion badge
      expect(screen.getByText(/Foreign Passport Identity Page/i)).toBeDefined();
      expect(screen.getAllByText(/COMPLETED/i)[0]).toBeDefined();
    });

    it("renders structured rejection form with client preview and internal notes", () => {
      render(
        <DocumentInspectorModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          onDocumentUpdated={vi.fn()}
          defaultViewMode="matrix"
        />
      );

      // Switch to Verification tab
      const verifyTab = screen.getByRole("button", { name: /Human Verification/i });
      fireEvent.click(verifyTab);

      // Select Reject
      const rejectRadio = screen.getByLabelText(/Reject Document/i);
      fireEvent.click(rejectRadio);

      // Verify structured rejection form fields appear
      expect(screen.getByText(/Structured Rejection Reason Code/i)).toBeDefined();
      expect(screen.getByText(/Customizable Client-Facing Explanation/i)).toBeDefined();
      expect(screen.getByText(/Internal Legal Notes/i)).toBeDefined();
    });
  });

  describe("5. WCAG 2.2 AA Accessibility & State Design (§7.1, §7.6)", () => {
    it("provides accessible region labels, semantic headings, and touch targets >= 44px", () => {
      render(<ManagerPriorityQueueView data={FALLBACK_PRIORITY_QUEUE} />);

      const region = screen.getByRole("region", { name: /Staff Work Queue Priority Triage/i });
      expect(region).toBeDefined();

      // Check that filter buttons have minHeight 44px for touch accessibility
      const filterTabs = screen.getAllByRole("tab");
      expect(filterTabs.length).toBeGreaterThan(0);
      filterTabs.forEach((tab) => {
        expect(tab.style.minHeight).toBe("44px");
      });
    });

    it("does not rely on color alone for status communication", () => {
      render(<ManagerPriorityQueueView data={FALLBACK_PRIORITY_QUEUE} />);

      // Priority ranks have both numerical badges and explicit text labels
      expect(screen.getAllByText(/P1_CRITICAL|CRITICAL/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/P2_HIGH|HIGH/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/OVERLOADED|OPTIMAL|AVAILABLE/i).length).toBeGreaterThan(0);
    });
  });
});
