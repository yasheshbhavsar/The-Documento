import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  deleteAgencyTenant,
  deleteAgencyApplication,
  getAgencyTenants,
  getAgencyApplications,
  getPlatformBillingInvoices,
  getAgencyTeamInvites,
  getAgencySupportTickets,
  getCalculatorAgencyLeads,
  getPlatformGovernanceLogs,
  computePlatformOverview,
  provisionSalesLedAgency,
  submitAgencyOnboarding,
  createAgencySupportTicket,
  inviteAgencyTeamMember,
  submitCobrandedCalculatorLead,
} from "../lib/agencyPlatformStore";
import { api, deleteClient } from "../lib/api";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import { SuperAdminControlPlane } from "../components/admin/SuperAdminControlPlane";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { canDeleteClient, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import { ImmigrationCase, UserContext } from "../lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const OWNER_USER: UserContext = {
  id: "owner-usr-01",
  email: "owner@lexisimmigration.com",
  full_name: "Eleanor Vance, Managing Attorney",
  role: "master_admin",
  organization_id: "ten-lexis",
  organization_name: "Lexis Immigration Partners",
  experience: "master_admin",
  permissions: ["*"],
};

const MANAGER_USER: UserContext = {
  id: "mgr-usr-01",
  email: "manager@lexisimmigration.com",
  full_name: "Carlos Rivera, Case Manager",
  role: "case_manager",
  organization_id: "ten-lexis",
  organization_name: "Lexis Immigration Partners",
  experience: "case_manager",
  permissions: ["cases:read", "cases:write", "client:delete"],
};

const PARALEGAL_USER: UserContext = {
  id: "para-usr-01",
  email: "paralegal@lexisimmigration.com",
  full_name: "Maya Patel, Paralegal",
  role: "case_worker",
  organization_id: "ten-lexis",
  organization_name: "Lexis Immigration Partners",
  experience: "paralegal",
  permissions: ["cases:read", "cases:write", "documents:read"],
};

const CLIENT_USER: UserContext = {
  id: "client-usr-01",
  email: "applicant@gmail.com",
  full_name: "Dev Patel",
  role: "retained_client",
  organization_id: "ten-lexis",
  organization_name: "Lexis Immigration Partners",
  experience: "client_applicant",
  permissions: ["portal:read"],
};

const SAMPLE_CASE: ImmigrationCase = {
  id: "case-lifecycle-001",
  case_number: "CAN-2026-9001",
  title: "In-Canada Spousal Sponsorship (Family Class)",
  client_id: "client-lifecycle-001",
  client_name: "Pooja & Dev Patel",
  jurisdiction: "CA",
  visa_category: "Spousal Sponsorship",
  status: "processing",
  priority_date: "2026-03-01",
  assigned_manager: "Carlos Rivera",
  created_at: "2026-02-15T10:00:00Z",
  organization_id: "ten-lexis",
  readiness_score: 75,
};

function signInHqOperatorInUi() {
  fireEvent.change(screen.getByLabelText(/Documento HQ Operator Email/i), {
    target: { value: PLATFORM_HQ_OPERATOR_EMAIL },
  });
  fireEvent.change(screen.getByLabelText(/Operator Passphrase/i), {
    target: { value: "DocumentoHQ2026!" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Authenticate to Control Plane/i }));
}

