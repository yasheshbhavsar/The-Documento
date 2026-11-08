import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PostOnboardingLaunchpadModal } from "../components/modals/PostOnboardingLaunchpadModal";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { api, fetchDocumentRequests } from "../lib/api";
import {
  getCaseKickoffProgress,
  initCaseKickoffRecord,
  updateCaseKickoffRecord,
} from "../lib/caseKickoffStore";
import { ClientProfile, ImmigrationCase, UserContext } from "../lib/types";

describe("Guided 4-Step Post-Onboarding Launchpad Flow", () => {
  const ownerUser: UserContext = {
    id: "owner-rcic-1",
    email: "priya@northstarrcic.ca",
    full_name: "Priya Grewal, RCIC",
    role: "master_admin",
    experience: "master_admin",
    organization_id: "org-northstar",
    organization_name: "NorthStar RCIC Practice",
    permissions: ["cases:read", "cases:write", "client:delete"],
  };

  let createdClient: ClientProfile;
  let createdCase: ImmigrationCase;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("documento_user", JSON.stringify(ownerUser));

    const clientRes = await api.createClient(
      {
        first_name: "Aarav",
        last_name: "Sharma",
        email: "aarav.sharma@example.com",
        nationality: "IND",
        portal_credentials_provided: true,
        portal_access_enabled: true,
        temporary_password: "Doc2026!Temp99",
      },
      "master_admin"
    );
    createdClient = clientRes.data;

    const caseRes = await api.createCase(
      {
        client_id: createdClient.id,
        title: "Express Entry PNP: Aarav Sharma",
        case_number: "CASE-4410",
        jurisdiction: "Canada (IRCC)",
        visa_category: "Express Entry PNP",
      },
      "master_admin"
    );
    createdCase = caseRes.data;
  });

  it("walks the agent through all 4 real-world kickoff steps and syncs officer, checklist, retainer, and initial uploads", async () => {
    const onCaseUpdated = vi.fn();
    const onDocumentUploaded = vi.fn();
    const onOpenCaseWorkspace = vi.fn();
    const onClose = vi.fn();

    render(
      <PostOnboardingLaunchpadModal
        isOpen={true}
        onClose={onClose}
        caseItem={createdCase}
        clientItem={createdClient}
        currentUser={ownerUser}
        activeRole="master_admin"
        onCaseUpdated={onCaseUpdated}
        onDocumentUploaded={onDocumentUploaded}
        onOpenCaseWorkspace={onOpenCaseWorkspace}
      />
    );

    // STEP 1: Portal Login Handoff
    expect(screen.getByText(/Step 1: Hand Off Client Transparency Portal Credentials/i)).toBeDefined();
    expect(screen.getByText("Portal Login Active")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Reveal/i }));
    expect(screen.getByTestId("kickoff-temp-password").textContent).toBe("Doc2026!Temp99");

    fireEvent.click(screen.getByRole("button", { name: /Post Welcome Note to Client Portal/i }));
    await waitFor(async () => {
      const msgs = await api.getMessages();
      expect(msgs.data.some((m) => m.content.includes("CASE-4410"))).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: /Mark Login Shared & Next/i }));

    // STEP 2: Assign Case Officer & Dispatch Pathway Checklist
    expect(await screen.findByText(/Step 2: Assign Case Officer & Dispatch/i)).toBeDefined();
    expect(screen.getByText(/Signed IRCC Use of Representative \(IMM 5476\)/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Assign Officer & Dispatch Checklist/i }));

    await waitFor(async () => {
      const dispatched = await fetchDocumentRequests(createdCase.id);
      expect(dispatched.length).toBeGreaterThanOrEqual(4);
      expect(onCaseUpdated).toHaveBeenCalled();
    });

    // STEP 3: Initial Retainer / Trust Billing
    expect(await screen.findByText(/Step 3: Configure Initial Legal Retainer/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Retainer Already Paid/i }));
    fireEvent.click(screen.getByRole("button", { name: /Record Paid Retainer & Next/i }));

    await waitFor(async () => {
      const invoices = await api.getInvoices();
      expect(invoices.data.some((inv) => inv.case_number === "CASE-4410" && inv.status === "paid")).toBe(
        true
      );
    });

    // STEP 4: Upload Initial Counsel Document & Open Case Workspace
    expect(
      await screen.findByText(/Step 4: Upload Initial Counsel Records & Launch Case Workspace/i)
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", {
        name: /\+ Log Executed IRCC Use of Representative Form \(IMM 5476\)/i,
      })
    );

    await waitFor(() => {
      expect(onDocumentUploaded).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Complete Kickoff & Open Case Workspace/i })
    );

    expect(getCaseKickoffProgress(createdCase.id).isComplete).toBe(true);
    expect(getCaseKickoffProgress(createdCase.id).completedCount).toBe(4);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenCaseWorkspace).toHaveBeenCalledTimes(1);
  });

  it("shows Resume Kickoff action on OwnerMasterDashboard and CaseDrilldownDrawer until all 4 steps are completed", () => {
    initCaseKickoffRecord({
      caseId: createdCase.id,
      caseNumber: createdCase.case_number,
      clientId: createdCase.client_id,
    });
    updateCaseKickoffRecord(createdCase.id, {
      step1CredentialsShared: true,
    });

    const handleOpenKickoff = vi.fn();

    const { rerender } = render(
      <OwnerMasterDashboard
        cases={[createdCase]}
        clients={[createdClient]}
        auditEvents={[]}
        invoices={[]}
        capacity={[]}
        currentUser={ownerUser}
        onOpenCreateClient={vi.fn()}
        onSelectCase={vi.fn()}
        onOpenCaseKickoff={handleOpenKickoff}
        kickoffVersion={1}
      />
    );

    // Overview pending kickoff banner shows 1/4 completed
    expect(screen.getByTestId("owner-pending-kickoff-banner")).toBeDefined();
    const resumeBtn = screen.getByRole("button", { name: /Resume 4-Step Kickoff \(1\/4\)/i });
    fireEvent.click(resumeBtn);
    expect(handleOpenKickoff).toHaveBeenCalledWith(createdCase);

    // CaseDrilldownDrawer also exposes Resume Kickoff while incomplete
    const { unmount: unmountDrawer } = render(
      <CaseDrilldownDrawer
        isOpen={true}
        onClose={vi.fn()}
        caseItem={createdCase}
        onOpenCaseKickoff={handleOpenKickoff}
      />
    );
    expect(screen.getByTestId("drawer-kickoff-banner")).toBeDefined();
    unmountDrawer();

    // Mark all 4 steps complete -> pending kickoff banner disappears
    updateCaseKickoffRecord(createdCase.id, {
      step2ChecklistDispatched: true,
      step3RetainerConfigured: true,
      step4InitialDocsOrWorkspace: true,
    });

    rerender(
      <OwnerMasterDashboard
        cases={[createdCase]}
        clients={[createdClient]}
        auditEvents={[]}
        invoices={[]}
        capacity={[]}
        currentUser={ownerUser}
        onOpenCreateClient={vi.fn()}
        onSelectCase={vi.fn()}
        onOpenCaseKickoff={handleOpenKickoff}
        kickoffVersion={2}
      />
    );

    expect(screen.queryByTestId("owner-pending-kickoff-banner")).toBeNull();
  });
});

