import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FirmConfigurationHub } from "../components/firm/FirmConfigurationHub";
import { ApprovalGatesCard } from "../components/cases/ApprovalGatesCard";
import { ImmigrationCase } from "../lib/types";

describe("Phase 9 — Firm Configuration and Approval Gates", () => {
  const dummyCase: ImmigrationCase = {
    id: "case-phase9-01",
    case_number: "CASE-US-9901",
    title: "O-1A Extraordinary Ability Petition",
    client_id: "client-01",
    client_name: "Dr. Aris Thorne",
    jurisdiction: "USA",
    visa_category: "O-1A",
    status: "intake",
    organization_id: "org-01",
    client_engagement_type: "retained",
    is_retained: true,
    payment_clearance_status: "PAID",
    preparation_status: "CLEARANCE_PENDING",
    review_status: "NOT_STARTED",
    submission_authorization_status: "NOT_REQUESTED",
    handover_authorization_status: "NOT_REQUESTED",
    firm_config_version: 1,
    firm_config_update_available: true,
    substantive_authorizations: {
      manager_authorization: { authorized: false, cleared: false },
      accounts_clearance: { cleared: false },
      counsellor_confirmation: { confirmed: false, cleared: false },
    },
    progressive_reviews: {
      officer_initial_review: { completed: false },
      senior_review: { completed: false },
      lawyer_review: { completed: false },
    },
    created_at: "2026-03-25T10:00:00Z",
  };

  describe("FirmConfigurationHub Component", () => {
    it("renders top header with version badge and immutable safeguards", () => {
      render(<FirmConfigurationHub organizationId="org-01" activeRole="master_admin" />);

      // Top header
      expect(screen.getByText("Firm Governance & Operating Policy")).toBeDefined();
      expect(screen.getByText("Config v1")).toBeDefined();

      // Safeguards Banner
      expect(screen.getByText("Essential Firm Safeguards (Immutable Governance)")).toBeDefined();
      expect(screen.getByText("Cryptographic Audit Logging")).toBeDefined();
      expect(screen.getByText("Lawyer Sign-Off Gate")).toBeDefined();
      expect(screen.getByText("Tripartite Clearance Gate")).toBeDefined();
      expect(screen.getByText("Reason Justification Rule")).toBeDefined();
      expect(screen.getByText("Zero Cross-Tenant Leakage")).toBeDefined();
      expect(screen.getByText("Case Snapshot Version Pinning")).toBeDefined();
    });

    it("renders all 10 governance domain navigation tabs", () => {
      render(<FirmConfigurationHub organizationId="org-01" activeRole="master_admin" />);

      expect(screen.getAllByText("Roles & Access").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Pathways & Jurisdictions")).toBeDefined();
      expect(screen.getByText("Dossier Folders")).toBeDefined();
      expect(screen.getByText("Checklists & Tiers")).toBeDefined();
      expect(screen.getByText("Cadence & Escalations")).toBeDefined();
      expect(screen.getByText("Inactivity Policy")).toBeDefined();
      expect(screen.getByText("Review Gates")).toBeDefined();
      expect(screen.getByText("Approval Owners")).toBeDefined();
      expect(screen.getByText("Communication Templates")).toBeDefined();
      expect(screen.getByText("Rejection Codes")).toBeDefined();
    });

    it("allows switching tabs and shows domain-specific editors", () => {
      render(<FirmConfigurationHub organizationId="org-01" activeRole="master_admin" />);

      // Switch to Reminders tab
      fireEvent.click(screen.getByText("Cadence & Escalations"));
      expect(screen.getByText("Automated Reminders & Escalation Policy")).toBeDefined();
      expect(screen.getByText("Enable Optional Automated Reminders")).toBeDefined();
      expect(screen.getByText("1st Reminder (Days)")).toBeDefined();

      // Switch to Review Gates tab
      fireEvent.click(screen.getByText("Review Gates"));
      expect(screen.getByText("Progressive Review Stage Configuration")).toBeDefined();
      expect(screen.getByText("Require Lead Lawyer Sign-Off Before Submission")).toBeDefined();
    });

    it("opens the justification modal and validates >= 10 character rationale", () => {
      render(<FirmConfigurationHub organizationId="org-01" activeRole="master_admin" />);

      // Click update domain
      fireEvent.click(screen.getByText("Update Domain"));

      // Modal appears
      expect(screen.getByText("Mandatory Change Justification (Audit Trail)")).toBeDefined();
      expect(screen.getByText("Minimum 10 characters required")).toBeDefined();

      const textarea = screen.getByPlaceholderText(/Explain the business, legal, or operational rationale/i);
      const submitBtn = screen.getByRole("button", { name: /Confirm & Record Audit Log/i }) as HTMLButtonElement;

      // Short rationale should keep button disabled or show error
      fireEvent.change(textarea, { target: { value: "short" } });
      expect(submitBtn.disabled).toBe(true);

      // Valid rationale enables submit button
      fireEvent.change(textarea, { target: { value: "Updating firm policy per Q2 compliance update guidelines" } });
      expect(submitBtn.disabled).toBe(false);
    });

    it("opens and displays the firm configuration audit trail modal", () => {
      render(<FirmConfigurationHub organizationId="org-01" activeRole="master_admin" />);

      const auditBtn = screen.getByRole("button", { name: /Audit Trail/i });
      fireEvent.click(auditBtn);

      expect(screen.getByText("Firm Configuration Audit Trail")).toBeDefined();
    });
  });

  describe("ApprovalGatesCard Component", () => {
    it("renders retained client badge and 5 decoupled state machines", () => {
      render(<ApprovalGatesCard caseItem={dummyCase} activeRole="case_manager" />);

      // Retained indicator
      expect(screen.getByText("Retained Client Matter")).toBeDefined();

      // 5 Decoupled State Machines
      expect(screen.getByText("1. Payment Status")).toBeDefined();
      expect(screen.getByText("PAID")).toBeDefined();

      expect(screen.getByText("2. Preparation")).toBeDefined();
      expect(screen.getByText("CLEARANCE_PENDING")).toBeDefined();

      expect(screen.getByText("3. Review Status")).toBeDefined();
      expect(screen.getByText("NOT_STARTED")).toBeDefined();

      expect(screen.getByText("4. Submission Auth")).toBeDefined();
      expect(screen.getAllByText("NOT_REQUESTED").length).toBeGreaterThanOrEqual(2);

      expect(screen.getByText("5. Handover Auth")).toBeDefined();
    });

    it("displays warning banner for non-retained consultation prospects blocking substantive preparation", () => {
      const consultationCase: ImmigrationCase = {
        ...dummyCase,
        is_retained: false,
        client_engagement_type: "consultation",
        preparation_status: "CONSULTATION_ONLY",
      };

      render(<ApprovalGatesCard caseItem={consultationCase} activeRole="case_manager" />);

      expect(screen.getByText(/Non-Retained Prospect: CONSULTATION/i)).toBeDefined();
      expect(screen.getByText("Preparation Blocked")).toBeDefined();
      expect(screen.getByText(/Initial consultation and preliminary assessment remain strictly separate/i)).toBeDefined();
    });

    it("renders tripartite onboarding clearance checklist with interactive gates", () => {
      const handleCaseUpdated = vi.fn();
      render(
        <ApprovalGatesCard
          caseItem={dummyCase}
          activeRole="case_manager"
          onCaseUpdated={handleCaseUpdated}
        />
      );

      // Tripartite checklist
      expect(screen.getByText("Tripartite Onboarding Clearance Gate")).toBeDefined();
      expect(screen.getByText("1. Manager Authorization")).toBeDefined();
      expect(screen.getByText("2. Accounts Clearance")).toBeDefined();
      expect(screen.getByText("3. Counsellor Confirmation")).toBeDefined();

      expect(screen.getByText("Authorize Manager Gate")).toBeDefined();
      expect(screen.getByText("Clear Accounts Gate")).toBeDefined();
      expect(screen.getByText("Confirm Counsellor Gate")).toBeDefined();
    });

    it("renders progressive review stages including lead lawyer signoff", () => {
      render(<ApprovalGatesCard caseItem={dummyCase} activeRole="case_manager" />);

      expect(screen.getByText("Progressive Review Stages")).toBeDefined();
      expect(screen.getByText("1. Officer Initial Review")).toBeDefined();
      expect(screen.getByText("2. Senior Technical Check")).toBeDefined();
      expect(screen.getByText("3. Lead Lawyer Sign-Off")).toBeDefined();
      expect(screen.getByText("Sign Off Officer Review")).toBeDefined();
      expect(screen.getByText("Execute Lawyer Sign-Off")).toBeDefined();
    });

    it("supports submission hold modal and controls", () => {
      render(<ApprovalGatesCard caseItem={dummyCase} activeRole="case_manager" />);

      const holdBtn = screen.getByText("Apply Submission Hold");
      fireEvent.click(holdBtn);

      expect(screen.getByText("Place Submission Hold")).toBeDefined();
      expect(screen.getByText("Accounts Concern (Billing / Arrears)")).toBeDefined();
    });

    it("supports migration modal when firm configuration update is available", () => {
      render(<ApprovalGatesCard caseItem={dummyCase} activeRole="case_manager" />);

      expect(screen.getByText(/Firm Configuration Update Available/i)).toBeDefined();
      const migrateBtn = screen.getByText("Migrate Matter");
      fireEvent.click(migrateBtn);

      expect(screen.getByText("Migrate Matter to Latest Firm Configuration")).toBeDefined();
      expect(screen.getByPlaceholderText(/State the reason for updating this case's pinned configuration rules/i)).toBeDefined();
    });

    it("supports manual reminder and acknowledgement modal triggers", () => {
      render(<ApprovalGatesCard caseItem={dummyCase} activeRole="case_manager" />);

      const reminderBtn = screen.getByText("✉️ Send Manual Reminder");
      fireEvent.click(reminderBtn);
      expect(screen.getByText("Dispatch Manual Client Reminder")).toBeDefined();

      // Close and open ack modal
      fireEvent.click(screen.getByText("Cancel"));

      const ackBtn = screen.getByText("📨 Send Acknowledgement");
      fireEvent.click(ackBtn);
      expect(screen.getByText("Dispatch Formal Acknowledgement")).toBeDefined();
    });
  });
});
