"use client";

import React from "react";
import {
  AgencyKybApplication,
  AgencyTenantRecord,
} from "../../../lib/agencyPlatformStore";

export interface NetworkOverviewViewProps {
  applications: AgencyKybApplication[];
  tenants: AgencyTenantRecord[];
  unpaidInvoicesCount: number;
  openTicketsCount: number;
  broadcastsCount: number;
  billingSummary: {
    pendingReceivablesUsd: number;
    pendingWireCount: number;
    pastDueCount: number;
    activeTrialsCount: number;
  };
  onNavigateView: (
    view: "overview" | "kyb_queue" | "agencies" | "billing_ops" | "support_rules" | "audit_privacy"
  ) => void;
  onSelectApp: (appId: string) => void;
  onSelectTenant: (organizationId: string) => void;
}

export function NetworkOverviewView({
  applications,
  tenants,
  unpaidInvoicesCount,
  openTicketsCount,
  broadcastsCount,
  billingSummary,
  onNavigateView,
  onSelectApp,
  onSelectTenant,
}: NetworkOverviewViewProps) {
  return (
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
              onClick={() => onNavigateView("kyb_queue")}
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
                    onSelectApp(app.id);
                    onNavigateView("kyb_queue");
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
              onClick={() => onNavigateView("agencies")}
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
                const aiRatio =
                  t.aiExtractionsUsed30d / Math.max(1, t.monthlyAiExtractionQuota);
                return (
                  <tr
                    key={t.organizationId}
                    onClick={() => {
                      onSelectTenant(t.organizationId);
                      onNavigateView("agencies");
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
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#8A5A10",
                textTransform: "uppercase",
              }}
            >
              Wire Upgrades &amp; Past-Due Cards ({unpaidInvoicesCount})
            </div>
            <div style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
              ${billingSummary.pendingReceivablesUsd.toLocaleString()} awaiting settlement (
              {billingSummary.pendingWireCount} SWIFT wire, {billingSummary.pastDueCount} card
              retry).
            </div>
            <button
              type="button"
              onClick={() => onNavigateView("billing_ops")}
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
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#063C3D",
                textTransform: "uppercase",
              }}
            >
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
              onClick={() => onNavigateView("billing_ops")}
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
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#063C3D",
                textTransform: "uppercase",
              }}
            >
              Partner Support &amp; Rule Sync ({openTicketsCount} Open)
            </div>
            <div style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
              {openTicketsCount > 0
                ? `${openTicketsCount} agency request(s) awaiting HQ response · ${broadcastsCount} statutory bulletins live.`
                : `Inbox zero · ${broadcastsCount} statutory bulletins live.`}
            </div>
            <button
              type="button"
              onClick={() => onNavigateView("support_rules")}
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
  );
}
