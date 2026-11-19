"use client";

import React from "react";
import {
  AgencyTenantRecord,
  PlatformGovernanceLogEntry,
} from "../../../lib/agencyPlatformStore";

export interface AuditGovernanceViewProps {
  tenants: AgencyTenantRecord[];
  govLogs: PlatformGovernanceLogEntry[];
  overview: {
    activeSupportGrantsCount: number;
    activeAgenciesCount: number;
  };
}

export function AuditGovernanceView({
  tenants,
  govLogs,
  overview,
}: AuditGovernanceViewProps) {
  return (
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
            0 active break-glass tokens — all {overview.activeAgenciesCount} active partner tenant
            boundaries are sealed.
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
  );
}
