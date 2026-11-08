import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { OwnerMasterDashboard } from "../../apps/web/components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../../apps/web/components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../../apps/web/components/dashboards/ClientPortal";
import { LoadingState, EmptyState } from "../../apps/web/components/common/StateViews";
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
} from "../../apps/web/lib/api";

describe("E2E Web Flows — 4-Tier Opaque-Box Dashboard Suite", () => {
  describe("Tier 1: Consolidated Agency Owner Master Dashboard", () => {
    it("renders operational health, caseload, retainers, and navigation tabs", async () => {
      const handleOpenCreateCase = vi.fn();
      const handleOpenCreateClient = vi.fn();
      const handleSelectCase = vi.fn();

      await act(async () => {
        render(
          <OwnerMasterDashboard
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            auditEvents={FIXTURE_AUDIT_EVENTS}
            invoices={FIXTURE_INVOICES}
            capacity={FIXTURE_CAPACITY}
            isLiveBackend={true}
            onOpenCreateCase={handleOpenCreateCase}
            onOpenCreateClient={handleOpenCreateClient}
            onSelectCase={handleSelectCase}
          />
        );
      });

      // Operational Health and Caseload metrics
      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();
      expect(screen.getByText("Active Caseload & Retained Clients")).toBeDefined();

      // Navigation sections
      expect(screen.getByRole("button", { name: /Company Overview/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Partner Onboarding & Leads/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Firm Governance & Configuration/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Reliability, Privacy & Security/i })).toBeDefined();
    });
  });

  describe("Tier 1: Consolidated Employee Workspace", () => {
    it("renders caseworker queues, priority triage, AI findings, and tasks", async () => {
      const handleSelectCase = vi.fn();
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
            notifications={FIXTURE_NOTIFICATIONS}
            onToggleTask={handleToggleTask}
            onSendMessage={handleSendMessage}
            onSelectCase={handleSelectCase}
          />
        );
      });

      // Caseworker queues
      expect(screen.getByText("Active Cases Assigned")).toBeDefined();
      expect(screen.getByText("Documents Pending Verification")).toBeDefined();
      expect(screen.getByText("AI Evidentiary Alerts")).toBeDefined();

      // Switch to Documents tab
      const docsTabBtn = screen.getByRole("button", { name: /Requirements & Evidence/i });
      act(() => {
        fireEvent.click(docsTabBtn);
      });
      expect(screen.getByText("Evidence & Document Verification Matrix")).toBeDefined();
    });
  });

  describe("Tier 1: Consolidated Client Portal Hub", () => {
    it("renders applicant overview, evidentiary checklist, and messaging hub", async () => {
      const activeCase = FIXTURE_CASES[0];

      await act(async () => {
        render(
          <ClientPortal
            myCase={activeCase}
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
      });

      // Clean applicant portal structure
      expect(screen.getByText(/Welcome to Your Immigration Transparency Portal/i)).toBeDefined();
      expect(screen.getByText("My Petition Details")).toBeDefined();
      expect(screen.getByText(/Upload Documents/i)).toBeDefined();
    });
  });

  describe("Tier 2: Guided Empty States and Loading Feedback", () => {
    it("renders sleek loading spinner with accessible status message", () => {
      render(<LoadingState message="Connecting to secure immigration database..." />);
      expect(screen.getByRole("status")).toBeDefined();
      expect(screen.getByText("Connecting to secure immigration database...")).toBeDefined();
    });

    it("renders guided empty state with call-to-action button", () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          title="No Immigration Cases Onboarded"
          description="Your firm workspace is clean. Create your first petition case to begin."
          action={<button onClick={handleAction}>Create First Case</button>}
        />
      );

      expect(screen.getByText("No Immigration Cases Onboarded")).toBeDefined();
      expect(screen.getByText("Your firm workspace is clean. Create your first petition case to begin.")).toBeDefined();
      const actionBtn = screen.getByRole("button", { name: "Create First Case" });
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });
});
