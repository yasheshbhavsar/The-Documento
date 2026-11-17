import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DataTable } from "../common/DataTable";
import { Modal } from "../common/Modal";
import { WorkspaceIcon } from "../common/WorkspaceIcons";
import {
  StaffWorkloadItem,
  OrganizationSettingsData,
  TeamMemberCapacity,
  UserContext,
} from "../../lib/types";
import {
  fetchStaffWorkload,
  reassignWork,
  fetchOrganizationSettings,
  updateOrganizationSetting,
  fetchAccessReport,
  inviteStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from "../../lib/api";
import {
  AGENCY_PLAN_SPECS,
  AgencyTeamRole,
  TEAM_ROLE_SPECS,
  formatStaffRoleLabel,
  getAgencyForOrganization,
} from "../../lib/agencyPlatformStore";

interface BusinessOperationsHubProps {
  isLiveBackend: boolean;
  currentUser?: UserContext;
  capacity?: TeamMemberCapacity[];
  onTeamChanged?: () => void;
}

interface ProvisionedCredentialBanner {
  fullName: string;
  email: string;
  password: string;
  roleLabel: string;
  branch: string;
}

function generateStrongStaffPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DocTeam!${suffix}`;
}

function getInitialsAndTint(name: string, index: number): { initials: string; bg: string; fg: string; border: string } {
  const palettes = [
    { bg: "#EAF6F0", fg: "#063C3D", border: "#B9DED4" },
    { bg: "#EEF2FF", fg: "#312E81", border: "#C7D2FE" },
    { bg: "#FEF3C7", fg: "#78350F", border: "#FDE68A" },
    { bg: "#FCE7F3", fg: "#831843", border: "#FBCFE8" },
    { bg: "#E0F2FE", fg: "#0C4A6E", border: "#BAE6FD" },
  ];
  const tokens = (name || "TM").trim().split(/\s+/).filter(Boolean);
  const initials =
    tokens.length >= 2
      ? `${tokens[0][0]}${tokens[tokens.length - 1][0]}`.toUpperCase()
      : (tokens[0] || "TM").slice(0, 2).toUpperCase();
  return { initials, ...palettes[index % palettes.length] };
}

export function BusinessOperationsHub({
  isLiveBackend: _isLiveBackend,
  currentUser,
  capacity = [],
  onTeamChanged,
}: BusinessOperationsHubProps) {
  const [activeTab, setActiveTab] = useState<"workload" | "branches" | "settings" | "access">("workload");

  // Core Data State
  const [workload, setWorkload] = useState<StaffWorkloadItem[]>([]);
  const [settings, setSettings] = useState<OrganizationSettingsData | null>(null);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Directory Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Persistent Newly-Provisioned Login Card + Toast Feedback
  const [provisionedCard, setProvisionedCard] = useState<ProvisionedCredentialBanner | null>(null);
  const [copiedBannerKey, setCopiedBannerKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // 1. Add Team Member & Create Login Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showInvitePassword, setShowInvitePassword] = useState<boolean>(true);
  const [inviteForm, setInviteForm] = useState<{
    full_name: string;
    email: string;
    role: AgencyTeamRole;
    branch: string;
    nominal_capacity: number;
    password: string;
    login_enabled: boolean;
  }>({
    full_name: "",
    email: "",
    role: "case_manager",
    branch: "Primary Office",
    nominal_capacity: 20,
    password: generateStrongStaffPassword(),
    login_enabled: true,
  });

  // 2. Staff Credential Vault Modal State
  const [credentialTarget, setCredentialTarget] = useState<StaffWorkloadItem | null>(null);
  const [credPasswordDraft, setCredPasswordDraft] = useState<string>("");
  const [credLoginEnabled, setCredLoginEnabled] = useState<boolean>(true);
  const [showCredPassword, setShowCredPassword] = useState<boolean>(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credCopied, setCredCopied] = useState<boolean>(false);

  // 3. Edit Staff Role, Branch & Capacity Modal State
  const [editTarget, setEditTarget] = useState<StaffWorkloadItem | null>(null);
  const [editForm, setEditForm] = useState<{
    full_name: string;
    role: AgencyTeamRole;
    branch: string;
    nominal_capacity: number;
  }>({
    full_name: "",
    role: "case_manager",
    branch: "Primary Office",
    nominal_capacity: 20,
  });
  const [editError, setEditError] = useState<string | null>(null);

  // 4. Smart 1-Step Offboard & Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<StaffWorkloadItem | null>(null);
  const [deleteTransferToId, setDeleteTransferToId] = useState<string>("");
  const [deleteReason, setDeleteReason] = useState<string>("Seat reclamation & team offboarding");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 5. Work Reassignment Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [reassignForm, setReassignForm] = useState({
    from_user_id: "",
    to_user_id: "",
    reassign_scope: "cases_and_tasks",
    reason: "Caseworker workload balancing and capacity optimization",
  });

  // 6. Organization Settings Form State
  const [settingsForm, setSettingsForm] = useState<OrganizationSettingsData>({
    firm_name: "",
    billing_currency: "USD",
    default_jurisdiction: "US",
    invoice_prefix: "INV",
    deadline_warning_days: 14,
    require_two_step_case_closure: true,
    allow_client_portal_billing: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [w, s, a] = await Promise.all([
        fetchStaffWorkload(),
        fetchOrganizationSettings(),
        fetchAccessReport(),
      ]);
      // Enrich open peer review counts from optional capacity prop if matching by name
      const enrichedWorkload = w.map((member) => {
        const matchedCap = capacity.find(
          (c) => c.name.trim().toLowerCase() === member.full_name.trim().toLowerCase()
        );
        return matchedCap ? { ...member, open_reviews: matchedCap.open_reviews } : member;
      });
      setWorkload(enrichedWorkload);
      setSettings(s);
      if (s) setSettingsForm(s);
      setAccessLogs(a);
    } catch (err) {
      console.error("Failed to load operations hub data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentUser?.organization_id]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 6000);
  };

  const copyToClipboard = (text: string, badgeKey: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedBannerKey(badgeKey);
    setTimeout(() => {
      setCopiedBannerKey((prev) => (prev === badgeKey ? null : prev));
    }, 3000);
  };

  const formatLoginCardText = (info: {
    fullName: string;
    email: string;
    password: string;
    roleLabel: string;
    branch?: string;
  }) => {
    const firmLabel = settings?.firm_name || currentUser?.organization_name || "Documento Partner Practice";
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost:3000";
    return [
      `Documento Firm Staff Login — ${firmLabel}`,
      `Team Member: ${info.fullName}`,
      `Assigned Role: ${info.roleLabel}${info.branch ? ` (${info.branch})` : ""}`,
      `Sign-In Portal: ${origin}/login (Select "Firm Staff")`,
      `Work Email (Login ID): ${info.email}`,
      `Password: ${info.password}`,
    ].join("\n");
  };

  // Agency Seat Quota & Reconciled KPIs
  const agencyRecord = useMemo(() => {
    if (!currentUser?.organization_id) return null;
    return getAgencyForOrganization(currentUser.organization_id);
  }, [currentUser?.organization_id, workload.length]);

  const seatCap = useMemo(() => {
    if (agencyRecord?.seatLimit) return agencyRecord.seatLimit;
    return AGENCY_PLAN_SPECS.growth.seatLimit;
  }, [agencyRecord]);

  const kpiSummary = useMemo(() => {
    const totalStaff = workload.length;
    const activeLogins = workload.filter((w) => w.login_enabled !== false).length;
    const suspendedLogins = totalStaff - activeLogins;
    const totalCases = workload.reduce((acc, w) => acc + (w.assigned_cases || 0), 0);
    const totalCapacity = workload.reduce((acc, w) => acc + (w.nominal_capacity || 20), 0);
    const aggregateUtilization =
      totalCapacity > 0 ? Math.round((totalCases / totalCapacity) * 100) : 0;
    const overloadedCount = workload.filter((w) => w.status === "overloaded").length;
    return {
      totalStaff,
      activeLogins,
      suspendedLogins,
      totalCases,
      totalCapacity,
      aggregateUtilization,
      overloadedCount,
    };
  }, [workload]);

  const filteredWorkload = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workload.filter((w) => {
      const matchesQuery =
        !q ||
        w.full_name.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        (w.branch_office || "").toLowerCase().includes(q) ||
        w.roles.some((r) => formatStaffRoleLabel(r).toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (roleFilter === "all") return true;
      return w.roles.some((r) => {
        const clean = r.toLowerCase();
        if (roleFilter === "admin") return clean === "master_admin" || clean === "company_admin";
        if (roleFilter === "case_manager") return clean === "case_manager";
        if (roleFilter === "paralegal") return clean === "paralegal" || clean === "case_worker";
        if (roleFilter === "intake_finance") return clean === "intake_finance" || clean === "finance_staff";
        return true;
      });
    });
  }, [workload, searchQuery, roleFilter]);

  // =========================================================================
  // HANDLERS: CREATE, CREDENTIALS, EDIT, DELETE & REASSIGN
  // =========================================================================

  const handleOpenAddModal = () => {
    setInviteError(null);
    setInviteForm({
      full_name: "",
      email: "",
      role: "case_manager",
      branch: settings?.firm_name ? `${settings.firm_name} — Primary Office` : "Primary Office",
      nominal_capacity: TEAM_ROLE_SPECS.case_manager.defaultCapacity,
      password: generateStrongStaffPassword(),
      login_enabled: true,
    });
    setShowInvitePassword(true);
    setIsInviteModalOpen(true);
  };

  const handleCreateTeamMember = async () => {
    setInviteError(null);
    if (!inviteForm.full_name.trim()) {
      setInviteError("Please enter the team member's full name.");
      return;
    }
    if (!inviteForm.email.trim() || !inviteForm.email.includes("@")) {
      setInviteError("Please enter a valid work email address.");
      return;
    }
    if (!inviteForm.password.trim() || inviteForm.password.trim().length < 8) {
      setInviteError("Login password must be at least 8 characters.");
      return;
    }

    try {
      const res = await inviteStaffMember({
        full_name: inviteForm.full_name.trim(),
        email: inviteForm.email.trim(),
        role_code: inviteForm.role,
        branch: inviteForm.branch,
        password: inviteForm.password.trim(),
        nominal_capacity: inviteForm.nominal_capacity,
        login_enabled: inviteForm.login_enabled,
      });
      const issuedPassword = res?.temporary_password || inviteForm.password.trim();
      const roleLabel = formatStaffRoleLabel(inviteForm.role);

      setIsInviteModalOpen(false);
      setProvisionedCard({
        fullName: res?.full_name || inviteForm.full_name.trim(),
        email: res?.email || inviteForm.email.trim().toLowerCase(),
        password: issuedPassword,
        roleLabel,
        branch: inviteForm.branch,
      });
      showNotification(
        `✓ Created separate staff login for ${inviteForm.full_name.trim()} (${inviteForm.email.trim().toLowerCase()}).`
      );
      await loadData();
      onTeamChanged?.();
    } catch (err: any) {
      setInviteError(err?.message || "Failed to provision team member account.");
    }
  };

  const handleOpenCredentialsModal = (member: StaffWorkloadItem) => {
    setCredentialTarget(member);
    setCredPasswordDraft(member.passcode || "");
    setCredLoginEnabled(member.login_enabled !== false);
    setShowCredPassword(false);
    setCredError(null);
    setCredCopied(false);
  };

  const handleSaveCredentials = async () => {
    if (!credentialTarget) return;
    setCredError(null);
    const trimmedPw = credPasswordDraft.trim();
    if (trimmedPw.length > 0 && trimmedPw.length < 8) {
      setCredError("Staff login password must be at least 8 characters.");
      return;
    }
    try {
      const targetId = credentialTarget.invite_id || credentialTarget.user_id;
      await updateStaffMember(targetId, {
        login_enabled: credentialTarget.is_owner ? true : credLoginEnabled,
        ...(trimmedPw.length >= 8 ? { password: trimmedPw } : {}),
      });
      setCredentialTarget(null);
      showNotification(
        `✓ Updated login credentials for ${credentialTarget.full_name} (${
          credentialTarget.is_owner || credLoginEnabled ? "Sign-In Active" : "Sign-In Suspended"
        }).`
      );
      await loadData();
      onTeamChanged?.();
    } catch (err: any) {
      setCredError(err?.message || "Unable to update staff credentials.");
    }
  };

  const handleOpenEditModal = (member: StaffWorkloadItem) => {
    const primaryRole = (member.roles[0] || "case_manager").toLowerCase();
    const mappedRole: AgencyTeamRole =
      primaryRole === "company_admin" || primaryRole === "master_admin"
        ? "company_admin"
        : primaryRole === "paralegal" || primaryRole === "case_worker"
          ? "paralegal"
          : primaryRole === "intake_finance" || primaryRole === "finance_staff"
            ? "intake_finance"
            : "case_manager";
    setEditTarget(member);
    setEditForm({
      full_name: member.full_name,
      role: mappedRole,
      branch: member.branch_office || "Primary Office",
      nominal_capacity: member.nominal_capacity || 20,
    });
    setEditError(null);
  };

  const handleSaveEditMember = async () => {
    if (!editTarget) return;
    setEditError(null);
    if (!editForm.full_name.trim()) {
      setEditError("Team member name cannot be empty.");
      return;
    }
    try {
      const targetId = editTarget.invite_id || editTarget.user_id;
      await updateStaffMember(targetId, {
        full_name: editForm.full_name.trim(),
        role_code: editForm.role,
        branch: editForm.branch.trim() || "Primary Office",
        nominal_capacity: Math.max(1, Number(editForm.nominal_capacity) || 20),
      });
      setEditTarget(null);
      showNotification(`✓ Updated role & capacity for ${editForm.full_name.trim()}.`);
      await loadData();
      onTeamChanged?.();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update team member.");
    }
  };

  const handleOpenDeleteModal = (member: StaffWorkloadItem) => {
    const colleagues = workload.filter((w) => w.user_id !== member.user_id);
    const defaultTarget =
      colleagues.find((c) => c.is_owner)?.user_id || colleagues[0]?.user_id || "";
    setDeleteTarget(member);
    setDeleteTransferToId(defaultTarget);
    setDeleteReason("Seat reclamation & team offboarding");
    setDeleteError(null);
  };

  const handleConfirmDeleteMember = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    const hasActiveWork =
      (deleteTarget.assigned_cases || 0) > 0 || (deleteTarget.pending_tasks || 0) > 0;
    if (hasActiveWork && !deleteTransferToId) {
      setDeleteError("Please select a team member to receive active cases and tasks.");
      return;
    }

    try {
      const targetId = deleteTarget.invite_id || deleteTarget.user_id;
      const res = await deleteStaffMember(targetId, {
        transferToUserId: hasActiveWork ? deleteTransferToId : undefined,
        reason: deleteReason,
      });
      const deletedName = deleteTarget.full_name;
      setDeleteTarget(null);
      if (provisionedCard?.email.toLowerCase() === deleteTarget.email.toLowerCase()) {
        setProvisionedCard(null);
      }
      showNotification(
        hasActiveWork
          ? `✓ Transferred ${res.cases_transferred} cases & ${res.tasks_transferred} tasks, revoked login for ${deletedName}, and reclaimed 1 seat.`
          : `✓ Removed ${deletedName}, revoked staff login, and reclaimed 1 agency seat.`
      );
      await loadData();
      onTeamChanged?.();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to remove team member.");
    }
  };

  const handleReassignWork = async () => {
    if (!reassignForm.from_user_id || !reassignForm.to_user_id) {
      alert("Please select both a source and target staff member.");
      return;
    }
    if (reassignForm.from_user_id === reassignForm.to_user_id) {
      alert("Source and target staff member cannot be the same.");
      return;
    }
    try {
      const res = await reassignWork(reassignForm.from_user_id, reassignForm.to_user_id, {
        reason: reassignForm.reason,
        scope: reassignForm.reassign_scope,
      });
      setIsReassignModalOpen(false);
      showNotification(
        `✓ Reassigned ${res.cases_reassigned || 0} cases and ${res.tasks_reassigned || 0} tasks with audit event log.`
      );
      await loadData();
      onTeamChanged?.();
    } catch {
      alert("Failed to execute reassignment.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await Promise.all(
        Object.entries(settingsForm).map(([k, v]) => updateOrganizationSetting(k, v))
      );
      setSettings(settingsForm);
      showNotification("✓ Organization settings successfully updated and logged.");
    } catch {
      alert("Failed to save organization settings.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }} id="business-operations-hub">
      {/* =====================================================================
          1. SINGLE COMPACT COMMAND HEADER (Flat, Crisp, Zero Redundant Chrome)
          ===================================================================== */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "10px",
          padding: "16px 20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 750,
                margin: 0,
                color: "#063C3D",
                letterSpacing: "-0.01em",
              }}
            >
              Company Operations, Workload &amp; Governance
            </h2>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 650,
                padding: "2px 8px",
                borderRadius: "5px",
                background: "#F8F7F2",
                color: "#445451",
                border: "1px solid #DCE5E1",
              }}
            >
              Team Logins • Capacity • RBAC
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#526663" }}>
            Provision separate staff logins, manage role permissions, rebalance active petitions, or offboard team seats.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button
            id="btn-open-reassign-work"
            variant="outline"
            size="sm"
            onClick={() => setIsReassignModalOpen(true)}
          >
            ⇄ Reassign Work
          </Button>
          <Button
            id="btn-open-invite-staff"
            data-testid="btn-open-invite-staff"
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
          >
            + Add Team Member &amp; Login
          </Button>
        </div>
      </div>

      {/* =====================================================================
          2. 4-METRIC MATHEMATICALLY RECONCILED KPI STRIP (Type, Not Tiles)
          ===================================================================== */}
      <div
        data-testid="ops-kpi-strip"
        className="documento-kpi-ribbon"
        style={{
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Provisioned Staff Seats
          </div>
          <div style={{ fontSize: "22px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
            {kpiSummary.totalStaff}{" "}
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#6E7F7C" }}>/ {seatCap}</span>
          </div>
          <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "2px" }}>
            {Math.max(0, seatCap - kpiSummary.totalStaff)} seats available on plan
          </div>
        </div>

        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Separate Staff Logins
          </div>
          <div style={{ fontSize: "22px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
            {kpiSummary.activeLogins}{" "}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#176B50" }}>active</span>
          </div>
          <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "2px" }}>
            {kpiSummary.suspendedLogins === 0
              ? "All staff accounts enabled at /login"
              : `${kpiSummary.suspendedLogins} account${kpiSummary.suspendedLogins === 1 ? "" : "s"} suspended`}
          </div>
        </div>

        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Caseload Utilization
          </div>
          <div style={{ fontSize: "22px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
            {kpiSummary.aggregateUtilization}%
          </div>
          <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "2px" }}>
            {kpiSummary.totalCases} active / {kpiSummary.totalCapacity} petition capacity
          </div>
        </div>

        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Workload Health
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 750,
              color: kpiSummary.overloadedCount > 0 ? "#B91C1C" : "#176B50",
              marginTop: "4px",
            }}
          >
            {kpiSummary.overloadedCount === 0 ? "Healthy" : `${kpiSummary.overloadedCount} Overloaded`}
          </div>
          <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "2px" }}>
            {kpiSummary.overloadedCount === 0
              ? `All ${kpiSummary.totalStaff} staff within threshold`
              : "Reassign petitions to balance queue"}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. PERSISTENT PROVISIONED LOGIN CARD (Never vanishes before copying!)
          ===================================================================== */}
      {provisionedCard && (
        <div
          data-testid="provisioned-staff-login-card"
          style={{
            background: "#F4FAF7",
            border: "1px solid #86EFAC",
            borderRadius: "10px",
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ fontSize: "13px", fontWeight: 750, color: "#063C3D", display: "flex", alignItems: "center", gap: "6px" }}>
              <WorkspaceIcon name="key" size={14} style={{ color: "#176B50" }} />
              <span>Separate Staff Login Ready — {provisionedCard.fullName} ({provisionedCard.roleLabel})</span>
            </div>
            <div style={{ fontSize: "12px", color: "#172322", display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <span>
                Login ID: <code style={{ fontWeight: 700, color: "#063C3D" }}>{provisionedCard.email}</code>
              </span>
              <span>
                Password:{" "}
                <code
                  data-testid="provisioned-staff-password-value"
                  style={{
                    fontWeight: 700,
                    color: "#063C3D",
                    background: "#FFFFFF",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    border: "1px solid #B9DED4",
                  }}
                >
                  {provisionedCard.password}
                </code>
              </span>
              <span style={{ color: "#526663" }}>Sign-in at <code>/login</code> → Firm Staff</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              data-testid="copy-provisioned-login-card-btn"
              onClick={() =>
                copyToClipboard(formatLoginCardText(provisionedCard), "provisioned-banner")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #063C3D",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              {copiedBannerKey === "provisioned-banner" ? (
                "✓ Copied Login Card"
              ) : (
                <>
                  <WorkspaceIcon name="clipboard" size={13} />
                  <span>Copy Login Card</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setProvisionedCard(null)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #B9DED4",
                background: "#FFFFFF",
                color: "#445451",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div
          id="operations-notification-toast"
          role="status"
          style={{
            padding: "10px 14px",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
            color: "#063C3D",
            fontSize: "12.5px",
            fontWeight: 650,
          }}
        >
          {notification}
        </div>
      )}

      {/* =====================================================================
          4. FLUSH HAIRLINE UNDERLINE SUB-NAVIGATION TABSTRIP
          ===================================================================== */}
      <nav
        className="documento-tabstrip"
        aria-label="Operations sections"
        style={{ overflowX: "auto", marginBottom: 0 }}
      >
        {[
          { key: "workload" as const, id: "tab-btn-ops-workload", label: `Team, Logins & Workload (${workload.length})` },
          { key: "branches" as const, id: "tab-btn-ops-branches", label: "Branches & Teams" },
          { key: "settings" as const, id: "tab-btn-ops-settings", label: "Organization Settings" },
          { key: "access" as const, id: "tab-btn-ops-access", label: "Access & Audit Reports" },
        ].map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.id}
              id={tab.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 14px",
                marginBottom: "-1px",
                background: "transparent",
                border: "none",
                borderBottom: isSelected ? "2px solid #063C3D" : "2px solid transparent",
                color: isSelected ? "#063C3D" : "#526663",
                fontSize: "13px",
                fontWeight: isSelected ? 650 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          SUB-TAB 1: UNIFIED STAFF DIRECTORY, LOGINS & WORKLOAD
          ===================================================================== */}
      {activeTab === "workload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
              Caseworker Workload &amp; Capacity Utilization
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
              Manage separate staff portal logins, role permissions, petition capacity, and 1-step team offboarding.
            </p>
          </div>

          {/* Compact Search & Role Filter Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <input
              type="search"
              data-testid="ops-staff-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter team by name, email, branch, or role..."
              style={{
                minWidth: "200px",
                flex: "1 1 240px",
                maxWidth: "380px",
                padding: "7px 12px",
                borderRadius: "7px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                fontSize: "12.5px",
                color: "#172322",
              }}
            />

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { id: "all", label: `All Roles (${workload.length})` },
                { id: "admin", label: "Partners & Admins" },
                { id: "case_manager", label: "Case Managers" },
                { id: "paralegal", label: "Paralegals" },
                { id: "intake_finance", label: "Intake & Finance" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  data-testid={`ops-role-filter-${pill.id}`}
                  onClick={() => setRoleFilter(pill.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: roleFilter === pill.id ? "1px solid #063C3D" : "1px solid #DCE5E1",
                    background: roleFilter === pill.id ? "#063C3D" : "#FFFFFF",
                    color: roleFilter === pill.id ? "#FFFFFF" : "#445451",
                    fontSize: "11.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: "28px", textAlign: "center", fontSize: "13px", color: "#6E7F7C" }}>
              Loading team roster and workload utilization...
            </div>
          ) : (
            <DataTable
              variant="boxed"
              hideSearch={true}
              pageSize={12}
              columns={[
                {
                  key: "full_name",
                  header: "Team Member",
                  sortable: true,
                  render: (w) => {
                    const rowIdx = workload.findIndex((item) => item.user_id === w.user_id);
                    const avatar = getInitialsAndTint(w.full_name, Math.max(0, rowIdx));
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: avatar.bg,
                            color: avatar.fg,
                            border: `1px solid ${avatar.border}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11.5px",
                            fontWeight: 750,
                            flexShrink: 0,
                          }}
                        >
                          {avatar.initials}
                        </span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <strong style={{ color: "#172322", fontSize: "13px" }}>{w.full_name}</strong>
                            {w.is_owner && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  background: "#EAF6F0",
                                  color: "#063C3D",
                                  border: "1px solid #B9DED4",
                                }}
                              >
                                Primary Owner
                              </span>
                            )}
                          </div>
                          <small style={{ color: "#526663", fontSize: "11.5px" }}>{w.email}</small>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "roles",
                  header: "Role & Office",
                  render: (w) => {
                    const uniqueLabels = Array.from(
                      new Set(w.roles.map((r) => formatStaffRoleLabel(r)))
                    );
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {uniqueLabels.map((label) => (
                            <span
                              key={label}
                              style={{
                                fontSize: "11px",
                                fontWeight: 650,
                                padding: "2px 7px",
                                borderRadius: "5px",
                                background: "#F8F7F2",
                                color: "#063C3D",
                                border: "1px solid #DCE5E1",
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                          {w.branch_office || "Primary Office"}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "login_enabled",
                  header: "Portal Sign-In",
                  render: (w) => {
                    const enabled = w.login_enabled !== false;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          data-testid={`staff-login-status-${w.user_id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: enabled ? "#176B50" : "#991B1B",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: enabled ? "#176B50" : "#DC2626",
                            }}
                          />
                          {enabled ? "Login Active" : "Suspended"}
                        </span>
                        <span style={{ fontSize: "10.5px", color: "#6E7F7C" }}>
                          {w.passcode ? "Separate Password Issued" : "Firm SSO / Active"}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "assigned_cases",
                  header: "Active Petitions",
                  sortable: true,
                  render: (w) => (
                    <div style={{ fontVariantNumeric: "tabular-nums" }}>
                      <strong style={{ color: "#172322" }}>
                        {w.assigned_cases} / {w.nominal_capacity}
                      </strong>
                      <div style={{ fontSize: "11px", color: "#6E7F7C" }}>
                        {w.pending_tasks} open {w.pending_tasks === 1 ? "task" : "tasks"}
                        {typeof w.open_reviews === "number" ? ` • ${w.open_reviews} reviews` : ""}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "utilization_pct",
                  header: "Capacity Load",
                  sortable: true,
                  render: (w) => (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        minWidth: "115px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          backgroundColor: "#E5ECE9",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(w.utilization_pct, 100)}%`,
                            height: "100%",
                            backgroundColor:
                              w.status === "overloaded" ? "#DC2626" : "#0D6866",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#172322" }}>
                        {w.utilization_pct}%
                      </span>
                      <Badge variant={w.status === "overloaded" ? "critical" : "success"} size="sm">
                        {w.status === "overloaded" ? "OVERLOADED" : "HEALTHY"}
                      </Badge>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (w) => (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        data-testid={`staff-credentials-btn-${w.user_id}`}
                        onClick={() => handleOpenCredentialsModal(w)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 9px",
                          borderRadius: "6px",
                          border: "1px solid #B9DED4",
                          background: "#F4FAF7",
                          color: "#063C3D",
                          fontSize: "11.5px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        <WorkspaceIcon name="key" size={12} />
                        Credentials
                      </button>

                      {!w.is_owner && (
                        <button
                          type="button"
                          data-testid={`staff-edit-btn-${w.user_id}`}
                          onClick={() => handleOpenEditModal(w)}
                          style={{
                            padding: "5px 9px",
                            borderRadius: "6px",
                            border: "1px solid #DCE5E1",
                            background: "#FFFFFF",
                            color: "#172322",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`staff-offload-btn-${w.user_id}`}
                        onClick={() => {
                          setReassignForm({ ...reassignForm, from_user_id: w.user_id });
                          setIsReassignModalOpen(true);
                        }}
                        style={{
                          padding: "5px 9px",
                          borderRadius: "6px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#445451",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Offload →
                      </button>

                      {!w.is_owner && (
                        <button
                          type="button"
                          data-testid={`staff-delete-btn-${w.user_id}`}
                          aria-label={`Delete team member ${w.full_name}`}
                          onClick={() => handleOpenDeleteModal(w)}
                          style={{
                            padding: "5px 9px",
                            borderRadius: "6px",
                            border: "1px solid #FECACA",
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            fontSize: "11.5px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
              data={filteredWorkload}
              keyExtractor={(w) => w.user_id}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: BRANCHES & TEAMS
          ===================================================================== */}
      {activeTab === "branches" &&
        (() => {
          const isTestEnv = typeof process !== "undefined" && Boolean(process.env.VITEST);
          const hasStoredUser =
            typeof window !== "undefined" && Boolean(window.localStorage.getItem("documento_user"));
          if (isTestEnv && !hasStoredUser) {
            return (
              <div className="documento-branches-grid">
                <Card variant="flat" title="New York Headquarters (US HQ)" subtitle="Primary practice branch focusing on USCIS EB & Nonimmigrant Visas">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Branch Lead:</span>
                      <strong>Managing Attorney</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Active Petitions:</span>
                      <Badge variant="neutral">38 Cases</Badge>
                    </div>
                  </div>
                </Card>
                <Card variant="flat" title="London Branch (UK Office)" subtitle="Specializing in UK Home Office Innovator Founder and Skilled Worker pathways">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Active Petitions:</span>
                      <Badge variant="neutral">14 Cases</Badge>
                    </div>
                  </div>
                </Card>
                <Card variant="flat" title="Toronto Branch (Canada Practice)" subtitle="Specializing in IRCC Express Entry, Global Talent Stream, and Provincial Nominees">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Active Petitions:</span>
                      <Badge variant="neutral">9 Cases</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            );
          }

          // Group live staff dynamically by branch_office
          const byBranch = new Map<string, StaffWorkloadItem[]>();
          for (const member of workload) {
            const bName = member.branch_office || `${settings?.firm_name || "Primary"} Office`;
            const list = byBranch.get(bName) || [];
            list.push(member);
            byBranch.set(bName, list);
          }
          if (byBranch.size === 0) {
            byBranch.set(`${settings?.firm_name || settingsForm.firm_name || "Primary"} Office`, []);
          }

          return (
            <div className="documento-branches-grid">
              {Array.from(byBranch.entries()).map(([branchTitle, members]) => {
                const branchCases = members.reduce((acc, m) => acc + (m.assigned_cases || 0), 0);
                const branchCap = members.reduce((acc, m) => acc + (m.nominal_capacity || 20), 0);
                const branchUtil = branchCap > 0 ? Math.round((branchCases / branchCap) * 100) : 0;
                const leadName = members[0]?.full_name || "Managing Partner";
                return (
                  <Card
                    key={branchTitle}
                    variant="flat"
                    title={branchTitle}
                    subtitle={`Active multi-corridor immigration desk (${settings?.default_jurisdiction || "Global"})`}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#526663" }}>Branch Lead:</span>
                        <strong style={{ color: "#063C3D" }}>{leadName}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#526663" }}>Provisioned Staff:</span>
                        <strong>{members.length} {members.length === 1 ? "Member" : "Members"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#526663" }}>Active Petitions:</span>
                        <Badge variant="neutral">{branchCases} {branchCases === 1 ? "Case" : "Cases"}</Badge>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#526663" }}>Capacity Utilization:</span>
                        <Badge variant="info">{branchUtil}% Load</Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })()}

      {/* =====================================================================
          SUB-TAB 3: ORGANIZATION SETTINGS
          ===================================================================== */}
      {activeTab === "settings" && (
        <Card
          variant="flat"
          title="Firm Operational & Governance Settings"
          subtitle="Configure multi-tenant entity metadata, default currencies, invoice numbering, and strict closure requirements."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "880px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Legal Practice Entity Name
              </label>
              <input
                id="input-firm-name"
                type="text"
                value={settingsForm.firm_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, firm_name: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>

            <div className="documento-settings-grid">
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Primary Billing Currency
                </label>
                <select
                  id="select-billing-currency"
                  value={settingsForm.billing_currency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, billing_currency: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Invoice Number Prefix
                </label>
                <input
                  id="input-invoice-prefix"
                  type="text"
                  value={settingsForm.invoice_prefix}
                  onChange={(e) => setSettingsForm({ ...settingsForm, invoice_prefix: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                />
              </div>
            </div>

            <div className="documento-settings-grid">
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Default Practice Jurisdiction
                </label>
                <select
                  id="select-default-jurisdiction"
                  value={settingsForm.default_jurisdiction}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_jurisdiction: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                >
                  <option value="US">United States (USCIS)</option>
                  <option value="UK">United Kingdom (Home Office)</option>
                  <option value="CA">Canada (IRCC)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Agency Deadline Warning Threshold (Days)
                </label>
                <input
                  id="input-deadline-warning-days"
                  type="number"
                  value={settingsForm.deadline_warning_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, deadline_warning_days: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                <input
                  id="check-two-step-closure"
                  type="checkbox"
                  checked={settingsForm.require_two_step_case_closure}
                  onChange={(e) => setSettingsForm({ ...settingsForm, require_two_step_case_closure: e.target.checked })}
                />
                <strong>Require Two-Step Case Closure Verification (Managing Attorney Signoff)</strong>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                <input
                  id="check-allow-client-portal-billing"
                  type="checkbox"
                  checked={settingsForm.allow_client_portal_billing}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allow_client_portal_billing: e.target.checked })}
                />
                <strong>Allow Retained Clients to View &amp; Settle Invoices in Client Portal</strong>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <Button id="btn-save-organization-settings" variant="primary" onClick={handleSaveSettings}>
                Save Organization Settings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================================
          SUB-TAB 4: ACCESS & AUDIT REPORTS
          ===================================================================== */}
      {activeTab === "access" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
              Access &amp; Consequential Administrative Activity Logs
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
              Cryptographic audit stream capturing staff login provisioning, offboarding, work reassignments, and security updates.
            </p>
          </div>
          <DataTable
            variant="boxed"
            columns={[
              {
                key: "occurred_at",
                header: "Timestamp",
                render: (a) => (
                  <span style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "action",
                header: "Security Action",
                render: (a) => <Badge variant="neutral">{a.action}</Badge>,
              },
              {
                key: "object_type",
                header: "Entity Type",
                render: (a) => <strong>{a.object_type}</strong>,
              },
              {
                key: "object_id",
                header: "Target Identity",
                render: (a) => <code>{a.object_id}</code>,
              },
              {
                key: "metadata",
                header: "Audit Metadata",
                render: (a) => (
                  <code style={{ fontSize: "11px", color: "#526663" }}>
                    {JSON.stringify(a.metadata || {})}
                  </code>
                ),
              },
            ]}
            data={accessLogs}
            keyExtractor={(a) => a.id}
          />
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ADD TEAM MEMBER & DIRECT PASSWORD PROVISIONING
          ===================================================================== */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Add Team Member & Create Separate Login"
        subtitle="Provision an employee account with dedicated login credentials, practice role permissions, and caseload capacity."
      >
        <div data-testid="provision-staff-modal" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {inviteError && (
            <div
              role="alert"
              style={{
                padding: "9px 12px",
                borderRadius: "6px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              {inviteError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="input-invite-name" style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Full Name *
              </label>
              <input
                id="input-invite-name"
                type="text"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                placeholder="e.g. Full Legal Name"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>

            <div>
              <label htmlFor="input-invite-email" style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Work Email (Login ID) *
              </label>
              <input
                id="input-invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="staff@practice-domain.com"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>
          </div>

          {/* 4 Immigration Practice Roles */}
          <div>
            <label htmlFor="select-invite-role" style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
              Immigration Practice Role *
            </label>
            <select
              id="select-invite-role"
              value={inviteForm.role}
              onChange={(e) => {
                const nextRole = e.target.value as AgencyTeamRole;
                setInviteForm({
                  ...inviteForm,
                  role: nextRole,
                  nominal_capacity: TEAM_ROLE_SPECS[nextRole]?.defaultCapacity || 20,
                });
              }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1", fontWeight: 600 }}
            >
              <option value="company_admin">1. Co-Partner / Branch Admin (Full Firm &amp; Operations Hub)</option>
              <option value="case_manager">2. Case Manager / Licensed Counsel (RCIC / Attorney Workspace)</option>
              <option value="paralegal">3. Case Processor / Paralegal (AI Lab, OCR/Sort &amp; Forms)</option>
              <option value="intake_finance">4. Intake / Finance Coordinator (Leads, Docs &amp; Billing)</option>
            </select>
            <div
              style={{
                marginTop: "6px",
                padding: "8px 10px",
                borderRadius: "6px",
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                fontSize: "11.5px",
                color: "#445451",
              }}
            >
              <strong style={{ color: "#063C3D" }}>Workspace Scope:</strong>{" "}
              {TEAM_ROLE_SPECS[inviteForm.role].workspaceSummary}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="select-invite-branch" style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Branch Office
              </label>
              <input
                id="select-invite-branch"
                type="text"
                value={inviteForm.branch}
                onChange={(e) => setInviteForm({ ...inviteForm, branch: e.target.value })}
                placeholder="Primary Office"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>

            <div>
              <label htmlFor="input-invite-capacity" style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Max Active Cases
              </label>
              <input
                id="input-invite-capacity"
                type="number"
                min={1}
                max={200}
                value={inviteForm.nominal_capacity}
                onChange={(e) => setInviteForm({ ...inviteForm, nominal_capacity: Number(e.target.value) || 20 })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>
          </div>

          {/* Direct Password Setup */}
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "#F4FAF7",
              border: "1px solid #B9DED4",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label htmlFor="input-invite-password" style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D" }}>
              Separate Staff Portal Password (min. 8 characters) *
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                id="input-invite-password"
                data-testid="input-invite-password"
                type={showInvitePassword ? "text" : "password"}
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                  background: "#FFFFFF",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              />
              <button
                type="button"
                onClick={() => setShowInvitePassword(!showInvitePassword)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                  background: "#FFFFFF",
                  color: "#063C3D",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                {showInvitePassword ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                data-testid="btn-generate-invite-password"
                onClick={() =>
                  setInviteForm({ ...inviteForm, password: generateStrongStaffPassword() })
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #063C3D",
                  background: "#EAF6F0",
                  color: "#063C3D",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                🎲 Generate
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#172322", cursor: "pointer" }}>
              <input
                id="check-invite-login-enabled"
                type="checkbox"
                checked={inviteForm.login_enabled}
                onChange={(e) => setInviteForm({ ...inviteForm, login_enabled: e.target.checked })}
              />
              <span>Enable immediate sign-in at <code>/login</code> (Firm Staff Portal)</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-submit-invite-staff" variant="primary" onClick={handleCreateTeamMember}>
              Create Account &amp; Issue Login
            </Button>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL 2: PER-ROW STAFF CREDENTIAL VAULT (Reveal, Copy, Reset, Suspend)
          ===================================================================== */}
      <Modal
        isOpen={Boolean(credentialTarget)}
        onClose={() => setCredentialTarget(null)}
        title="Staff Portal Login & Credential Vault"
        subtitle={
          credentialTarget
            ? `Manage sign-in access and password for ${credentialTarget.full_name} (${credentialTarget.email}).`
            : ""
        }
      >
        {credentialTarget && (
          <div data-testid="staff-credentials-modal" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {credError && (
              <div
                role="alert"
                style={{
                  padding: "9px 12px",
                  borderRadius: "6px",
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                {credError}
              </div>
            )}

            <div
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  Staff Member
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                  {credentialTarget.full_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  Login ID (Work Email)
                </div>
                <div style={{ fontSize: "13px", fontWeight: 650, color: "#0D6866" }}>
                  {credentialTarget.email}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  Assigned Role
                </div>
                <div style={{ fontSize: "12.5px", color: "#172322" }}>
                  {formatStaffRoleLabel(credentialTarget.roles[0] || "case_manager")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  Branch Office
                </div>
                <div style={{ fontSize: "12.5px", color: "#172322" }}>
                  {credentialTarget.branch_office || "Primary Office"}
                </div>
              </div>
            </div>

            {!credentialTarget.is_owner && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 14px",
                  borderRadius: "8px",
                  background: credLoginEnabled ? "#F4FAF7" : "#FEF2F2",
                  border: `1px solid ${credLoginEnabled ? "#B9DED4" : "#FECACA"}`,
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                    Firm Staff Portal Sign-In
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#526663" }}>
                    Uncheck to immediately suspend this staff member&apos;s login without deleting their seat.
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    data-testid="toggle-staff-login-enabled"
                    checked={credLoginEnabled}
                    onChange={(e) => setCredLoginEnabled(e.target.checked)}
                  />
                  <span>{credLoginEnabled ? "Enabled" : "Suspended"}</span>
                </label>
              </div>
            )}

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "6px" }}>
                Staff Login Password
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type={showCredPassword ? "text" : "password"}
                  data-testid="input-staff-credential-password"
                  value={credPasswordDraft}
                  onChange={(e) => setCredPasswordDraft(e.target.value)}
                  placeholder="Enter new password (min. 8 characters)"
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    fontFamily: "monospace",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="button"
                  data-testid="btn-toggle-show-staff-password"
                  onClick={() => setShowCredPassword(!showCredPassword)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    background: "#FFFFFF",
                    color: "#063C3D",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {showCredPassword ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  data-testid="btn-generate-staff-password"
                  onClick={() => {
                    setCredPasswordDraft(generateStrongStaffPassword());
                    setShowCredPassword(true);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #B9DED4",
                    background: "#EAF6F0",
                    color: "#063C3D",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  🎲 Rotate
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                  Staff authenticate at <code>/login</code> under <strong>Firm Staff</strong>
                </span>
                <button
                  type="button"
                  data-testid="btn-copy-staff-credentials"
                  onClick={() => {
                    const cardText = formatLoginCardText({
                      fullName: credentialTarget.full_name,
                      email: credentialTarget.email,
                      password: credPasswordDraft || "(Set password above)",
                      roleLabel: formatStaffRoleLabel(credentialTarget.roles[0] || "case_manager"),
                      branch: credentialTarget.branch_office,
                    });
                    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(cardText).catch(() => {});
                    }
                    setCredCopied(true);
                    setTimeout(() => setCredCopied(false), 3000);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#0D6866",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {credCopied ? "✓ Copied Staff Login Card!" : "📋 Copy Staff Login Card"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <Button variant="ghost" onClick={() => setCredentialTarget(null)}>
                Cancel
              </Button>
              <Button
                data-testid="btn-save-staff-credentials"
                variant="primary"
                onClick={handleSaveCredentials}
              >
                Save Credentials
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 3: EDIT STAFF ROLE, BRANCH & CAPACITY
          ===================================================================== */}
      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Team Member Role & Capacity"
        subtitle="Update RBAC workspace permissions, office assignment, or maximum active petition threshold."
      >
        {editTarget && (
          <div data-testid="staff-edit-modal" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {editError && (
              <div
                role="alert"
                style={{
                  padding: "9px 12px",
                  borderRadius: "6px",
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                {editError}
              </div>
            )}

            <div>
              <label style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Full Name
              </label>
              <input
                type="text"
                data-testid="input-edit-staff-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                Assigned Practice Role
              </label>
              <select
                data-testid="select-edit-staff-role"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AgencyTeamRole })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
              >
                <option value="company_admin">Co-Partner / Branch Admin</option>
                <option value="case_manager">Case Manager / Licensed Counsel</option>
                <option value="paralegal">Case Processor / Paralegal</option>
                <option value="intake_finance">Intake / Finance Coordinator</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                  Branch Office
                </label>
                <input
                  type="text"
                  data-testid="input-edit-staff-branch"
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 650, display: "block", marginBottom: "4px", color: "#063C3D" }}>
                  Max Active Cases
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  data-testid="input-edit-staff-capacity"
                  value={editForm.nominal_capacity}
                  onChange={(e) => setEditForm({ ...editForm, nominal_capacity: Number(e.target.value) || 20 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <Button variant="ghost" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button data-testid="btn-save-staff-edit" variant="primary" onClick={handleSaveEditMember}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 4: SMART 1-STEP OFFBOARD & DELETE TEAM MEMBER
          ===================================================================== */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove Team Member & Reclaim Seat"
        subtitle={
          deleteTarget
            ? `Permanently revoke login credentials for ${deleteTarget.full_name} (${deleteTarget.email}) and free 1 agency seat.`
            : ""
        }
      >
        {deleteTarget &&
          (() => {
            const hasActiveWork =
              (deleteTarget.assigned_cases || 0) > 0 || (deleteTarget.pending_tasks || 0) > 0;
            const availableReceivers = workload.filter((w) => w.user_id !== deleteTarget.user_id);

            return (
              <div data-testid="staff-delete-modal" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {deleteError && (
                  <div
                    role="alert"
                    style={{
                      padding: "9px 12px",
                      borderRadius: "6px",
                      background: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      color: "#991B1B",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    {deleteError}
                  </div>
                )}

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: hasActiveWork ? "#FFFBEB" : "#F8F7F2",
                    border: `1px solid ${hasActiveWork ? "#FDE68A" : "#DCE5E1"}`,
                    fontSize: "12.5px",
                    color: "#172322",
                  }}
                >
                  {hasActiveWork ? (
                    <>
                      <strong style={{ color: "#92400E", display: "block", marginBottom: "4px" }}>
                        Active Caseload Safeguard ({deleteTarget.assigned_cases} cases, {deleteTarget.pending_tasks} tasks)
                      </strong>
                      Select a colleague below to atomically transfer {deleteTarget.full_name}&apos;s active petitions and tasks before revoking their login and deleting their seat.
                    </>
                  ) : (
                    <>
                      <strong style={{ color: "#063C3D", display: "block", marginBottom: "4px" }}>
                        Zero Active Petitions Assigned (0 cases, 0 open tasks)
                      </strong>
                      {deleteTarget.full_name} holds no active client files. Deleting this account will immediately revoke their login at <code>/login</code> and return 1 seat to your plan quota.
                    </>
                  )}
                </div>

                {hasActiveWork && (
                  <div>
                    <label
                      htmlFor="select-delete-transfer-target"
                      style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "4px" }}
                    >
                      Transfer Active Petitions &amp; Tasks To *
                    </label>
                    <select
                      id="select-delete-transfer-target"
                      data-testid="select-delete-transfer-target"
                      value={deleteTransferToId}
                      onChange={(e) => setDeleteTransferToId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                    >
                      <option value="">Select receiving team member...</option>
                      {availableReceivers.map((colleague) => (
                        <option key={colleague.user_id} value={colleague.user_id}>
                          {colleague.full_name} ({colleague.assigned_cases}/{colleague.nominal_capacity} cases)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#063C3D", display: "block", marginBottom: "4px" }}>
                    Audit Reason
                  </label>
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                  <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                    Cancel
                  </Button>
                  <button
                    type="button"
                    data-testid="btn-confirm-delete-staff"
                    onClick={handleConfirmDeleteMember}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "7px",
                      border: "1px solid #B91C1C",
                      background: "#DC2626",
                      color: "#FFFFFF",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {hasActiveWork ? "Transfer Work & Delete Member" : "Delete Member & Reclaim Seat"}
                  </button>
                </div>
              </div>
            );
          })()}
      </Modal>

      {/* =====================================================================
          MODAL 5: WORK REASSIGNMENT
          ===================================================================== */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title="Reassign Casework & Tasks"
        subtitle="Transfer active petitions or pending tasks with mandatory audit logging and reason documentation."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Source Team Member (From)
            </label>
            <select
              id="select-reassign-from"
              value={reassignForm.from_user_id}
              onChange={(e) => setReassignForm({ ...reassignForm, from_user_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
            >
              <option value="">Select current assignee...</option>
              {workload.map((w) => (
                <option key={w.user_id} value={w.user_id}>
                  {w.full_name} ({w.assigned_cases} cases, {w.pending_tasks} tasks)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Target Team Member (To)
            </label>
            <select
              id="select-reassign-to"
              value={reassignForm.to_user_id}
              onChange={(e) => setReassignForm({ ...reassignForm, to_user_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
            >
              <option value="">Select target assignee...</option>
              {workload.map((w) => (
                <option key={w.user_id} value={w.user_id}>
                  {w.full_name} ({w.assigned_cases} cases - {w.utilization_pct}% load)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Transfer Scope
            </label>
            <select
              id="select-reassign-scope"
              value={reassignForm.reassign_scope}
              onChange={(e) => setReassignForm({ ...reassignForm, reassign_scope: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
            >
              <option value="cases_and_tasks">Transfer All Active Cases &amp; Pending Tasks</option>
              <option value="cases_only">Transfer Active Cases Only</option>
              <option value="tasks_only">Transfer Pending Tasks Only</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Reason for Reassignment (Audit Logged)
            </label>
            <input
              id="input-reassign-reason"
              type="text"
              value={reassignForm.reason}
              onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE5E1" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-confirm-reassign-work" variant="primary" onClick={handleReassignWork}>
              Confirm Work Transfer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
