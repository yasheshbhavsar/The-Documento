import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { canDeleteCase } from "../lib/auth";
import { api } from "../lib/api";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { initCaseKickoffRecord, getCaseKickoffRecord } from "../lib/caseKickoffStore";
import { ClientProfile, ImmigrationCase, UserContext } from "../lib/types";

const OWNER_USER: UserContext = {
  id: "usr-owner-yb",
  email: "owner@ybimmigration.ca",
  full_name: "Yashesh Bhavsar",
  role: "master_admin",
  organization_id: "ten-yb-immigration",
  organization_name: "YB Immigration",
  experience: "master_admin",
  permissions: ["cases:read", "cases:write", "case:delete", "client:delete"],
};

const MANAGER_USER: UserContext = {
  id: "usr-mgr-heli",
  email: "heli@ybimmigration.ca",
  full_name: "Heli Desai, Case Manager",
  role: "case_manager",
  organization_id: "ten-yb-immigration",
  organization_name: "YB Immigration",
  experience: "case_manager",
  permissions: ["cases:read", "cases:write", "case:delete", "client:delete"],
};

const PARALEGAL_USER: UserContext = {
  id: "usr-para-simran",
  email: "paralegal@ybimmigration.ca",
  full_name: "Simran Kaur, Paralegal",
  role: "case_worker",
  organization_id: "ten-yb-immigration",
  organization_name: "YB Immigration",
  experience: "paralegal",
  permissions: ["cases:read", "cases:write"],
};

const FINANCE_USER: UserContext = {
  id: "usr-fin-01",
  email: "finance@ybimmigration.ca",
  full_name: "Kiran Patel, Finance",
  role: "finance_staff",
  organization_id: "ten-yb-immigration",
  organization_name: "YB Immigration",
  experience: "case_manager",
  permissions: ["cases:read", "billing:read", "billing:write"],
};

const CLIENT_USER: UserContext = {
  id: "usr-client-01",
  email: "applicant@example.com",
  full_name: "Aarav Mehta",
  role: "retained_client",
  organization_id: "ten-yb-immigration",
  organization_name: "YB Immigration",
  experience: "client_applicant",
  permissions: ["portal:read"],
};

const CLIENT_FIXTURE: ClientProfile = {
  id: "client-yb-001",
  first_name: "Yashesh",
  last_name: "Bhavsar",
  email: "yashesh.applicant@example.com",
  nationality: "IND",
  phone: "+919999900001",
  organization_id: "ten-yb-immigration",
  created_at: "2026-11-12T10:00:00Z",
};

const CASE_EB1A: ImmigrationCase = {
  id: "case-6021",
  case_number: "CASE-6021",
  title: "EB-1A Extraordinary Ability: YASHESH BHAVSAR",
  client_id: "client-yb-001",
  client_name: "YASHESH BHAVSAR",
  jurisdiction: "US",
  visa_category: "EB-1A Extraordinary Ability",
  status: "intake",
  readiness_score: undefined as unknown as number,
  deadline: "2027-02-10",
  organization_id: "ten-yb-immigration",
  created_at: "2026-11-12T10:00:00Z",
};

const CASE_TRV: ImmigrationCase = {
  id: "case-3031",
  case_number: "CASE-3031",
  title: "Canada Visitor Visa (TRV): YASHESH BHAVSAR",
  client_id: "client-yb-001",
  client_name: "YASHESH BHAVSAR",
  jurisdiction: "CA",
  visa_category: "Canada Visitor Visa (TRV)",
  status: "intake",
  readiness_score: 42,
  deadline: "2027-02-15",
  organization_id: "ten-yb-immigration",
  created_at: "2026-11-12T10:05:00Z",
};

