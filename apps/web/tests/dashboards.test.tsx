import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
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

describe("Three Separate Role Experiences", () => {
  describe("A. Owner Master Dashboard", () => {
    it("renders operational health, pipeline, and interactive tabs", () => {
      const handleOpenCreateCase = vi.fn();
      const handleOpenCreateClient = vi.fn();
      const handleSelectCase = vi.fn();

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

      // 1. Check Key Metrics
      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();
      expect(screen.getByText("100% Strict")).toBeDefined();
      expect(screen.getByText("Active Caseload & Retained Clients")).toBeDefined();
      expect(screen.getByText("Cases Requiring Owner Attention")).toBeDefined();
      expect(screen.getByText("Escrow & Retainer Revenue")).toBeDefined();

      // 2. Check Pipeline Stage Distribution
      expect(screen.getByText("Immigration Case Pipeline by Processing Stage")).toBeDefined();
      expect(screen.getByText("Evidence Gathering")).toBeDefined();
      expect(screen.getByText("Attorney Review")).toBeDefined();
      expect(screen.getByText("Package Assembly")).toBeDefined();

      // 3. Switch to All Cases tab and inspect a case
      const casesTabBtn = screen.getByRole("button", { name: /All Cases/i });
      fireEvent.click(casesTabBtn);

      expect(screen.getByText("Comprehensive Firm Caseload")).toBeDefined();
      expect(screen.getByText("CASE-US-8841")).toBeDefined();

      // Inspect button triggers callback
      const inspectButtons = screen.getAllByRole("button", { name: "Inspect" });
      fireEvent.click(inspectButtons[0]);
      expect(handleSelectCase).toHaveBeenCalled();

      // 4. Switch to Team Capacity tab
      const teamTabBtn = screen.getByRole("button", { name: /Team Capacity/i });
      fireEvent.click(teamTabBtn);
      expect(screen.getByText("Caseworker Workload & Review Capacity")).toBeDefined();
      expect(screen.getByText("Sarah Jenkins, Esq.")).toBeDefined();

      // 5. Switch to Financials tab
      const finTabBtn = screen.getByRole("button", { name: /Revenue & Billing/i });
      fireEvent.click(finTabBtn);
      expect(screen.getByText("Retainers, Invoices & Escrow Ledger")).toBeDefined();
      expect(screen.getByText("INV-2026-081")).toBeDefined();

      // 6. Switch to Audit tab
      const auditTabBtn = screen.getByRole("button", { name: /Audit Alerts/i });
      fireEvent.click(auditTabBtn);
      expect(screen.getByText("Append-Only Cryptographic Audit Log")).toBeDefined();
    });
  });

  describe("B. Employee Workspace", () => {
    it("renders casework queues, AI findings, tasks, and form signoff", () => {
      const handleToggleTask = vi.fn();
      const handleSendMessage = vi.fn();
      const handleSelectCase = vi.fn();
      const handleOpenUpload = vi.fn();

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
          onSelectCase={handleSelectCase}
          onOpenUploadModal={handleOpenUpload}
        />
      );

      // 1. My Work Dashboard view
      expect(screen.getByText("Active Cases Assigned")).toBeDefined();
      expect(screen.getByText("Documents Pending Verification")).toBeDefined();
      expect(screen.getByText("AI Evidentiary Alerts")).toBeDefined();

      // 2. Task completion checkbox toggle
      const taskCheckboxes = screen.getAllByRole("checkbox");
      fireEvent.click(taskCheckboxes[0]);
      expect(handleToggleTask).toHaveBeenCalled();

      // 3. Switch to Documents tab
      const docsTabBtn = screen.getByRole("button", { name: /Requirements & Evidence/i });
      fireEvent.click(docsTabBtn);
      expect(screen.getByText("Evidence & Document Verification Matrix")).toBeDefined();
      expect(screen.getByText("US_Passport_Biodata_Elena_Rostova.pdf")).toBeDefined();

      // 4. Switch to AI findings tab
      const aiTabBtn = screen.getByRole("button", { name: /AI Findings/i });
      fireEvent.click(aiTabBtn);
      expect(screen.getByText("AI Document Findings & Evidentiary Gap Analysis")).toBeDefined();
      expect(screen.getByText("Matter of Chawathe, 25 I&N Dec. 369 (AAO 2010)")).toBeDefined();

      // 5. Switch to Form Preparation tab and verify ConfigurableFormViewer
      const formTabBtn = screen.getByRole("button", { name: /Form Preparation/i });
      fireEvent.click(formTabBtn);
      expect(screen.getByText("USCIS_I140")).toBeDefined();
      expect(screen.getAllByText(/Information About the Person or Organization/i).length).toBeGreaterThan(0);

      // 6. Switch to Package Review tab and verify Readiness Checklist & Package Builder
      const pkgTabBtn = screen.getByRole("button", { name: /Package Review/i });
      fireEvent.click(pkgTabBtn);
      expect(screen.getByText("Deterministic Case Readiness Checklist")).toBeDefined();
      expect(screen.getByText(/Clear for Assembly/i)).toBeDefined();
      expect(screen.getByText(/Package Folders/i)).toBeDefined();
    });
  });

  describe("C. Client Portal", () => {
    it("renders transparency portal, onboarding, questionnaire, milestones, and messages", () => {
      const handleOpenUpload = vi.fn();
      const handleOpenQuestionnaire = vi.fn();
      const handleSendMessage = vi.fn();
      const handleMarkRead = vi.fn();

      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleOpenUpload}
          onOpenQuestionnaireModal={handleOpenQuestionnaire}
          onSendMessage={handleSendMessage}
          onMarkNotificationRead={handleMarkRead}
        />
      );

      // 1. Overview
      expect(screen.getByText(/Welcome to Your Immigration Transparency Portal/i)).toBeDefined();
      expect(screen.getByText("My Petition Details")).toBeDefined();
      expect(screen.getByText("CASE-US-8841")).toBeDefined();

      // 2. Click Continue Questionnaire in banner
      const continueBtn = screen.getByRole("button", { name: /Continue Questionnaire/i });
      fireEvent.click(continueBtn);
      expect(handleOpenQuestionnaire).toHaveBeenCalled();

      // 3. Switch to Milestones tab
      const milestonesTabBtn = screen.getByRole("button", { name: /Case Milestones/i });
      fireEvent.click(milestonesTabBtn);
      expect(screen.getByText("Immigration Pathway Milestones")).toBeDefined();
      expect(screen.getByText("Legal Retainer Executed")).toBeDefined();

      // 4. Switch to Messages tab and send message
      const messagesTabBtn = screen.getByRole("button", { name: /Lawyer Messages/i });
      fireEvent.click(messagesTabBtn);
      expect(screen.getByText("Attorney Communications")).toBeDefined();

      const messageInput = screen.getByPlaceholderText(/Type question or update for your legal team/i);
      fireEvent.change(messageInput, { target: { value: "Hello attorney team!" } });

      const sendBtn = screen.getByRole("button", { name: "Send" });
      fireEvent.click(sendBtn);
      expect(handleSendMessage).toHaveBeenCalledWith("Hello attorney team!");

      // 5. Switch to Privacy & Settings tab
      const settingsTabBtn = screen.getByRole("button", { name: /Privacy & Security/i });
      fireEvent.click(settingsTabBtn);
      expect(screen.getByText("Two-Factor Authentication (MFA)")).toBeDefined();
      expect(screen.getByText("MFA Enabled")).toBeDefined();
      expect(screen.getByText("Tenant Isolation Guarantee")).toBeDefined();
    });
  });
});
