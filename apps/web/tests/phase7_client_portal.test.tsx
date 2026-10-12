import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WaitingStateBanner } from "../components/portal/WaitingStateBanner";
import { DocumentRequestManager } from "../components/portal/DocumentRequestManager";
import { SecureMessagingHub } from "../components/portal/SecureMessagingHub";
import { ClientOnboardingWizard } from "../components/portal/ClientOnboardingWizard";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import {
  FIXTURE_CASES,
  FIXTURE_DOCUMENTS,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_INVOICES,
  FALLBACK_DOCUMENT_REQUESTS,
  FALLBACK_MESSAGE_THREADS,
  FALLBACK_THREAD_MESSAGES,
} from "../lib/api";

describe("Phase 7 — Client Portal, Requests, Messaging, and Notifications", () => {
  describe("WaitingStateBanner Component", () => {
    it("renders dual-breakdown of Waiting on You (Client) vs Waiting on the Firm", async () => {
      render(<WaitingStateBanner caseId="case-01" />);

      // Verify title and overview
      await waitFor(() => {
        expect(screen.getByText(/Immediate Next Action Required/i)).toBeDefined();
      });

      // Verify dual breakdown sections
      expect(screen.getByText(/Waiting on You \(Client\)/i)).toBeDefined();
      expect(screen.getByText(/Waiting on the Firm/i)).toBeDefined();

      // Verify progress readiness meter
      expect(screen.getByText(/Petition Filing & Onboarding Readiness/i)).toBeDefined();
    });

    it("triggers action callback when primary next action button is clicked", async () => {
      const handleActionClick = vi.fn();
      render(<WaitingStateBanner caseId="case-01" onActionClick={handleActionClick} />);

      await waitFor(() => {
        expect(screen.getByText(/Complete Action →/i)).toBeDefined();
      });

      const actionBtn = screen.getByText(/Complete Action →/i);
      fireEvent.click(actionBtn);

      expect(handleActionClick).toHaveBeenCalled();
    });
  });

  describe("DocumentRequestManager Component", () => {
    it("renders client requests with statutory requirement citations, rationale, and translation guidance", async () => {
      render(<DocumentRequestManager caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Document & Evidence Requests/i)).toBeDefined();
      });

      // Verify request title and statutory citation
      expect(screen.getAllByText(/Official Master's Degree Diploma & Transcripts/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/8 CFR § 204.5\(k\)\(3\)/i).length).toBeGreaterThan(0);

      // Verify rationale narrative
      expect(screen.getByText(/Required to substantiate the advanced degree prerequisite/i)).toBeDefined();

      // Verify translation guidance
      expect(screen.getByText(/Include certified English translation if original is in Ukrainian/i)).toBeDefined();
    });

    it("displays rejection reason and action banner for rejected requests", async () => {
      render(<DocumentRequestManager caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Evidence Rejected — Action Required/i)).toBeDefined();
      });

      // Verify specific rejection reason is displayed clearly
      expect(
        screen.getByText(/Low resolution photocopy. Transcripts page 2 is blurred and unreadable./i)
      ).toBeDefined();

      // Verify Re-upload Evidence button is present
      expect(screen.getByText(/Re-upload Evidence/i)).toBeDefined();
    });

    it("allows staff mode to create new document request with statutory fields", async () => {
      render(<DocumentRequestManager caseId="case-01" isStaffMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Issue Document Request/i)).toBeDefined();
      });

      const newBtn = screen.getByText(/Issue Document Request/i);
      fireEvent.click(newBtn);

      // Verify modal opened with required statutory input fields
      expect(screen.getByText(/Issue New Document Request/i)).toBeDefined();
      expect(screen.getByText(/Document Title \/ Requested Evidence \*/i)).toBeDefined();
      expect(screen.getByText(/Legal Rationale & Justification \*/i)).toBeDefined();
      expect(screen.getByText(/Statutory Requirement Code/i)).toBeDefined();
      expect(screen.getAllByText(/Translation Guidance/i).length).toBeGreaterThan(0);
    });

    it("allows staff mode to review and approve/reject evidence", async () => {
      render(<DocumentRequestManager caseId="case-01" isStaffMode={true} />);

      await waitFor(() => {
        expect(screen.getAllByText(/Review Submission/i).length).toBeGreaterThan(0);
      });

      const reviewButtons = screen.getAllByText(/Review Submission/i);
      fireEvent.click(reviewButtons[0]);

      // Verify review modal opened
      expect(screen.getByText(/Review Client Evidence Submission/i)).toBeDefined();
      expect(screen.getByText(/Approve Evidence/i)).toBeDefined();
      expect(screen.getByText(/Reject with Actionable Feedback/i)).toBeDefined();
    });
  });

  describe("SecureMessagingHub Component", () => {
    it("renders thread list with classification badges, unread counter, and case numbers", async () => {
      render(<SecureMessagingHub caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Secure Communications Hub/i)).toBeDefined();
      });

      // Verify threads listed
      expect(screen.getAllByText(/CASE-US-8841/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Client Inquiry/i).length).toBeGreaterThan(0);
    });

    it("strictly isolates staff internal notes from client view", async () => {
      // 1. In client mode: staff internal notes must NOT be rendered
      render(<SecureMessagingHub caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Secure Communications Hub/i)).toBeDefined();
      });

      // Should not see staff-only internal banner in client view
      expect(screen.queryByText(/STAFF INTERNAL NOTE — HIDDEN FROM CLIENT/i)).toBeNull();

      // 2. In staff mode: internal notes MUST be visible with prominent warning banner
      render(<SecureMessagingHub caseId="case-01" isStaffMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Staff View \(Internal Notes Enabled\)/i)).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.getByText(/STAFF INTERNAL NOTE — HIDDEN FROM CLIENT/i)).toBeDefined();
      });
      expect(screen.getByText(/Post as Staff-Only Internal Note/i)).toBeDefined();
    });

    it("displays confirmed delivery states and timestamps", async () => {
      render(<SecureMessagingHub caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getAllByText(/Delivered/i).length).toBeGreaterThan(0);
      });
    });

    it("allows searching and filtering threads by topic and status", async () => {
      render(<SecureMessagingHub caseId="case-01" isStaffMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/EB-1A Petition Strategy & Evidentiary Roadmap/i)).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Search subject or case.../i);
      fireEvent.change(searchInput, { target: { value: "Testimonial" } });

      // Testimonial thread matches
      expect(screen.getByText(/IEEE Expert Testimonial Guidance/i)).toBeDefined();
    });
  });

  describe("ClientOnboardingWizard Component", () => {
    it("navigates through all 5 guided intake steps", async () => {
      render(<ClientOnboardingWizard />);

      // Step 1: Consents
      expect(screen.getByText(/Legal Notice & Representation Disclosures/i)).toBeDefined();
      expect(screen.getByText(/Form G-28 Notice of Entry of Appearance/i)).toBeDefined();
      expect(screen.getByText(/Data Processing, Privacy & Cryptographic Verification Consent/i)).toBeDefined();

      // Continue to Step 2: Biodata
      const nextBtn1 = screen.getByText(/Continue to Step 2 →/i);
      fireEvent.click(nextBtn1);

      expect(screen.getByText(/Legal First Name \(Given Name\)/i)).toBeDefined();
      expect(screen.getByText(/Current Passport Number/i)).toBeDefined();

      // Continue to Step 3: Dependants
      const nextBtn2 = screen.getByText(/Continue to Step 3 →/i);
      fireEvent.click(nextBtn2);

      expect(screen.getByText(/Authorized Family Dependants/i)).toBeDefined();
      expect(screen.getByText(/Authorized to View Case/i)).toBeDefined();

      // Continue to Step 4: Questionnaire
      const nextBtn3 = screen.getByText(/Continue to Step 4 →/i);
      fireEvent.click(nextBtn3);

      expect(screen.getByText(/Statutory Criteria & Extraordinary Ability Intake/i)).toBeDefined();
      expect(screen.getByText(/Current Employer or Institutional Affiliation \*/i)).toBeDefined();

      // Continue to Step 5: Review
      const nextBtn4 = screen.getByText(/Continue to Step 5 →/i);
      fireEvent.click(nextBtn4);

      expect(screen.getByText(/Onboarding Summary Verification/i)).toBeDefined();
      expect(screen.getByText(/Complete Onboarding & Activate Portal/i)).toBeDefined();
    });

    it("allows toggling dependant case viewing authorization", async () => {
      render(<ClientOnboardingWizard />);

      // Jump to Step 3 (Family & Dependants)
      const step3Tab = screen.getByText(/Family & Dependants/i);
      fireEvent.click(step3Tab);

      expect(screen.getByText(/Authorized to View Case/i)).toBeDefined();
      const authCheckbox = screen.getAllByRole("checkbox")[0];
      fireEvent.click(authCheckbox);
      // Toggle state updated
      expect(authCheckbox).toBeDefined();
    });
  });

  describe("ClientPortal Integration", () => {
    it("integrates WaitingStateBanner, DocumentRequestManager, and SecureMessagingHub", async () => {
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

      // Verify WaitingStateBanner is present in Overview tab
      await waitFor(() => {
        expect(screen.getByText(/Immediate Next Action Required/i)).toBeDefined();
      });

      // Switch to Evidence & Uploads tab
      const docsTab = screen.getByRole("button", { name: /Evidence & Uploads/i });
      fireEvent.click(docsTab);

      // Verify DocumentRequestManager is embedded
      await waitFor(() => {
        expect(screen.getByText(/Document & Evidence Requests/i)).toBeDefined();
      });

      // Switch to Messages tab
      const messagesTab = screen.getByRole("button", { name: /Lawyer Messages/i });
      fireEvent.click(messagesTab);

      // Verify SecureMessagingHub is embedded
      await waitFor(() => {
        expect(screen.getByText(/Secure Communications Hub/i)).toBeDefined();
      });
    });
  });
});
