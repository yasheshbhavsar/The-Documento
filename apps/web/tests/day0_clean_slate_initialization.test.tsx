import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { DEMO_USERS } from "../lib/auth";

describe("Day 0 Scratch Setup — Zero Mock Data & Interactive Workflow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders OwnerMasterDashboard in clean Day 0 state with 0 cases and Walkthrough Banner", () => {
    const handleOpenCreateCase = vi.fn();
    const handleOpenCreateClient = vi.fn();

    render(
      <OwnerMasterDashboard
        cases={[]}
        clients={[]}
        auditEvents={[]}
        invoices={[]}
        capacity={[]}
        isLiveBackend={false}
        onOpenCreateCase={handleOpenCreateCase}
        onOpenCreateClient={handleOpenCreateClient}
        onSelectCase={vi.fn()}
      />
    );

    // Verify Active Caseload is 0
    expect(screen.getByText("Active Caseload: 0 Petitions")).toBeDefined();

    // Verify Day 0 Clean Slate Walkthrough Banner
    expect(screen.getByText(/Clean Slate Initial Setup • Day 0 Practice Ready/i)).toBeDefined();
    expect(screen.getByText(/Step 1: Retain Client/i)).toBeDefined();
    expect(screen.getByText(/Step 2: Open Petition/i)).toBeDefined();
    expect(screen.getByText(/Step 3: Upload Evidence/i)).toBeDefined();
    expect(screen.getByText(/Step 4: Real-time Readiness/i)).toBeDefined();

    // Action buttons in walkthrough banner
    const retainBtn = screen.getByRole("button", { name: /1\. \+ Retain Client/i });
    fireEvent.click(retainBtn);
    expect(handleOpenCreateClient).toHaveBeenCalled();

    const openCaseBtn = screen.getByRole("button", { name: /2\. \+ New Case Record/i });
    fireEvent.click(openCaseBtn);
    expect(handleOpenCreateCase).toHaveBeenCalled();

    // Empty caseload table display
    expect(screen.getByText("No Active Cases in Firm Workspace")).toBeDefined();
  });

  it("renders EmployeeWorkspace in clean Day 0 state with zero exceptions and zero assigned cases", () => {
    render(
      <EmployeeWorkspace
        cases={[]}
        clients={[]}
        documents={[]}
        tasks={[]}
        aiFindings={[]}
        messages={[]}
        onToggleTask={vi.fn()}
        onSendMessage={vi.fn()}
        onSelectCase={vi.fn()}
        onOpenUploadModal={vi.fn()}
        onDocumentUpdated={vi.fn()}
        onResolveFinding={vi.fn()}
        onDismissFinding={vi.fn()}
        onEscalateFinding={vi.fn()}
      />
    );

    // Switch to Exception-First Queue
    const queueBtn = screen.getByRole("button", { name: /Exception-First Queue/i });
    fireEvent.click(queueBtn);

    // Verify Day 0 Zero Exceptions state
    expect(screen.getByText("Zero Exceptions Pending • Day 0 Initial State")).toBeDefined();
    expect(screen.getByText(/There are currently no document verification rejections/i)).toBeDefined();
  });

  it("renders ClientPortal in clean Day 0 state when no case is opened yet", () => {
    render(
      <ClientPortal
        myCase={null}
        documents={[]}
        messages={[]}
        notifications={[]}
        invoices={[]}
        onOpenUploadModal={vi.fn()}
        onOpenQuestionnaireModal={vi.fn()}
        onSendMessage={vi.fn()}
        onMarkNotificationRead={vi.fn()}
      />
    );

    // Verify initial setup greeting and badge
    expect(screen.getAllByText("Initial Client Intake").length).toBeGreaterThan(0);
    expect(screen.getByText(/Initial Setup Ready/i)).toBeDefined();
    expect(screen.getByText(/Onboard your first matter to begin tracking/i)).toBeDefined();

    // Verify 0 in-progress forms and 0 pending actions
    expect(screen.getByText("0 Forms In Progress • 0 Pending Actions")).toBeDefined();
    expect(screen.getByText("No questionnaires currently pending.")).toBeDefined();
    expect(screen.getByText("No urgent client actions pending at this stage.")).toBeDefined();
    expect(screen.getByText("No upcoming appointments scheduled.")).toBeDefined();
  });

  it("displays Day 0 notice in CreateCaseModal when 0 clients exist", () => {
    render(
      <CreateCaseModal
        isOpen={true}
        onClose={vi.fn()}
        clients={[]}
        onCaseCreated={vi.fn()}
      />
    );

    expect(screen.getByText(/Initial Setup \(Day 0\):/i)).toBeDefined();
    expect(screen.getByText(/No retained clients are registered in the firm directory yet/i)).toBeDefined();
  });

  it("allows retaining a client and creating a case record interactively", async () => {
    const handleClientCreated = vi.fn();
    const handleCaseCreated = vi.fn();

    // 1. Render CreateClientModal
    render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onClientCreated={handleClientCreated}
      />
    );

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);

    const nationalityInput = screen.getByLabelText(/Primary Nationality/i);

    fireEvent.change(firstNameInput, { target: { value: "Aarav" } });
    fireEvent.change(lastNameInput, { target: { value: "Patel" } });
    fireEvent.change(emailInput, { target: { value: "aarav.patel@example.com" } });
    fireEvent.change(nationalityInput, { target: { value: "IND" } });

    const submitClientBtn = screen.getByRole("button", { name: /Save Client Record/i });
    fireEvent.click(submitClientBtn);

    // 2. Render CreateCaseModal with the newly retained client
    const dummyClient = {
      id: "client-aarav",
      first_name: "Aarav",
      last_name: "Patel",
      email: "aarav.patel@example.com",
      nationality: "India",
      organization_id: "demo-org",
      created_at: new Date().toISOString(),
    };

    const { unmount } = render(
      <CreateCaseModal
        isOpen={true}
        onClose={vi.fn()}
        clients={[dummyClient]}
        onCaseCreated={handleCaseCreated}
      />
    );

    const titleInput = screen.getAllByLabelText(/Petition Case Title/i)[0];
    fireEvent.change(titleInput, { target: { value: "EB-2 NIW: Aarav Patel" } });

    const submitCaseBtn = screen.getByRole("button", { name: /Create Case Record/i });
    fireEvent.click(submitCaseBtn);
    unmount();
  });

  it("renders Day 0 Reset button in WorkspaceHeader and confirms reset callback", () => {
    const handleReset = vi.fn();
    // Mock window.confirm
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    render(
      <WorkspaceHeader
        currentUser={DEMO_USERS.master_admin}
        onLogout={vi.fn()}
        onSwitchRole={vi.fn()}
        onResetToScratch={handleReset}
        isLiveBackend={false}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Day 0 Reset/i });
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(handleReset).toHaveBeenCalled();
  });
});
