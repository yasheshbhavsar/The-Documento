import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { canDeleteClient, authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import {
  submitAgencyOnboarding,
  adjudicateAgencyKybApplication,
  inviteAgencyTeamMember,
} from "../lib/agencyPlatformStore";
import { api } from "../lib/api";
import { ClientProfile, UserContext } from "../lib/types";

const OWNER_USER: UserContext = {
  id: "owner-northstar",
  email: "priya@northstarrcic.ca",
  full_name: "Priya Grewal, RCIC",
  role: "master_admin",
  organization_id: "ten-northstar-rcic",
  organization_name: "NorthStar RCIC",
  experience: "master_admin",
  permissions: ["cases:read", "cases:write", "client:delete", "clients:write"],
};

const MANAGER_USER: UserContext = {
  id: "mgr-northstar",
  email: "manager@northstarrcic.ca",
  full_name: "Karan Gill, Case Manager",
  role: "case_manager",
  organization_id: "ten-northstar-rcic",
  organization_name: "NorthStar RCIC",
  experience: "case_manager",
  permissions: ["cases:read", "cases:write", "client:delete", "clients:write"],
};

const PARALEGAL_USER: UserContext = {
  id: "para-northstar",
  email: "paralegal@northstarrcic.ca",
  full_name: "Simran Kaur, Paralegal",
  role: "case_worker",
  organization_id: "ten-northstar-rcic",
  organization_name: "NorthStar RCIC",
  experience: "paralegal",
  permissions: ["cases:read", "cases:write", "documents:read", "documents:write"],
};

const CLIENT_USER: UserContext = {
  id: "client-001",
  email: "aarav.mehta@example.com",
  full_name: "Aarav Mehta",
  role: "retained_client",
  organization_id: "ten-northstar-rcic",
  organization_name: "NorthStar RCIC",
  experience: "client_applicant",
  permissions: ["portal:read", "portal:write"],
};

describe("Retained Client Deletion RBAC & Access Control", () => {
  const mockClients: ClientProfile[] = [
    {
      id: "client-001",
      first_name: "Aarav",
      last_name: "Mehta",
      email: "aarav.mehta@example.com",
      nationality: "IND",
      phone: "+919876500101",
      organization_id: "ten-northstar-rcic",
      created_at: "2026-10-23T10:00:00Z",
      portal_credentials_provided: true,
      portal_access_enabled: true,
    },
    {
      id: "client-002",
      first_name: "Neha",
      last_name: "Sharma",
      email: "neha.sharma@example.com",
      nationality: "IND",
      phone: "+919876500102",
      organization_id: "ten-northstar-rcic",
      created_at: "2026-10-23T10:05:00Z",
      portal_credentials_provided: true,
      portal_access_enabled: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("canDeleteClient helper permission matrix", () => {
    it("permits Owner (master_admin / Managing Partner) to delete clients", () => {
      expect(canDeleteClient(OWNER_USER)).toBe(true);
    });

    it("permits Manager (case_manager) to delete clients", () => {
      expect(canDeleteClient(MANAGER_USER)).toBe(true);
    });

    it("permits Manager with explicit client:delete permission", () => {
      const customManager: UserContext = {
        id: "usr-custom-manager",
        email: "lead@northstarrcic.ca",
        full_name: "Lead Immigration Counsel",
        role: "case_manager",
        organization_id: "ten-northstar-rcic",
        organization_name: "NorthStar RCIC",
        experience: "case_manager",
        permissions: ["cases:read", "cases:write", "client:delete"],
      };
      expect(canDeleteClient(customManager)).toBe(true);
    });

    it("strictly blocks Paralegal and Document Reviewer from deleting clients", () => {
      expect(canDeleteClient(PARALEGAL_USER)).toBe(false);

      const reviewerUser: UserContext = {
        id: "usr-rev",
        email: "reviewer@northstarrcic.ca",
        full_name: "Document Reviewer",
        role: "document_reviewer",
        organization_id: "ten-northstar-rcic",
        organization_name: "NorthStar RCIC",
        experience: "case_manager",
        permissions: ["documents:read"],
      };
      expect(canDeleteClient(reviewerUser)).toBe(false);
    });

    it("strictly blocks Retained Clients from deleting clients", () => {
      expect(canDeleteClient(CLIENT_USER)).toBe(false);
    });
  });

  describe("authenticateUser real staff RBAC resolution", () => {
    it("resolves provisioned owner, invited manager, and invited paralegal with accurate delete privileges", async () => {
      const application = await submitAgencyOnboarding({
        legalEntityName: "NorthStar Regulated Immigration Counsel Inc.",
        tradingName: "NorthStar RCIC",
        requestedSlug: "northstar-rcic",
        hqCountry: "CA",
        hqCity: "Vancouver",
        corporateDomain: "northstarrcic.ca",
        taxRegistrationId: "BN-892104552RC0001",
        contactFullName: "Priya Grewal, RCIC",
        contactWorkEmail: "priya@northstarrcic.ca",
        contactPhone: "+1-604-555-0192",
        ownerPassword: "OwnerSecurePass2026!",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R719804",
        targetCorridors: ["CA"],
        estimatedMonthlyCases: 25,
        requestedSeats: 6,
        branchCount: 1,
        selectedPlanTier: "growth",
        dpaAccepted: true,
        zeroTrainingAccepted: true,
      });

      const { provisionedTenant } = adjudicateAgencyKybApplication(
        application.id,
        "approve",
        "Verified CICC certificate.",
        PLATFORM_HQ_OPERATOR_EMAIL
      );
      const orgId = provisionedTenant!.organizationId;

      const mgrInvite = inviteAgencyTeamMember({
        organizationId: orgId,
        fullName: "Karan Gill",
        email: "karan@northstarrcic.ca",
        role: "case_manager",
      });
      const paraInvite = inviteAgencyTeamMember({
        organizationId: orgId,
        fullName: "Simran Kaur",
        email: "simran@northstarrcic.ca",
        role: "paralegal",
      });

      const ownerRes = authenticateUser("priya@northstarrcic.ca", "firm", "OwnerSecurePass2026!");
      expect(ownerRes.success).toBe(true);
      expect(ownerRes.user?.role).toBe("master_admin");
      expect(canDeleteClient(ownerRes.user)).toBe(true);

      const mgrRes = authenticateUser("karan@northstarrcic.ca", "firm", mgrInvite.passcode);
      expect(mgrRes.success).toBe(true);
      expect(mgrRes.user?.role).toBe("case_manager");
      expect(canDeleteClient(mgrRes.user)).toBe(true);

      const paraRes = authenticateUser("simran@northstarrcic.ca", "firm", paraInvite.passcode);
      expect(paraRes.success).toBe(true);
      expect(paraRes.user?.role).toBe("case_worker");
      expect(paraRes.user?.experience).toBe("paralegal");
      expect(canDeleteClient(paraRes.user)).toBe(false);
    });
  });

  describe("OwnerMasterDashboard UI Rendering", () => {
    it("renders Delete Client buttons in Owner Master Dashboard for Owner login", async () => {
      const { container } = render(
        <OwnerMasterDashboard
          cases={[]}
          clients={mockClients}
          auditEvents={[]}
          currentUser={OWNER_USER}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      const clientsTab = container.querySelector("#tab-btn-clients");
      expect(clientsTab).toBeDefined();
      fireEvent.click(clientsTab!);

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
          currentUser={OWNER_USER}
          onDeleteClient={onDeleteClientMock}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      const clientsTab = container.querySelector("#tab-btn-clients");
      fireEvent.click(clientsTab!);

      const deleteFirst = screen.getByRole("button", { name: /Delete client Aarav Mehta/i });
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
          currentUser={PARALEGAL_USER}
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      const clientsTab = screen.getByRole("button", { name: /Client Directory/i });
      fireEvent.click(clientsTab);

      await waitFor(() => {
        expect(screen.getByText("aarav.mehta@example.com")).toBeDefined();
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
          currentUser={MANAGER_USER}
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

  describe("WorkspaceHeader Profile Menu (No Demo Persona Switcher)", () => {
    it("displays authenticated user role badge and Sign Out without demo persona buttons", () => {
      render(
        <WorkspaceHeader
          currentUser={OWNER_USER}
          onLogout={vi.fn()}
          isLiveBackend={true}
        />
      );

      const profileBtn = screen.getByRole("button", { name: /Priya Grewal, RCIC - User profile menu/i });
      fireEvent.click(profileBtn);

      expect(screen.getAllByText(/Managing Partner/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Switch Demo Persona/i)).toBeNull();
      expect(screen.getByRole("button", { name: /Sign Out of Documento/i })).toBeDefined();
    });
  });

  describe("API Client deletion method", () => {
    it("allows Owner and Manager to delete standalone client and logs audit event", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));
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
      const deleteAudit = auditRes.data.find(
        (a) => a.action === "client.deleted" && a.object_id === createdId
      );
      expect(deleteAudit).toBeDefined();
    });

    it("strictly blocks Paralegal role from executing deleteClient in fallback mode", async () => {
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));
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
      window.localStorage.setItem("documento_user", JSON.stringify(OWNER_USER));
      const createRes = await api.createClient({
        first_name: "ClientSelf",
        last_name: "Record",
        email: "self@example.com",
        nationality: "GBR",
      });
      const createdId = createRes.data.id;

      await expect(api.deleteClient(createdId, "retained_client")).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });
  });
});
