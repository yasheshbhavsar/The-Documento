import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BusinessOperationsHub } from "../components/operations/BusinessOperationsHub";
import { OwnerMasterDashboard, resolveEffectiveTab } from "../components/dashboards/OwnerMasterDashboard";
import { authenticateUser, canDeleteClient } from "../lib/auth";
import {
  provisionSalesLedAgency,
  getAgencyForOrganization,
  getAgencyTeamInvites,
} from "../lib/agencyPlatformStore";
import { deleteStaffMember } from "../lib/api";
import { UserContext } from "../lib/types";

describe("Operations Hub Redesign: Separate Team Member Logins, Credential Vault & Smart 1-Step Offboarding", () => {
  let ownerUser: UserContext;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("documento_cases_v3_clean", "[]");
    window.localStorage.setItem("documento_tasks_v3_clean", "[]");

    // Provision a clean verified agency matching the user's real screenshot ("YB IMMIGRATION")
    const tenant = provisionSalesLedAgency({
      legalEntityName: "YB IMMIGRATION",
      tradingName: "YB IMMIGRATION",
      slug: "yb-immigration",
      hqCity: "Ahmedabad",
      hqCountry: "India",
      kybTrack: "regulated_counsel",
      regulatoryBody: "CICC",
      licenseNumber: "R654321",
      ownerFullName: "YASHESH BHAVSAR",
      ownerEmail: "yasheshbhavsarzuyu@gmail.com",
      ownerPassword: "OwnerPass!2026",
      enabledCorridors: ["CA"],
      planTier: "growth",
      paymentMethod: "stripe_card",
      kybVerifiedOnCall: true,
    });

    ownerUser = {
      id: `usr-owner-${tenant.slug}`,
      email: tenant.ownerEmail,
      full_name: tenant.ownerFullName,
      role: "company_admin",
      experience: "master_admin",
      organization_id: tenant.organizationId,
      organization_name: tenant.legalEntityName,
      permissions: ["*"],
    };

    window.localStorage.setItem("documento_user", JSON.stringify(ownerUser));
  });

  it("provisions separate logins across all 4 Immigration Practice Roles and routes each login to its exact workspace & RBAC scope", async () => {
    render(<BusinessOperationsHub isLiveBackend={false} currentUser={ownerUser} />);

    await waitFor(() => {
      expect(screen.getByText("YASHESH BHAVSAR")).toBeDefined();
      expect(screen.getByText("Primary Owner")).toBeDefined();
    });

    const rolesToProvision = [
      {
        name: "Aarav Patel",
        email: "aarav.partner@ybimmigration.com",
        role: "company_admin",
        password: "PartnerLogin!01",
        expectedRoleLabel: "Co-Partner / Admin",
        expectedAuthRole: "company_admin",
        expectedExperience: "master_admin",
        expectedCanDeleteClient: true,
      },
      {
        name: "Heli Shah",
        email: "heli@ybimmigration.com",
        role: "case_manager",
        password: "CounselLogin!02",
        expectedRoleLabel: "Case Manager / Counsel",
        expectedAuthRole: "case_manager",
        expectedExperience: "case_manager",
        expectedCanDeleteClient: true,
      },
      {
        name: "Riya Desai",
        email: "riya.paralegal@ybimmigration.com",
        role: "paralegal",
        password: "ParalegalLogin!03",
        expectedRoleLabel: "Case Processor / Paralegal",
        expectedAuthRole: "case_worker",
        expectedExperience: "paralegal",
        expectedCanDeleteClient: false,
      },
      {
        name: "Karan Mehta",
        email: "karan.intake@ybimmigration.com",
        role: "intake_finance",
        password: "IntakeLogin!04",
        expectedRoleLabel: "Intake & Finance",
        expectedAuthRole: "finance_staff",
        expectedExperience: "case_manager",
        expectedCanDeleteClient: false,
      },
    ];

    for (const spec of rolesToProvision) {
      fireEvent.click(screen.getByTestId("btn-open-invite-staff"));
      expect(await screen.findByTestId("provision-staff-modal")).toBeDefined();

      fireEvent.change(document.getElementById("input-invite-name")!, {
        target: { value: spec.name },
      });
      fireEvent.change(document.getElementById("input-invite-email")!, {
        target: { value: spec.email },
      });
      fireEvent.change(document.getElementById("select-invite-role")!, {
        target: { value: spec.role },
      });
      fireEvent.change(screen.getByTestId("input-invite-password"), {
        target: { value: spec.password },
      });

      fireEvent.click(document.getElementById("btn-submit-invite-staff")!);

      // Verify persistent Provisioned Login Card appears with exact password & copy button
      await waitFor(() => {
        expect(screen.getByTestId("provisioned-staff-login-card")).toBeDefined();
        expect(screen.getByTestId("provisioned-staff-password-value").textContent).toBe(
          spec.password
        );
      });

      // Verify member is rendered in table with human-readable role label (never raw snake_case)
      expect(screen.getByText(spec.name)).toBeDefined();
      expect(screen.getAllByText(spec.expectedRoleLabel).length).toBeGreaterThan(0);

      // Verify separate login at /login (Firm Staff Portal) works with exact password and fails with wrong password
      const wrongLogin = authenticateUser(spec.email, "firm", "WrongPassword999");
      expect(wrongLogin.success).toBe(false);

      const validLogin = authenticateUser(spec.email, "firm", spec.password);
      expect(validLogin.success).toBe(true);
      expect(validLogin.user?.role).toBe(spec.expectedAuthRole);
      expect(validLogin.user?.experience).toBe(spec.expectedExperience);
      expect(validLogin.user?.organization_id).toBe(ownerUser.organization_id);
      expect(canDeleteClient(validLogin.user)).toBe(spec.expectedCanDeleteClient);
    }

    // Reconcile seatsUsed: 1 founding owner + 4 provisioned staff = 5 seats
    const updatedTenant = getAgencyForOrganization(ownerUser.organization_id);
    expect(updatedTenant?.seatsUsed).toBe(5);
  });

  it("manages per-row Credential Vault: reveals password, rotates password, and suspends/re-enables staff login immediately", async () => {
    render(<BusinessOperationsHub isLiveBackend={false} currentUser={ownerUser} />);

    await waitFor(() => {
      expect(screen.getByText("YASHESH BHAVSAR")).toBeDefined();
    });

    // Add a staff member first
    fireEvent.click(screen.getByTestId("btn-open-invite-staff"));
    fireEvent.change(document.getElementById("input-invite-name")!, {
      target: { value: "Heli" },
    });
    fireEvent.change(document.getElementById("input-invite-email")!, {
      target: { value: "hns@aaa.com" },
    });
    fireEvent.change(screen.getByTestId("input-invite-password"), {
      target: { value: "InitialPass!88" },
    });
    fireEvent.click(document.getElementById("btn-submit-invite-staff")!);

    await waitFor(() => {
      expect(screen.getByText("Heli")).toBeDefined();
    });

    const invites = getAgencyTeamInvites(ownerUser.organization_id);
    expect(invites.length).toBe(1);
    const heliUserId = invites[0].id;

    // Open per-row Credential Vault
    fireEvent.click(screen.getByTestId(`staff-credentials-btn-${heliUserId}`));
    expect(await screen.findByTestId("staff-credentials-modal")).toBeDefined();

    const pwInput = screen.getByTestId("input-staff-credential-password") as HTMLInputElement;
    expect(pwInput.type).toBe("password");
    expect(pwInput.value).toBe("InitialPass!88");

    // Reveal password
    fireEvent.click(screen.getByTestId("btn-toggle-show-staff-password"));
    expect(pwInput.type).toBe("text");

    // Reject too-short password (<8 chars)
    fireEvent.change(pwInput, { target: { value: "short" } });
    fireEvent.click(screen.getByTestId("btn-save-staff-credentials"));
    expect(await screen.findByRole("alert")).toBeDefined();

    // Set rotated strong password & suspend login
    fireEvent.change(pwInput, { target: { value: "RotatedPass!2026" } });
    fireEvent.click(screen.getByTestId("toggle-staff-login-enabled"));
    fireEvent.click(screen.getByTestId("btn-save-staff-credentials"));

    await waitFor(() => {
      expect(screen.queryByTestId("staff-credentials-modal")).toBeNull();
      expect(screen.getByText("Suspended")).toBeDefined();
    });

    // Old password fails, and even new password is blocked while login is Suspended
    expect(authenticateUser("hns@aaa.com", "firm", "InitialPass!88").success).toBe(false);
    const suspendedAttempt = authenticateUser("hns@aaa.com", "firm", "RotatedPass!2026");
    expect(suspendedAttempt.success).toBe(false);
    expect(suspendedAttempt.error).toMatch(/Access Suspended/i);

    // Re-enable login from Credential Vault and verify new password succeeds
    fireEvent.click(screen.getByTestId(`staff-credentials-btn-${heliUserId}`));
    expect(await screen.findByTestId("staff-credentials-modal")).toBeDefined();
    fireEvent.click(screen.getByTestId("toggle-staff-login-enabled"));
    fireEvent.click(screen.getByTestId("btn-save-staff-credentials"));

    await waitFor(() => {
      expect(screen.queryByTestId("staff-credentials-modal")).toBeNull();
    });

    const activeAttempt = authenticateUser("hns@aaa.com", "firm", "RotatedPass!2026");
    expect(activeAttempt.success).toBe(true);
    expect(activeAttempt.user?.email).toBe("hns@aaa.com");
  });

  it("edits a team member's role, branch office, and max active case capacity with live reconciliation", async () => {
    render(<BusinessOperationsHub isLiveBackend={false} currentUser={ownerUser} />);

    await waitFor(() => {
      expect(screen.getByText("YASHESH BHAVSAR")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("btn-open-invite-staff"));
    fireEvent.change(document.getElementById("input-invite-name")!, {
      target: { value: "Neha Trivedi" },
    });
    fireEvent.change(document.getElementById("input-invite-email")!, {
      target: { value: "neha@ybimmigration.com" },
    });
    fireEvent.change(screen.getByTestId("input-invite-password"), {
      target: { value: "NehaSecure!2026" },
    });
    fireEvent.click(document.getElementById("btn-submit-invite-staff")!);

    await waitFor(() => {
      expect(screen.getByText("Neha Trivedi")).toBeDefined();
    });

    const nehaId = getAgencyTeamInvites(ownerUser.organization_id)[0].id;
    fireEvent.click(screen.getByTestId(`staff-edit-btn-${nehaId}`));
    expect(await screen.findByTestId("staff-edit-modal")).toBeDefined();

    fireEvent.change(screen.getByTestId("select-edit-staff-role"), {
      target: { value: "company_admin" },
    });
    fireEvent.change(screen.getByTestId("input-edit-staff-branch"), {
      target: { value: "Toronto Missisauga Desk" },
    });
    fireEvent.change(screen.getByTestId("input-edit-staff-capacity"), {
      target: { value: "35" },
    });

    fireEvent.click(screen.getByTestId("btn-save-staff-edit"));

    await waitFor(() => {
      expect(screen.queryByTestId("staff-edit-modal")).toBeNull();
      expect(screen.getByText("Toronto Missisauga Desk")).toBeDefined();
      expect(screen.getByText("0 / 35")).toBeDefined();
    });

    // Verify upgraded login grants master_admin experience
    const nehaAuth = authenticateUser("neha@ybimmigration.com", "firm", "NehaSecure!2026");
    expect(nehaAuth.success).toBe(true);
    expect(nehaAuth.user?.role).toBe("company_admin");
    expect(nehaAuth.user?.experience).toBe("master_admin");

    // Verify Branches & Teams reflects the new branch
    fireEvent.click(document.getElementById("tab-btn-ops-branches")!);
    expect(await screen.findByText("Toronto Missisauga Desk")).toBeDefined();
  });

  it("supports 1-step deletion for 0-case members (like Heli) AND atomic case transfer + deletion when active cases exist, while protecting Primary Owner", async () => {
    const { unmount: unmountInitial } = render(
      <BusinessOperationsHub isLiveBackend={false} currentUser={ownerUser} />
    );

    await waitFor(() => {
      expect(screen.getByText("YASHESH BHAVSAR")).toBeDefined();
    });

    // Founding Primary Owner has NO Delete button and backend/API blocks owner deletion
    expect(screen.queryByTestId(`staff-delete-btn-${ownerUser.id}`)).toBeNull();
    await expect(deleteStaffMember(ownerUser.id)).rejects.toThrow(
      /The Founding Managing Partner account is protected and cannot be deleted/i
    );

    // 1. Add Heli with 0 active cases -> 1-step instant delete & seat reclaim
    fireEvent.click(screen.getByTestId("btn-open-invite-staff"));
    fireEvent.change(document.getElementById("input-invite-name")!, {
      target: { value: "Heli" },
    });
    fireEvent.change(document.getElementById("input-invite-email")!, {
      target: { value: "hns@aaa.com" },
    });
    fireEvent.change(screen.getByTestId("input-invite-password"), {
      target: { value: "HeliPass!2026" },
    });
    fireEvent.click(document.getElementById("btn-submit-invite-staff")!);

    await waitFor(() => {
      expect(screen.getByText("Heli")).toBeDefined();
    });
    expect(getAgencyForOrganization(ownerUser.organization_id)?.seatsUsed).toBe(2);

    const heliId = getAgencyTeamInvites(ownerUser.organization_id)[0].id;
    fireEvent.click(screen.getByTestId(`staff-delete-btn-${heliId}`));
    expect(await screen.findByTestId("staff-delete-modal")).toBeDefined();
    expect(screen.getByText(/Zero Active Petitions Assigned/i)).toBeDefined();
    expect(screen.queryByTestId("select-delete-transfer-target")).toBeNull();

    fireEvent.click(screen.getByTestId("btn-confirm-delete-staff"));

    await waitFor(() => {
      expect(screen.queryByText("hns@aaa.com")).toBeNull();
    });

    // Seat reclaimed (2 -> 1) and Heli's login immediately revoked!
    expect(getAgencyForOrganization(ownerUser.organization_id)?.seatsUsed).toBe(1);
    expect(authenticateUser("hns@aaa.com", "firm", "HeliPass!2026").success).toBe(false);

    // 2. Add Devansh and assign 2 active cases + 1 open task in localStorage -> Delete modal enforces inline transfer!
    fireEvent.click(screen.getByTestId("btn-open-invite-staff"));
    fireEvent.change(document.getElementById("input-invite-name")!, {
      target: { value: "Devansh Joshi" },
    });
    fireEvent.change(document.getElementById("input-invite-email")!, {
      target: { value: "devansh@ybimmigration.com" },
    });
    fireEvent.change(screen.getByTestId("input-invite-password"), {
      target: { value: "DevanshPass!99" },
    });
    fireEvent.click(document.getElementById("btn-submit-invite-staff")!);

    await waitFor(() => {
      expect(screen.getByText("Devansh Joshi")).toBeDefined();
    });

    const devanshInvite = getAgencyTeamInvites(ownerUser.organization_id)[0];
    const devanshId = devanshInvite.id;

    // Unmount first instance cleanly before seeding localStorage & mounting fresh
    unmountInitial();

    window.localStorage.setItem(
      "documento_cases_v3_clean",
      JSON.stringify([
        {
          id: "case-yb-101",
          case_number: "CASE-CA-101",
          client_name: "Meera Nair",
          assigned_manager: "Devansh Joshi",
          organization_id: ownerUser.organization_id,
          status: "gathering",
        },
        {
          id: "case-yb-102",
          case_number: "CASE-CA-102",
          client_name: "Rohan Verma",
          assigned_manager: "Devansh Joshi",
          organization_id: ownerUser.organization_id,
          status: "review",
        },
      ])
    );
    window.localStorage.setItem(
      "documento_tasks_v3_clean",
      JSON.stringify([
        {
          id: "task-yb-1",
          case_id: "case-yb-101",
          title: "Verify WES ECA equivalence",
          assigned_to: "Devansh Joshi",
          is_completed: false,
        },
      ])
    );

    render(<BusinessOperationsHub isLiveBackend={false} currentUser={ownerUser} />);
    await waitFor(() => {
      expect(screen.getByText("2 / 20")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId(`staff-delete-btn-${devanshId}`));
    expect(await screen.findByTestId("staff-delete-modal")).toBeDefined();
    expect(screen.getByText(/Active Caseload Safeguard \(2 cases, 1 tasks\)/i)).toBeDefined();

    // Select YASHESH BHAVSAR as receiving colleague and confirm atomic transfer + delete
    const transferSelect = screen.getByTestId("select-delete-transfer-target") as HTMLSelectElement;
    expect(transferSelect.value).toBe(ownerUser.id);

    fireEvent.click(screen.getByTestId("btn-confirm-delete-staff"));

    await waitFor(() => {
      expect(screen.queryByText("devansh@ybimmigration.com")).toBeNull();
    });

    // Verify all cases & tasks were atomically transferred to YASHESH BHAVSAR and zero orphaned work remains
    const transferredCases = JSON.parse(
      window.localStorage.getItem("documento_cases_v3_clean") || "[]"
    );
    expect(transferredCases).toHaveLength(2);
    expect(transferredCases.every((c: any) => c.assigned_manager === "YASHESH BHAVSAR")).toBe(true);

    const transferredTasks = JSON.parse(
      window.localStorage.getItem("documento_tasks_v3_clean") || "[]"
    );
    expect(transferredTasks[0].assigned_to).toBe("YASHESH BHAVSAR");

    // Verify login is revoked, seat is reclaimed, and audit trail recorded offboarding
    expect(
      authenticateUser("devansh@ybimmigration.com", "firm", "DevanshPass!99").success
    ).toBe(false);
    expect(getAgencyForOrganization(ownerUser.organization_id)?.seatsUsed).toBe(1);

    fireEvent.click(document.getElementById("tab-btn-ops-access")!);
    expect((await screen.findAllByText("staff.offboarded_and_deleted")).length).toBe(2);
  });

  it("de-clutters OwnerMasterDashboard by merging Team Capacity into Operations Hub and suppressing duplicate stacked headers", async () => {
    expect(resolveEffectiveTab("team")).toBe("operations");

    render(
      <OwnerMasterDashboard
        cases={[]}
        clients={[]}
        auditEvents={[]}
        invoices={[]}
        capacity={[]}
        isLiveBackend={false}
        currentUser={ownerUser}
        onOpenCreateCase={vi.fn()}
        onOpenCreateClient={vi.fn()}
        onSelectCase={vi.fn()}
      />
    );

    // Duplicate "Team Capacity" button no longer clutters the sidebar
    expect(document.querySelector("#tab-btn-team")).toBeNull();

    // Switch to Operations Hub
    fireEvent.click(document.querySelector("#tab-btn-operations")!);

    await waitFor(() => {
      expect(screen.getByText("Company Operations, Workload & Governance")).toBeDefined();
      expect(screen.getByTestId("ops-kpi-strip")).toBeDefined();
    });

    // Verify outer redundant "Operations Hub [Managing Partner Suite]" h1 header is suppressed when viewing Operations Hub
    expect(screen.queryByRole("heading", { level: 1, name: "Operations Hub" })).toBeNull();

    // Verify raw snake_case role strings never leak into UI badges
    expect(screen.queryByText("company_admin")).toBeNull();
    expect(screen.queryByText("master_admin")).toBeNull();
  });
});
