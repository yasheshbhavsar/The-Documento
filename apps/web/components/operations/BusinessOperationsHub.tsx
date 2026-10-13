import React, { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DataTable } from "../common/DataTable";
import { Modal } from "../common/Modal";
import {
  StaffWorkloadItem,
  OrganizationSettingsData,
} from "../../lib/types";
import {
  fetchStaffWorkload,
  reassignWork,
  fetchOrganizationSettings,
  updateOrganizationSetting,
  fetchAccessReport,
  inviteStaffMember,
} from "../../lib/api";

interface BusinessOperationsHubProps {
  isLiveBackend: boolean;
}

export function BusinessOperationsHub({
  isLiveBackend,
}: BusinessOperationsHubProps) {
  const [activeTab, setActiveTab] = useState<"workload" | "reassignment" | "branches" | "settings" | "access">("workload");

  // State
  const [workload, setWorkload] = useState<StaffWorkloadItem[]>([]);
  const [settings, setSettings] = useState<OrganizationSettingsData | null>(null);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reassignment Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [reassignForm, setReassignForm] = useState({
    from_user_id: "",
    to_user_id: "",
    reassign_scope: "cases_and_tasks",
    reason: "Caseworker workload balancing and capacity optimization",
  });

  // Organization Settings Form State
  const [settingsForm, setSettingsForm] = useState<OrganizationSettingsData>({
    firm_name: "Lex Immigration Global Law Group",
    billing_currency: "USD",
    default_jurisdiction: "US",
    invoice_prefix: "INV",
    deadline_warning_days: 14,
    require_two_step_case_closure: true,
    allow_client_portal_billing: true,
  });

  // Invite Staff Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteForm, setInviteForm] = useState({
    full_name: "",
    email: "",
    role: "associate_attorney",
    branch: "New York HQ",
  });

  const [notification, setNotification] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [w, s, a] = await Promise.all([
        fetchStaffWorkload(),
        fetchOrganizationSettings(),
        fetchAccessReport(),
      ]);
      setWorkload(w);
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
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  // Reassign work handler
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
      loadData();
    } catch (err) {
      alert("Failed to execute reassignment.");
    }
  };

  // Save Settings handler
  const handleSaveSettings = async () => {
    try {
      await Promise.all(
        Object.entries(settingsForm).map(([k, v]) => updateOrganizationSetting(k, v))
      );
      setSettings(settingsForm);
      showNotification("✓ Organization settings successfully updated and logged.");
    } catch (err) {
      alert("Failed to save organization settings.");
    }
  };

  const handleInviteStaff = async () => {
    try {
      await inviteStaffMember({
        email: inviteForm.email,
        role_code: inviteForm.role,
        branch: inviteForm.branch,
      });
      setIsInviteModalOpen(false);
      showNotification(`✓ Membership invitation dispatched to ${inviteForm.email}.`);
    } catch (err) {
      alert("Failed to send membership invitation.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} id="business-operations-hub">
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Company Operations, Workload & Governance
            </h2>
            <Badge variant="neutral" size="sm">
              Operational Management
            </Badge>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Internal capacity balancing, casework reassignment, branch management, and tenant configurations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            id="btn-open-invite-staff"
            variant="outline"
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
          >
            + Invite Team Member
          </Button>
          <Button
            id="btn-open-reassign-work"
            variant="primary"
            size="sm"
            onClick={() => setIsReassignModalOpen(true)}
          >
            ⇄ Reassign Work
          </Button>
        </div>
      </div>

      {notification && (
        <div
          id="operations-notification-toast"
          style={{
            padding: "12px 16px",
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: "8px",
            color: "#065f46",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {notification}
        </div>
      )}

      {/* Sub Tabs */}
      <div role="tablist" aria-label="Operations sections" style={{ display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border, #e2e8f0)", paddingBottom: "8px" }}>
        <Button
          id="tab-btn-ops-workload"
          variant={activeTab === "workload" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("workload")}
        >
          👥 Staff Workload & Capacity ({workload.length})
        </Button>
        <Button
          id="tab-btn-ops-branches"
          variant={activeTab === "branches" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("branches")}
        >
          🏢 Branches & Teams
        </Button>
        <Button
          id="tab-btn-ops-settings"
          variant={activeTab === "settings" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Organization Settings
        </Button>
        <Button
          id="tab-btn-ops-access"
          variant={activeTab === "access" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("access")}
        >
          🛡️ Access & Audit Reports
        </Button>
      </div>

      {/* SUB-TAB: WORKLOAD & CAPACITY */}
      {activeTab === "workload" && (
        <Card
          title="Caseworker Workload & Capacity Utilization"
          subtitle="Real-time distribution of assigned active petitions, pending tasks, and capacity thresholds."
        >
          <DataTable
            columns={[
              {
                key: "full_name",
                header: "Team Member",
                sortable: true,
                render: (w) => (
                  <div>
                    <strong style={{ display: "block", color: "var(--text)" }}>{w.full_name}</strong>
                    <small style={{ color: "var(--muted)" }}>{w.email}</small>
                  </div>
                ),
              },
              {
                key: "roles",
                header: "Assigned Roles",
                render: (w) => (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {w.roles.map((r) => (
                      <Badge key={r} variant="neutral" size="sm">
                        {r}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: "assigned_cases",
                header: "Active Petitions",
                sortable: true,
                render: (w) => (
                  <strong>
                    {w.assigned_cases} / {w.nominal_capacity}
                  </strong>
                ),
              },
              {
                key: "pending_tasks",
                header: "Pending Tasks",
                sortable: true,
                render: (w) => <span>{w.pending_tasks} open</span>,
              },
              {
                key: "utilization_pct",
                header: "Capacity Load",
                sortable: true,
                render: (w) => (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                    <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(w.utilization_pct, 100)}%`,
                          height: "100%",
                          backgroundColor: w.status === "overloaded" ? "var(--critical, #e11d48)" : "var(--accent, #0284c7)",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700 }}>{w.utilization_pct}%</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Workload Status",
                render: (w) => (
                  <Badge variant={w.status === "overloaded" ? "critical" : "success"} size="sm">
                    {w.status === "overloaded" ? "OVERLOADED" : "HEALTHY"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "Action",
                render: (w) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReassignForm({ ...reassignForm, from_user_id: w.user_id });
                      setIsReassignModalOpen(true);
                    }}
                  >
                    Offload →
                  </Button>
                ),
              },
            ]}
            data={workload}
            keyExtractor={(w) => w.user_id}
          />
        </Card>
      )}

      {/* SUB-TAB: BRANCHES & TEAMS */}
      {activeTab === "branches" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          <Card title="New York Headquarters (US HQ)" subtitle="Primary practice branch focusing on USCIS EB & Nonimmigrant Visas">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Branch Lead:</span>
                <strong>Sarah Jenkins (Managing Attorney)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Staff Count:</span>
                <strong>6 Attorneys, 4 Paralegals</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Active Petitions:</span>
                <Badge variant="neutral">38 Cases</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Aggregate Capacity Load:</span>
                <Badge variant="info">64% Utilization</Badge>
              </div>
            </div>
          </Card>

          <Card title="London Branch (UK Office)" subtitle="Specializing in UK Home Office Innovator Founder and Skilled Worker pathways">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Branch Lead:</span>
                <strong>Elena Rostova (Compliance Specialist)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Staff Count:</span>
                <strong>2 Solictors, 2 Caseworkers</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Active Petitions:</span>
                <Badge variant="neutral">14 Cases</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Aggregate Capacity Load:</span>
                <Badge variant="info">52% Utilization</Badge>
              </div>
            </div>
          </Card>

          <Card title="Toronto Branch (Canada Practice)" subtitle="Specializing in IRCC Express Entry, Global Talent Stream, and Provincial Nominees">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Branch Lead:</span>
                <strong>David Vance (Associate Attorney)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Staff Count:</span>
                <strong>3 Immigration Consultants</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Active Petitions:</span>
                <Badge variant="neutral">9 Cases</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Aggregate Capacity Load:</span>
                <Badge variant="info">45% Utilization</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SUB-TAB: ORGANIZATION SETTINGS */}
      {activeTab === "settings" && (
        <Card
          title="Firm Operational & Governance Settings"
          subtitle="Configure multi-tenant entity metadata, default currencies, invoice numbering, and strict closure requirements."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "680px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Legal Practice Entity Name
              </label>
              <input
                id="input-firm-name"
                type="text"
                value={settingsForm.firm_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, firm_name: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Primary Billing Currency
                </label>
                <select
                  id="select-billing-currency"
                  value={settingsForm.billing_currency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, billing_currency: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
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
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Default Practice Jurisdiction
                </label>
                <select
                  id="select-default-jurisdiction"
                  value={settingsForm.default_jurisdiction}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_jurisdiction: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
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
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
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
                <strong>Allow Retained Clients to View & Settle Invoices in Client Portal</strong>
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

      {/* SUB-TAB: ACCESS & ACTIVITY REPORTS */}
      {activeTab === "access" && (
        <Card
          title="Access & Consequential Administrative Activity Logs"
          subtitle="Cryptographic audit stream capturing work reassignments, billing exports, and security role modifications."
        >
          <DataTable
            columns={[
              {
                key: "occurred_at",
                header: "Timestamp",
                render: (a) => (
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
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
                header: "Entity ID",
                render: (a) => <code>{a.object_id}</code>,
              },
              {
                key: "metadata",
                header: "Audit Metadata",
                render: (a) => (
                  <code style={{ fontSize: "11px", color: "var(--quiet)" }}>
                    {JSON.stringify(a.metadata || {})}
                  </code>
                ),
              },
            ]}
            data={accessLogs}
            keyExtractor={(a) => a.id}
          />
        </Card>
      )}

      {/* MODAL: WORK REASSIGNMENT */}
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
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
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
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
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
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            >
              <option value="cases_and_tasks">Transfer All Active Cases & Pending Tasks</option>
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
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
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

      {/* MODAL: INVITE STAFF MEMBER */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Team Member"
        subtitle="Provision an employee profile with defined statutory role and branch association."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Full Name
            </label>
            <input
              id="input-invite-name"
              type="text"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
              placeholder="e.g. Rachel Torres, Esq."
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Work Email Address
            </label>
            <input
              id="input-invite-email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="rachel.torres@lexlaw.com"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Role Assignment
              </label>
              <select
                id="select-invite-role"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              >
                <option value="associate_attorney">Associate Attorney</option>
                <option value="paralegal">Senior Paralegal</option>
                <option value="compliance_officer">Compliance Specialist</option>
                <option value="finance_staff">Finance Staff</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Branch Office
              </label>
              <select
                id="select-invite-branch"
                value={inviteForm.branch}
                onChange={(e) => setInviteForm({ ...inviteForm, branch: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              >
                <option value="New York HQ">New York HQ</option>
                <option value="London Office">London Office</option>
                <option value="Toronto Branch">Toronto Branch</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-submit-invite-staff" variant="primary" onClick={handleInviteStaff}>
              Send Membership Invitation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