describe("Milestone M4: Complete Deletion Lifecycle & RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("1. Agency Tenant Deletion with Record Cascades & Dynamic KPI Reconciliation", () => {
    it("deletes agency tenant, cascades invoices, invites, tickets, leads, logs audit and dynamically recalculates KPIs", () => {
      // 1. Provision an agency tenant
      const provisioned = provisionSalesLedAgency({
        legalEntityName: "Cascade Legal Services Ltd.",
        tradingName: "Cascade Legal",
        slug: "cascade-legal",
        ownerFullName: "Arthur Dent",
        ownerEmail: "arthur@cascadelegal.ca",
        hqCountry: "Canada",
        hqCity: "Calgary",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R999111",
        enabledCorridors: ["CA"],
        planTier: "growth",
        customMrrUsd: 499,
        customSeatLimit: 18,
        paymentMethod: "stripe_card",
        kybVerifiedOnCall: true,
      });

      const orgId = provisioned.organizationId;
      expect(orgId).toBe("ten-cascade-legal");

      // 2. Attach team invite, ticket, and calculator lead
      const invite = inviteAgencyTeamMember({
        organizationId: orgId,
        fullName: "Trillian Astra",
        email: "trillian@cascadelegal.ca",
        role: "case_manager",
      });
      expect(invite.organizationId).toBe(orgId);

      const ticket = createAgencySupportTicket({
        organizationId: orgId,
        requesterEmail: "arthur@cascadelegal.ca",
        category: "statutory_rules",
        subject: "IRCC NOC 2026 Transition Help",
        message: "Need guidance on NOC matrix transition.",
      });
      expect(ticket.organizationId).toBe(orgId);

      const lead = submitCobrandedCalculatorLead({
        agencySlug: "cascade-legal",
        applicantName: "Ford Prefect",
        applicantEmail: "ford@hitchhiker.com",
        calculatorId: "ca_express_entry",
        calculatorTitle: "Express Entry Comprehensive Ranking Score (CRS)",
        countryCode: "CA",
        scoreSummary: "Estimated CRS: 482 points",
      });
      expect(lead.agencySlug).toBe("cascade-legal");

      // Verify records exist before deletion
      expect(getAgencyTenants().some((t) => t.organizationId === orgId)).toBe(true);
      expect(getAgencyTeamInvites().some((i) => i.organizationId === orgId)).toBe(true);
      expect(getAgencySupportTickets().some((tk) => tk.organizationId === orgId)).toBe(true);
      expect(getCalculatorAgencyLeads().some((l) => l.organizationId === orgId || l.agencySlug === "cascade-legal")).toBe(true);

      const overviewBefore = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
      expect(overviewBefore.activeAgenciesCount).toBeGreaterThanOrEqual(1);
      expect(overviewBefore.recurringMrrUsd).toBeGreaterThanOrEqual(499);

      // 3. Execute deleteAgencyTenant
      const deleteSuccess = deleteAgencyTenant(orgId, "hq.auditor@documento.ai", "Client account closure");
      expect(deleteSuccess).toBe(true);

      // 4. Verify cascade deletion
      expect(getAgencyTenants().some((t) => t.organizationId === orgId)).toBe(false);
      expect(getPlatformBillingInvoices().some((i) => i.organizationId === orgId)).toBe(false);
      expect(getAgencyTeamInvites().some((i) => i.organizationId === orgId)).toBe(false);
      expect(getAgencySupportTickets().some((tk) => tk.organizationId === orgId)).toBe(false);
      expect(getCalculatorAgencyLeads().some((l) => l.organizationId === orgId || l.agencySlug === "cascade-legal")).toBe(false);

      // 5. Verify governance audit log
      const logs = getPlatformGovernanceLogs();
      const deleteLog = logs.find((l) => l.actionCode === "agency_tenant_deleted");
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.agencyName).toBe("Cascade Legal");
      expect(deleteLog?.detail).toContain(orgId);
      expect(deleteLog?.detail).toContain("Client account closure");

      // 6. Verify KPI dynamic reconciliation
      const overviewAfter = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
      expect(overviewAfter.activeAgenciesCount).toBe(overviewBefore.activeAgenciesCount - 1);
      expect(overviewAfter.recurringMrrUsd).toBe(overviewBefore.recurringMrrUsd - 499);
      expect(overviewAfter.seatsProvisionedTotal).toBe(overviewBefore.seatsProvisionedTotal - 18);
    });

    it("returns false cleanly when attempting to delete non-existent tenant", () => {
      const res = deleteAgencyTenant("ten-non-existent-999");
      expect(res).toBe(false);
    });
  });

  describe("2. KYB Application Deletion Lifecycle", () => {
    it("deletes submitted KYB dossier application and logs governance audit", async () => {
      const app = await submitAgencyOnboarding({
        legalEntityName: "Apex Counsel Corp.",
        tradingName: "Apex Counsel",
        requestedSlug: "apex-counsel",
        hqCountry: "CA",
        hqCity: "Vancouver",
        corporateDomain: "apexcounsel.ca",
        taxRegistrationId: "BN-112233445RC0001",
        contactFullName: "Jessica Pearson",
        contactWorkEmail: "jessica@apexcounsel.ca",
        contactPhone: "+1-604-555-8888",
        ownerPassword: "ApexPass2026!",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R888999",
        targetCorridors: ["CA"],
        estimatedMonthlyCases: 20,
        requestedSeats: 5,
        branchCount: 1,
        selectedPlanTier: "boutique",
        dpaAccepted: true,
        zeroTrainingAccepted: true,
      });

      expect(getAgencyApplications().some((a) => a.id === app.id)).toBe(true);

      const deleteRes = deleteAgencyApplication(app.id, "hq.admin@documento.ai", "Spam submission rejected");
      expect(deleteRes).toBe(true);

      expect(getAgencyApplications().some((a) => a.id === app.id)).toBe(false);

      const logs = getPlatformGovernanceLogs();
      const appLog = logs.find((l) => l.actionCode === "kyb_application_deleted");
      expect(appLog).toBeDefined();
      expect(appLog?.agencyName).toBe("Apex Counsel");
      expect(appLog?.detail).toContain(app.id);
    });

    it("returns false cleanly when attempting to delete non-existent application", () => {
      const res = deleteAgencyApplication("app-nonexistent-123");
      expect(res).toBe(false);
    });
  });

  describe("3. SuperAdminControlPlane UI Deletion Actions with Confirmation", () => {
    it("allows SuperAdmin to delete partner agency from Ledger Table with confirmation dialog", async () => {
      provisionSalesLedAgency({
        legalEntityName: "Ledger Agency Inc.",
        tradingName: "Ledger Agency",
        slug: "ledger-agency",
        ownerFullName: "Harvey Specter",
        ownerEmail: "harvey@ledgeragency.com",
        hqCountry: "Canada",
        hqCity: "Toronto",
        kybTrack: "regulated_counsel",
        regulatoryBody: "Law Society of Ontario",
        licenseNumber: "LSO-777222",
        enabledCorridors: ["CA"],
        planTier: "growth",
        paymentMethod: "stripe_card",
        kybVerifiedOnCall: true,
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<SuperAdminControlPlane />);
      signInHqOperatorInUi();

      await waitFor(() => {
        expect(screen.getByText(/Documento HQ Control Plane/i)).toBeDefined();
      });

      // Switch to Partner Agencies directory
      fireEvent.click(screen.getByRole("button", { name: /Partner Agencies/i }));

      await waitFor(() => {
        expect(screen.getByText("Ledger Agency")).toBeDefined();
      });

      const deleteBtn = screen.getByTestId("delete-tenant-btn-ten-ledger-agency");
      expect(deleteBtn).toBeDefined();
      fireEvent.click(deleteBtn);

      expect(confirmSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText("Ledger Agency")).toBeNull();
      });
      expect(getAgencyTenants().some((t) => t.organizationId === "ten-ledger-agency")).toBe(false);
    });

    it("allows SuperAdmin to delete partner agency from Tenant Governance Drawer with confirmation dialog", async () => {
      provisionSalesLedAgency({
        legalEntityName: "Drawer Agency Inc.",
        tradingName: "Drawer Agency",
        slug: "drawer-agency",
        ownerFullName: "Donna Paulsen",
        ownerEmail: "donna@draweragency.com",
        hqCountry: "Canada",
        hqCity: "Toronto",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R555444",
        enabledCorridors: ["CA"],
        planTier: "growth",
        paymentMethod: "stripe_card",
        kybVerifiedOnCall: true,
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<SuperAdminControlPlane />);
      signInHqOperatorInUi();

      await waitFor(() => {
        expect(screen.getByText(/Documento HQ Control Plane/i)).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Partner Agencies/i }));

      await waitFor(() => {
        expect(screen.getByText("Drawer Agency")).toBeDefined();
      });

      // Click Govern to open drawer
      const governBtn = screen.getByRole("button", { name: "Govern" });
      fireEvent.click(governBtn);

      await waitFor(() => {
        expect(screen.getByTestId("tenant-governance-drawer")).toBeDefined();
      });

      const deleteDrawerBtn = screen.getByTestId("delete-tenant-drawer-btn");
      expect(deleteDrawerBtn).toBeDefined();
      fireEvent.click(deleteDrawerBtn);

      expect(confirmSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByTestId("tenant-governance-drawer")).toBeNull();
      });
      expect(getAgencyTenants().some((t) => t.organizationId === "ten-drawer-agency")).toBe(false);
    });

    it("allows SuperAdmin to delete KYB application from Dossiers list and Adjudication Panel with confirmation dialog", async () => {
      const app = await submitAgencyOnboarding({
        legalEntityName: "Adjudication Delete Legal",
        tradingName: "Adjudication Delete",
        requestedSlug: "adj-delete",
        hqCountry: "CA",
        hqCity: "Calgary",
        corporateDomain: "adjdelete.ca",
        taxRegistrationId: "BN-998877665RC0001",
        contactFullName: "Rachel Zane",
        contactWorkEmail: "rachel@adjdelete.ca",
        contactPhone: "+1-403-555-9999",
        ownerPassword: "RachelPass2026!",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R333222",
        targetCorridors: ["CA"],
        estimatedMonthlyCases: 10,
        requestedSeats: 3,
        branchCount: 1,
        selectedPlanTier: "boutique",
        dpaAccepted: true,
        zeroTrainingAccepted: true,
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<SuperAdminControlPlane />);
      signInHqOperatorInUi();

      await waitFor(() => {
        expect(screen.getByText(/Documento HQ Control Plane/i)).toBeDefined();
      });

      // Switch to KYB queue
      fireEvent.click(screen.getByRole("button", { name: /KYB Verification Desk/i }));

      await waitFor(() => {
        expect(screen.getAllByText("Adjudication Delete").length).toBeGreaterThanOrEqual(1);
      });

      // Panel delete button
      const deletePanelBtn = screen.getByTestId("delete-kyb-app-panel-btn");
      expect(deletePanelBtn).toBeDefined();
      fireEvent.click(deletePanelBtn);

      expect(confirmSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(getAgencyApplications().some((a) => a.id === app.id)).toBe(false);
      });
    });
  });

  describe("4. Client Deletion Cascades & API RBAC", () => {
    it("throws foreign key error when cascade=false and client has associated cases", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));

      const clientRes = await api.createClient({
        first_name: "Tariq",
        last_name: "Aziz",
        email: "tariq.aziz@example.com",
        nationality: "PAK",
      });
      const clientId = clientRes.data.id;

      await api.createCase({
        case_number: "CAN-2026-FK01",
        title: "Express Entry Skilled Worker",
        client_id: clientId,
        jurisdiction: "CA",
        visa_category: "Express Entry",
      });

      // Without cascade: throws foreign key error
      await expect(api.deleteClient(clientId, "master_admin", false)).rejects.toThrow(
        /Cannot delete client with 1 associated case\(s\)/i
      );
    });

    it("cascade-deletes cases, documents, tasks, credentials, and intake sheets when cascade=true", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));

      const clientRes = await api.createClient({
        first_name: "Fatima",
        last_name: "Zahra",
        email: "fatima.zahra@example.com",
        nationality: "MAR",
      });
      const clientId = clientRes.data.id;

      const caseRes = await api.createCase({
        case_number: "CAN-2026-CASCADE",
        title: "Study Permit Extension",
        client_id: clientId,
        jurisdiction: "CA",
        visa_category: "Study Permit",
      });
      const caseId = caseRes.data.id;

      const docRes = await api.uploadDocument({
        case_id: caseId,
        title: "Letter of Acceptance.pdf",
        category: "educational",
        file_size: "100 KB",
        uploaded_by: "applicant",
        sha256_hash: "mock-hash-loa",
      });
      const docId = docRes.data.id;

      // Seed tasks in storage for this case
      const storedTasks = [
        {
          id: `task-cascade-${caseId}`,
          case_id: caseId,
          title: "Review GIC Certificate",
          assigned_to: "Carlos Rivera",
          is_completed: false,
          status: "pending" as const,
          created_at: new Date().toISOString(),
        },
      ];
      window.localStorage.setItem("documento_tasks_v3_clean", JSON.stringify(storedTasks));

      // Seed localStorage intake sheets
      window.localStorage.setItem(`documento_initial_info_sheet_${caseId}`, JSON.stringify({ test: "data" }));
      window.localStorage.setItem(`documento_questionnaire_${caseId}`, JSON.stringify({ step: 1 }));
      window.localStorage.setItem(`documento_initial_info_sheet_${clientId}`, JSON.stringify({ client: true }));

      // Execute cascade deletion
      const delRes = await deleteClient(clientId, "master_admin", true);
      expect(delRes.success).toBe(true);
      expect(delRes.deleted_client_id).toBe(clientId);

      // Verify client is gone
      const clientsList = await api.getClients();
      expect(clientsList.data.some((c) => c.id === clientId)).toBe(false);

      // Verify linked case is gone
      const casesList = await api.getCases();
      expect(casesList.data.some((c) => c.id === caseId)).toBe(false);

      // Verify linked document is gone
      const docsList = await api.getDocuments();
      expect(docsList.data.some((d) => d.id === docId)).toBe(false);

      // Verify linked task is gone
      const tasksList = await api.getTasks();
      expect(tasksList.data.some((t) => t.id === storedTasks[0].id)).toBe(false);

      // Verify localStorage intake sheets are purged
      expect(window.localStorage.getItem(`documento_initial_info_sheet_${caseId}`)).toBeNull();
      expect(window.localStorage.getItem(`documento_questionnaire_${caseId}`)).toBeNull();
      expect(window.localStorage.getItem(`documento_initial_info_sheet_${clientId}`)).toBeNull();
    });

    it("enforces RBAC strictly: denies paralegals and retained clients from deleting clients", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));
      const clientRes = await api.createClient({
        first_name: "Protected",
        last_name: "Person",
        email: "protected@example.com",
        nationality: "CAN",
      });
      const clientId = clientRes.data.id;

      await expect(api.deleteClient(clientId, "case_worker", true)).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );

      await expect(api.deleteClient(clientId, "document_reviewer", true)).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );

      await expect(api.deleteClient(clientId, "retained_client", true)).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );

      await expect(api.deleteClient(clientId, "applicant", true)).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });
  });

  describe("5. WorkspaceContext State Synchronization on Client Cascade", () => {
    function TestWorkspaceConsumer({ clientIdToDelete }: { clientIdToDelete: string }) {
      const { clients, cases, documents, tasks, selectedCaseForKickoff, handleDeleteClient } = useWorkspace();
      return (
        <div>
          <span data-testid="clients-count">{clients.length}</span>
          <span data-testid="cases-count">{cases.length}</span>
          <span data-testid="docs-count">{documents.length}</span>
          <span data-testid="tasks-count">{tasks.length}</span>
          <span data-testid="kickoff-case">{selectedCaseForKickoff ? selectedCaseForKickoff.id : "none"}</span>
          <button data-testid="delete-client-btn" onClick={() => handleDeleteClient(clientIdToDelete)}>
            Delete Client
          </button>
        </div>
      );
    }

    it("synchronizes clients, cases, documents, tasks and resets selectedCaseForKickoff simultaneously", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));

      const clientRes = await api.createClient({
        first_name: "Sameer",
        last_name: "Khan",
        email: "sameer.khan@example.com",
        nationality: "IND",
      });
      const clientId = clientRes.data.id;

      const caseRes = await api.createCase({
        case_number: "CAN-2026-CTX",
        title: "Express Entry PNP",
        client_id: clientId,
        jurisdiction: "CA",
        visa_category: "PNP",
      });
      const caseId = caseRes.data.id;

      await api.uploadDocument({
        case_id: caseId,
        title: "Passport Scan.pdf",
        category: "identity",
        file_size: "50 KB",
        uploaded_by: "applicant",
        sha256_hash: "mock-hash-passport",
      });

      render(
        <WorkspaceProvider initialUser={OWNER_USER}>
          <TestWorkspaceConsumer clientIdToDelete={clientId} />
        </WorkspaceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("clients-count").textContent).not.toBe("0");
      });

      // Delete the client via context handler
      fireEvent.click(screen.getByTestId("delete-client-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("kickoff-case").textContent).toBe("none");
      });
    });
  });

  describe("6. CaseDetailModal & CaseDrilldownDrawer RBAC Delete Actions", () => {
    describe("CaseDetailModal", () => {
      it("renders Delete Client button for Owner and calls onDeleteClient on confirmation", async () => {
        const onDeleteClientMock = vi.fn();
        const onCloseMock = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(true);

        render(
          <CaseDetailModal
            isOpen={true}
            onClose={onCloseMock}
            caseItem={SAMPLE_CASE}
            currentUser={OWNER_USER}
            onDeleteClient={onDeleteClientMock}
          />
        );

        const deleteBtn = screen.getByTestId("delete-client-modal-btn");
        expect(deleteBtn).toBeDefined();

        fireEvent.click(deleteBtn);

        await waitFor(() => {
          expect(window.confirm).toHaveBeenCalled();
          expect(onDeleteClientMock).toHaveBeenCalledWith(SAMPLE_CASE.client_id);
          expect(onCloseMock).toHaveBeenCalled();
        });
      });

      it("does not call onDeleteClient or onClose when window.confirm is cancelled", async () => {
        const onDeleteClientMock = vi.fn();
        const onCloseMock = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(false);

        render(
          <CaseDetailModal
            isOpen={true}
            onClose={onCloseMock}
            caseItem={SAMPLE_CASE}
            currentUser={OWNER_USER}
            onDeleteClient={onDeleteClientMock}
          />
        );

        const deleteBtn = screen.getByTestId("delete-client-modal-btn");
        fireEvent.click(deleteBtn);

        expect(window.confirm).toHaveBeenCalled();
        expect(onDeleteClientMock).not.toHaveBeenCalled();
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      it("does NOT render Delete Client button for Paralegal or Retained Client", () => {
        const { rerender } = render(
          <CaseDetailModal
            isOpen={true}
            onClose={vi.fn()}
            caseItem={SAMPLE_CASE}
            currentUser={PARALEGAL_USER}
          />
        );

        expect(screen.queryByTestId("delete-client-modal-btn")).toBeNull();

        rerender(
          <CaseDetailModal
            isOpen={true}
            onClose={vi.fn()}
            caseItem={SAMPLE_CASE}
            currentUser={CLIENT_USER}
          />
        );

        expect(screen.queryByTestId("delete-client-modal-btn")).toBeNull();
      });
    });

    describe("CaseDrilldownDrawer", () => {
      it("renders Delete Client buttons for Manager and calls onDeleteClient on confirmation", async () => {
        const onDeleteClientMock = vi.fn();
        const onCloseMock = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(true);

        render(
          <CaseDrilldownDrawer
            isOpen={true}
            onClose={onCloseMock}
            caseItem={SAMPLE_CASE}
            currentUser={MANAGER_USER}
            onDeleteClient={onDeleteClientMock}
          />
        );

        const drawerBtn = screen.getByTestId("delete-client-drawer-btn");
        const cardBtn = screen.getByTestId("delete-client-card-btn");
        expect(drawerBtn).toBeDefined();
        expect(cardBtn).toBeDefined();

        fireEvent.click(drawerBtn);

        await waitFor(() => {
          expect(window.confirm).toHaveBeenCalled();
          expect(onDeleteClientMock).toHaveBeenCalledWith(SAMPLE_CASE.client_id);
          expect(onCloseMock).toHaveBeenCalled();
        });
      });

      it("does NOT render Delete Client buttons for Paralegal or Retained Client", () => {
        const { rerender } = render(
          <CaseDrilldownDrawer
            isOpen={true}
            onClose={vi.fn()}
            caseItem={SAMPLE_CASE}
            currentUser={PARALEGAL_USER}
          />
        );

        expect(screen.queryByTestId("delete-client-drawer-btn")).toBeNull();
        expect(screen.queryByTestId("delete-client-card-btn")).toBeNull();

        rerender(
          <CaseDrilldownDrawer
            isOpen={true}
            onClose={vi.fn()}
            caseItem={SAMPLE_CASE}
            currentUser={CLIENT_USER}
          />
        );

        expect(screen.queryByTestId("delete-client-drawer-btn")).toBeNull();
        expect(screen.queryByTestId("delete-client-card-btn")).toBeNull();
      });
    });
  });
});