describe("Individual Case Deletion Lifecycle & RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("canDeleteCase permission matrix", () => {
    it("allows Owners and Case Managers while blocking Paralegals, Finance Staff, and Retained Clients", () => {
      expect(canDeleteCase(OWNER_USER)).toBe(true);
      expect(canDeleteCase(MANAGER_USER)).toBe(true);
      expect(canDeleteCase({ ...MANAGER_USER, permissions: ["client:delete"] })).toBe(true);
      expect(canDeleteCase(PARALEGAL_USER)).toBe(false);
      expect(canDeleteCase({ ...MANAGER_USER, role: "document_reviewer" })).toBe(false);
      expect(canDeleteCase(FINANCE_USER)).toBe(false);
      expect(canDeleteCase(CLIENT_USER)).toBe(false);
      expect(canDeleteCase(null)).toBe(false);
    });
  });

  describe("api.deleteCase cascade & preservation", () => {
    it("deletes a single case and its child artifacts while keeping the retained client and sibling case", async () => {
      window.localStorage.setItem("documento_active_user", JSON.stringify(OWNER_USER));
      window.localStorage.setItem("documento_clients_v3_clean", JSON.stringify([CLIENT_FIXTURE]));
      window.localStorage.setItem("documento_cases_v3_clean", JSON.stringify([CASE_EB1A, CASE_TRV]));
      window.localStorage.setItem(
        "documento_documents_v3_clean",
        JSON.stringify([
          { id: "doc-1", case_id: CASE_EB1A.id, title: "Patent.pdf", category: "supporting_evidence", status: "pending", sha256_hash: "x", uploaded_at: "2026-11-12" },
          { id: "doc-2", case_id: CASE_TRV.id, title: "Passport.pdf", category: "identity_passport", status: "verified", sha256_hash: "y", uploaded_at: "2026-11-12" },
        ])
      );
      window.localStorage.setItem(
        "documento_tasks_v3_clean",
        JSON.stringify([
          { id: "task-1", case_id: CASE_EB1A.id, title: "Draft EB-1A brief", due_date: "2026-12-01", priority: "high", is_completed: false },
          { id: "task-2", case_id: CASE_TRV.id, title: "Check travel history", due_date: "2026-12-01", priority: "medium", is_completed: false },
        ])
      );
      window.localStorage.setItem(`documento_initial_info_sheet_${CASE_EB1A.id}`, JSON.stringify({ draft: true }));
      initCaseKickoffRecord({
        caseId: CASE_EB1A.id,
        caseNumber: CASE_EB1A.case_number,
        clientId: CLIENT_FIXTURE.id,
      });
      expect(getCaseKickoffRecord(CASE_EB1A.id)).not.toBeNull();

      const res = await api.deleteCase(CASE_EB1A.id, "master_admin");
      expect(res.data.success).toBe(true);
      expect(res.data.id).toBe(CASE_EB1A.id);

      const remainingCases = JSON.parse(window.localStorage.getItem("documento_cases_v3_clean") || "[]");
      expect(remainingCases).toHaveLength(1);
      expect(remainingCases[0].id).toBe(CASE_TRV.id);

      const remainingDocs = JSON.parse(window.localStorage.getItem("documento_documents_v3_clean") || "[]");
      expect(remainingDocs.map((d: any) => d.id)).toEqual(["doc-2"]);

      const remainingTasks = JSON.parse(window.localStorage.getItem("documento_tasks_v3_clean") || "[]");
      expect(remainingTasks.map((t: any) => t.id)).toEqual(["task-2"]);

      const remainingClients = JSON.parse(window.localStorage.getItem("documento_clients_v3_clean") || "[]");
      expect(remainingClients).toHaveLength(1);
      expect(remainingClients[0].id).toBe(CLIENT_FIXTURE.id);

      expect(window.localStorage.getItem(`documento_initial_info_sheet_${CASE_EB1A.id}`)).toBeNull();
      expect(getCaseKickoffRecord(CASE_EB1A.id)).toBeNull();

      const audits = JSON.parse(window.localStorage.getItem("documento_audit_events_v3_clean") || "[]");
      expect(audits[0].action).toBe("case.deleted");
      expect(audits[0].object_id).toBe("CASE-6021");
    });

    it("rejects deleteCase for paralegals, finance staff, and retained clients", async () => {
      await expect(api.deleteCase(CASE_EB1A.id, "case_worker")).rejects.toThrow(/permission/i);
      await expect(api.deleteCase(CASE_EB1A.id, "document_reviewer")).rejects.toThrow(/permission/i);
      await expect(api.deleteCase(CASE_EB1A.id, "finance_staff")).rejects.toThrow(/permission/i);
      await expect(api.deleteCase(CASE_EB1A.id, "retained_client")).rejects.toThrow(/permission/i);
    });
  });

  describe("Dashboard & Modal Case Deletion UI", () => {
    it("renders Delete Case button and 0% readiness fallback in OwnerMasterDashboard All Cases table", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const onDeleteCase = vi.fn().mockResolvedValue(undefined);

      render(
        <OwnerMasterDashboard
          cases={[CASE_EB1A, CASE_TRV]}
          clients={[CLIENT_FIXTURE]}
          currentUser={OWNER_USER}
          onDeleteCase={onDeleteCase}
        />
      );

      // Navigate to All Cases tab
      fireEvent.click(screen.getByRole("button", { name: /All Cases/i }));

      // Undefined readiness_score renders "0%" rather than blank "%"
      expect(screen.getByText("0%")).toBeDefined();

      const deleteBtn = screen.getByTestId(`delete-case-${CASE_EB1A.id}`);
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(onDeleteCase).toHaveBeenCalledWith(CASE_EB1A.id);
      });
      confirmSpy.mockRestore();
    });

    it("shows Delete Case in EmployeeWorkspace only for Managers, hiding it from Paralegals", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const onDeleteCase = vi.fn().mockResolvedValue(undefined);

      const { rerender } = render(
        <EmployeeWorkspace
          cases={[CASE_EB1A]}
          clients={[CLIENT_FIXTURE]}
          currentUser={PARALEGAL_USER}
          onDeleteCase={onDeleteCase}
        />
      );

      fireEvent.click(screen.getByTestId("tab-btn-assigned_cases"));
      expect(screen.queryByTestId(`emp-delete-case-${CASE_EB1A.id}`)).toBeNull();

      rerender(
        <EmployeeWorkspace
          cases={[CASE_EB1A]}
          clients={[CLIENT_FIXTURE]}
          currentUser={MANAGER_USER}
          onDeleteCase={onDeleteCase}
        />
      );

      const mgrDeleteBtn = screen.getByTestId(`emp-delete-case-${CASE_EB1A.id}`);
      fireEvent.click(mgrDeleteBtn);

      await waitFor(() => {
        expect(onDeleteCase).toHaveBeenCalledWith(CASE_EB1A.id);
      });
      confirmSpy.mockRestore();
    });

    it("exposes Delete Case in CaseDrilldownDrawer and CaseDetailModal for authorized roles only", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const onDeleteCase = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      const { rerender } = render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={onClose}
          caseItem={CASE_TRV}
          currentUser={OWNER_USER}
          onDeleteCase={onDeleteCase}
        />
      );

      fireEvent.click(screen.getByTestId("delete-case-drawer-btn"));
      await waitFor(() => {
        expect(onDeleteCase).toHaveBeenCalledWith(CASE_TRV.id);
        expect(onClose).toHaveBeenCalled();
      });

      rerender(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={onClose}
          caseItem={CASE_TRV}
          currentUser={PARALEGAL_USER}
          onDeleteCase={onDeleteCase}
        />
      );
      expect(screen.queryByTestId("delete-case-drawer-btn")).toBeNull();

      const modalOnDelete = vi.fn().mockResolvedValue(undefined);
      const modalOnClose = vi.fn();
      render(
        <CaseDetailModal
          isOpen={true}
          onClose={modalOnClose}
          caseItem={CASE_TRV}
          currentUser={MANAGER_USER}
          onDeleteCase={modalOnDelete}
        />
      );

      fireEvent.click(screen.getByTestId("delete-case-modal-btn"));
      await waitFor(() => {
        expect(modalOnDelete).toHaveBeenCalledWith(CASE_TRV.id);
        expect(modalOnClose).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });

    it("updates WorkspaceContext state when handleDeleteCase removes one case", async () => {
      window.localStorage.setItem("documento_active_user", JSON.stringify(OWNER_USER));
      window.localStorage.setItem("documento_clients_v3_clean", JSON.stringify([CLIENT_FIXTURE]));
      window.localStorage.setItem("documento_cases_v3_clean", JSON.stringify([CASE_EB1A, CASE_TRV]));

      function Harness() {
        const ws = useWorkspace();
        return (
          <div>
            <span data-testid="case-count">{ws.cases.length}</span>
            <span data-testid="client-count">{ws.clients.length}</span>
            <button data-testid="ctx-delete-case" onClick={() => void ws.handleDeleteCase(CASE_EB1A.id)}>
              Remove Case
            </button>
            {ws.bannerAlert && <div role="status">{ws.bannerAlert.message}</div>}
          </div>
        );
      }

      render(
        <WorkspaceProvider initialUser={OWNER_USER}>
          <Harness />
        </WorkspaceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("case-count").textContent).toBe("2");
      });

      fireEvent.click(screen.getByTestId("ctx-delete-case"));

      await waitFor(() => {
        expect(screen.getByTestId("case-count").textContent).toBe("1");
        expect(screen.getByTestId("client-count").textContent).toBe("1");
        expect(screen.getByRole("status").textContent).toMatch(/CASE-6021 deleted/i);
      });
    });
  });
});
