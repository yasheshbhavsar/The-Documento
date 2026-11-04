"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import {
  AGENCY_PLAN_SPECS,
  AgencyBillingInvoice,
  AgencyFeatureFlags,
  AgencyKybApplication,
  AgencyPlanTier,
  AgencySupportTicket,
  AgencyTenantRecord,
  KybTrack,
  KybVerificationChecklist,
  PlatformGovernanceLogEntry,
  REGULATORY_BODIES,
  SOVEREIGN_CORRIDORS,
  StatutoryRuleBroadcast,
  adjudicateAgencyKybApplication,
  computeBillingAndMarginSummary,
  computePlatformOverview,
  exportPartnerAgenciesCsv,
  extendAgencyTrialDays,
  getAgencyApplications,
  getAgencySupportTickets,
  getAgencyTenants,
  getPlatformBillingInvoices,
  getPlatformGovernanceLogs,
  getStatutoryRuleBroadcasts,
  provisionSalesLedAgency,
  publishStatutoryRuleBroadcast,
  recordAgencyInvoicePaid,
  replyAndResolveSupportTicket,
  updateAgencyGovernanceLocal,
  updateKybVerificationChecklist,
} from "../../lib/agencyPlatformStore";
import { DEMO_USERS, authenticateUser } from "../../lib/auth";
import { UserContext } from "../../lib/types";

