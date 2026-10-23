import React, { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  FirmConfiguration,
  FirmConfigDomain,
  FirmConfigAuditLogItem,
  RoleCode,
} from "../../lib/types";
import {
  fetchFirmConfiguration,
  updateDomainConfiguration,
  fetchFirmConfigAuditLog,
  FALLBACK_FIRM_CONFIGURATION,
} from "../../lib/api";

interface FirmConfigurationHubProps {
  organizationId?: string;
  activeRole?: RoleCode;
}

export function FirmConfigurationHub({
  organizationId,
  activeRole = "master_admin",
}: FirmConfigurationHubProps) {
  const [config, setConfig] = useState<FirmConfiguration>(FALLBACK_FIRM_CONFIGURATION);
  const [loading, setLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState<FirmConfigDomain>("roles");
  const [auditLogs, setAuditLogs] = useState<FirmConfigAuditLogItem[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingDomainData, setPendingDomainData] = useState<any>(null);
  const [changeReason, setChangeReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editable domain states
  const [domainForms, setDomainForms] = useState<Record<string, any>>({});

  useEffect(() => {
    loadConfiguration();
  }, [organizationId]);

  async function loadConfiguration() {
    setLoading(true);
    try {
      const data = await fetchFirmConfiguration(organizationId, activeRole);
      setConfig(data);
      setDomainForms(JSON.parse(JSON.stringify(data.domains || {})));
      const logs = await fetchFirmConfigAuditLog(undefined, organizationId, activeRole);
      setAuditLogs(logs);
    } catch (e: any) {
      console.error("Failed to load firm config:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveClick() {
    setSaveError(null);
    setSaveSuccess(null);
    setChangeReason("");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setPendingDomainData(domainForms[activeDomain]);
    setIsSaveModalOpen(true);
  }

  async function handleConfirmSave() {
    if (!changeReason || changeReason.trim().length < 10) {
      setSaveError("Mandatory justification reason must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setSaveError(null);
    try {
      const res = await updateDomainConfiguration(
        activeDomain,
        pendingDomainData,
        changeReason.trim(),
        effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
        organizationId,
        activeRole
      );
      setSaveSuccess(`Domain '${activeDomain}' successfully updated to version v${res.version || config.version + 1}`);
      setIsSaveModalOpen(false);
      await loadConfiguration();
    } catch (e: any) {
      setSaveError(e.message || "Failed to update firm configuration domain");
    } finally {
      setSubmitting(false);
    }
  }

  const DOMAIN_TABS: { key: FirmConfigDomain; label: string; icon: string; desc: string }[] = [
    { key: "roles", label: "Roles & Access", icon: "👥", desc: "Staff roles, escalation contacts & permissions" },
    { key: "country_pathway_enablement", label: "Pathways & Jurisdictions", icon: "🌐", desc: "Enabled jurisdictions (US, UK, CA) and visa categories" },
    { key: "folder_structure", label: "Dossier Folders", icon: "📁", desc: "Standard repository structure and strict hierarchy" },
    { key: "checklist_versions", label: "Checklists & Tiers", icon: "📋", desc: "Version standard pinning and mandatory criteria tiers" },
    { key: "reminders_escalations", label: "Cadence & Escalations", icon: "⏰", desc: "Automated reminders vs manual controls and intervals" },
    { key: "inactivity_policy", label: "Inactivity Policy", icon: "⏳", desc: "Dormancy thresholds and stalled case alerts" },
    { key: "review_stages", label: "Review Gates", icon: "⚖️", desc: "Officer, Senior and Lawyer review requirements" },
    { key: "approval_owners", label: "Approval Owners", icon: "🛡️", desc: "Designated role holders for tripartite onboarding gates" },
    { key: "templates", label: "Communication Templates", icon: "✉️", desc: "Intake notices, reminders, and portal invitations" },
    { key: "rejection_reasons", label: "Rejection Codes", icon: "🚫", desc: "Structured anomaly and document rejection codes" },
  ];

  return (
    <div className="space-y-6" data-testid="firm-configuration-hub">
      {/* Top Banner & Metadata */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#063C3D] via-[#0A4D4A] to-[#063C3D] border border-[#145C56] rounded-2xl shadow-xl text-white">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Firm Governance & Operating Policy</h2>
            <Badge variant="info" size="md">
              Config v{config.version}
            </Badge>
          </div>
          <p className="text-teal-100/90 text-sm mt-1 max-w-2xl leading-relaxed">
            Configure firm-wide operating models, approval gates, checklist versions, and review policies.
            Existing cases remain pinned to their creation snapshot and never silently inherit mutations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline-inverted"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="shadow-sm font-medium"
          >
            📜 Audit Trail ({auditLogs.length} Records)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveClick}
            style={{ background: "#059669", borderColor: "#047857" }}
            className="shadow-md font-semibold text-white"
          >
            Save Changes to {DOMAIN_TABS.find((t) => t.key === activeDomain)?.label}
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-emerald-900 text-sm shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium">{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">✕</button>
        </div>
      )}

      {/* Immutable Safeguards Card (Locked & Non-Disablable) */}
      <Card className="border-[#DCE5E1] shadow-sm">
        <div className="p-5 border-b border-[#EAF0ED] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">🔒</span>
            <h3 className="font-bold text-[#063C3D] text-sm uppercase tracking-wider">
              Essential Firm Safeguards (Immutable Governance)
            </h3>
          </div>
          <Badge variant="warning" size="sm">
            Enforced by Architecture
          </Badge>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#526360] mb-4">
            The following safeguards protect regulatory compliance, confidentiality, and legal liability.
            Under firm operating policy, these controls cannot be disabled or weakened under any circumstances.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">🛡️</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Cryptographic Audit Logging</p>
                <p className="text-[11px] text-[#526360]">Append-only audit trail recorded for all state mutations.</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">⚖️</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Lawyer Sign-Off Gate</p>
                <p className="text-[11px] text-[#526360]">Licensed attorney review required prior to agency dispatch.</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">📋</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Tripartite Clearance Gate</p>
                <p className="text-[11px] text-[#526360]">Manager, Accounts, and Counsellor clearance before prep starts.</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">📝</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Reason Justification Rule</p>
                <p className="text-[11px] text-[#526360]">Configuration changes require mandatory reason (min 10 chars).</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">🏢</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Zero Cross-Tenant Leakage</p>
                <p className="text-[11px] text-[#526360]">Strict cryptographic scoping preventing multi-tenant overlap.</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg flex items-start gap-3">
              <span className="text-emerald-700 font-mono text-base">📌</span>
              <div>
                <p className="text-xs font-bold text-[#063C3D]">Case Snapshot Version Pinning</p>
                <p className="text-[11px] text-[#526360]">Cases pin firm config at creation; explicit migration required.</p>
                <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Enforced / Locked</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Configuration Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Domain Navigation Sidebar */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#063C3D] uppercase tracking-wider px-3 py-2">
            Governance Domains (10)
          </p>
          {DOMAIN_TABS.map((tab) => {
            const isSelected = activeDomain === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveDomain(tab.key)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl transition flex items-center justify-between text-sm ${
                  isSelected
                    ? "bg-[#063C3D] text-white font-semibold shadow-sm"
                    : "text-[#2C3E3A] hover:bg-[#EAF6F0] hover:text-[#063C3D] bg-white border border-[#DCE5E1]/60 font-medium"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {isSelected && <span className="text-xs font-bold">→</span>}
              </button>
            );
          })}
        </div>

        {/* Domain Configuration Form Card */}
        <div className="lg:col-span-3">
          <Card className="border-[#DCE5E1] shadow-sm">
            <div className="p-6 border-b border-[#EAF0ED] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{DOMAIN_TABS.find((t) => t.key === activeDomain)?.icon}</span>
                  <h3 className="text-lg font-bold text-[#063C3D]">
                    {DOMAIN_TABS.find((t) => t.key === activeDomain)?.label}
                  </h3>
                </div>
                <p className="text-xs text-[#526360] mt-0.5">
                  {DOMAIN_TABS.find((t) => t.key === activeDomain)?.desc}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadConfiguration}>
                  Reset
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveClick}>
                  Update Domain
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Domain Specific Editors */}
              {activeDomain === "roles" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Role Structure & Escalation Matrix</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#374744] block">
                      Firm Escalation Contacts (comma-separated)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                      value={(domainForms.roles?.escalation_contacts || []).join(", ")}
                      onChange={(e) => {
                        const val = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                        setDomainForms({
                          ...domainForms,
                          roles: { ...domainForms.roles, escalation_contacts: val },
                        });
                      }}
                    />
                  </div>
                  <div className="p-4 bg-[#F4F8F6] border border-[#D2E3DC] rounded-xl space-y-2">
                    <p className="text-xs font-bold text-[#063C3D]">Configured Firm Roles</p>
                    <ul className="text-xs text-[#374744] space-y-1.5">
                      <li>• <strong>Managing Partner (master_admin):</strong> Full organizational and policy configuration authority.</li>
                      <li>• <strong>Senior Reviewing Counsel (senior_reviewer):</strong> Substantive legal review sign-off and risk approval.</li>
                      <li>• <strong>Case Manager (case_manager):</strong> Day-to-day dossier preparation, client requests, and task assignments.</li>
                      <li>• <strong>Finance Staff (finance_staff):</strong> Billing verification, accounts clearance gate sign-off.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeDomain === "country_pathway_enablement" && (
                <div className="space-y-5">
                  <h4 className="text-sm font-bold text-[#063C3D]">Active Jurisdictions & Pathway Offerings</h4>
                  {["USA", "GBR", "CAN"].map((jur) => {
                    const current = domainForms.country_pathway_enablement?.jurisdictions?.[jur] || { enabled: true, pathways: [] };
                    return (
                      <div key={jur} className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#063C3D]">
                            {jur} - {jur === "USA" ? "United States" : jur === "GBR" ? "United Kingdom" : "Canada"}
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C3E3A]">
                            <input
                              type="checkbox"
                              checked={current.enabled !== false}
                              onChange={(e) => {
                                const updated = { ...domainForms.country_pathway_enablement };
                                updated.jurisdictions = { ...updated.jurisdictions, [jur]: { ...current, enabled: e.target.checked } };
                                setDomainForms({ ...domainForms, country_pathway_enablement: updated });
                              }}
                              className="rounded border-[#DCE5E1] text-[#0D6866] focus:ring-[#0D6866]"
                            />
                            <span>Jurisdiction Enabled</span>
                          </label>
                        </div>
                        <p className="text-xs text-[#526360]">
                          Active Pathways: {(current.pathways || []).join(", ") || "All standard categories"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeDomain === "folder_structure" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Standard Filing Dossier Folders</h4>
                  <p className="text-xs text-[#526360]">
                    Defines the deterministic root folders created for each new matter.
                  </p>
                  <textarea
                    rows={5}
                    className="w-full bg-white border border-[#DCE5E1] rounded-lg p-3 text-xs font-mono text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                    value={(domainForms.folder_structure?.standard_folders || []).join("\n")}
                    onChange={(e) => {
                      const folders = e.target.value.split("\n").map((f) => f.trim()).filter(Boolean);
                      setDomainForms({
                        ...domainForms,
                        folder_structure: { ...domainForms.folder_structure, standard_folders: folders },
                      });
                    }}
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C3E3A]">
                    <input
                      type="checkbox"
                      checked={domainForms.folder_structure?.enforce_hierarchy !== false}
                      onChange={(e) => {
                        setDomainForms({
                          ...domainForms,
                          folder_structure: { ...domainForms.folder_structure, enforce_hierarchy: e.target.checked },
                        });
                      }}
                      className="rounded border-[#DCE5E1] text-[#0D6866] focus:ring-[#0D6866]"
                    />
                    <span>Enforce deterministic hierarchy without unmapped root files</span>
                  </label>
                </div>
              )}

              {activeDomain === "checklist_versions" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Standard Checklist Versioning</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">Standard Checklist Release</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.checklist_versions?.standard_version || "v2026.1"}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            checklist_versions: { ...domainForms.checklist_versions, standard_version: e.target.value },
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">Mandatory Tiers</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={(domainForms.checklist_versions?.mandatory_tiers || []).join(", ")}
                        onChange={(e) => {
                          const tiers = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                          setDomainForms({
                            ...domainForms,
                            checklist_versions: { ...domainForms.checklist_versions, mandatory_tiers: tiers },
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-[#063C3D] flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>When a new checklist release is deployed here, active cases remain on their pinned version until explicitly migrated by a case manager with justification.</span>
                  </div>
                </div>
              )}

              {activeDomain === "reminders_escalations" && (
                <div className="space-y-5">
                  <h4 className="text-sm font-bold text-[#063C3D]">Automated Reminders & Escalation Policy</h4>
                  <div className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-[#063C3D] font-semibold">
                      <input
                        type="checkbox"
                        checked={domainForms.reminders_escalations?.auto_reminders_enabled !== false}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            reminders_escalations: { ...domainForms.reminders_escalations, auto_reminders_enabled: e.target.checked },
                          });
                        }}
                        className="rounded border-[#DCE5E1] text-[#0D6866] focus:ring-[#0D6866]"
                      />
                      <span>Enable Optional Automated Reminders</span>
                    </label>
                    <p className="text-xs text-[#526360]">
                      When enabled, the background worker automatically dispatches polite follow-up reminders.
                      Case managers retain full manual override control to send one-click reminders or acknowledgements at any time.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">1st Reminder (Days)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.reminders_escalations?.first_reminder_days || 7}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            reminders_escalations: { ...domainForms.reminders_escalations, first_reminder_days: parseInt(e.target.value) || 7 },
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">2nd Reminder (Days)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.reminders_escalations?.second_reminder_days || 14}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            reminders_escalations: { ...domainForms.reminders_escalations, second_reminder_days: parseInt(e.target.value) || 14 },
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">Partner Escalation (Days)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.reminders_escalations?.escalate_after_days || 21}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            reminders_escalations: { ...domainForms.reminders_escalations, escalate_after_days: parseInt(e.target.value) || 21 },
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeDomain === "inactivity_policy" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Client Inactivity & Stalled Case Monitoring</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">Inactivity Warning Trigger (Days)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.inactivity_policy?.warn_after_inactive_days || 14}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            inactivity_policy: { ...domainForms.inactivity_policy, warn_after_inactive_days: parseInt(e.target.value) || 14 },
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#374744] block mb-1">Auto-Dormant Status (Days)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-sm text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                        value={domainForms.inactivity_policy?.auto_dormant_after_days || 30}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            inactivity_policy: { ...domainForms.inactivity_policy, auto_dormant_after_days: parseInt(e.target.value) || 30 },
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeDomain === "review_stages" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Progressive Review Stage Configuration</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C3E3A]">
                      <input
                        type="checkbox"
                        checked={domainForms.review_stages?.require_officer_review !== false}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            review_stages: { ...domainForms.review_stages, require_officer_review: e.target.checked },
                          });
                        }}
                        className="rounded border-[#DCE5E1] text-[#0D6866] focus:ring-[#0D6866]"
                      />
                      <span>Require Caseworker Initial Completeness Review</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C3E3A]">
                      <input
                        type="checkbox"
                        checked={domainForms.review_stages?.require_senior_review !== false}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            review_stages: { ...domainForms.review_stages, require_senior_review: e.target.checked },
                          });
                        }}
                        className="rounded border-[#DCE5E1] text-[#0D6866] focus:ring-[#0D6866]"
                      />
                      <span>Require Senior Reviewer Technical Check</span>
                    </label>

                    <div className="p-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>🔒</span>
                        <span className="text-xs text-[#92400E] font-bold">Require Lead Lawyer Sign-Off Before Submission</span>
                      </div>
                      <Badge variant="warning" size="sm">Immutable Safeguard</Badge>
                    </div>
                  </div>
                </div>
              )}

              {activeDomain === "approval_owners" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Tripartite Onboarding Clearance Approval Owners</h4>
                  <p className="text-xs text-[#526360]">
                    Specify the authorized department or role responsible for clearing each gate before substantive preparation begins.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg">
                      <label className="text-xs font-semibold text-[#374744] block mb-1">1. Manager Authorization</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#DCE5E1] rounded p-2 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866]"
                        value={domainForms.approval_owners?.manager_authorization || "case_manager"}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            approval_owners: { ...domainForms.approval_owners, manager_authorization: e.target.value },
                          });
                        }}
                      />
                    </div>
                    <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg">
                      <label className="text-xs font-semibold text-[#374744] block mb-1">2. Accounts Clearance</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#DCE5E1] rounded p-2 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866]"
                        value={domainForms.approval_owners?.accounts_clearance || "finance_staff"}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            approval_owners: { ...domainForms.approval_owners, accounts_clearance: e.target.value },
                          });
                        }}
                      />
                    </div>
                    <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-lg">
                      <label className="text-xs font-semibold text-[#374744] block mb-1">3. Counsellor Confirmation</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#DCE5E1] rounded p-2 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866]"
                        value={domainForms.approval_owners?.counsellor_confirmation || "case_worker"}
                        onChange={(e) => {
                          setDomainForms({
                            ...domainForms,
                            approval_owners: { ...domainForms.approval_owners, counsellor_confirmation: e.target.value },
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeDomain === "templates" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Standard Email & Communication Templates</h4>
                  <div>
                    <label className="text-xs font-semibold text-[#374744] block mb-1">Welcome Email Notification</label>
                    <textarea
                      rows={3}
                      className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] font-mono focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                      value={domainForms.templates?.welcome_email || ""}
                      onChange={(e) => {
                        setDomainForms({
                          ...domainForms,
                          templates: { ...domainForms.templates, welcome_email: e.target.value },
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#374744] block mb-1">Document Request Notification</label>
                    <textarea
                      rows={3}
                      className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] font-mono focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                      value={domainForms.templates?.document_request || ""}
                      onChange={(e) => {
                        setDomainForms({
                          ...domainForms,
                          templates: { ...domainForms.templates, document_request: e.target.value },
                        });
                      }}
                    />
                  </div>
                </div>
              )}

              {activeDomain === "rejection_reasons" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#063C3D]">Standard Rejection & Anomaly Codes</h4>
                  <p className="text-xs text-[#526360]">
                    Standardized codes for document reviews, preventing arbitrary uninformative rejections.
                  </p>
                  <input
                    type="text"
                    className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                    value={(domainForms.rejection_reasons?.standard_rejection_codes || []).join(", ")}
                    onChange={(e) => {
                      const codes = e.target.value.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
                      setDomainForms({
                        ...domainForms,
                        rejection_reasons: { ...domainForms.rejection_reasons, standard_rejection_codes: codes },
                      });
                    }}
                  />
                  <p className="text-[11px] text-[#526360]">
                    Comma separated values: e.g. ILLEGIBLE_SCAN, WRONG_DOCUMENT_TYPE, EXPIRED_DOCUMENT, MISSING_PAGES, UNOFFICIAL_TRANSLATION
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Save Justification Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAF0ED] pb-3">
              <h3 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
                <span>📝</span> Mandatory Change Justification (Audit Trail)
              </h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-[#6E7F7C] hover:text-[#063C3D] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#526360]">
              Firm governance requires every configuration mutation to be accompanied by an explicit, auditable rationale (minimum 10 characters).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374744] block mb-1">
                  Justification Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-white border border-[#DCE5E1] rounded-lg p-3 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                  placeholder="Explain the business, legal, or operational rationale for updating this domain..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
                <div className="flex justify-between items-center text-[11px] mt-1 text-[#526360]">
                  <span>Minimum 10 characters required</span>
                  <span className={changeReason.trim().length >= 10 ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                    {changeReason.trim().length} chars
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374744] block mb-1">
                  Effective Date (Optional)
                </label>
                <input
                  type="date"
                  className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>

              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs">
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#EAF0ED]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmSave}
                disabled={submitting || changeReason.trim().length < 10}
              >
                {submitting ? "Saving..." : "Confirm & Record Audit Log"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Drawer / Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAF0ED] pb-3">
              <div className="flex items-center gap-2">
                <span>📜</span>
                <h3 className="text-base font-bold text-[#063C3D]">Firm Configuration Audit Trail</h3>
                <Badge variant="info" size="sm">{auditLogs.length} Events</Badge>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-[#6E7F7C] hover:text-[#063C3D] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-[#526360] text-center py-8">No configuration changes recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" size="sm">Domain: {log.domain}</Badge>
                        <span className="font-mono text-[#0D6866] font-bold">
                          v{log.old_version} → v{log.new_version}
                        </span>
                      </div>
                      <span className="text-[#526360] text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[#172322]">
                      <strong className="text-[#063C3D]">Reason:</strong> {log.reason}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#526360] pt-1.5 border-t border-[#EAF0ED]">
                      <span>Actor: {log.actor_email}</span>
                      {log.effective_date && (
                        <span>Effective: {new Date(log.effective_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#EAF0ED]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuditModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
