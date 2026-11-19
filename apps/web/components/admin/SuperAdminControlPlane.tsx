"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import {
  AgencyBillingInvoice, AgencyFeatureFlags, AgencyKybApplication, AgencyPlanTier,
  AgencySupportTicket, AgencyTeamInviteRecord, AgencyTenantRecord, KybTrack,
  KybVerificationChecklist, PlatformGovernanceLogEntry, StatutoryRuleBroadcast,
  adjudicateAgencyKybApplication, computeBillingAndMarginSummary, computePlatformOverview,
  deleteAgencyApplication, deleteAgencyTenant, exportPartnerAgenciesCsv, extendAgencyTrialDays,
  formatStaffRoleLabel, getAgencyApplications, getAgencySupportTickets, getAgencyTeamInvites,
  getAgencyTenants, getPlatformBillingInvoices, getPlatformGovernanceLogs,
  getStatutoryRuleBroadcasts, provisionSalesLedAgency, publishStatutoryRuleBroadcast,
  recordAgencyInvoicePaid, replyAndResolveSupportTicket, resetAgencyOwnerPassword,
  resetAgencyStaffPasscode, resolveAgencyTenantCredentials, updateAgencyGovernanceLocal,
  updateKybVerificationChecklist,
} from "../../lib/agencyPlatformStore";
import { authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../../lib/auth";
import { api } from "../../lib/api";
import { UserContext } from "../../lib/types";
import { NetworkOverviewView } from "./views/NetworkOverviewView";
import { KybQueueView } from "./views/KybQueueView";
import { PartnerAgenciesView, AgencyStatusFilter } from "./views/PartnerAgenciesView";
import { BillingTrialsView } from "./views/BillingTrialsView";
import { SupportRulesView } from "./views/SupportRulesView";
import { AuditGovernanceView } from "./views/AuditGovernanceView";
import { SalesProvisionModal } from "./views/SalesProvisionModal";

export type ControlPlaneView = "overview" | "kyb_queue" | "agencies" | "billing_ops" | "support_rules" | "audit_privacy";

function isAuthorizedPlatformOperator(user: UserContext | null | undefined): user is UserContext {
  if (!user) return false;
  return (
    user.role === "platform_super_admin" ||
    user.role === "platform_ops" ||
    user.experience === "platform_super_admin"
  );
}

export function SuperAdminControlPlane({ onSignOut }: { onSignOut?: () => void } = {}) {
  const [operator, setOperator] = useState<UserContext | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ControlPlaneView>("overview");
  const [tenants, setTenants] = useState<AgencyTenantRecord[]>([]);
  const [applications, setApplications] = useState<AgencyKybApplication[]>([]);
  const [govLogs, setGovLogs] = useState<PlatformGovernanceLogEntry[]>([]);
  const [invoices, setInvoices] = useState<AgencyBillingInvoice[]>([]);
  const [supportTickets, setSupportTickets] = useState<AgencySupportTicket[]>([]);
  const [broadcasts, setBroadcasts] = useState<StatutoryRuleBroadcast[]>([]);
  const [teamInvites, setTeamInvites] = useState<AgencyTeamInviteRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState<AgencyStatusFilter>("all");
  const [corridorFilter, setCorridorFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [reviewerNoteDraft, setReviewerNoteDraft] = useState<string>("");
  const [overridePlanDraft, setOverridePlanDraft] = useState<AgencyPlanTier | "">("");
  const [kybDecisionError, setKybDecisionError] = useState<string | null>(null);
  const [lastProvisionedResult, setLastProvisionedResult] = useState<{
    tradingName: string;
    slug: string;
    ownerEmail: string;
    tempPassword?: string;
  } | null>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [govSeatDraft, setGovSeatDraft] = useState<number>(18);
  const [govCaseDraft, setGovCaseDraft] = useState<number>(180);
  const [govAiDraft, setGovAiDraft] = useState<number>(2500);
  const [govPlanDraft, setGovPlanDraft] = useState<AgencyPlanTier>("growth");
  const [govReasonDraft, setGovReasonDraft] = useState<string>("");
  const [showTenantPasswords, setShowTenantPasswords] = useState<boolean>(false);
  const [isEditingOwnerPassword, setIsEditingOwnerPassword] = useState<boolean>(false);
  const [customOwnerPasswordDraft, setCustomOwnerPasswordDraft] = useState<string>("");
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Sales-Led Direct Agency Provisioning Modal State
  const [showSalesProvisionModal, setShowSalesProvisionModal] = useState<boolean>(false);
  const [salesLegalName, setSalesLegalName] = useState<string>("");
  const [salesTradingName, setSalesTradingName] = useState<string>("");
  const [salesOwnerName, setSalesOwnerName] = useState<string>("");
  const [salesOwnerEmail, setSalesOwnerEmail] = useState<string>("");
  const [salesOwnerPassword, setSalesOwnerPassword] = useState<string>("");
  const [salesCountry, setSalesCountry] = useState<string>("Canada");
  const [salesCity, setSalesCity] = useState<string>("Toronto");
  const [salesTrack, setSalesTrack] = useState<KybTrack>("regulated_counsel");
  const [salesRegulator, setSalesRegulator] = useState<string>("CICC");
  const [salesLicense, setSalesLicense] = useState<string>("");
  const [salesCorridors, setSalesCorridors] = useState<string[]>(["CA", "UK"]);
  const [salesPlan, setSalesPlan] = useState<AgencyPlanTier>("growth");
  const [salesCustomMrr, setSalesCustomMrr] = useState<number>(499);
  const [salesCustomSeats, setSalesCustomSeats] = useState<number>(18);
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<"stripe_card" | "wire_invoice" | "trial">("stripe_card");
  const [salesVerifiedOnCall, setSalesVerifiedOnCall] = useState<boolean>(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Support Replies & Statutory Broadcast Drafts
  const [ticketRepliesDraft, setTicketRepliesDraft] = useState<Record<string, string>>({});
  const [supportActionError, setSupportActionError] = useState<string | null>(null);
  const [broadcastCorridor, setBroadcastCorridor] = useState<string>("CA");
  const [broadcastTitle, setBroadcastTitle] = useState<string>("");
  const [broadcastSummary, setBroadcastSummary] = useState<string>("");
  const [broadcastEffectiveDate, setBroadcastEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const refreshData = () => {
    const t = getAgencyTenants();
    const a = getAgencyApplications();
    setTenants(t);
    setApplications(a);
    setGovLogs(getPlatformGovernanceLogs());
    setInvoices(getPlatformBillingInvoices());
    setSupportTickets(getAgencySupportTickets());
    setBroadcasts(getStatutoryRuleBroadcasts());
    setTeamInvites(getAgencyTeamInvites());
    if (!selectedAppId) {
      const firstPending = a.find((item) => item.kybStatus === "pending_kyb") || a[0];
      if (firstPending) setSelectedAppId(firstPending.id);
    }
  };

  useEffect(() => {
    refreshData();
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("documento_hq_operator") || window.localStorage.getItem("documento_user");
        if (raw) {
          const parsed = JSON.parse(raw) as UserContext;
          if (isAuthorizedPlatformOperator(parsed)) setOperator(parsed);
        }
      } catch {
        // ignore storage parse issue
      }
    }
    setAuthChecked(true);
  }, []);

  const overview = useMemo(() => computePlatformOverview(tenants, applications), [tenants, applications]);
  const billingSummary = useMemo(() => computeBillingAndMarginSummary(tenants, invoices), [tenants, invoices]);
  const openTicketsCount = useMemo(() => supportTickets.filter((t) => t.status === "open").length, [supportTickets]);
  const unpaidInvoicesCount = useMemo(() => invoices.filter((i) => i.status !== "paid").length, [invoices]);
  const selectedApp = useMemo(() => applications.find((a) => a.id === selectedAppId) || applications[0] || null, [applications, selectedAppId]);
  const selectedTenant = useMemo(() => tenants.find((t) => t.organizationId === selectedTenantId) || null, [tenants, selectedTenantId]);
  const selectedTenantCredentials = useMemo(
    () => (selectedTenant ? resolveAgencyTenantCredentials(selectedTenant.organizationId) : null),
    [selectedTenant, tenants, applications, teamInvites]
  );

  useEffect(() => {
    if (selectedTenant) {
      setGovPlanDraft(selectedTenant.planTier);
      setGovSeatDraft(selectedTenant.seatLimit);
      setGovCaseDraft(selectedTenant.monthlyCaseQuota);
      setGovAiDraft(selectedTenant.monthlyAiExtractionQuota);
      setGovReasonDraft(""); setShowTenantPasswords(false); setIsEditingOwnerPassword(false);
      setCustomOwnerPasswordDraft(""); setCredentialError(null);
    }
  }, [selectedTenantId]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter === "active" && t.status !== "active") return false;
      if (statusFilter === "onboarding" && t.health !== "onboarding") return false;
      if (statusFilter === "suspended" && t.status !== "suspended") return false;
      if (statusFilter === "quota_alert") {
        const high = t.seatsUsed / Math.max(1, t.seatLimit) >= 0.85 || t.casesActiveCount / Math.max(1, t.monthlyCaseQuota) >= 0.85 || t.aiExtractionsUsed30d / Math.max(1, t.monthlyAiExtractionQuota) >= 0.85;
        if (!high) return false;
      }
      if (corridorFilter !== "ALL" && !t.enabledCorridors.includes(corridorFilter)) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${t.tradingName} ${t.legalEntityName} ${t.slug} ${t.licenseNumber} ${t.hqCity} ${t.hqCountry}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tenants, statusFilter, corridorFilter, searchQuery]);

  const headlineFinding = useMemo(() => {
    const parts: string[] = [];
    if (overview.pendingKybCount > 0) parts.push(`${overview.pendingKybCount} agency KYB ${overview.pendingKybCount === 1 ? "dossier awaits" : "dossiers await"} practitioner license verification`);
    if (unpaidInvoicesCount > 0) parts.push(`$${billingSummary.pendingReceivablesUsd.toLocaleString()} in pending wire/past-due invoices`);
    if (overview.quotaAttentionCount > 0) parts.push(`${overview.quotaAttentionCount} active ${overview.quotaAttentionCount === 1 ? "tenant is" : "tenants are"} at ≥85% monthly seat/AI quota`);
    if (openTicketsCount > 0) parts.push(`${openTicketsCount} open partner support ticket(s)`);
    if (overview.suspendedAgenciesCount > 0) parts.push(`${overview.suspendedAgenciesCount} suspended`);
    return parts.length === 0 ? "All KYB dossiers cleared, billing settled, and all active partner agencies operating within healthy bounds." : parts.join(" · ");
  }, [overview, unpaidInvoicesCount, billingSummary.pendingReceivablesUsd, openTicketsCount]);

  const handleOperatorSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const persistOperator = (user: UserContext) => {
      setOperator(user);
      if (typeof window !== "undefined") window.localStorage.setItem("documento_hq_operator", JSON.stringify(user));
    };

    const fallbackRes = authenticateUser(loginEmail, "firm", loginPassword);
    const fallbackValid = isAuthorizedPlatformOperator(fallbackRes.user) && fallbackRes.success;
    const defaultErr = "Control Plane access requires an authorized Documento HQ Platform Super-Admin account and passphrase.";

    void api
      .login({ email: loginEmail, password: loginPassword })
      .then((liveRes) => {
        if (liveRes.success && liveRes.user) {
          const liveRole = liveRes.user.role || liveRes.user.roles?.[0] || fallbackRes.user?.role;
          if (liveRole === "platform_super_admin" || liveRole === "platform_ops" || fallbackRes.user?.experience === "platform_super_admin") {
            persistOperator(
              fallbackRes.user || {
                id: String(liveRes.user.user_id || liveRes.user.id || "usr-hq-01"),
                email: loginEmail.trim().toLowerCase(),
                full_name: liveRes.user.full_name || "Documento HQ • Platform Governance",
                role: liveRole,
                organization_id: String(liveRes.user.organization_id || "ten-documento-hq"),
                organization_name: "Documento Platform Control Plane",
                experience: "platform_super_admin",
                permissions: liveRes.user.permissions || ["*"],
              }
            );
            setLoginError(null);
            return;
          }
        }
        if (!fallbackValid) setLoginError(fallbackRes.error || liveRes.error || defaultErr);
      })
      .catch(() => {
        if (!fallbackValid) setLoginError(fallbackRes.error || defaultErr);
      });

    if (process.env.NODE_ENV !== "production") {
      if (fallbackValid && fallbackRes.user) persistOperator(fallbackRes.user);
      else setLoginError(fallbackRes.error || defaultErr);
    }
  };

  const handleOperatorSignOut = () => {
    setOperator(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("documento_hq_operator");
      try {
        const raw = window.localStorage.getItem("documento_user");
        if (raw && isAuthorizedPlatformOperator(JSON.parse(raw))) window.localStorage.removeItem("documento_user");
      } catch {
        // ignore
      }
    }
    onSignOut?.();
  };

  const handleToggleChecklistField = (field: keyof KybVerificationChecklist) => {
    if (!selectedApp) return;
    updateKybVerificationChecklist(selectedApp.id, { [field]: !Boolean(selectedApp.verificationChecklist?.[field]) });
    refreshData();
  };

  const handleKybDecision = (decision: "approve" | "request_clarification" | "reject") => {
    if (!selectedApp || !operator) return;
    try {
      setKybDecisionError(null);
      const outcome = adjudicateAgencyKybApplication(selectedApp.id, decision, reviewerNoteDraft, operator.email, overridePlanDraft || undefined);
      setReviewerNoteDraft("");
      setOverridePlanDraft("");
      refreshData();

      if (decision === "approve" && outcome.provisionedTenant) {
        const pt = outcome.provisionedTenant;
        setLastProvisionedResult({ tradingName: pt.tradingName, slug: pt.slug, ownerEmail: pt.ownerEmail, tempPassword: pt.temporaryPassword });
        setToastBanner(`Provisioned ${pt.tradingName} (${pt.slug}) and activated co-branded calculator link.`);
      } else if (decision === "request_clarification") {
        setToastBanner(`Requested KYB clarification from ${selectedApp.tradingName}.`);
      } else {
        setToastBanner(`Rejected KYB application for ${selectedApp.tradingName}.`);
      }
    } catch (err: any) {
      setKybDecisionError(err?.message || "Invalid KYB review action.");
    }
  };

  const handleSalesProvisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator) return;
    setSalesError(null);
    try {
      const created = provisionSalesLedAgency({
        legalEntityName: salesLegalName, tradingName: salesTradingName, ownerFullName: salesOwnerName,
        ownerEmail: salesOwnerEmail, ownerPassword: salesOwnerPassword.trim() || undefined,
        hqCountry: salesCountry, hqCity: salesCity, kybTrack: salesTrack, regulatoryBody: salesRegulator,
        licenseNumber: salesLicense, enabledCorridors: salesCorridors, planTier: salesPlan,
        customMrrUsd: salesPaymentMethod === "trial" ? 0 : salesCustomMrr, customSeatLimit: salesCustomSeats,
        paymentMethod: salesPaymentMethod, kybVerifiedOnCall: salesVerifiedOnCall, actorEmail: operator.email,
      });

      setLastProvisionedResult({ tradingName: created.tradingName, slug: created.slug, ownerEmail: created.ownerEmail, tempPassword: created.temporaryPassword });
      setShowSalesProvisionModal(false);
      setSalesLegalName(""); setSalesTradingName(""); setSalesOwnerName(""); setSalesOwnerEmail(""); setSalesOwnerPassword(""); setSalesLicense("");
      refreshData();
      setToastBanner(`Provisioned sales-led partner ${created.tradingName} ($${created.mrrUsd}/mo • ${created.seatLimit} seats).`);
    } catch (err: any) {
      setSalesError(err?.message || "Unable to provision agency workspace.");
    }
  };

  const handleSettleInvoice = (invoice: AgencyBillingInvoice) => {
    if (!operator) return;
    recordAgencyInvoicePaid(invoice.id, operator.email);
    refreshData();
    setToastBanner(`Marked ${invoice.invoiceNumber} ($${invoice.amountUsd}) as PAID for ${invoice.tradingName}.`);
  };

  const handleExtendTrial = (tenant: AgencyTenantRecord) => {
    if (!operator) return;
    const updated = extendAgencyTrialDays(tenant.organizationId, 7, operator.email);
    refreshData();
    setToastBanner(`Extended 14-day pilot for ${updated.tradingName} by +7 days (new expiry ${updated.trialEndsAt ? updated.trialEndsAt.slice(0, 10) : ""}).`);
  };

  const handleResolveSupportTicket = (ticket: AgencySupportTicket) => {
    if (!operator) return;
    setSupportActionError(null);
    try {
      replyAndResolveSupportTicket(ticket.id, ticketRepliesDraft[ticket.id] || "", operator.email);
      setTicketRepliesDraft((prev) => ({ ...prev, [ticket.id]: "" }));
      refreshData();
      setToastBanner(`Sent official HQ reply and resolved ${ticket.ticketCode} (${ticket.tradingName}).`);
    } catch (err: any) {
      setSupportActionError(err?.message || "Enter an official HQ response before resolving.");
    }
  };

  const handlePublishRuleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator) return;
    setBroadcastError(null);
    try {
      const published = publishStatutoryRuleBroadcast({
        corridorCode: broadcastCorridor, title: broadcastTitle, summary: broadcastSummary,
        effectiveDate: broadcastEffectiveDate, actorEmail: operator.email,
      });
      setBroadcastTitle(""); setBroadcastSummary("");
      refreshData();
      setToastBanner(`Published [${published.corridorCode}] statutory update "${published.title}" to all partner workspaces.`);
    } catch (err: any) {
      setBroadcastError(err?.message || "Enter both a headline and statutory summary.");
    }
  };

  const handleExportPartnerLedgerCsv = () => {
    const csv = exportPartnerAgenciesCsv(filteredTenants);
    if (typeof window !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "documento-partner-agencies-ledger.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setToastBanner(`Exported ${filteredTenants.length} partner agency ledger row(s) to CSV (Zero-PII aggregate metrics).`);
  };

  const handleSaveGovernance = () => {
    if (!selectedTenant || !operator) return;
    updateAgencyGovernanceLocal(
      selectedTenant.organizationId,
      { planTier: govPlanDraft, seatLimit: govSeatDraft, monthlyCaseQuota: govCaseDraft, monthlyAiExtractionQuota: govAiDraft, reason: govReasonDraft.trim() || undefined },
      operator.email
    );
    refreshData();
    setToastBanner(`Updated SaaS quotas and plan governance for ${selectedTenant.tradingName}.`);
  };

  const copyTextToClipboard = (value: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) navigator.clipboard.writeText(value).catch(() => {});
    setToastBanner(`Copied ${label} to clipboard.`);
  };

  const handleCopyFullLoginPacket = () => {
    if (!selectedTenant || !selectedTenantCredentials) return;
    const ownerPw = selectedTenantCredentials.ownerPassword || "(Password not set — reset in Tenant Governance)";
    const lines = [
      `Documento Partner Workspace Credentials — ${selectedTenant.tradingName}`,
      `Firm Sign-In Portal: /login (Firm Staff)`,
      `Workspace Slug: ${selectedTenant.slug}`,
      `Co-Branded Calculators: /calculators?agency=${selectedTenant.slug}`,
      ``,
      `[Managing Partner / Master Admin]`,
      `Name: ${selectedTenant.ownerFullName}`,
      `Login ID: ${selectedTenant.ownerEmail}`,
      `Password: ${ownerPw}`,
    ];
    if (selectedTenantCredentials.teamSeats.length > 0) {
      lines.push(``, `[Provisioned Staff Seats]`);
      for (const seat of selectedTenantCredentials.teamSeats) {
        lines.push(`- ${seat.fullName} (${formatStaffRoleLabel(seat.role)}) | Login ID: ${seat.email} | Password: ${seat.passcode}`);
      }
    }
    copyTextToClipboard(lines.join("\n"), `full login credential packet for ${selectedTenant.tradingName}`);
  };

  const handleAutoResetOwnerPassword = () => {
    if (!selectedTenant) return;
    setCredentialError(null);
    try {
      const updated = resetAgencyOwnerPassword(selectedTenant.organizationId, undefined, operator?.email || PLATFORM_HQ_OPERATOR_EMAIL, govReasonDraft.trim() || undefined);
      setShowTenantPasswords(true); setIsEditingOwnerPassword(false); setCustomOwnerPasswordDraft("");
      refreshData();
      setToastBanner(`Issued new Managing Partner password (${updated.temporaryPassword}) for ${updated.ownerEmail}.`);
    } catch (err: any) {
      setCredentialError(err?.message || "Unable to reset Managing Partner password.");
    }
  };

  const handleSaveCustomOwnerPassword = () => {
    if (!selectedTenant) return;
    setCredentialError(null);
    try {
      const updated = resetAgencyOwnerPassword(selectedTenant.organizationId, customOwnerPasswordDraft, operator?.email || PLATFORM_HQ_OPERATOR_EMAIL, govReasonDraft.trim() || undefined);
      setShowTenantPasswords(true); setIsEditingOwnerPassword(false); setCustomOwnerPasswordDraft("");
      refreshData();
      setToastBanner(`Updated custom Managing Partner password for ${updated.ownerEmail}.`);
    } catch (err: any) {
      setCredentialError(err?.message || "Password must be at least 8 characters.");
    }
  };

  const handleResetStaffSeatPasscode = (seat: AgencyTeamInviteRecord) => {
    setCredentialError(null);
    try {
      const updated = resetAgencyStaffPasscode(seat.id, undefined, operator?.email || PLATFORM_HQ_OPERATOR_EMAIL);
      setShowTenantPasswords(true);
      refreshData();
      setToastBanner(`Issued new staff passcode (${updated.passcode}) for ${updated.email}.`);
    } catch (err: any) {
      setCredentialError(err?.message || "Unable to rotate staff passcode.");
    }
  };

  const handleToggleFeatureFlag = (flagKey: keyof AgencyFeatureFlags) => {
    if (!selectedTenant || !operator) return;
    const nextVal = !selectedTenant.featureFlags[flagKey];
    updateAgencyGovernanceLocal(selectedTenant.organizationId, { featureFlags: { [flagKey]: nextVal }, reason: `${nextVal ? "Enabled" : "Disabled"} ${flagKey} feature flag` }, operator.email);
    refreshData();
  };

  const handleToggleFreeze = (tenant: AgencyTenantRecord) => {
    if (!operator) return;
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    updateAgencyGovernanceLocal(
      tenant.organizationId,
      { status: nextStatus, reason: nextStatus === "suspended" ? "Emergency tenant freeze triggered from Documento HQ Control Plane" : "Tenant reactivated following compliance clearance" },
      operator.email
    );
    refreshData();
    setToastBanner(nextStatus === "suspended" ? `Frozen ${tenant.tradingName} — active staff sessions revoked while preserving encrypted records.` : `Reactivated ${tenant.tradingName} production tenant.`);
  };

  const handleDeleteTenant = (tenant: AgencyTenantRecord) => {
    if (!window.confirm(`Permanently delete partner agency tenant "${tenant.tradingName}" (${tenant.organizationId})?\n\nThis will cascade-delete all associated invoices, team invites, support tickets, and calculator leads. This action cannot be undone.`)) return;
    deleteAgencyTenant(tenant.organizationId, operator?.email || PLATFORM_HQ_OPERATOR_EMAIL, "Deleted via SuperAdmin Control Plane");
    if (selectedTenantId === tenant.organizationId) setSelectedTenantId(null);
    setToastBanner(`Agency tenant "${tenant.tradingName}" and associated records successfully deleted.`);
    refreshData();
  };

  const handleDeleteApplication = (app: AgencyKybApplication) => {
    if (!window.confirm(`Permanently delete KYB application "${app.tradingName}" (${app.id})?\n\nThis action cannot be undone.`)) return;
    deleteAgencyApplication(app.id, operator?.email || PLATFORM_HQ_OPERATOR_EMAIL, "Deleted via SuperAdmin Control Plane");
    if (selectedAppId === app.id) setSelectedAppId(null);
    setToastBanner(`KYB application "${app.tradingName}" successfully deleted.`);
    refreshData();
  };

  if (!authChecked) return null;

  /* Operator Authentication Gate */
  if (!operator) {
    return (
      <div style={{ minHeight: "100vh", background: "#F2F4F2", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "24px", fontFamily: "var(--font-sans, Inter, sans-serif)" }}>
        <div style={{ width: "100%", maxWidth: "440px", background: "#FFFFFF", border: "1px solid #CFD9D5", borderRadius: "8px", padding: "32px" }}>
          <div style={{ marginBottom: "20px" }}><DocumentoLogo size="md" showWordmark showDomain /></div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0D6866", marginBottom: "6px" }}>Platform Control Plane • Restricted Scope</div>
          <h1 style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", margin: "0 0 8px 0" }}>Documento HQ Super-Admin Sign In</h1>
          <p style={{ fontSize: "13px", color: "#526663", lineHeight: 1.5, margin: "0 0 20px 0" }}>Partner agency provisioning, KYB document verification, SaaS billing/wire operations, and Zero-PII support governance.</p>
          {loginError && <div role="alert" style={{ padding: "10px 12px", borderRadius: "6px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: "12.5px", marginBottom: "14px" }}>{loginError}</div>}
          <form onSubmit={handleOperatorSignIn} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label htmlFor="hq-email" style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#172322", marginBottom: "5px" }}>Documento HQ Operator Email</label>
              <input id="hq-email" type="email" required placeholder="hq.admin@documento.ai" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13.5px" }} />
            </div>
            <div>
              <label htmlFor="hq-password" style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#172322", marginBottom: "5px" }}>Operator Passphrase</label>
              <input id="hq-password" type="password" required placeholder="Enter HQ operator passphrase..." value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13.5px" }} />
            </div>
            <button type="submit" style={{ padding: "10px 16px", borderRadius: "6px", border: "none", background: "#063C3D", color: "#FFFFFF", fontSize: "13.5px", fontWeight: 650, cursor: "pointer" }}>Authenticate to Control Plane</button>
          </form>
          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #E5ECE9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11.5px", color: "#526663" }}>Authorized Platform Governance Operators Only</span>
            <Link href="/" style={{ fontSize: "12.5px", color: "#063C3D", fontWeight: 600, textDecoration: "none" }}>← Back to Site</Link>
          </div>
        </div>
      </div>
    );
  }

  /* Framed-Sheet Control Plane Layout */
  return (
    <div style={{ minHeight: "100vh", background: "#EFF2F0", padding: "8px", color: "#172322", fontFamily: "var(--font-sans, Inter, sans-serif)", fontVariantNumeric: "tabular-nums" }}>
      <style>{`@media (max-width: 1024px) { .hq-shell-grid, .hq-split-2col, .hq-cred-grid { grid-template-columns: 1fr !important; } }`}</style>
      <div className="hq-shell-grid" style={{ display: "grid", gridTemplateColumns: "234px minmax(0, 1fr)", minHeight: "calc(100vh - 16px)", background: "#FFFFFF", border: "1px solid #CFD9D5", borderRadius: "8px", overflow: "hidden" }}>
        {/* Left Navigation Rail */}
        <aside style={{ background: "#F7F9F8", borderRight: "1px solid #DCE5E1", padding: "18px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px" }}>
          <div>
            <div style={{ padding: "0 6px 16px 6px", borderBottom: "1px solid #E4ECE8" }}>
              <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}><DocumentoLogo size="sm" showWordmark /></Link>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", marginTop: "6px" }}>Documento HQ Control Plane</div>
              <div style={{ fontSize: "11px", color: "#5C6E6A" }}>B2B Partner Agency Operations</div>
            </div>
            <nav aria-label="Super Admin Sections" style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "14px" }}>
              {[
                { id: "overview" as ControlPlaneView, label: "Network Overview", count: null },
                { id: "kyb_queue" as ControlPlaneView, label: "KYB Verification Desk", count: overview.pendingKybCount },
                { id: "agencies" as ControlPlaneView, label: "Partner Agencies", count: overview.activeAgenciesCount },
                { id: "billing_ops" as ControlPlaneView, label: "Billing & Trials", count: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : null },
                { id: "support_rules" as ControlPlaneView, label: "Support & Rules", count: openTicketsCount > 0 ? openTicketsCount : null },
                { id: "audit_privacy" as ControlPlaneView, label: "Zero-PII & Audit Log", count: overview.activeSupportGrantsCount > 0 ? overview.activeSupportGrantsCount : null },
              ].map((item) => {
                const active = activeView === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setActiveView(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 10px", borderRadius: "6px", border: "none", background: active ? "#E6EFEA" : "transparent", color: active ? "#063C3D" : "#3E504C", fontSize: "13px", fontWeight: active ? 650 : 500, cursor: "pointer", textAlign: "left" }}>
                    <span>{item.label}</span>
                    {item.count !== null && <span style={{ fontSize: "11.5px", fontWeight: 700, color: (item.id === "kyb_queue" || item.id === "billing_ops") && item.count > 0 ? "#8A5A10" : "#4A5D59" }}>{item.count}</span>}
                  </button>
                );
              })}
            </nav>
            <div style={{ marginTop: "20px", padding: "10px", borderRadius: "6px", background: "#FFFFFF", border: "1px solid #DCE5E1", fontSize: "11.5px", color: "#445451", lineHeight: 1.45 }}>
              <div style={{ fontWeight: 700, color: "#176B50", marginBottom: "3px" }}>Zero-PII Boundary Sealed</div>
              Raw applicant passports, bank statements, and case notes are excluded from HQ operators unless a partner issues a 2-hour diagnostic token.
            </div>
          </div>
          <div style={{ borderTop: "1px solid #E4ECE8", paddingTop: "12px", fontSize: "12px" }}>
            <div style={{ fontWeight: 650, color: "#172322", overflow: "hidden", textOverflow: "ellipsis" }}>{operator.email}</div>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <Link href="/agency-onboarding" style={{ color: "#0D6866", fontWeight: 600, textDecoration: "none" }}>+ Public Signup Form</Link>
              <button type="button" onClick={handleOperatorSignOut} style={{ background: "none", border: "none", padding: 0, color: "#647571", cursor: "pointer", fontSize: "12px" }}>Sign out</button>
            </div>
          </div>
        </aside>

        {/* Main Work Surface */}
        <main style={{ padding: "22px 28px 40px 28px", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid #E4ECE8", marginBottom: "20px" }}>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 750, color: "#063C3D", margin: "0 0 4px 0" }}>Visa Agency Network, KYB &amp; Revenue Operations</h1>
              <div style={{ fontSize: "13px", color: "#445451" }}>{headlineFinding}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" data-testid="open-sales-provision-modal-btn" onClick={() => { setSalesError(null); setShowSalesProvisionModal(true); }} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#063C3D", color: "#FFFFFF", fontSize: "12.5px", fontWeight: 650, cursor: "pointer" }}>
                + Invite / Provision Agency
              </button>
              {overview.pendingKybCount > 0 && activeView !== "kyb_queue" && (
                <button type="button" onClick={() => setActiveView("kyb_queue")} style={{ padding: "8px 13px", borderRadius: "6px", border: "1px solid #0D6866", background: "#EAF6F0", color: "#063C3D", fontSize: "12.5px", fontWeight: 650, cursor: "pointer" }}>
                  Review {overview.pendingKybCount} Pending KYB →
                </button>
              )}
            </div>
          </div>

          <SalesProvisionModal
            isOpen={showSalesProvisionModal} salesError={salesError} salesLegalName={salesLegalName} salesTradingName={salesTradingName}
            salesOwnerName={salesOwnerName} salesOwnerEmail={salesOwnerEmail} salesOwnerPassword={salesOwnerPassword}
            salesCountry={salesCountry} salesCity={salesCity} salesTrack={salesTrack} salesRegulator={salesRegulator}
            salesLicense={salesLicense} salesCorridors={salesCorridors} salesPlan={salesPlan} salesCustomMrr={salesCustomMrr}
            salesCustomSeats={salesCustomSeats} salesPaymentMethod={salesPaymentMethod} salesVerifiedOnCall={salesVerifiedOnCall}
            onClose={() => setShowSalesProvisionModal(false)} onSubmit={handleSalesProvisionSubmit}
            onChangeLegalName={setSalesLegalName} onChangeTradingName={setSalesTradingName} onChangeOwnerName={setSalesOwnerName}
            onChangeOwnerEmail={setSalesOwnerEmail} onChangeOwnerPassword={setSalesOwnerPassword} onChangeCountry={setSalesCountry}
            onChangeCity={setSalesCity} onChangeTrack={setSalesTrack} onChangeRegulator={setSalesRegulator} onChangeLicense={setSalesLicense}
            onToggleCorridor={(code) => setSalesCorridors((prev) => (prev.includes(code) ? (prev.length > 1 ? prev.filter((x) => x !== code) : prev) : [...prev, code]))}
            onChangePlan={setSalesPlan} onChangeCustomMrr={setSalesCustomMrr} onChangeCustomSeats={setSalesCustomSeats}
            onChangePaymentMethod={setSalesPaymentMethod} onChangeVerifiedOnCall={setSalesVerifiedOnCall}
          />

          {toastBanner && (
            <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "6px", background: "#EAF6F0", border: "1px solid #B9DED4", color: "#0F543E", fontSize: "13px", fontWeight: 600, marginBottom: "18px" }}>
              <span>{toastBanner}</span>
              <button type="button" onClick={() => setToastBanner(null)} style={{ background: "none", border: "none", color: "#0F543E", fontWeight: 700, cursor: "pointer" }}>×</button>
            </div>
          )}

          {lastProvisionedResult && (
            <div data-testid="provisioned-credentials-banner" style={{ padding: "14px 16px", borderRadius: "6px", background: "#F4F8F6", border: "1px solid #0D6866", marginBottom: "18px", fontSize: "13px" }}>
              <div style={{ fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>✓ Production Tenant Provisioned: {lastProvisionedResult.tradingName}</div>
              <div style={{ color: "#334441", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <span>Owner Login: <strong>{lastProvisionedResult.ownerEmail}</strong></span>
                {lastProvisionedResult.tempPassword && <span>Passphrase: <code>{lastProvisionedResult.tempPassword}</code></span>}
                <Link href={`/calculators?agency=${lastProvisionedResult.slug}`} style={{ color: "#0D6866", fontWeight: 650 }}>Open Co-Branded Calculators (/calculators?agency={lastProvisionedResult.slug}) ↗</Link>
              </div>
            </div>
          )}

          {/* Reconciled Type-First KPI Strip */}
          <section aria-label="Reconciled Network Metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", border: "1px solid #DCE5E1", borderRadius: "6px", background: "#FFFFFF", marginBottom: "22px" }}>
            {[
              { label: "Active Partner Agencies", value: String(overview.activeAgenciesCount), sub: overview.suspendedAgenciesCount > 0 ? `${overview.suspendedAgenciesCount} frozen` : `${billingSummary.activeTrialsCount} in 14-day pilot` },
              { label: "Pending KYB Queue", value: String(overview.pendingKybCount), sub: `${overview.clarificationKybCount} awaiting clarification` },
              { label: "Recurring SaaS MRR", value: `$${overview.recurringMrrUsd.toLocaleString()}`, sub: `${billingSummary.grossMarginPct}% gross margin · $${overview.annualizedRunRateUsd.toLocaleString()} ARR` },
              { label: "Provisioned Staff Seats", value: `${overview.seatsUsedTotal} / ${overview.seatsProvisionedTotal}`, sub: `${Math.round((overview.seatsUsedTotal / Math.max(1, overview.seatsProvisionedTotal)) * 100)}% seat utilization` },
              { label: "Active Cases (Zero-PII)", value: overview.networkActiveCasesCount.toLocaleString(), sub: `of ${overview.networkCaseQuotaTotal.toLocaleString()} monthly cap` },
              { label: "30d AI Extractions & Leads", value: overview.aiExtractions30dTotal.toLocaleString(), sub: `${overview.calculatorLeads30dTotal} PR leads · $${billingSummary.estimatedAiCostUsd} OCR cost` },
            ].map((kpi, idx) => (
              <div key={kpi.label} style={{ padding: "14px 16px", borderRight: idx < 5 ? "1px solid #E8EEEC" : "none" }}>
                <div style={{ fontSize: "11.5px", color: "#5C6E6A", fontWeight: 550 }}>{kpi.label}</div>
                <div style={{ fontSize: "23px", fontWeight: 750, color: "#063C3D", letterSpacing: "-0.02em", margin: "4px 0 2px 0" }}>{kpi.value}</div>
                <div style={{ fontSize: "11.5px", color: "#647571" }}>{kpi.sub}</div>
              </div>
            ))}
          </section>

          {activeView === "overview" && (
            <NetworkOverviewView
              applications={applications} tenants={tenants} unpaidInvoicesCount={unpaidInvoicesCount}
              openTicketsCount={openTicketsCount} broadcastsCount={broadcasts.length} billingSummary={billingSummary}
              onNavigateView={setActiveView} onSelectApp={(appId) => { setSelectedAppId(appId); setKybDecisionError(null); }}
              onSelectTenant={setSelectedTenantId}
            />
          )}

          {activeView === "kyb_queue" && (
            <KybQueueView
              applications={applications} selectedApp={selectedApp} reviewerNoteDraft={reviewerNoteDraft}
              overridePlanDraft={overridePlanDraft} kybDecisionError={kybDecisionError}
              onSelectApp={(appId) => { setSelectedAppId(appId); setKybDecisionError(null); }}
              onChangeReviewerNote={setReviewerNoteDraft} onChangeOverridePlan={setOverridePlanDraft}
              onToggleChecklistField={handleToggleChecklistField} onKybDecision={handleKybDecision}
              onDeleteApplication={handleDeleteApplication}
            />
          )}

          {activeView === "agencies" && (
            <PartnerAgenciesView
              tenants={tenants} filteredTenants={filteredTenants} selectedTenant={selectedTenant}
              selectedTenantCredentials={selectedTenantCredentials} overview={overview}
              statusFilter={statusFilter} corridorFilter={corridorFilter} searchQuery={searchQuery}
              showTenantPasswords={showTenantPasswords} isEditingOwnerPassword={isEditingOwnerPassword}
              customOwnerPasswordDraft={customOwnerPasswordDraft} credentialError={credentialError}
              govPlanDraft={govPlanDraft} govSeatDraft={govSeatDraft} govCaseDraft={govCaseDraft}
              govAiDraft={govAiDraft} govReasonDraft={govReasonDraft}
              onChangeStatusFilter={setStatusFilter} onChangeCorridorFilter={setCorridorFilter}
              onChangeSearchQuery={setSearchQuery} onExportCsv={handleExportPartnerLedgerCsv}
              onSelectTenant={setSelectedTenantId} onToggleFreeze={handleToggleFreeze}
              onDeleteTenant={handleDeleteTenant} onToggleShowPasswords={() => setShowTenantPasswords((prev) => !prev)}
              onCopyFullLoginPacket={handleCopyFullLoginPacket} onCopyText={copyTextToClipboard}
              onToggleEditOwnerPassword={() => { setCredentialError(null); setIsEditingOwnerPassword((prev) => !prev); }}
              onChangeCustomOwnerPassword={setCustomOwnerPasswordDraft} onSaveCustomOwnerPassword={handleSaveCustomOwnerPassword}
              onAutoResetOwnerPassword={handleAutoResetOwnerPassword} onResetStaffSeatPasscode={handleResetStaffSeatPasscode}
              onChangeGovPlan={setGovPlanDraft} onChangeGovSeat={setGovSeatDraft} onChangeGovCase={setGovCaseDraft}
              onChangeGovAi={setGovAiDraft} onChangeGovReason={setGovReasonDraft}
              onToggleFeatureFlag={handleToggleFeatureFlag} onSaveGovernance={handleSaveGovernance}
            />
          )}

          {activeView === "billing_ops" && (
            <BillingTrialsView
              tenants={tenants} invoices={invoices} aiExtractions30dTotal={overview.aiExtractions30dTotal}
              billingSummary={billingSummary} onExtendTrial={handleExtendTrial} onSettleInvoice={handleSettleInvoice}
            />
          )}

          {activeView === "support_rules" && (
            <SupportRulesView
              supportTickets={supportTickets} ticketRepliesDraft={ticketRepliesDraft} supportActionError={supportActionError}
              broadcasts={broadcasts} broadcastCorridor={broadcastCorridor} broadcastTitle={broadcastTitle}
              broadcastSummary={broadcastSummary} broadcastEffectiveDate={broadcastEffectiveDate} broadcastError={broadcastError}
              onChangeTicketReply={(ticketId, reply) => setTicketRepliesDraft((prev) => ({ ...prev, [ticketId]: reply }))}
              onResolveSupportTicket={handleResolveSupportTicket} onChangeBroadcastCorridor={setBroadcastCorridor}
              onChangeBroadcastTitle={setBroadcastTitle} onChangeBroadcastSummary={setBroadcastSummary}
              onChangeBroadcastEffectiveDate={setBroadcastEffectiveDate} onPublishRuleBroadcast={handlePublishRuleBroadcast}
            />
          )}

          {activeView === "audit_privacy" && (
            <AuditGovernanceView tenants={tenants} govLogs={govLogs} overview={overview} />
          )}
        </main>
      </div>
    </div>
  );
}
