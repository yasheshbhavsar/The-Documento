import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { UserContext } from "../lib/types";

describe("Day 0 Scratch Setup — Zero Mock Data & Interactive Workflow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders OwnerMasterDashboard in clean Day 0 state with single unified + Onboard Client & Case option and no duplicate Clean Slate banner", () => {
    const handleOpenCreateClient = vi.fn();

    render(
      <OwnerMasterDashboard
        cases={[]}
        clients={[]}
        auditEvents={[]}
        invoices={[]}
        capacity={[]}
        isLiveBackend={false}
        onOpenCreateClient={handleOpenCreateClient}
        onSelectCase={vi.fn()}
      />
    );

    // Verify Active Caseload is 0
    expect(screen.getByText("Active Caseload: 0 Petitions")).toBeDefined();

    // Verify duplicate dark Clean Slate banner & split buttons are removed
    expect(screen.queryByText(/Clean Slate Initial Setup • Day 0 Practice Ready/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ Retain Client/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ New Case Record/i })).toBeNull();

    // Verify unified "+ Onboard Client & Case" button triggers intake flow
    const onboardButtons = screen.getAllByRole("button", { name: /\+ Onboard Client & Case/i });
    expect(onboardButtons.length).toBeGreaterThan(0);
    fireEvent.click(onboardButtons[0]);
    expect(handleOpenCreateClient).toHaveBeenCalled();

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

  it("onboards a client and opens their initial visa case in one unified step", async () => {
    const handleClientCreated = vi.fn();
    const handleCaseCreated = vi.fn();

    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onClientCreated={handleClientCreated}
        onCaseCreated={handleCaseCreated}
        clients={[]}
      />
    );

    expect(screen.getByText("Onboard Client & Open Visa Case")).toBeDefined();
    expect(screen.getByTestId("unified-case-scope-section")).toBeDefined();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Aarav" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Patel" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "aarav.patel@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Primary Nationality/i), {
      target: { value: "IND" },
    });
    fireEvent.change(screen.getByLabelText(/Immigration Jurisdiction/i), {
      target: { value: "Canada (IRCC)" },
    });

    const submitUnifiedBtn = screen.getByRole("button", {
      name: /Onboard Client & Open Case/i,
    });
    fireEvent.click(submitUnifiedBtn);

    await waitFor(() => {
      expect(handleClientCreated).toHaveBeenCalledTimes(1);
      expect(handleCaseCreated).toHaveBeenCalledTimes(1);
    });

    const createdCase = handleCaseCreated.mock.calls[0][0];
    expect(createdCase.jurisdiction).toBe("Canada (IRCC)");
    expect(createdCase.title).toContain("Aarav Patel");
    expect(handleCaseCreated.mock.calls[0][2]).toBe(true);
    unmount();
  });

  it("opens a new case for an existing client via the Existing Client tab without duplicating the client", async () => {
    const handleClientCreated = vi.fn();
    const handleCaseCreated = vi.fn();
    const existingClient = {
      id: "client-existing-1",
      first_name: "Meera",
      last_name: "Nair",
      email: "meera.nair@example.com",
      nationality: "IND",
      organization_id: "org-1",
      created_at: "2026-11-06T00:00:00Z",
    };

    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onClientCreated={handleClientCreated}
        onCaseCreated={handleCaseCreated}
        clients={[existingClient]}
      />
    );

    const existingTab = screen.getByRole("tab", { name: /Existing Client \(1\)/i });
    fireEvent.click(existingTab);

    fireEvent.change(screen.getByLabelText(/Immigration Jurisdiction/i), {
      target: { value: "Germany (BAMF)" },
    });

    const openCaseBtn = screen.getByRole("button", { name: /Open Case Record/i });
    fireEvent.click(openCaseBtn);

    await waitFor(() => {
      expect(handleCaseCreated).toHaveBeenCalledTimes(1);
    });
    expect(handleClientCreated).not.toHaveBeenCalled();
    expect(handleCaseCreated.mock.calls[0][0].jurisdiction).toBe("Germany (BAMF)");
    expect(handleCaseCreated.mock.calls[0][1].id).toBe("client-existing-1");
    expect(handleCaseCreated.mock.calls[0][2]).toBe(false);
    unmount();
  });

  it("recovers from partial case-creation failure without creating duplicate clients on retry", async () => {
    const { api } = await import("../lib/api");
    const createClientSpy = vi.spyOn(api, "createClient");
    const createCaseSpy = vi
      .spyOn(api, "createCase")
      .mockRejectedValueOnce(new Error("Temporary network timeout"));

    const handleClientCreated = vi.fn();
    const handleCaseCreated = vi.fn();

    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onClientCreated={handleClientCreated}
        onCaseCreated={handleCaseCreated}
        clients={[]}
      />
    );

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Rohan" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Desai" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "rohan.desai@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Primary Nationality/i), {
      target: { value: "IND" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Onboard Client & Open Case/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Client profile saved, but opening their case failed");
    });
    expect(createClientSpy).toHaveBeenCalledTimes(1);
    expect(handleCaseCreated).not.toHaveBeenCalled();

    // Retry should now say "Open Case Record" and only invoke createCase
    const retryBtn = screen.getByRole("button", { name: /Open Case Record/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(handleCaseCreated).toHaveBeenCalledTimes(1);
    });
    expect(createClientSpy).toHaveBeenCalledTimes(1);

    createClientSpy.mockRestore();
    createCaseSpy.mockRestore();
    unmount();
  });

  it("prefills jurisdiction and visa pathway when converting a calculator lead and normalizes ISO jurisdiction on live POST /cases", async () => {
    const { api } = await import("../lib/api");
    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onClientCreated={vi.fn()}
        onCaseCreated={vi.fn()}
        clients={[]}
        initialPrefill={{
          firstName: "Simran",
          lastName: "Kaur",
          email: "simran@example.com",
          jurisdiction: "Canada (IRCC)",
          visaCategory: "Express Entry PNP",
          leadScoreNote: "Canada CRS — 496 pts",
        }}
      />
    );

    expect(
      (screen.getByLabelText(/Immigration Jurisdiction/i) as HTMLSelectElement).value
    ).toBe("Canada (IRCC)");
    expect(
      (screen.getByLabelText(/Pathway \/ Visa Category/i) as HTMLSelectElement).value
    ).toBe("Express Entry PNP");
    unmount();

    // Verify api.createCase normalizes human-readable jurisdiction to <=3 char ISO code for FastAPI
    const createdClient = await api.createClient({
      first_name: "Simran",
      last_name: "Kaur",
      email: "simran@example.com",
      nationality: "IND",
    });

    let capturedBody: any = null;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body || "{}"));
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: "11111111-2222-3333-4444-555555555555",
          client_id: createdClient.data.id,
          case_number: "CASE-9901",
          title: "Express Entry PNP: Simran Kaur",
          jurisdiction: "CA",
          visa_category: "Express Entry PNP",
          status: "intake",
        }),
      } as Response;
    });

    const liveRes = await api.createCase({
      client_id: createdClient.data.id,
      title: "Express Entry PNP: Simran Kaur",
      case_number: "CASE-9901",
      jurisdiction: "Canada (IRCC)",
      visa_category: "Express Entry PNP",
    });

    expect(capturedBody.jurisdiction).toBe("CA");
    expect(capturedBody.jurisdiction.length).toBeLessThanOrEqual(3);
    expect(liveRes.isLiveBackend).toBe(true);
    expect(liveRes.data.client_name).toBe("Simran Kaur");
    expect(liveRes.data.jurisdiction).toBe("Canada (IRCC)");
    fetchSpy.mockRestore();
  });

  it("renders Day 0 Reset button in WorkspaceHeader and confirms reset callback", () => {
    const handleReset = vi.fn();
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const ownerUser: UserContext = {
      id: "owner-1",
      email: "partner@northstarrcic.ca",
      full_name: "Priya Grewal, RCIC",
      role: "master_admin",
      organization_id: "ten-northstar-rcic",
      organization_name: "NorthStar RCIC",
      experience: "master_admin",
      permissions: ["cases:read", "cases:write", "client:delete"],
    };

    render(
      <WorkspaceHeader
        currentUser={ownerUser}
        onLogout={vi.fn()}
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
