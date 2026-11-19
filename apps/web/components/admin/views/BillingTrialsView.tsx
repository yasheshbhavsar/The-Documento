"use client";

import React from "react";
import {
  AgencyBillingInvoice,
  AgencyTenantRecord,
} from "../../../lib/agencyPlatformStore";

export interface BillingTrialsViewProps {
  tenants: AgencyTenantRecord[];
  invoices: AgencyBillingInvoice[];
  aiExtractions30dTotal: number;
  billingSummary: {
    mrrUsd: number;
    pendingReceivablesUsd: number;
    pendingWireCount: number;
    pastDueCount: number;
    estimatedAiCostUsd: number;
    grossMarginPct: number;
    netContributionUsd: number;
  };
  onExtendTrial: (tenant: AgencyTenantRecord) => void;
  onSettleInvoice: (invoice: AgencyBillingInvoice) => void;
}

export function BillingTrialsView({
  tenants,
  invoices,
  aiExtractions30dTotal,
  billingSummary,
  onExtendTrial,
  onSettleInvoice,
}: BillingTrialsViewProps) {
  const trialTenants = tenants.filter((t) => t.billingStatus === "trialing");

  return (
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
        <div
          style={{
            padding: "14px 16px",
            border: "1px solid #DCE5E1",
            borderRadius: "6px",
            background: "#FFFFFF",
          }}
        >
          <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>Active Recurring MRR</div>
          <div style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
            ${billingSummary.mrrUsd.toLocaleString()}
          </div>
          <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
            Stripe auto-charge &amp; settled contracts
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            border: "1px solid #DCE5E1",
            borderRadius: "6px",
            background: "#FFFFFF",
          }}
        >
          <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>Pending Wire &amp; Past-Due</div>
          <div style={{ fontSize: "21px", fontWeight: 750, color: "#8A5A10", marginTop: "4px" }}>
            ${billingSummary.pendingReceivablesUsd.toLocaleString()}
          </div>
          <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
            {billingSummary.pendingWireCount} SWIFT wire · {billingSummary.pastDueCount} card retry
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            border: "1px solid #DCE5E1",
            borderRadius: "6px",
            background: "#FFFFFF",
          }}
        >
          <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>30d AI OCR Unit Cost</div>
          <div style={{ fontSize: "21px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
            ${billingSummary.estimatedAiCostUsd.toFixed(2)}
          </div>
          <div style={{ fontSize: "11.5px", color: "#647571", marginTop: "2px" }}>
            {aiExtractions30dTotal.toLocaleString()} runs @ $0.04/extraction
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            border: "1px solid #DCE5E1",
            borderRadius: "6px",
            background: "#FFFFFF",
          }}
        >
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
          Active 14-Day Free Pilots ({trialTenants.length})
        </div>
        {trialTenants.length === 0 ? (
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
              {trialTenants.map((t) => (
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
                      onClick={() => onExtendTrial(t)}
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
                  <div style={{ fontSize: "11.5px", color: "#5C6E6A" }}>
                    {inv.notes || inv.planLabel}
                  </div>
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
                      onClick={() => onSettleInvoice(inv)}
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
  );
}