type ControlPlaneView =
  | "overview"
  | "kyb_queue"
  | "agencies"
  | "billing_ops"
  | "support_rules"
  | "audit_privacy";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export function SuperAdminControlPlane({ onSignOut }: { onSignOut?: () => void } = {}) {
  const [operator, setOperator] = useState<UserContext | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState("hq.admin@documento.ai");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ControlPlaneView>("overview");
  const [tenants, setTenants] = useState<AgencyTenantRecord[]>([]);
  const [applications, setApplications] = useState<AgencyKybApplication[]>([]);
  const [govLogs, setGovLogs] = useState<PlatformGovernanceLogEntry[]>([]);
  const [invoices, setInvoices] = useState<AgencyBillingInvoice[]>([]);
  const [supportTickets, setSupportTickets] = useState<AgencySupportTicket[]>([]);
  const [broadcasts, setBroadcasts] = useState<StatutoryRuleBroadcast[]>([]);

  // Filters & Selection
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "onboarding" | "quota_alert" | "suspended"
  >("all");
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
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Sales-Led Direct Agency Provisioning Modal State
  const [isSalesModalOpen, setIsSalesModalOpen] = useState<boolean>(false);
  const [salesLegalName, setSalesLegalName] = useState<string>("");
  const [salesTradingName, setSalesTradingName] = useState<string>("");
  const [salesOwnerName, setSalesOwnerName] = useState<string>("");
  const [salesOwnerEmail, setSalesOwnerEmail] = useState<string>("");
  const [salesCountry, setSalesCountry] = useState<string>("Canada");
  const [salesCity, setSalesCity] = useState<string>("Toronto");
  const [salesTrack, setSalesTrack] = useState<KybTrack>("regulated_counsel");
  const [salesRegulator, setSalesRegulator] = useState<string>("CICC");
  const [salesLicense, setSalesLicense] = useState<string>("");
  const [salesCorridors, setSalesCorridors] = useState<string[]>(["CA", "UK"]);
  const [salesPlan, setSalesPlan] = useState<AgencyPlanTier>("growth");
  const [salesCustomMrr, setSalesCustomMrr] = useState<number>(499);
  const [salesCustomSeats, setSalesCustomSeats] = useState<number>(18);
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<
    "stripe_card" | "wire_invoice" | "trial"
  >("stripe_card");
  const [salesVerifiedOnCall, setSalesVerifiedOnCall] = useState<boolean>(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Support Replies & Statutory Broadcast Drafts
  const [ticketRepliesDraft, setTicketRepliesDraft] = useState<Record<string, string>>({});
  const [supportActionError, setSupportActionError] = useState<string | null>(null);

  const [broadcastCorridor, setBroadcastCorridor] = useState<string>("CA");
  const [broadcastTitle, setBroadcastTitle] = useState<string>("");
  const [broadcastSummary, setBroadcastSummary] = useState<string>("");
  const [broadcastEffectiveDate, setBroadcastEffectiveDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const refreshData = () => {
    const t = getAgencyTenants();
    const a = getAgencyApplications();
    const l = getPlatformGovernanceLogs();
    const inv = getPlatformBillingInvoices();
    const tkts = getAgencySupportTickets();
    const bcs = getStatutoryRuleBroadcasts();
    setTenants(t);
    setApplications(a);
    setGovLogs(l);
    setInvoices(inv);
    setSupportTickets(tkts);
    setBroadcasts(bcs);
    if (!selectedAppId) {
      const firstPending = a.find((item) => item.kybStatus === "pending_kyb") || a[0];
      if (firstPending) setSelectedAppId(firstPending.id);
    }
  };

  useEffect(() => {
    refreshData();
    if (typeof window !== "undefined") {
      try {
        const raw =
          window.localStorage.getItem("documento_hq_operator") ||
          window.localStorage.getItem("documento_user");
        if (raw) {
          const parsed = JSON.parse(raw) as UserContext;
          if (parsed && parsed.role === "platform_super_admin") {
            setOperator(parsed);
          }
        }
      } catch {
        // ignore storage parse issue
      }
    }
    setAuthChecked(true);
  }, []);

  const overview = useMemo(
    () => computePlatformOverview(tenants, applications),
    [tenants, applications]
  );

  const billingSummary = useMemo(
    () => computeBillingAndMarginSummary(tenants, invoices),
    [tenants, invoices]
  );

  const openTicketsCount = useMemo(
    () => supportTickets.filter((t) => t.status === "open").length,
    [supportTickets]
  );

  const unpaidInvoicesCount = useMemo(
    () => invoices.filter((i) => i.status !== "paid").length,
    [invoices]
  );

  const selectedApp = useMemo(
    () => applications.find((a) => a.id === selectedAppId) || applications[0] || null,
    [applications, selectedAppId]
  );

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.organizationId === selectedTenantId) || null,
    [tenants, selectedTenantId]
  );

  useEffect(() => {
    if (selectedTenant) {
      setGovPlanDraft(selectedTenant.planTier);
      setGovSeatDraft(selectedTenant.seatLimit);
      setGovCaseDraft(selectedTenant.monthlyCaseQuota);
      setGovAiDraft(selectedTenant.monthlyAiExtractionQuota);
      setGovReasonDraft("");
    }
  }, [selectedTenantId]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter === "active" && t.status !== "active") return false;
      if (statusFilter === "onboarding" && t.health !== "onboarding") return false;
      if (statusFilter === "suspended" && t.status !== "suspended") return false;
      if (statusFilter === "quota_alert") {
        const high =
          t.seatsUsed / Math.max(1, t.seatLimit) >= 0.85 ||
          t.casesActiveCount / Math.max(1, t.monthlyCaseQuota) >= 0.85 ||
          t.aiExtractionsUsed30d / Math.max(1, t.monthlyAiExtractionQuota) >= 0.85;
        if (!high) return false;
      }
      if (corridorFilter !== "ALL" && !t.enabledCorridors.includes(corridorFilter)) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        const hay =
          `${t.tradingName} ${t.legalEntityName} ${t.slug} ${t.licenseNumber} ${t.hqCity} ${t.hqCountry}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tenants, statusFilter, corridorFilter, searchQuery]);

  // Dynamic Headline Finding (computed strictly from live data)
  const headlineFinding = useMemo(() => {
    const parts: string[] = [];
    if (overview.pendingKybCount > 0) {
      parts.push(
        `${overview.pendingKybCount} agency KYB ${
          overview.pendingKybCount === 1 ? "dossier awaits" : "dossiers await"
        } practitioner license verification`
      );
    }
    if (unpaidInvoicesCount > 0) {
      parts.push(
        `$${billingSummary.pendingReceivablesUsd.toLocaleString()} in pending wire/past-due invoices`
      );
    }
    if (overview.quotaAttentionCount > 0) {
      parts.push(
        `${overview.quotaAttentionCount} active ${
          overview.quotaAttentionCount === 1 ? "tenant is" : "tenants are"
        } at ≥85% monthly seat/AI quota`
      );
    }
    if (openTicketsCount > 0) {
      parts.push(`${openTicketsCount} open partner support ticket(s)`);
    }
    if (overview.suspendedAgenciesCount > 0) {
      parts.push(`${overview.suspendedAgenciesCount} suspended`);
    }
    if (parts.length === 0) {
      return "All KYB dossiers cleared, billing settled, and all active partner agencies operating within healthy bounds.";
    }
    return parts.join(" · ");
  }, [overview, unpaidInvoicesCount, billingSummary.pendingReceivablesUsd, openTicketsCount]);

  const handleOperatorSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = authenticateUser(loginEmail, "firm", loginPassword || "DocumentoHQ2026!");
    if (res.success && res.user && res.user.role === "platform_super_admin") {
      setOperator(res.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("documento_hq_operator", JSON.stringify(res.user));
      }
      return;
    }
    setLoginError(
      "Control Plane access requires a Documento HQ Platform Super-Admin account (e.g. hq.admin@documento.ai)."
    );
  };

  const handleInstantHqDemoAuth = () => {
    const hq = DEMO_USERS.platform_super_admin;
    setOperator(hq);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("documento_hq_operator", JSON.stringify(hq));
    }
  };

  const handleOperatorSignOut = () => {
    setOperator(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("documento_hq_operator");
      try {
        const raw = window.localStorage.getItem("documento_user");
        if (raw && JSON.parse(raw)?.role === "platform_super_admin") {
          window.localStorage.removeItem("documento_user");
        }
      } catch {
        // ignore
      }
    }
    onSignOut?.();
  };

  const handleToggleChecklistField = (field: keyof KybVerificationChecklist) => {
    if (!selectedApp) return;
    const currentVal = Boolean(selectedApp.verificationChecklist?.[field]);
    updateKybVerificationChecklist(selectedApp.id, { [field]: !currentVal });
    refreshData();
  };

  const handleKybDecision = (decision: "approve" | "request_clarification" | "reject") => {
    if (!selectedApp || !operator) return;
    try {
      setKybDecisionError(null);
      const outcome = adjudicateAgencyKybApplication(
        selectedApp.id,
        decision,
        reviewerNoteDraft,
        operator.email,
        overridePlanDraft || undefined
      );
      setReviewerNoteDraft("");
      setOverridePlanDraft("");
      refreshData();

      if (decision === "approve" && outcome.provisionedTenant) {
        setLastProvisionedResult({
          tradingName: outcome.provisionedTenant.tradingName,
          slug: outcome.provisionedTenant.slug,
          ownerEmail: outcome.provisionedTenant.ownerEmail,
          tempPassword: outcome.provisionedTenant.temporaryPassword,
        });
        setToastBanner(
          `Provisioned ${outcome.provisionedTenant.tradingName} (${outcome.provisionedTenant.slug}) and activated co-branded calculator link.`
        );
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
        legalEntityName: salesLegalName,
        tradingName: salesTradingName,
        ownerFullName: salesOwnerName,
        ownerEmail: salesOwnerEmail,
        hqCountry: salesCountry,
        hqCity: salesCity,
        kybTrack: salesTrack,
        regulatoryBody: salesRegulator,
        licenseNumber: salesLicense,
        enabledCorridors: salesCorridors,
        planTier: salesPlan,
        customMrrUsd: salesPaymentMethod === "trial" ? 0 : salesCustomMrr,
        customSeatLimit: salesCustomSeats,
        paymentMethod: salesPaymentMethod,
        kybVerifiedOnCall: salesVerifiedOnCall,
        actorEmail: operator.email,
      });

      setLastProvisionedResult({
        tradingName: created.tradingName,
        slug: created.slug,
        ownerEmail: created.ownerEmail,
        tempPassword: created.temporaryPassword,
      });
      setIsSalesModalOpen(false);
      setSalesLegalName("");
      setSalesTradingName("");
      setSalesOwnerName("");
      setSalesOwnerEmail("");
      setSalesLicense("");
      refreshData();
      setToastBanner(
        `Provisioned sales-led partner ${created.tradingName} ($${created.mrrUsd}/mo • ${created.seatLimit} seats).`
      );
    } catch (err: any) {
      setSalesError(err?.message || "Unable to provision agency workspace.");
    }
  };

  const handleSettleInvoice = (invoice: AgencyBillingInvoice) => {
    if (!operator) return;
    recordAgencyInvoicePaid(invoice.id, operator.email);
    refreshData();
    setToastBanner(
      `Marked ${invoice.invoiceNumber} ($${invoice.amountUsd}) as PAID for ${invoice.tradingName}.`
    );
  };

  const handleExtendTrial = (tenant: AgencyTenantRecord) => {
    if (!operator) return;
    const updated = extendAgencyTrialDays(tenant.organizationId, 7, operator.email);
    refreshData();
    setToastBanner(
      `Extended 14-day pilot for ${updated.tradingName} by +7 days (new expiry ${
        updated.trialEndsAt ? updated.trialEndsAt.slice(0, 10) : ""
      }).`
    );
  };

  const handleResolveSupportTicket = (ticket: AgencySupportTicket) => {
    if (!operator) return;
    setSupportActionError(null);
    try {
      const reply = ticketRepliesDraft[ticket.id] || "";
      replyAndResolveSupportTicket(ticket.id, reply, operator.email);
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
        corridorCode: broadcastCorridor,
        title: broadcastTitle,
        summary: broadcastSummary,
        effectiveDate: broadcastEffectiveDate,
        actorEmail: operator.email,
      });
      setBroadcastTitle("");
      setBroadcastSummary("");
      refreshData();
      setToastBanner(
        `Published [${published.corridorCode}] statutory update "${published.title}" to all partner workspaces.`
      );
    } catch (err: any) {
      setBroadcastError(err?.message || "Enter both a headline and statutory summary.");
    }
  };

  const handleExportPartnerLedgerCsv = () => {
    const csv = exportPartnerAgenciesCsv(filteredTenants);
    if (
      typeof window !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
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
    setToastBanner(
      `Exported ${filteredTenants.length} partner agency ledger row(s) to CSV (Zero-PII aggregate metrics).`
    );
  };

  const handleSaveGovernance = () => {
    if (!selectedTenant || !operator) return;
    updateAgencyGovernanceLocal(
      selectedTenant.organizationId,
      {
        planTier: govPlanDraft,
        seatLimit: govSeatDraft,
        monthlyCaseQuota: govCaseDraft,
        monthlyAiExtractionQuota: govAiDraft,
        reason: govReasonDraft.trim() || undefined,
      },
      operator.email
    );
    refreshData();
    setToastBanner(`Updated SaaS quotas and plan governance for ${selectedTenant.tradingName}.`);
  };

  const handleToggleFeatureFlag = (flagKey: keyof AgencyFeatureFlags) => {
    if (!selectedTenant || !operator) return;
    const nextVal = !selectedTenant.featureFlags[flagKey];
    updateAgencyGovernanceLocal(
      selectedTenant.organizationId,
      {
        featureFlags: { [flagKey]: nextVal },
        reason: `${nextVal ? "Enabled" : "Disabled"} ${flagKey} feature flag`,
      },
      operator.email
    );
    refreshData();
  };

  const handleToggleFreeze = (tenant: AgencyTenantRecord) => {
    if (!operator) return;
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    updateAgencyGovernanceLocal(
      tenant.organizationId,
      {
        status: nextStatus,
        reason:
          nextStatus === "suspended"
            ? "Emergency tenant freeze triggered from Documento HQ Control Plane"
            : "Tenant reactivated following compliance clearance",
      },
      operator.email
    );
    refreshData();
    setToastBanner(
      nextStatus === "suspended"
        ? `Frozen ${tenant.tradingName} — active staff sessions revoked while preserving encrypted records.`
        : `Reactivated ${tenant.tradingName} production tenant.`
    );
  };

  if (!authChecked) return null;

  /* Operator Authentication Gate */
  if (!operator) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F2F4F2",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          fontFamily: "var(--font-sans, Inter, sans-serif)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            background: "#FFFFFF",
            border: "1px solid #CFD9D5",
            borderRadius: "8px",
            padding: "32px",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <DocumentoLogo size="md" showWordmark showDomain />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#0D6866",
              marginBottom: "6px",
            }}
          >
            Platform Control Plane • Restricted Scope
          </div>
          <h1 style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", margin: "0 0 8px 0" }}>
            Documento HQ Super-Admin Sign In
          </h1>
          <p style={{ fontSize: "13px", color: "#526663", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Partner agency provisioning, KYB document verification, SaaS billing/wire operations, and Zero-PII support governance.
          </p>

          {loginError && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "12.5px",
                marginBottom: "14px",
              }}
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleOperatorSignIn} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label
                htmlFor="hq-email"
                style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#172322", marginBottom: "5px" }}
              >
                Documento HQ Operator Email
              </label>
              <input
                id="hq-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13.5px",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="hq-password"
                style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#172322", marginBottom: "5px" }}
              >
                Operator Passphrase
              </label>
              <input
                id="hq-password"
                type="password"
                placeholder="Enter HQ operator passphrase..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13.5px",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Authenticate to Control Plane
            </button>
          </form>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #E5ECE9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              data-testid="hq-instant-auth-btn"
              onClick={handleInstantHqDemoAuth}
              style={{
                background: "#F3FAF7",
                border: "1px solid #B9DED4",
                color: "#063C3D",
                padding: "7px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Quick Enter as HQ Founder (hq.admin@documento.ai)
            </button>
            <Link href="/" style={{ fontSize: "12.5px", color: "#526663", textDecoration: "none" }}>
              ← Back to Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* Framed-Sheet Control Plane Layout (1440px Grid, Flat 1px Surfaces, Tabular Figures) */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#EFF2F0",
        padding: "8px",
        color: "#172322",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .hq-shell-grid {
            grid-template-columns: 1fr !important;
          }
          .hq-split-2col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        className="hq-shell-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "234px minmax(0, 1fr)",
          minHeight: "calc(100vh - 16px)",
          background: "#FFFFFF",
          border: "1px solid #CFD9D5",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Left Navigation Rail */}
        <aside
          style={{
            background: "#F7F9F8",
            borderRight: "1px solid #DCE5E1",
            padding: "18px 14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div>
            <div style={{ padding: "0 6px 16px 6px", borderBottom: "1px solid #E4ECE8" }}>
              <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
                <DocumentoLogo size="sm" showWordmark />
              </Link>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", marginTop: "6px" }}>
                Documento HQ Control Plane
              </div>
              <div style={{ fontSize: "11px", color: "#5C6E6A" }}>B2B Partner Agency Operations</div>
            </div>

            <nav
              aria-label="Super Admin Sections"
              style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "14px" }}
            >
              {[
                {
                  id: "overview" as ControlPlaneView,
                  label: "Network Overview",
                  count: null,
                },
                {
                  id: "kyb_queue" as ControlPlaneView,
                  label: "KYB Verification Desk",
                  count: overview.pendingKybCount,
                },
                {
                  id: "agencies" as ControlPlaneView,
                  label: "Partner Agencies",
                  count: overview.activeAgenciesCount,
                },
                {
                  id: "billing_ops" as ControlPlaneView,
                  label: "Billing & Trials",
                  count: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : null,
                },
                {
                  id: "support_rules" as ControlPlaneView,
                  label: "Support & Rules",
                  count: openTicketsCount > 0 ? openTicketsCount : null,
                },
                {
                  id: "audit_privacy" as ControlPlaneView,
                  label: "Zero-PII & Audit Log",
                  count: overview.activeSupportGrantsCount > 0 ? overview.activeSupportGrantsCount : null,
                },
              ].map((item) => {
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: active ? "#E6EFEA" : "transparent",
                      color: active ? "#063C3D" : "#3E504C",
                      fontSize: "13px",
                      fontWeight: active ? 650 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{item.label}</span>
                    {item.count !== null && (
                      <span
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 700,
                          color:
                            (item.id === "kyb_queue" || item.id === "billing_ops") && item.count > 0
                              ? "#8A5A10"
                              : "#4A5D59",
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div
              style={{
                marginTop: "20px",
                padding: "10px",
                borderRadius: "6px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                fontSize: "11.5px",
                color: "#445451",
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, color: "#176B50", marginBottom: "3px" }}>
                Zero-PII Boundary Sealed
              </div>
              Raw applicant passports, bank statements, and case notes are excluded from HQ operators unless a partner issues a 2-hour diagnostic token.
            </div>
          </div>

          <div style={{ borderTop: "1px solid #E4ECE8", paddingTop: "12px", fontSize: "12px" }}>
            <div style={{ fontWeight: 650, color: "#172322", overflow: "hidden", textOverflow: "ellipsis" }}>
              {operator.email}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <Link
                href="/agency-onboarding"
                style={{ color: "#0D6866", fontWeight: 600, textDecoration: "none" }}
              >
                + Public Signup Form
              </Link>
              <button
                type="button"
                onClick={handleOperatorSignOut}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#647571",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Work Surface */}
        <main style={{ padding: "22px 28px 40px 28px", overflowX: "auto" }}>
          {/* Title Row + Headline Finding + Primary Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid #E4ECE8",
              marginBottom: "20px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 750, color: "#063C3D", margin: "0 0 4px 0" }}>
                Visa Agency Network, KYB &amp; Revenue Operations
              </h1>
              <div style={{ fontSize: "13px", color: "#445451" }}>{headlineFinding}</div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="open-sales-provision-modal-btn"
                onClick={() => {
                  setSalesError(null);
                  setIsSalesModalOpen(true);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#063C3D",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                + Invite / Provision Agency
              </button>
              {overview.pendingKybCount > 0 && activeView !== "kyb_queue" && (
                <button
                  type="button"
                  onClick={() => setActiveView("kyb_queue")}
                  style={{
                    padding: "8px 13px",
                    borderRadius: "6px",
                    border: "1px solid #0D6866",
                    background: "#EAF6F0",
                    color: "#063C3D",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Review {overview.pendingKybCount} Pending KYB →
                </button>
              )}
              <Link
                href="/agency-onboarding"
                style={{
                  padding: "8px 13px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  background: "#FFFFFF",
                  color: "#172322",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Public Partner Signup ↗
              </Link>
            </div>
          </div>

          {/* Sales-Led Direct Agency Provisioning Modal (Inline Sheet) */}
          {isSalesModalOpen && (
            <section
              data-testid="sales-led-provision-modal"
              style={{
                padding: "20px 22px",
                borderRadius: "8px",
                border: "1px solid #063C3D",
                background: "#F9FBFA",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                    Sales-Led Agency Provisioning (Direct Zoom / Enterprise Deal)
                  </h2>
                  <div style={{ fontSize: "12px", color: "#526663", marginTop: "2px" }}>
                    Create a dedicated agency workspace with custom negotiated MRR, seat allocation, and Stripe/Wire billing.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSalesModalOpen(false)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid #BDCDC7",
                    background: "#FFFFFF",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              {salesError && (
                <div
                  role="alert"
                  style={{
                    padding: "9px 12px",
                    borderRadius: "6px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    marginBottom: "12px",
                  }}
                >
                  {salesError}
                </div>
              )}

              <form onSubmit={handleSalesProvisionSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Legal Entity Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pacific Rim Immigration Law PC"
                      value={salesLegalName}
                      onChange={(e) => setSalesLegalName(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Public Brand Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pacific Rim Visas"
                      value={salesTradingName}
                      onChange={(e) => setSalesTradingName(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Managing Partner Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Daniel Cho, Barrister"
                      value={salesOwnerName}
                      onChange={(e) => setSalesOwnerName(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Owner Login Email
                    </label>
                    <input
                      type="email"
                      placeholder="daniel@pacificrimlaw.ca"
                      value={salesOwnerEmail}
                      onChange={(e) => setSalesOwnerEmail(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      HQ Country
                    </label>
                    <input
                      type="text"
                      value={salesCountry}
                      onChange={(e) => setSalesCountry(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      HQ City
                    </label>
                    <input
                      type="text"
                      value={salesCity}
                      onChange={(e) => setSalesCity(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Practice Track
                    </label>
                    <select
                      value={salesTrack}
                      onChange={(e) => setSalesTrack(e.target.value as KybTrack)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px", background: "#FFFFFF" }}
                    >
                      <option value="regulated_counsel">Licensed Lawyer / Consultant</option>
                      <option value="overseas_consultancy">Visa / Study Abroad Agency</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Regulator / Register
                    </label>
                    <select
                      value={salesRegulator}
                      onChange={(e) => setSalesRegulator(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px", background: "#FFFFFF" }}
                    >
                      {REGULATORY_BODIES.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      License / Reg #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. R708112"
                      value={salesLicense}
                      onChange={(e) => setSalesLicense(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Plan Tier
                    </label>
                    <select
                      value={salesPlan}
                      onChange={(e) => {
                        const next = e.target.value as AgencyPlanTier;
                        setSalesPlan(next);
                        setSalesCustomMrr(AGENCY_PLAN_SPECS[next].mrrUsd);
                        setSalesCustomSeats(AGENCY_PLAN_SPECS[next].seatLimit);
                      }}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px", background: "#FFFFFF" }}
                    >
                      {(Object.keys(AGENCY_PLAN_SPECS) as AgencyPlanTier[]).map((k) => (
                        <option key={k} value={k}>
                          {AGENCY_PLAN_SPECS[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Negotiated MRR ($ USD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      aria-label="Negotiated MRR USD"
                      value={salesCustomMrr}
                      onChange={(e) => setSalesCustomMrr(Number(e.target.value) || 0)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Custom Seat Cap
                    </label>
                    <input
                      type="number"
                      min={1}
                      aria-label="Custom Seat Cap"
                      value={salesCustomSeats}
                      onChange={(e) => setSalesCustomSeats(Number(e.target.value) || 1)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Billing Method
                    </label>
                    <select
                      aria-label="Sales billing method"
                      value={salesPaymentMethod}
                      onChange={(e) =>
                        setSalesPaymentMethod(
                          e.target.value as "stripe_card" | "wire_invoice" | "trial"
                        )
                      }
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #BDCDC7", fontSize: "13px", background: "#FFFFFF" }}
                    >
                      <option value="stripe_card">Stripe Corporate Card</option>
                      <option value="wire_invoice">SWIFT / Bank Wire Invoice</option>
                      <option value="trial">14-Day Pilot ($0)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {SOVEREIGN_CORRIDORS.map((c) => {
                        const on = salesCorridors.includes(c.code);
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() =>
                              setSalesCorridors((prev) =>
                                prev.includes(c.code)
                                  ? prev.length > 1
                                    ? prev.filter((x) => x !== c.code)
                                  : prev
                                  : [...prev, c.code]
                              )
                            }
                            style={{
                              padding: "4px 9px",
                              borderRadius: "5px",
                              border: `1px solid ${on ? "#063C3D" : "#DCE5E1"}`,
                              background: on ? "#063C3D" : "#FFFFFF",
                              color: on ? "#FFFFFF" : "#445451",
                              fontSize: "11.5px",
                              fontWeight: 650,
                              cursor: "pointer",
                            }}
                          >
                            {c.code}
                          </button>
                        );
                      })}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={salesVerifiedOnCall}
                        onChange={(e) => setSalesVerifiedOnCall(e.target.checked)}
                        style={{ accentColor: "#063C3D" }}
                      />
                      <span>KYB license verified on sales call (activate co-branded calculators immediately)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    data-testid="confirm-sales-provision-btn"
                    style={{
                      padding: "9px 18px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#063C3D",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Provision Workspace &amp; Issue Invite →
                  </button>
                </div>
              </form>
            </section>
          )}

          {toastBanner && (
            <div
              role="status"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "6px",
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                color: "#0F543E",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "18px",
              }}
            >
              <span>{toastBanner}</span>
              <button
                type="button"
                onClick={() => setToastBanner(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0F543E",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          )}

          {lastProvisionedResult && (
            <div
              data-testid="provisioned-credentials-banner"
              style={{
                padding: "14px 16px",
                borderRadius: "6px",
                background: "#F4F8F6",
                border: "1px solid #0D6866",
                marginBottom: "18px",
                fontSize: "13px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
                ✓ Production Tenant Provisioned: {lastProvisionedResult.tradingName}
              </div>
              <div style={{ color: "#334441", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <span>
                  Owner Login: <strong>{lastProvisionedResult.ownerEmail}</strong>
                </span>
                {lastProvisionedResult.tempPassword && (
                  <span>
                    Passphrase: <code>{lastProvisionedResult.tempPassword}</code>
                  </span>
                )}
                <Link
                  href={`/calculators?agency=${lastProvisionedResult.slug}`}
                  style={{ color: "#0D6866", fontWeight: 650 }}
                >
                  Open Co-Branded Calculators (/calculators?agency={lastProvisionedResult.slug}) ↗
                </Link>
              </div>
            </div>
          )}

          {/* Reconciled Type-First KPI Strip (Exact Sums + Net AI Margin) */}
          <section
            aria-label="Reconciled Network Metrics"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
              border: "1px solid #DCE5E1",
              borderRadius: "6px",
              background: "#FFFFFF",
              marginBottom: "22px",
            }}
          >
            {[
              {
                label: "Active Partner Agencies",
                value: String(overview.activeAgenciesCount),
                sub:
                  overview.suspendedAgenciesCount > 0
                    ? `${overview.suspendedAgenciesCount} frozen`
                    : `${billingSummary.activeTrialsCount} in 14-day pilot`,
              },
              {
                label: "Pending KYB Queue",
                value: String(overview.pendingKybCount),
                sub: `${overview.clarificationKybCount} awaiting clarification`,
              },
              {
                label: "Recurring SaaS MRR",
                value: `$${overview.recurringMrrUsd.toLocaleString()}`,
                sub: `${billingSummary.grossMarginPct}% gross margin · $${overview.annualizedRunRateUsd.toLocaleString()} ARR`,
              },
              {
                label: "Provisioned Staff Seats",
                value: `${overview.seatsUsedTotal} / ${overview.seatsProvisionedTotal}`,
                sub: `${Math.round(
                  (overview.seatsUsedTotal / Math.max(1, overview.seatsProvisionedTotal)) * 100
                )}% seat utilization`,
              },
              {
                label: "Active Cases (Zero-PII)",
                value: overview.networkActiveCasesCount.toLocaleString(),
                sub: `of ${overview.networkCaseQuotaTotal.toLocaleString()} monthly cap`,
              },
              {
                label: "30d AI Extractions & Leads",
                value: overview.aiExtractions30dTotal.toLocaleString(),
                sub: `${overview.calculatorLeads30dTotal} PR leads · $${billingSummary.estimatedAiCostUsd} OCR cost`,
              },
            ].map((kpi, idx) => (
              <div
                key={kpi.label}
                style={{
                  padding: "14px 16px",
                  borderRight: idx < 5 ? "1px solid #E8EEEC" : "none",
                }}
              >
                <div style={{ fontSize: "11.5px", color: "#5C6E6A", fontWeight: 550 }}>
                  {kpi.label}
                </div>
                <div
                  style={{
                    fontSize: "23px",
                    fontWeight: 750,
                    color: "#063C3D",
                    letterSpacing: "-0.02em",
                    margin: "4px 0 2px 0",
                  }}
                >
                  {kpi.value}
                </div>
                <div style={{ fontSize: "11.5px", color: "#647571" }}>{kpi.sub}</div>
              </div>
            ))}
          </section>

          {/* VIEW 1: NETWORK OVERVIEW (KYB Queue + Partner Utilization + Activation & Churn Radar) */}
          {activeView === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                className="hq-split-2col"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
                  gap: "20px",
                  alignItems: "start",
                }}
              >
                {/* Actionable KYB Queue Block */}
                <section
                  style={{
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    background: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      padding: "13px 16px",
                      borderBottom: "1px solid #E5ECE9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                      KYB Onboarding Queue
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveView("kyb_queue")}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Open Adjudication Desk →
                    </button>
                  </div>

                  <div>
                    {applications.slice(0, 5).map((app, idx) => (
                      <div
                        key={app.id}
                        style={{
                          padding: "12px 16px",
                          borderBottom:
                            idx < Math.min(applications.length, 5) - 1 ? "1px solid #EDF2F0" : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13.5px", fontWeight: 650, color: "#172322" }}>
                            {app.tradingName}
                          </div>
                          <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
                            {app.regulatoryBody} <strong>{app.licenseNumber}</strong> · {app.hqCity},{" "}
                            {app.hqCountry} · {(app.uploadedDocuments || []).length} file(s)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAppId(app.id);
                            setActiveView("kyb_queue");
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "4px",
                            border: "1px solid #BDCDC7",
                            background: app.kybStatus === "pending_kyb" ? "#FEF7EA" : "#F7F9F8",
                            color: app.kybStatus === "pending_kyb" ? "#8A5A10" : "#445451",
                            fontSize: "11.5px",
                            fontWeight: 650,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {app.kybStatus === "pending_kyb"
                            ? "Verify KYB"
                            : app.kybStatus === "approved"
                              ? "Approved"
                              : app.kybStatus === "clarification_requested"
                                ? "Clarification"
                                : "Rejected"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Partner Agency Utilization Snapshot */}
                <section
                  style={{
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    background: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      padding: "13px 16px",
                      borderBottom: "1px solid #E5ECE9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                      Partner Agencies &amp; Quota Utilization
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveView("agencies")}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Manage All ({tenants.length}) →
                    </button>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E5ECE9", color: "#5C6E6A", textAlign: "left" }}>
                        <th style={{ padding: "9px 14px", fontWeight: 600 }}>Agency &amp; License</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600 }}>Corridors</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600, textAlign: "right" }}>MRR</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600, textAlign: "right" }}>Cases</th>
                        <th style={{ padding: "9px 14px", fontWeight: 600, textAlign: "right" }}>AI Quota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.slice(0, 6).map((t) => {
                        const aiRatio = t.aiExtractionsUsed30d / Math.max(1, t.monthlyAiExtractionQuota);
                        return (
                          <tr
                            key={t.organizationId}
                            onClick={() => {
                              setSelectedTenantId(t.organizationId);
                              setActiveView("agencies");
                            }}
                            style={{
                              borderBottom: "1px solid #EFF3F1",
                              cursor: "pointer",
                            }}
                          >
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontWeight: 650, color: "#172322" }}>
                                {t.tradingName}
                                {t.status === "suspended" && (
                                  <span style={{ color: "#991B1B", marginLeft: "6px", fontSize: "11px" }}>
                                    [FROZEN]
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#647571" }}>
                                {t.regulatoryBody} · {t.licenseNumber}
                              </div>
                            </td>
                            <td style={{ padding: "10px", color: "#445451" }}>
                              {t.enabledCorridors.join(", ")}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>
                              ${t.mrrUsd}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right" }}>
                              {t.casesActiveCount} / {t.monthlyCaseQuota}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                textAlign: "right",
                                fontWeight: aiRatio >= 0.85 ? 700 : 500,
                                color: aiRatio >= 0.85 ? "#8A5A10" : "#172322",
                              }}
                            >
                              {Math.round(aiRatio * 100)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              </div>

              {/* Partner Activation, Billing & Expansion Radar */}
              <section
                data-testid="hq-activation-churn-radar"
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                    Account Health, Billing &amp; Expansion Radar
                  </h2>
                  <span style={{ fontSize: "12px", color: "#5C6E6A" }}>
                    Actionable SaaS retention &amp; revenue queue
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      border: "1px solid #E5ECE9",
                      background: "#F9FBFA",
                    }}
                  >
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#8A5A10", textTransform: "uppercase" }}>
                      Wire Upgrades &amp; Past-Due Cards ({unpaidInvoicesCount})
                    </div>
                    <div style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
                      ${billingSummary.pendingReceivablesUsd.toLocaleString()} awaiting settlement ({billingSummary.pendingWireCount} SWIFT wire, {billingSummary.pastDueCount} card retry).
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView("billing_ops")}
                      style={{
                        marginTop: "8px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Open Billing &amp; Wire Ledger →
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      border: "1px solid #E5ECE9",
                      background: "#F9FBFA",
                    }}
                  >
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase" }}>
                      14-Day Pilot Conversion ({billingSummary.activeTrialsCount} Active)
                    </div>
                    <div style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
                      {tenants
                        .filter((t) => t.billingStatus === "trialing")
                        .map((t) => `${t.tradingName} (${t.casesActiveCount} cases)`)
                        .join(", ") || "All pilot workspaces converted to paid plans."}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView("billing_ops")}
                      style={{
                        marginTop: "8px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Manage Pilot Expiries →
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      border: "1px solid #E5ECE9",
                      background: "#F9FBFA",
                    }}
                  >
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase" }}>
                      Partner Support &amp; Rule Sync ({openTicketsCount} Open)
                    </div>
                    <div style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
                      {openTicketsCount > 0
                        ? `${openTicketsCount} agency request(s) awaiting HQ response · ${broadcasts.length} statutory bulletins live.`
                        : `Inbox zero · ${broadcasts.length} statutory bulletins live.`}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView("support_rules")}
                      style={{
                        marginTop: "8px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Open Support &amp; Rule Publisher →
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* VIEW 2: KYB VERIFICATION & PROVISIONING DESK */}
          {activeView === "kyb_queue" && (
            <div
              className="hq-split-2col"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 4.5fr) minmax(0, 7.5fr)",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {/* Left Queue List */}
              <div
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #E5ECE9",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#063C3D",
                  }}
                >
                  Submitted KYB Dossiers ({applications.length})
                </div>
                {applications.map((app) => {
                  const selected = selectedApp?.id === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setSelectedAppId(app.id);
                        setKybDecisionError(null);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 14px",
                        border: "none",
                        borderBottom: "1px solid #EFF3F1",
                        borderLeft: selected ? "3px solid #063C3D" : "3px solid transparent",
                        background: selected ? "#F4F8F6" : "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#172322" }}>
                          {app.tradingName}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color:
                              app.kybStatus === "approved"
                                ? "#176B50"
                                : app.kybStatus === "pending_kyb"
                                  ? "#8A5A10"
                                  : "#5C6E6A",
                          }}
                        >
                          {app.kybStatus.toUpperCase().replace("_", " ")}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#5C6E6A", marginTop: "3px" }}>
                        {app.dossierCode} · {app.regulatoryBody} ({app.licenseNumber}) ·{" "}
                        {(app.uploadedDocuments || []).length} doc(s)
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Adjudication Inspector */}
              {selectedApp && (
                <section
                  data-testid="kyb-adjudication-panel"
                  style={{
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    background: "#FFFFFF",
                    padding: "22px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                      paddingBottom: "16px",
                      borderBottom: "1px solid #E5ECE9",
                      marginBottom: "18px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11.5px", color: "#5C6E6A", fontWeight: 600 }}>
                        {selectedApp.dossierCode} · Submitted{" "}
                        {new Date(selectedApp.createdAt).toLocaleDateString()}
                      </div>
                      <h2 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", margin: "4px 0" }}>
                        {selectedApp.legalEntityName}
                      </h2>
                      <div style={{ fontSize: "13px", color: "#445451" }}>
                        Trading as <strong>{selectedApp.tradingName}</strong> · Requested slug:{" "}
                        <code>{selectedApp.requestedSlug}</code>
                      </div>
                    </div>

                    {(() => {
                      const regMeta = REGULATORY_BODIES.find(
                        (r) => r.code === selectedApp.regulatoryBody
                      );
                      return regMeta ? (
                        <a
                          href={regMeta.registryUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "7px 12px",
                            borderRadius: "6px",
                            border: "1px solid #BDCDC7",
                            background: "#F8FAF9",
                            color: "#063C3D",
                            fontSize: "12px",
                            fontWeight: 650,
                            textDecoration: "none",
                          }}
                        >
                          Verify on {regMeta.code} Public Register ↗
                        </a>
                      ) : null;
                    })()}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "14px",
                      fontSize: "13px",
                      marginBottom: "18px",
                    }}
                  >
                    <div>
                      <div style={{ color: "#647571", fontSize: "11.5px" }}>KYB Track &amp; Regulator</div>
                      <div style={{ fontWeight: 650, marginTop: "2px" }}>
                        {selectedApp.regulatoryBody} · {selectedApp.licenseNumber}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#647571", fontSize: "11.5px" }}>Corporate Tax / Business ID</div>
                      <div style={{ fontWeight: 650, marginTop: "2px" }}>
                        {selectedApp.taxRegistrationId} ({selectedApp.hqCity}, {selectedApp.hqCountry})
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#647571", fontSize: "11.5px" }}>Principal Contact &amp; Email Domain</div>
                      <div style={{ fontWeight: 650, marginTop: "2px" }}>
                        {selectedApp.contactFullName} ({selectedApp.contactWorkEmail})
                      </div>
                      {(() => {
                        const emailDomain =
                          selectedApp.contactWorkEmail.split("@")[1]?.toLowerCase() || "";
                        const isWebmail = FREE_EMAIL_DOMAINS.has(emailDomain);
                        return (
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 650,
                              marginTop: "2px",
                              color: isWebmail ? "#8A5A10" : "#176B50",
                            }}
                          >
                            {isWebmail
                              ? "⚠ Personal Webmail Domain — Check Incorporation Certificate"
                              : `✓ Corporate Domain Verified (@${emailDomain})`}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <div style={{ color: "#647571", fontSize: "11.5px" }}>Requested Tier &amp; Corridors</div>
                      <div style={{ fontWeight: 650, marginTop: "2px" }}>
                        {AGENCY_PLAN_SPECS[selectedApp.selectedPlanTier].label} ·{" "}
                        {selectedApp.targetCorridors.join(", ")} ({selectedApp.requestedSeats} seats)
                      </div>
                    </div>
                  </div>

                  {/* Uploaded KYB Evidence Files Inspector */}
                  <div
                    data-testid="kyb-uploaded-evidence-list"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      border: "1px solid #DCE5E1",
                      background: "#F8FAF9",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                      Uploaded KYB Verification Evidence ({(selectedApp.uploadedDocuments || []).length})
                    </div>
                    {(selectedApp.uploadedDocuments || []).length === 0 ? (
                      <div style={{ fontSize: "12px", color: "#8A5A10" }}>
                        No certificate PDF uploaded yet — applicant deferred document upload during 14-day trial signup. Request clarification or ask firm to upload via Launchpad.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {(selectedApp.uploadedDocuments || []).map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                              padding: "7px 10px",
                              borderRadius: "5px",
                              background: "#FFFFFF",
                              border: "1px solid #E4ECE8",
                              fontSize: "12px",
                            }}
                          >
                            <div>
                              <strong>{doc.fileName}</strong>{" "}
                              <span style={{ color: "#5C6E6A" }}>
                                ({doc.docType.replace(/_/g, " ")} · {doc.fileSizeKb} KB)
                              </span>
                            </div>
                            <code style={{ fontSize: "11px", color: "#5C6E6A" }}>
                              SHA-256 {doc.sha256Preview}
                            </code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive 4-Point KYB Verification Checklist */}
                  <div
                    data-testid="kyb-compliance-checklist"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      border: "1px solid #DCE5E1",
                      background: "#FFFFFF",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                      4-Point Compliance Verification Checklist
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "8px",
                        fontSize: "12px",
                      }}
                    >
                      {[
                        {
                          key: "registryVerified" as const,
                          label: "Regulator / Trade Register Active Standing",
                        },
                        {
                          key: "entityTaxMatched" as const,
                          label: "Incorporation / Tax ID Matches Entity",
                        },
                        {
                          key: "domainOwnershipVerified" as const,
                          label: "Corporate Email Domain Confirmed",
                        },
                        {
                          key: "principalIdentityVerified" as const,
                          label: "Principal Owner Identity Checked",
                        },
                      ].map((chk) => (
                        <label
                          key={chk.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            cursor: "pointer",
                            color: "#172322",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(selectedApp.verificationChecklist?.[chk.key])}
                            onChange={() => handleToggleChecklistField(chk.key)}
                            style={{ accentColor: "#063C3D" }}
                          />
                          <span>{chk.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {selectedApp.coCounselDetails && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "6px",
                        background: "#F8FAF9",
                        border: "1px solid #DCE5E1",
                        fontSize: "12.5px",
                        marginBottom: "16px",
                      }}
                    >
                      <strong>Co-Counsel / Clarification Note:</strong> {selectedApp.coCounselDetails}
                    </div>
                  )}

                  {selectedApp.kybStatus === "approved" ? (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "6px",
                        background: "#EAF6F0",
                        border: "1px solid #B9DED4",
                        color: "#176B50",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Approved and provisioned as tenant{" "}
                      <code>{selectedApp.provisionedOrganizationId}</code>.
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px solid #E5ECE9", paddingTop: "16px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "14px" }}>
                        <div>
                          <label
                            htmlFor="kyb-reviewer-note"
                            style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "5px" }}
                          >
                            KYB Adjudication Note (Recorded in Governance Log)
                          </label>
                          <input
                            id="kyb-reviewer-note"
                            type="text"
                            placeholder="e.g. Confirmed active RCIC standing on CICC register..."
                            value={reviewerNoteDraft}
                            onChange={(e) => setReviewerNoteDraft(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 11px",
                              borderRadius: "6px",
                              border: "1px solid #BDCDC7",
                              fontSize: "13px",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="kyb-plan-override"
                            style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "5px" }}
                          >
                            Provisioned Plan Tier
                          </label>
                          <select
                            id="kyb-plan-override"
                            value={overridePlanDraft || selectedApp.selectedPlanTier}
                            onChange={(e) => setOverridePlanDraft(e.target.value as AgencyPlanTier)}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              border: "1px solid #BDCDC7",
                              fontSize: "13px",
                            }}
                          >
                            {(Object.keys(AGENCY_PLAN_SPECS) as AgencyPlanTier[]).map((k) => (
                              <option key={k} value={k}>
                                {AGENCY_PLAN_SPECS[k].label} ({AGENCY_PLAN_SPECS[k].priceLabel})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {kybDecisionError && (
                        <div
                          role="alert"
                          data-testid="kyb-decision-error"
                          style={{
                            padding: "9px 12px",
                            borderRadius: "6px",
                            border: "1px solid #FECACA",
                            background: "#FEF2F2",
                            color: "#991B1B",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            marginBottom: "12px",
                          }}
                        >
                          {kybDecisionError}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          data-testid="approve-provision-kyb-btn"
                          onClick={() => handleKybDecision("approve")}
                          style={{
                            padding: "9px 16px",
                            borderRadius: "6px",
                            border: "none",
                            background: "#063C3D",
                            color: "#FFFFFF",
                            fontSize: "13px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          ✓ Approve KYB &amp; Provision Tenant
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKybDecision("request_clarification")}
                          style={{
                            padding: "9px 14px",
                            borderRadius: "6px",
                            border: "1px solid #D4B483",
                            background: "#FEF7EA",
                            color: "#8A5A10",
                            fontSize: "13px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          Request Clarification
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKybDecision("reject")}
                          style={{
                            padding: "9px 14px",
                            borderRadius: "6px",
                            border: "1px solid #FECACA",
                            background: "#FFFFFF",
                            color: "#991B1B",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reject Dossier
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* VIEW 3: PARTNER AGENCIES DIRECTORY & QUOTA GOVERNANCE */}
          {activeView === "agencies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Filter Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { id: "all" as const, label: `All (${tenants.length})` },
                    { id: "active" as const, label: `Active (${overview.activeAgenciesCount})` },
                    { id: "onboarding" as const, label: "Onboarding" },
                    { id: "quota_alert" as const, label: `≥85% Quota (${overview.quotaAttentionCount})` },
                    { id: "suspended" as const, label: `Frozen (${overview.suspendedAgenciesCount})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      style={{
                        padding: "6px 11px",
                        borderRadius: "6px",
                        border: statusFilter === f.id ? "1px solid #063C3D" : "1px solid #DCE5E1",
                        background: statusFilter === f.id ? "#063C3D" : "#FFFFFF",
                        color: statusFilter === f.id ? "#FFFFFF" : "#384A46",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    aria-label="Filter by corridor"
                    value={corridorFilter}
                    onChange={(e) => setCorridorFilter(e.target.value)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #BDCDC7",
                      fontSize: "12.5px",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="ALL">All Corridors</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="AU">Australia (AU)</option>
                    <option value="NZ">New Zealand (NZ)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="US">United States (US)</option>
                  </select>
                  <input
                    type="search"
                    placeholder="Search agency, slug, license..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: "1px solid #BDCDC7",
                      fontSize: "12.5px",
                      width: "220px",
                    }}
                  />
                  <button
                    type="button"
                    data-testid="export-partner-ledger-csv-btn"
                    onClick={handleExportPartnerLedgerCsv}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: "1px solid #063C3D",
                      background: "#FFFFFF",
                      color: "#063C3D",
                      fontSize: "12px",
                      fontWeight: 650,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Export Ledger CSV
                  </button>
                </div>
              </div>

              {/* Partner Agencies Ledger Table */}
              <div
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #DCE5E1", color: "#5C6E6A", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>Partner Agency</th>
                      <th style={{ padding: "10px", fontWeight: 600 }}>KYB License</th>
                      <th style={{ padding: "10px", fontWeight: 600 }}>Plan &amp; Channel</th>
                      <th style={{ padding: "10px", fontWeight: 600, textAlign: "right" }}>MRR</th>
                      <th style={{ padding: "10px", fontWeight: 600, textAlign: "right" }}>Seats</th>
                      <th style={{ padding: "10px", fontWeight: 600, textAlign: "right" }}>Active Cases</th>
                      <th style={{ padding: "10px", fontWeight: 600, textAlign: "right" }}>30d AI Lab</th>
                      <th style={{ padding: "10px", fontWeight: 600, textAlign: "right" }}>Calc Leads</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((t) => {
                      const isSelected = selectedTenant?.organizationId === t.organizationId;
                      return (
                        <tr
                          key={t.organizationId}
                          style={{
                            borderBottom: "1px solid #EFF3F1",
                            background: isSelected ? "#F4F8F6" : "#FFFFFF",
                          }}
                        >
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 650, color: "#172322" }}>
                              {t.tradingName}{" "}
                              {t.status === "suspended" && (
                                <span style={{ color: "#991B1B", fontWeight: 700 }}>[FROZEN]</span>
                              )}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#647571" }}>
                              <code>{t.slug}</code> · {t.hqCity}, {t.hqCountry} ·{" "}
                              {t.enabledCorridors.join(", ")}
                            </div>
                          </td>
                          <td style={{ padding: "11px 10px" }}>
                            <div style={{ fontWeight: 600 }}>{t.regulatoryBody}</div>
                            <div style={{ fontSize: "11.5px", color: "#647571" }}>{t.licenseNumber}</div>
                          </td>
                          <td style={{ padding: "11px 10px" }}>
                            <div>{AGENCY_PLAN_SPECS[t.planTier].label}</div>
                            <div style={{ fontSize: "11px", color: "#647571" }}>
                              {t.onboardingSource === "hq_sales_invite" ? "HQ Sales Deal" : "Self-Serve"} ·{" "}
                              {t.billingStatus === "past_due"
                                ? "Past Due"
                                : t.billingStatus === "trialing"
                                  ? "14d Trial"
                                  : "Active"}
                            </div>
                          </td>
                          <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 650 }}>
                            ${t.mrrUsd}
                          </td>
                          <td style={{ padding: "11px 10px", textAlign: "right" }}>
                            {t.seatsUsed} / {t.seatLimit}
                          </td>
                          <td style={{ padding: "11px 10px", textAlign: "right" }}>
                            {t.casesActiveCount} / {t.monthlyCaseQuota}
                          </td>
                          <td style={{ padding: "11px 10px", textAlign: "right" }}>
                            {t.aiExtractionsUsed30d.toLocaleString()} /{" "}
                            {t.monthlyAiExtractionQuota.toLocaleString()}
                          </td>
                          <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 600 }}>
                            {t.calculatorLeads30d}
                          </td>
                          <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedTenantId(isSelected ? null : t.organizationId)
                              }
                              style={{
                                padding: "5px 10px",
                                borderRadius: "4px",
                                border: "1px solid #BDCDC7",
                                background: "#FFFFFF",
                                color: "#063C3D",
                                fontSize: "11.5px",
                                fontWeight: 650,
                                cursor: "pointer",
                                marginRight: "6px",
                              }}
                            >
                              {isSelected ? "Close" : "Govern"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleFreeze(t)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "4px",
                                border:
                                  t.status === "active"
                                    ? "1px solid #FECACA"
                                    : "1px solid #B9DED4",
                                background: "#FFFFFF",
                                color: t.status === "active" ? "#991B1B" : "#176B50",
                                fontSize: "11.5px",
                                fontWeight: 650,
                                cursor: "pointer",
                              }}
                            >
                              {t.status === "active" ? "Freeze" : "Reactivate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected Agency Governance Panel */}
              {selectedTenant && (
                <section
                  data-testid="tenant-governance-drawer"
                  style={{
                    border: "1px solid #063C3D",
                    borderRadius: "6px",
                    background: "#FFFFFF",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      gap: "12px",
                      paddingBottom: "14px",
                      borderBottom: "1px solid #E5ECE9",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 750, color: "#063C3D", margin: 0 }}>
                        Tenant Governance: {selectedTenant.tradingName} ({selectedTenant.legalEntityName})
                      </h3>
                      <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "3px" }}>
                        Managing Partner: {selectedTenant.ownerFullName} ({selectedTenant.ownerEmail}) ·{" "}
                        <Link
                          href={`/calculators?agency=${selectedTenant.slug}`}
                          style={{ color: "#0D6866", fontWeight: 600 }}
                        >
                          /calculators?agency={selectedTenant.slug} ↗
                        </Link>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: selectedTenant.supportGrantActive ? "#8A5A10" : "#176B50",
                      }}
                    >
                      {selectedTenant.supportGrantActive
                        ? `Break-Glass Support Token Active (Reason: ${selectedTenant.supportGrantReason})`
                        : "Zero-PII Sealed (No Support Token Issued)"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        SaaS Plan Tier
                      </label>
                      <select
                        value={govPlanDraft}
                        onChange={(e) => {
                          const next = e.target.value as AgencyPlanTier;
                          setGovPlanDraft(next);
                          setGovSeatDraft(AGENCY_PLAN_SPECS[next].seatLimit);
                          setGovCaseDraft(AGENCY_PLAN_SPECS[next].monthlyCaseQuota);
                          setGovAiDraft(AGENCY_PLAN_SPECS[next].monthlyAiExtractions);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "13px",
                        }}
                      >
                        {(Object.keys(AGENCY_PLAN_SPECS) as AgencyPlanTier[]).map((k) => (
                          <option key={k} value={k}>
                            {AGENCY_PLAN_SPECS[k].label} ({AGENCY_PLAN_SPECS[k].priceLabel})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Seat Cap
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={govSeatDraft}
                        onChange={(e) => setGovSeatDraft(Number(e.target.value) || 1)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "13px",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Monthly Case Quota
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={govCaseDraft}
                        onChange={(e) => setGovCaseDraft(Number(e.target.value) || 1)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "13px",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Monthly AI Extraction Quota
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={govAiDraft}
                        onChange={(e) => setGovAiDraft(Number(e.target.value) || 0)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Feature Entitlement Toggles */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
                    {[
                      { key: "ai_lab" as const, label: "AI Document Lab & OCR" },
                      { key: "cobranded_calculators" as const, label: "Co-Branded PR Calculators" },
                      { key: "multi_branch" as const, label: "Multi-Branch Office RBAC" },
                      { key: "custom_rules" as const, label: "Custom Rule Pack Studio" },
                    ].map((fl) => {
                      const on = selectedTenant.featureFlags[fl.key];
                      return (
                        <button
                          key={fl.key}
                          type="button"
                          onClick={() => handleToggleFeatureFlag(fl.key)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: on ? "1px solid #0D6866" : "1px solid #DCE5E1",
                            background: on ? "#F2F9F6" : "#FFFFFF",
                            color: on ? "#063C3D" : "#647571",
                            fontSize: "12px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          {on ? "✓ " : "— "}
                          {fl.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      placeholder="Audit reason (optional)..."
                      value={govReasonDraft}
                      onChange={(e) => setGovReasonDraft(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "220px",
                        padding: "8px 11px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        fontSize: "13px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveGovernance}
                      style={{
                        padding: "9px 18px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Save Quota &amp; Plan Changes
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* VIEW 4: BILLING, 14-DAY TRIALS & WIRE INVOICE LEDGER */}
          {activeView === "billing_ops" && (
            <div
              data-testid="hq-billing-ops-view"
              style={{ display: "flex", flexDirection: "column", gap: "18px" }}
            >
              {/* Unit Economics & Cash Collection Summary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "12px",
                }}
              >
                <div style={{ padding: "14px 16px", border: "1px solid #DCE5E1", borderRadius: "6px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>Active Recurring MRR</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
                    ${billingSummary.mrrUsd.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
                    Stripe auto-charge &amp; settled contracts
                  </div>
                </div>

                <div style={{ padding: "14px 16px", border: "1px solid #DCE5E1", borderRadius: "6px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>Pending Wire &amp; Past-Due</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#8A5A10", marginTop: "4px" }}>
                    ${billingSummary.pendingReceivablesUsd.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
                    {billingSummary.pendingWireCount} SWIFT wire · {billingSummary.pastDueCount} card retry
                  </div>
                </div>

                <div style={{ padding: "14px 16px", border: "1px solid #DCE5E1", borderRadius: "6px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>30d AI OCR Unit Cost</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
                    ${billingSummary.estimatedAiCostUsd.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
                    {overview.aiExtractions30dTotal.toLocaleString()} runs @ $0.04/extraction
                  </div>
                </div>

                <div style={{ padding: "14px 16px", border: "1px solid #DCE5E1", borderRadius: "6px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>Net SaaS Gross Margin</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#176B50", marginTop: "4px" }}>
                    {billingSummary.grossMarginPct}%
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
                    ${billingSummary.netContributionUsd.toLocaleString()} net contribution / mo
                  </div>
                </div>
              </div>

              {/* Active 14-Day Pilot Trials */}
              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    padding: "13px 16px",
                    borderBottom: "1px solid #E5ECE9",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#063C3D",
                  }}
                >
                  Active 14-Day Free Pilots ({tenants.filter((t) => t.billingStatus === "trialing").length})
                </div>
                {tenants.filter((t) => t.billingStatus === "trialing").length === 0 ? (
                  <div style={{ padding: "16px", fontSize: "12.5px", color: "#5C6E6A" }}>
                    No agencies currently in 14-day pilot — all active firms are on paid subscriptions.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E5ECE9", color: "#5C6E6A", textAlign: "left" }}>
                        <th style={{ padding: "9px 14px", fontWeight: 600 }}>Agency</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600 }}>Owner</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600 }}>Usage</th>
                        <th style={{ padding: "9px 10px", fontWeight: 600 }}>Trial Ends</th>
                        <th style={{ padding: "9px 14px", fontWeight: 600, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants
                        .filter((t) => t.billingStatus === "trialing")
                        .map((t) => (
                          <tr key={t.organizationId} style={{ borderBottom: "1px solid #EFF3F1" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 650 }}>{t.tradingName}</td>
                            <td style={{ padding: "10px" }}>{t.ownerEmail}</td>
                            <td style={{ padding: "10px" }}>
                              {t.casesActiveCount} cases · {t.calculatorLeads30d} leads
                            </td>
                            <td style={{ padding: "10px", fontWeight: 600 }}>
                              {t.trialEndsAt ? t.trialEndsAt.slice(0, 10) : "14 days"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <button
                                type="button"
                                data-testid={`extend-trial-btn-${t.organizationId}`}
                                onClick={() => handleExtendTrial(t)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "4px",
                                  border: "1px solid #063C3D",
                                  background: "#FFFFFF",
                                  color: "#063C3D",
                                  fontSize: "11.5px",
                                  fontWeight: 650,
                                  cursor: "pointer",
                                }}
                              >
                                Extend +7 Days
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Subscriptions, SWIFT Wire Transfers & Past-Due Invoices */}
              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    padding: "13px 16px",
                    borderBottom: "1px solid #E5ECE9",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#063C3D",
                  }}
                >
                  Subscriptions, SWIFT Wire Invoices &amp; Dunning Ledger
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5ECE9", color: "#5C6E6A", textAlign: "left" }}>
                      <th style={{ padding: "9px 14px", fontWeight: 600 }}>Invoice #</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Agency &amp; Plan</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Method</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600, textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Status</th>
                      <th style={{ padding: "9px 14px", fontWeight: 600, textAlign: "right" }}>Reconcile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid #EFF3F1" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <code>{inv.invoiceNumber}</code>
                          <div style={{ fontSize: "11px", color: "#647571" }}>Due {inv.dueDate}</div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ fontWeight: 650 }}>{inv.tradingName}</div>
                          <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>{inv.notes || inv.planLabel}</div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          {inv.paymentMethod === "wire_invoice" ? "SWIFT / Bank Wire" : "Stripe Card"}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>
                          ${inv.amountUsd.toLocaleString()}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background:
                                inv.status === "paid"
                                  ? "#EAF6F0"
                                  : inv.status === "past_due"
                                    ? "#FEF2F2"
                                    : "#FEF7EA",
                              color:
                                inv.status === "paid"
                                  ? "#176B50"
                                  : inv.status === "past_due"
                                    ? "#991B1B"
                                    : "#8A5A10",
                            }}
                          >
                            {inv.status === "paid"
                              ? "PAID"
                              : inv.status === "past_due"
                                ? "PAST DUE"
                                : "PENDING WIRE"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          {inv.status !== "paid" ? (
                            <button
                              type="button"
                              data-testid={`settle-invoice-btn-${inv.invoiceNumber}`}
                              onClick={() => handleSettleInvoice(inv)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "4px",
                                border: "none",
                                background: "#063C3D",
                                color: "#FFFFFF",
                                fontSize: "11.5px",
                                fontWeight: 650,
                                cursor: "pointer",
                              }}
                            >
                              Mark Paid / Settle Wire
                            </button>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#647571" }}>Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {/* VIEW 5: PARTNER SUPPORT DESK & STATUTORY RULE BROADCASTS */}
          {activeView === "support_rules" && (
            <div
              data-testid="hq-support-rules-view"
              className="hq-split-2col"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 6fr) minmax(0, 6fr)",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {/* Left: Partner Agency Support Inbox */}
              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  padding: "18px",
                }}
              >
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
                  Partner Agency Support Inbox ({supportTickets.length})
                </h2>
                <p style={{ fontSize: "12px", color: "#5C6E6A", margin: "0 0 14px 0" }}>
                  Respond to seat upgrade requests, OCR pipeline questions, and statutory checklist inquiries.
                </p>

                {supportActionError && (
                  <div
                    role="alert"
                    style={{
                      padding: "8px 11px",
                      borderRadius: "6px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      color: "#991B1B",
                      fontSize: "12px",
                      fontWeight: 600,
                      marginBottom: "12px",
                    }}
                  >
                    {supportActionError}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {supportTickets.map((tkt) => (
                    <div
                      key={tkt.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "6px",
                        border: "1px solid #DCE5E1",
                        background: tkt.status === "resolved" ? "#F8FAF9" : "#FFFFFF",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                          {tkt.ticketCode} · {tkt.tradingName}
                        </div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {tkt.breakGlassAttached && (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "#FEF7EA",
                                color: "#8A5A10",
                              }}
                            >
                              2h Break-Glass Active
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: tkt.status === "resolved" ? "#176B50" : "#8A5A10",
                            }}
                          >
                            {tkt.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "12.5px", fontWeight: 650, color: "#172322", marginTop: "4px" }}>
                        {tkt.subject}
                      </div>
                      <div style={{ fontSize: "12px", color: "#445451", marginTop: "3px", lineHeight: 1.45 }}>
                        {tkt.message}
                      </div>

                      {tkt.status === "resolved" ? (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px 10px",
                            borderRadius: "5px",
                            background: "#EAF6F0",
                            color: "#176B50",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Official HQ Reply ({tkt.repliedByEmail}): {tkt.hqReply}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <input
                            type="text"
                            data-testid={`hq-ticket-reply-input-${tkt.ticketCode}`}
                            placeholder="Write official HQ response to partner firm..."
                            value={ticketRepliesDraft[tkt.id] || ""}
                            onChange={(e) =>
                              setTicketRepliesDraft((prev) => ({
                                ...prev,
                                [tkt.id]: e.target.value,
                              }))
                            }
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              borderRadius: "6px",
                              border: "1px solid #BDCDC7",
                              fontSize: "12px",
                            }}
                          />
                          <button
                            type="button"
                            data-testid={`hq-resolve-ticket-btn-${tkt.ticketCode}`}
                            onClick={() => handleResolveSupportTicket(tkt)}
                            style={{
                              padding: "7px 12px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#063C3D",
                              color: "#FFFFFF",
                              fontSize: "12px",
                              fontWeight: 650,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Send Reply &amp; Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Right: Statutory Rule & Draw Cutoff Broadcast Publisher */}
              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  padding: "18px",
                }}
              >
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
                  Statutory Rule &amp; Draw Cutoff Publisher
                </h2>
                <p style={{ fontSize: "12px", color: "#5C6E6A", margin: "0 0 14px 0" }}>
                  Broadcast IRCC, SkillSelect, Home Office, INZ, or Germany rule updates directly to partner agency Launchpads.
                </p>

                {broadcastError && (
                  <div
                    role="alert"
                    style={{
                      padding: "8px 11px",
                      borderRadius: "6px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      color: "#991B1B",
                      fontSize: "12px",
                      fontWeight: 600,
                      marginBottom: "12px",
                    }}
                  >
                    {broadcastError}
                  </div>
                )}

                <form
                  onSubmit={handlePublishRuleBroadcast}
                  style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Jurisdiction Corridor
                      </label>
                      <select
                        aria-label="Broadcast jurisdiction corridor"
                        value={broadcastCorridor}
                        onChange={(e) => setBroadcastCorridor(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "12.5px",
                          background: "#FFFFFF",
                        }}
                      >
                        <option value="ALL">All Corridors (Global)</option>
                        <option value="CA">Canada (IRCC / PNP)</option>
                        <option value="AU">Australia (SkillSelect)</option>
                        <option value="NZ">New Zealand (INZ SMC)</option>
                        <option value="UK">United Kingdom (Home Office)</option>
                        <option value="DE">Germany (Make it in Germany)</option>
                        <option value="US">United States (USCIS)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Effective Date
                      </label>
                      <input
                        type="date"
                        value={broadcastEffectiveDate}
                        onChange={(e) => setBroadcastEffectiveDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          fontSize: "12.5px",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Bulletin Headline
                    </label>
                    <input
                      type="text"
                      data-testid="hq-broadcast-title-input"
                      placeholder="e.g. IRCC French Proficiency Category Draw #325 — 478 CRS Cutoff"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        fontSize: "12.5px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Checklist &amp; Calculator Impact Summary
                    </label>
                    <textarea
                      rows={2}
                      data-testid="hq-broadcast-summary-input"
                      placeholder="Describe updated statutory thresholds, checklists, or point rules..."
                      value={broadcastSummary}
                      onChange={(e) => setBroadcastSummary(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        fontSize: "12.5px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      data-testid="hq-publish-broadcast-btn"
                      style={{
                        padding: "8px 15px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "12.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Publish Rule Update to Agencies
                    </button>
                  </div>
                </form>

                <div style={{ borderTop: "1px solid #E5ECE9", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#5C6E6A", textTransform: "uppercase" }}>
                    Published Bulletins ({broadcasts.length})
                  </div>
                  {broadcasts.slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: "9px 11px",
                        borderRadius: "6px",
                        background: "#F8FAF9",
                        border: "1px solid #E4ECE8",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#063C3D" }}>
                        [{b.corridorCode}] {b.title}
                      </div>
                      <div style={{ color: "#445451", marginTop: "2px" }}>{b.summary}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* VIEW 6: ZERO-PII BOUNDARY & BREAK-GLASS GOVERNANCE LOG */}
          {activeView === "audit_privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  padding: "18px",
                }}
              >
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0" }}>
                  Active Agency-Granted Break-Glass Support Tokens ({overview.activeSupportGrantsCount})
                </h2>
                <p style={{ fontSize: "12.5px", color: "#526663", margin: "0 0 12px 0" }}>
                  Documento HQ cannot inspect tenant case metadata unless an Agency Managing Partner
                  explicitly issues a time-boxed 2-hour diagnostic token from their Firm Dashboard.
                </p>

                {overview.activeSupportGrantsCount === 0 ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      background: "#F8FAF9",
                      border: "1px solid #DCE5E1",
                      fontSize: "12.5px",
                      color: "#445451",
                    }}
                  >
                    0 active break-glass tokens — all {overview.activeAgenciesCount} active partner
                    tenant boundaries are sealed.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tenants
                      .filter((t) => t.supportGrantActive)
                      .map((t) => (
                        <div
                          key={t.organizationId}
                          style={{
                            padding: "11px 14px",
                            borderRadius: "6px",
                            background: "#FEF7EA",
                            border: "1px solid #E6CEA0",
                            fontSize: "12.5px",
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <span>
                            <strong>{t.tradingName}</strong> — Reason: &ldquo;{t.supportGrantReason}&rdquo;
                          </span>
                          <span style={{ color: "#8A5A10", fontWeight: 650 }}>
                            Expires{" "}
                            {t.supportGrantExpiresAt
                              ? new Date(t.supportGrantExpiresAt).toLocaleTimeString()
                              : "in 2h"}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </section>

              <section
                style={{
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    padding: "13px 16px",
                    borderBottom: "1px solid #E5ECE9",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#063C3D",
                  }}
                >
                  Immutable Platform Governance Ledger
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5ECE9", color: "#5C6E6A", textAlign: "left" }}>
                      <th style={{ padding: "9px 14px", fontWeight: 600 }}>Timestamp</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Actor</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Agency</th>
                      <th style={{ padding: "9px 10px", fontWeight: 600 }}>Action</th>
                      <th style={{ padding: "9px 14px", fontWeight: 600 }}>Audit Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {govLogs.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #EFF3F1" }}>
                        <td style={{ padding: "10px 14px", color: "#5C6E6A", whiteSpace: "nowrap" }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px" }}>{entry.actorEmail}</td>
                        <td style={{ padding: "10px", fontWeight: 650 }}>{entry.agencyName}</td>
                        <td style={{ padding: "10px" }}>
                          <code>{entry.actionCode}</code>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#334441" }}>{entry.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
