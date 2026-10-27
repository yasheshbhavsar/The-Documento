import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { canDeleteClient, DEMO_USERS, authenticateUser } from "../lib/auth";
import { api } from "../lib/api";
import { ClientProfile, UserContext } from "../lib/types";

describe("Retained Client Deletion RBAC & Access Control", () => {
  const mockClients: ClientProfile[] = [
    {
      id: "client-001",
      first_name: "Yash",
      last_name: "Bhavsar",
      email: "yash.bhavsar@example.com",
      nationality: "IND",
      phone: "+917202063858",
      organization_id: "org-01",
      created_at: "2026-10-23T10:00:00Z",
      portal_credentials_provided: true,
      portal_access_enabled: true,
    },
    {
      id: "client-002",
      first_name: "Yashesh",
      last_name: "Bhavsar",
      email: "yashesh.bhavsar@example.com",
      nationality: "IND",
      phone: "+917202063859",
      organization_id: "org-01",
      created_at: "2026-10-23T10:05:00Z",
      portal_credentials_provided: true,
      portal_access_enabled: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canDeleteClient helper permission matrix", () => {
    it("permits Owner (master_admin / Managing Partner) to delete clients", () => {
      const ownerUser: UserContext = {
        ...DEMO_USERS.master_admin,
      };
      expect(canDeleteClient(ownerUser)).toBe(true);
    });

    it("permits Manager (case_manager / David Cho) to delete clients", () => {
      const managerUser: UserContext = {
        ...DEMO_USERS.case_manager,
      };
      expect(canDeleteClient(managerUser)).toBe(true);
    });

    it("permits Manager with explicit client:delete permission", () => {
      const customManager: UserContext = {
        id: "usr-custom-manager",
        email: "alexander.reed@vanguardlegal.com",
        full_name: "Alexander Reed, Managing Attorney",
        role: "case_manager",
        organization_id: "org-01",
        organization_name: "Vanguard Immigration Law Group LLP",
        experience: "case_manager",
        permissions: ["cases:read", "cases:write", "client:delete"],
      };
      expect(canDeleteClient(customManager)).toBe(true);
    });

    it("strictly blocks Paralegal from deleting clients", () => {
      // Marcus Vance, Lead Paralegal
      const paralegalUser: UserContext = {
        ...DEMO_USERS.paralegal,
      };
      expect(canDeleteClient(paralegalUser)).toBe(false);

      // Explicit case_worker role
      const caseworkerUser: UserContext = {
        id: "usr-cw",
        email: "staff.clerk@vanguardlegal.com",
        full_name: "Jordan Lee",
        role: "case_worker",
        organization_id: "org-01",
        organization_name: "Vanguard Immigration Law Group LLP",
        experience: "case_manager",
        permissions: ["cases:read"],
      };
      expect(canDeleteClient(caseworkerUser)).toBe(false);

      // Document reviewer
      const reviewerUser: UserContext = {
        id: "usr-rev",
        email: "reviewer@vanguardlegal.com",
        full_name: "Document Reviewer",
        role: "document_reviewer",
        organization_id: "org-01",
        organization_name: "Vanguard Immigration Law Group LLP",
        experience: "case_manager",
        permissions: ["documents:read"],
      };
      expect(canDeleteClient(reviewerUser)).toBe(false);
    });

    it("strictly blocks Retained Clients from deleting clients", () => {
      const clientUser: UserContext = {
        ...DEMO_USERS.client_applicant,
      };
      expect(canDeleteClient(clientUser)).toBe(false);
    });
  });

  describe("authenticateUser persona resolution", () => {
    it("resolves owner login with full client delete privileges", () => {
      const res = authenticateUser("sarah.jenkins@vanguardlegal.com", "firm", "password123");
      expect(res.success).toBe(true);
      expect(res.user?.role).toBe("master_admin");
      expect(canDeleteClient(res.user)).toBe(true);
    });

    it("resolves manager login with client delete privileges", () => {
      const res = authenticateUser("manager@vanguardlegal.com", "firm", "password123");
      expect(res.success).toBe(true);
      expect(res.user?.role).toBe("case_manager");
      expect(canDeleteClient(res.user)).toBe(true);
    });

    it("resolves paralegal login without client delete privileges", () => {
      const res = authenticateUser("paralegal@vanguardlegal.com", "firm", "password123");
      expect(res.success).toBe(true);
      expect(res.user?.full_name).toContain("Lead Paralegal");
      expect(canDeleteClient(res.user)).toBe(false);
    });
  });

  describe("OwnerMasterDashboard UI Rendering", () => {
    it("renders Delete Client buttons in Owner Master Dashboard for Owner login", async () => {
      const { container } = render(
        <OwnerMasterDashboard
          cases={[]}
          clients={mockClients}
          auditEvents={[]}
          currentUser={DEMO_USERS.master_admin}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      // Click "Retained Clients" tab in sidebar
      const clientsTab = container.querySelector("#tab-btn-clients");
      expect(clientsTab).toBeDefined();
      fireEvent.click(clientsTab!);

      // Verify Delete Client buttons are rendered for each client
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole("button", { name: /Delete client/i });
        expect(deleteButtons.length).toBe(2);
      });
    });

    it("calls onDeleteClient callback when Owner confirms deletion", async () => {
      const onDeleteClientMock = vi.fn();
      vi.spyOn(window, "confirm").mockReturnValue(true);

      const { container } = render(
        <OwnerMasterDashboard
          cases={[]}
          clients={mockClients}
          auditEvents={[]}
          currentUser={DEMO_USERS.master_admin}
          onDeleteClient={onDeleteClientMock}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      const clientsTab = container.querySelector("#tab-btn-clients");
      fireEvent.click(clientsTab!);

      const deleteFirst = screen.getByRole("button", { name: /Delete client Yash Bhavsar/i });
      fireEvent.click(deleteFirst);

      expect(window.confirm).toHaveBeenCalled();
      expect(onDeleteClientMock).toHaveBeenCalledWith("client-001");
    });
  });

  describe("EmployeeWorkspace UI Rendering", () => {
    it("does NOT render Delete Client button when logged in as Paralegal", async () => {
      render(
        <EmployeeWorkspace
          cases={[]}
          clients={mockClients}
          documents={[]}
          tasks={[]}
          aiFindings={[]}
          messages={[]}
          currentUser={DEMO_USERS.paralegal} // Marcus Vance, Lead Paralegal
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      // Switch to Client Directory tab
      const clientsTab = screen.getByRole("button", { name: /Client Directory/i });
      fireEvent.click(clientsTab);

      // Verify "Manage Credentials" exists, but NO "Delete Client" button
      await waitFor(() => {
        expect(screen.getByText("yash.bhavsar@example.com")).toBeDefined();
      });

      const deleteButtons = screen.queryAllByRole("button", { name: /Delete client/i });
      expect(deleteButtons.length).toBe(0);
    });

    it("renders Delete Client button when logged in as Manager", async () => {
      render(
        <EmployeeWorkspace
          cases={[]}
          clients={mockClients}
          documents={[]}
          tasks={[]}
          aiFindings={[]}
          messages={[]}
          currentUser={DEMO_USERS.case_manager} // David Cho, Case Manager
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      const clientsTab = screen.getByRole("button", { name: /Client Directory/i });
      fireEvent.click(clientsTab);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole("button", { name: /Delete client/i });
        expect(deleteButtons.length).toBe(2);
      });
    });
  });

  describe("WorkspaceHeader Persona Switching", () => {
    it("renders persona switch buttons in profile menu with RBAC badges", () => {
      const onSwitchRole = vi.fn();
      render(
        <WorkspaceHeader
          currentUser={DEMO_USERS.master_admin}
          onLogout={vi.fn()}
          onSwitchRole={onSwitchRole}
          isLiveBackend={true}
        />
      );

      const profileBtn = screen.getByRole("button", { name: /Sarah Jenkins, Esq./i });
      fireEvent.click(profileBtn);

      const ownerBtn = screen.getByRole("button", { name: /Owner \(Managing Partner\)/i });
      const managerBtn = screen.getByRole("button", { name: /Case Manager/i });
      const paralegalBtn = screen.getByRole("button", { name: /Lead Paralegal/i });
      const clientBtn = screen.getByRole("button", { name: /Retained Client/i });

      expect(ownerBtn).toBeDefined();
      expect(managerBtn).toBeDefined();
      expect(paralegalBtn).toBeDefined();
      expect(clientBtn).toBeDefined();

      fireEvent.click(managerBtn);
      expect(onSwitchRole).toHaveBeenCalledWith("case_manager");

      fireEvent.click(profileBtn);
      const reopenedParalegalBtn = screen.getByRole("button", { name: /Lead Paralegal/i });
      fireEvent.click(reopenedParalegalBtn);
      expect(onSwitchRole).toHaveBeenCalledWith("paralegal");
    });
  });

  describe("API Client deletion method", () => {
    it("allows Owner and Manager to delete standalone client and logs audit event", async () => {
      const createRes = await api.createClient({
        first_name: "Temp",
        last_name: "Standalone",
        email: "temp.standalone@example.com",
        nationality: "IND",
      });
      const createdId = createRes.data.id;
      expect(createdId).toBeDefined();

      const deleteRes = await api.deleteClient(createdId, "master_admin");
      expect(deleteRes.data.success).toBe(true);

      const clientsList = await api.getClients();
      expect(clientsList.data.find((c) => c.id === createdId)).toBeUndefined();

      const auditRes = await api.getAuditEvents();
      const deleteAudit = auditRes.data.find((a) => a.action === "client.deleted" && a.object_id === createdId);
      expect(deleteAudit).toBeDefined();
    });

    it("strictly blocks Paralegal role from executing deleteClient in fallback mode", async () => {
      const createRes = await api.createClient({
        first_name: "Protected",
        last_name: "Client",
        email: "protected@example.com",
        nationality: "CAN",
      });
      const createdId = createRes.data.id;

      await expect(api.deleteClient(createdId, "case_worker")).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });

    it("strictly blocks Retained Client role from executing deleteClient in fallback mode", async () => {
      const createRes = await api.createClient({
        first_name: "ClientAttempt",
        last_name: "Target",
        email: "target-attempt@example.com",
        nationality: "GBR",
      });
      const createdId = createRes.data.id;

      await expect(api.deleteClient(createdId, "retained_client")).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });

    it("blocks deletion of client when linked active cases exist", async () => {
      // client-01 is linked to case-01 ("CASE-US-8841") in FIXTURE_CASES
      await expect(api.deleteClient("client-01", "master_admin")).rejects.toThrow(
        /Cannot delete client with.*associated case/i
      );
    });
  });
});
