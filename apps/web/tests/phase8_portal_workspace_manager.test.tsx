import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ClientPortal, DocumentProgressionStepper } from "../components/dashboards/ClientPortal";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { DocumentInspectorModal } from "../components/modals/DocumentInspectorModal";
import {
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_INVOICES,
  FIXTURE_CAPACITY,
  FIXTURE_NOTIFICATIONS,
} from "../lib/api";

describe("Phase 8 — Client Portal, Staff Workspace & Manager Priority Board", () => {
  describe("1. Mobile-First Client Portal Experience", () => {
    it("renders status & concise progress summary with waiting state breakdown", () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Verify overview heading and status banner
      expect(screen.getAllByText("EB-1A Extraordinary Ability").length).toBeGreaterThan(0);
      expect(screen.getByText(/Waiting on You/i)).toBeDefined();
      expect(screen.getByText(/Waiting on the Firm/i)).toBeDefined();
    });

    it("renders Save/Resume in-progress forms, pending actions, and upcoming appointments card", () => {
      const handleOpenQuestionnaire = vi.fn();
      const handleOpenUpload = vi.fn();

      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleOpenUpload}
          onOpenQuestionnaireModal={handleOpenQuestionnaire}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Verify in-progress forms with completion %
      expect(screen.getByText("Form I-140 Immigrant Petition Questionnaire")).toBeDefined();
      expect(screen.getByText("65%")).toBeDefined();
      const resumeButtons = screen.getAllByRole("button", { name: /Resume Form/i });
      fireEvent.click(resumeButtons[0]);
      expect(handleOpenQuestionnaire).toHaveBeenCalled();

      // Verify pending actions checklist
      expect(screen.getAllByText(/Pending Actions/i).length).toBeGreaterThan(0);
      expect(screen.getByText("Re-upload Certified Translation of Foreign Marriage Record")).toBeDefined();
      const actionButtons = screen.getAllByRole("button", { name: /Take Action/i });
      fireEvent.click(actionButtons[0]);
      expect(handleOpenUpload).toHaveBeenCalled();

      // Verify upcoming official appointments
      expect(screen.getByText("USCIS Biometrics Appointment")).toBeDefined();
      expect(screen.getByText("Strategy Video Consultation with Lead Attorney")).toBeDefined();
      const rescheduleButtons = screen.getAllByRole("button", { name: /Request Reschedule/i });
      act(() => {
        fireEvent.click(rescheduleButtons[0]);
      });
      expect(screen.getByText(/Reschedule request submitted to your caseworker/i)).toBeDefined();
    });

    it("switches to Per-Applicant Checklist tab and groups requirements per applicant with exact badges", () => {
      const handleOpenUpload = vi.fn();

      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleOpenUpload}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Click on Per-Applicant Checklist navigation item
      const checklistNavBtn = screen.getByRole("button", { name: /Per-Applicant Checklist/i });
      act(() => {
        fireEvent.click(checklistNavBtn);
      });

      // Groupings: Primary Applicant, Spouse, Child
      expect(screen.getByText("Dr. Elena Rostova (Primary Applicant)")).toBeDefined();
      expect(screen.getByText("Dmitri Rostov (Spouse)")).toBeDefined();
      expect(screen.getByText("Sofia Rostova (Child)")).toBeDefined();

      // Exact status badges: accepted, received, rejected/correction req., required, outstanding
      expect(screen.getAllByText("✓ ACCEPTED").length).toBeGreaterThan(0);
      expect(screen.getAllByText("RECEIVED").length).toBeGreaterThan(0);
      expect(screen.getAllByText("✕ REJECTED (CORRECTION REQ.)").length).toBeGreaterThan(0);
      expect(screen.getAllByText("REQUIRED").length).toBeGreaterThan(0);
      expect(screen.getAllByText("OUTSTANDING").length).toBeGreaterThan(0);

      // Structured rejection reason codes and caseworker explanations
      expect(screen.getByText(/\[INCOMPLETE_DOCUMENT\] Incomplete Document or Missing Pages/i)).toBeDefined();
      expect(screen.getByText(/Letter 2 from Prof\. H\. Zhang lacks the referee's complete curriculum vitae/i)).toBeDefined();
      expect(screen.getByText(/\[MISSING_PAGES\] Missing Pages or Declaration/i)).toBeDefined();
      expect(screen.getByText(/Cyrillic marriage certificate was uploaded without the certified translator's formal declaration/i)).toBeDefined();

      // Re-upload action button on rejected items
      const reuploadButtons = screen.getAllByRole("button", { name: /Re-Upload Document/i });
      fireEvent.click(reuploadButtons[0]);
      expect(handleOpenUpload).toHaveBeenCalled();
    });

    it("renders the 4-state Document Progression Stepper pipeline", () => {
      const { rerender } = render(
        <DocumentProgressionStepper status="uploaded" />
      );
      expect(screen.getByLabelText("Document progression stage: Uploaded")).toBeDefined();

      rerender(<DocumentProgressionStepper status="under_review" />);
      expect(screen.getByLabelText("Document progression stage: Under Review")).toBeDefined();

      rerender(<DocumentProgressionStepper status="accepted" verificationStatus="verified" />);
      expect(screen.getByLabelText("Document progression stage: Accepted")).toBeDefined();

      rerender(<DocumentProgressionStepper status="ready" />);
      expect(screen.getByLabelText("Document progression stage: Package-Ready")).toBeDefined();

      rerender(<DocumentProgressionStepper status="rejected" verificationStatus="rejected" />);
      expect(screen.getByLabelText("Document progression stage: Correction Req.")).toBeDefined();
    });
  });

  describe("2. Employee Workspace & Officer Exception Queue", () => {
    it("defaults to assigned cases only with a toggle to view all office cases", async () => {
      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
            onToggleTask={vi.fn()}
            onSendMessage={vi.fn()}
            onSelectCase={vi.fn()}
            onOpenUploadModal={vi.fn()}
          />
        );
      });

      // Verify toggle button switch is present and indicates default assigned-only
      const toggleSwitch = screen.getByRole("switch");
      expect(toggleSwitch).toBeDefined();
      expect(screen.getByText(/Show: Assigned Cases Only \(Default\)/i)).toBeDefined();

      // Toggle to Show All Office Cases
      act(() => {
        fireEvent.click(toggleSwitch);
      });
      expect(screen.getByText(/Show: All Office Cases/i)).toBeDefined();
    });

    it("renders Exception-First Queue with 5 prioritized categories and direct actions", async () => {
      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
            onToggleTask={vi.fn()}
            onSendMessage={vi.fn()}
            onSelectCase={vi.fn()}
            onOpenUploadModal={vi.fn()}
          />
        );
      });

      // Navigate to Exception-First Queue
      const exceptionTabBtn = screen.getByRole("button", { name: /Exception-First Queue/i });
      act(() => {
        fireEvent.click(exceptionTabBtn);
      });

      // Category filter pills: All, Blockers, Documents, Client Actions, Deadlines, Reviews
      expect(screen.getByRole("button", { name: /Hard Blockers/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Document Issues/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Client Actions/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Filing Deadlines/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Pending Reviews/i })).toBeDefined();

      // Verify exception cards
      expect(screen.getByText("Missing Mandatory Regulatory Criteria (O-1A)")).toBeDefined();
      expect(screen.getByText("Potential J-1 2-Year Foreign Residence Requirement")).toBeDefined();
      expect(screen.getByText("Passport Identity Page Rejected")).toBeDefined();
      expect(screen.getByText("USCIS Premium Processing 15-Day Milestone")).toBeDefined();

      // Filter specifically by Hard Blockers
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /Hard Blockers/i }));
      });
      expect(screen.getByText("Missing Mandatory Regulatory Criteria (O-1A)")).toBeDefined();
      expect(screen.queryByText("Passport Identity Page Rejected")).toBeNull();
    });

    it("renders All-in-One Studio with unified Checklist, Tasks, Quarantined Notes, Package Manifest, and Timeline", async () => {
      const handleToggleTask = vi.fn();
      const handleSendMessage = vi.fn();

      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
            onToggleTask={handleToggleTask}
            onSendMessage={handleSendMessage}
            onSelectCase={vi.fn()}
            onOpenUploadModal={vi.fn()}
          />
        );
      });

      // Navigate to All-in-One Studio
      const studioTabBtn = screen.getByRole("button", { name: /All-in-One Studio/i });
      act(() => {
        fireEvent.click(studioTabBtn);
      });

      // Panel 1: Per-Applicant Evidentiary Checklist
      expect(screen.getByText("Per-Applicant Evidentiary Checklist")).toBeDefined();
      expect(screen.getByText("Dr. Elena Rostova (Primary Applicant)")).toBeDefined();

      // Panel 2: Immediate Tasks & Milestones
      expect(screen.getByText("Immediate Tasks & Milestones")).toBeDefined();

      // Panel 3: Client Messaging & Quarantined Notes
      expect(screen.getByText("Client Messaging & Quarantined Notes")).toBeDefined();
      // Switch to Quarantined Notes channel
      const quarantinedBtn = screen.getByRole("button", { name: /Internal Notes/i });
      act(() => {
        fireEvent.click(quarantinedBtn);
      });
      expect(screen.getByText(/Quarantined Caseworker Workspace/i)).toBeDefined();

      // Panel 4: Filing Package Manifest & Provenance with Merkle Root Hash
      expect(screen.getByText("Filing Package Manifest & Provenance")).toBeDefined();
      expect(screen.getByText("MERKLE ROOT HASH SEAL")).toBeDefined();

      // Panel 5: Immutable Case Timeline
      expect(screen.getByText("Immutable Case Timeline")).toBeDefined();
    });
  });

  describe("3. Document Inspector Modal with Structured Rejection", () => {
    it("enforces structured reason code and client explanation >= 5 characters, quarantining internal notes", async () => {
      const handleClose = vi.fn();
      const handleDocumentUpdated = vi.fn();

      render(
        <DocumentInspectorModal
          isOpen={true}
          document={FIXTURE_DOCUMENTS[0]}
          onClose={handleClose}
          onDocumentUpdated={handleDocumentUpdated}
        />
      );

      // Verify page navigation controls by switching to preview tab
      const previewTabBtn = screen.getByRole("button", { name: /Preview & Extracted OCR Text/i });
      fireEvent.click(previewTabBtn);

      expect(screen.getByRole("button", { name: /Prev Page/i })).toBeDefined();
      expect(screen.getAllByText(/Page 1 of/i).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Next Page/i })).toBeDefined();

      // Switch to Verification tab
      const verificationTabBtn = screen.getByRole("button", { name: /Human Verification & Audit Trail/i });
      fireEvent.click(verificationTabBtn);

      // Select "Reject Document (Requires Reason)" option
      const rejectRadio = screen.getByLabelText(/Reject Document/i);
      fireEvent.click(rejectRadio);

      // Verify reason code dropdown is rendered with structured reason codes
      const reasonSelect = screen.getByRole("combobox");
      expect(reasonSelect).toBeDefined();
      fireEvent.change(reasonSelect, { target: { value: "BLURRY_IMAGE" } });

      // Check client explanation input with validation
      const explanationInput = screen.getByPlaceholderText(/The scan of page 2 has excessive glare/i);
      // Enter short explanation (< 5 chars)
      fireEvent.change(explanationInput, { target: { value: "bad" } });
      const submitBtn = screen.getByRole("button", { name: /Reject Document & Notify Client/i });
      fireEvent.click(submitBtn);
      expect(screen.getByText(/Customizable client-facing explanation is required \(minimum 5 characters\)/i)).toBeDefined();
      expect(handleDocumentUpdated).not.toHaveBeenCalled();

      // Enter valid explanation (>= 5 chars)
      fireEvent.change(explanationInput, { target: { value: "Machine-readable zone unreadable due to lighting glare." } });

      // Verify internal legal notes quarantine banner
      expect(screen.getByText(/Quarantined from Client View/i)).toBeDefined();
      const internalNotesInput = screen.getByPlaceholderText(/Flagged for supervising attorney/i);
      fireEvent.change(internalNotesInput, { target: { value: "Check passport expiry vs visa validity." } });

      // Submit verification rejection
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleDocumentUpdated).toHaveBeenCalled();
      });
    });
  });

  describe("4. Manager Dashboard & Sequential Ranks 1 to 8", () => {
    it("renders Manager Priority Command Board strictly in Ranks 1 through 8", async () => {
      await act(async () => {
        render(
          <OwnerMasterDashboard
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            auditEvents={FIXTURE_AUDIT_EVENTS}
            invoices={FIXTURE_INVOICES}
            capacity={FIXTURE_CAPACITY}
            isLiveBackend={true}
            onOpenCreateCase={vi.fn()}
            onOpenCreateClient={vi.fn()}
            onSelectCase={vi.fn()}
          />
        );
      });

      // Switch to Manager Priority Command Board tab
      const priorityBoardBtn = screen.getByRole("button", { name: /Priority Command Board/i });
      act(() => {
        fireEvent.click(priorityBoardBtn);
      });

      // Strict sequential verification of Ranks 1 through 8
      expect(screen.getByText(/Rank 1: Critical\/Overdue Deadlines/i)).toBeDefined();
      expect(screen.getByText(/Rank 2: Workload & Allocation/i)).toBeDefined();
      expect(screen.getByText(/Rank 3: Blocked Cases/i)).toBeDefined();
      expect(screen.getByText(/Rank 4: Overdue Client Responses/i)).toBeDefined();
      expect(screen.getByText(/Rank 5: Pending Reviews/i)).toBeDefined();
      expect(screen.getByText(/Rank 6: Quality Issues, Corrections & Escalations/i)).toBeDefined();
      expect(screen.getByText(/Rank 7: Payment Status/i)).toBeDefined();
      expect(screen.getByText(/Rank 8: Performance View & Quality Improvement/i)).toBeDefined();

      // Verify Rank 7 payment status breakdown (Paid, Pending, Partially Paid)
      expect(screen.getByText("PAID IN FULL")).toBeDefined();
      expect(screen.getByText("PENDING INVOICES")).toBeDefined();
      expect(screen.getByText("PARTIALLY PAID")).toBeDefined();

      // Verify Rank 8 continuous quality improvement and team enablement focus (not blame-only)
      expect(screen.getByText(/Continuous Quality Improvement Focus/i)).toBeDefined();
      expect(screen.getAllByText(/94\.[26]%/).length).toBeGreaterThan(0); // First-Time Pass Rate
      expect(screen.getByText("1.2")).toBeDefined(); // Avg Review Cycles
      expect(screen.getByText(/Recommended Quality Coaching Areas/i)).toBeDefined();
    });

    it("allows managers to inspect officer-client conversations and quarantined internal notes across cases", async () => {
      await act(async () => {
        render(
          <OwnerMasterDashboard
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            auditEvents={FIXTURE_AUDIT_EVENTS}
            invoices={FIXTURE_INVOICES}
            capacity={FIXTURE_CAPACITY}
            isLiveBackend={true}
            onOpenCreateCase={vi.fn()}
            onOpenCreateClient={vi.fn()}
            onSelectCase={vi.fn()}
          />
        );
      });

      // Switch to Conversation Inspector tab
      const inspectorBtn = screen.getByRole("button", { name: /Conversation Inspector/i });
      act(() => {
        fireEvent.click(inspectorBtn);
      });

      // Verify executive oversight clearance banner
      expect(screen.getByText(/Managing Partner Oversight Clearance/i)).toBeDefined();

      // Verify transcript messages
      expect(screen.getByText("Dr. Elena Rostova")).toBeDefined();
      expect(screen.getAllByText("Sarah Vance, Esq.").length).toBeGreaterThan(0);
      expect(screen.getByText(/INTERNAL WORK NOTE/i)).toBeDefined();

      // Add a supervisory partner directive
      const directiveInput = screen.getByPlaceholderText(/Enter confidential managing partner direction/i);
      fireEvent.change(directiveInput, { target: { value: "Approved for premium processing upgrade." } });
      const postBtn = screen.getByRole("button", { name: /Post Directive/i });
      act(() => {
        fireEvent.click(postBtn);
      });
    });
  });
});
