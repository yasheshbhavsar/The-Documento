"use client";

import React from "react";
import Link from "next/link";
import {
  AGENCY_PLAN_SPECS,
  AgencyFeatureFlags,
  AgencyPlanTier,
  AgencyTeamInviteRecord,
  AgencyTenantRecord,
  formatStaffRoleLabel,
} from "../../../lib/agencyPlatformStore";

export type AgencyStatusFilter = "all" | "active" | "onboarding" | "quota_alert" | "suspended";

export interface PartnerAgenciesViewProps {
  tenants: AgencyTenantRecord[];
  filteredTenants: AgencyTenantRecord[];
  selectedTenant: AgencyTenantRecord | null;
  selectedTenantCredentials: {
    ownerPassword?: string;
    teamSeats: AgencyTeamInviteRecord[];
  } | null;
  overview: {
    activeAgenciesCount: number;
    quotaAttentionCount: number;
    suspendedAgenciesCount: number;
  };
  statusFilter: AgencyStatusFilter;
  corridorFilter: string;
  searchQuery: string;
  showTenantPasswords: boolean;
  isEditingOwnerPassword: boolean;
  customOwnerPasswordDraft: string;
  credentialError: string | null;
  govPlanDraft: AgencyPlanTier;
  govSeatDraft: number;
  govCaseDraft: number;
  govAiDraft: number;
  govReasonDraft: string;
  onChangeStatusFilter: (filter: AgencyStatusFilter) => void;
  onChangeCorridorFilter: (corridor: string) => void;
  onChangeSearchQuery: (query: string) => void;
  onExportCsv: () => void;
  onSelectTenant: (organizationId: string | null) => void;
  onToggleFreeze: (tenant: AgencyTenantRecord) => void;
  onDeleteTenant: (tenant: AgencyTenantRecord) => void;
  onToggleShowPasswords: () => void;
  onCopyFullLoginPacket: () => void;
  onCopyText: (value: string, label: string) => void;
  onToggleEditOwnerPassword: () => void;
  onChangeCustomOwnerPassword: (value: string) => void;
  onSaveCustomOwnerPassword: () => void;
  onAutoResetOwnerPassword: () => void;
  onResetStaffSeatPasscode: (seat: AgencyTeamInviteRecord) => void;
  onChangeGovPlan: (plan: AgencyPlanTier) => void;
  onChangeGovSeat: (seats: number) => void;
  onChangeGovCase: (cases: number) => void;
  onChangeGovAi: (aiQuota: number) => void;
  onChangeGovReason: (reason: string) => void;
  onToggleFeatureFlag: (flagKey: keyof AgencyFeatureFlags) => void;
  onSaveGovernance: () => void;
}

export function PartnerAgenciesView({
  tenants,
  filteredTenants,
  selectedTenant,
  selectedTenantCredentials,
  overview,
  statusFilter,
  corridorFilter,
  searchQuery,
  showTenantPasswords,
  isEditingOwnerPassword,
  customOwnerPasswordDraft,
  credentialError,
  govPlanDraft,
  govSeatDraft,
  govCaseDraft,
  govAiDraft,
  govReasonDraft,
  onChangeStatusFilter,
  onChangeCorridorFilter,
  onChangeSearchQuery,
  onExportCsv,
  onSelectTenant,
  onToggleFreeze,
  onDeleteTenant,
  onToggleShowPasswords,
  onCopyFullLoginPacket,
  onCopyText,
  onToggleEditOwnerPassword,
  onChangeCustomOwnerPassword,
  onSaveCustomOwnerPassword,
  onAutoResetOwnerPassword,
  onResetStaffSeatPasscode,
  onChangeGovPlan,
  onChangeGovSeat,
  onChangeGovCase,
  onChangeGovAi,
  onChangeGovReason,
  onToggleFeatureFlag,
  onSaveGovernance,
}: PartnerAgenciesViewProps) {
  const onboardingCount = tenants.filter((t) => t.health === "onboarding").length;

  return (
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
            { id: "onboarding" as const, label: `Onboarding (${onboardingCount})` },
            { id: "quota_alert" as const, label: `≥85% Quota (${overview.quotaAttentionCount})` },
            { id: "suspended" as const, label: `Frozen (${overview.suspendedAgenciesCount})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChangeStatusFilter(f.id)}
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
            onChange={(e) => onChangeCorridorFilter(e.target.value)}
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
            onChange={(e) => onChangeSearchQuery(e.target.value)}
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
            onClick={onExportCsv}
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
            <tr
              style={{
                borderBottom: "1px solid #DCE5E1",
                color: "#5C6E6A",
                textAlign: "left",
              }}
            >
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
                      onClick={() => onSelectTenant(isSelected ? null : t.organizationId)}
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
                      onClick={() => onToggleFreeze(t)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "4px",
                        border:
                          t.status === "active" ? "1px solid #FECACA" : "1px solid #B9DED4",
                        background: "#FFFFFF",
                        color: t.status === "active" ? "#991B1B" : "#176B50",
                        fontSize: "11.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {t.status === "active" ? "Freeze" : "Reactivate"}
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-tenant-btn-${t.organizationId}`}
                      onClick={() => onDeleteTenant(t)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "4px",
                        border: "1px solid #FECACA",
                        background: "#FFFFFF",
                        color: "#991B1B",
                        fontSize: "11.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                        marginLeft: "6px",
                      }}
                    >
                      Delete
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

          {/* Workspace Login Credentials (IDs & Passwords) */}
          <div
            data-testid="tenant-credentials-panel"
            style={{
              border: "1px solid #DCE5E1",
              borderRadius: "6px",
              background: "#F8FAF9",
              padding: "14px 16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                  Workspace Login Credentials (IDs &amp; Passwords)
                </div>
                <div style={{ fontSize: "11.5px", color: "#5C6E6A", marginTop: "2px" }}>
                  Firm Sign-In Portal (<code>/login</code>) · 1 Managing Partner
                  {(selectedTenantCredentials?.teamSeats.length || 0) > 0
                    ? ` + ${selectedTenantCredentials!.teamSeats.length} Provisioned Staff Seat(s)`
                    : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-testid="toggle-tenant-passwords-btn"
                  onClick={onToggleShowPasswords}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "5px",
                    border: "1px solid #BDCDC7",
                    background: "#FFFFFF",
                    color: "#063C3D",
                    fontSize: "11.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {showTenantPasswords ? "Hide Passwords" : "Show Passwords"}
                </button>
                <button
                  type="button"
                  data-testid="copy-tenant-login-packet-btn"
                  onClick={onCopyFullLoginPacket}
                  style={{
                    padding: "5px 11px",
                    borderRadius: "5px",
                    border: "1px solid #063C3D",
                    background: "#063C3D",
                    color: "#FFFFFF",
                    fontSize: "11.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Copy Login Packet
                </button>
              </div>
            </div>

            {credentialError && (
              <div
                role="alert"
                style={{
                  padding: "8px 10px",
                  borderRadius: "5px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                {credentialError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Managing Partner / Master Admin Account */}
              <div
                data-testid="tenant-owner-credential-row"
                style={{
                  border: "1px solid #E4ECE8",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  className="hq-cred-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(170px, 1.3fr) minmax(210px, 1.8fr) minmax(190px, 1.5fr) auto",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#172322" }}>
                      {selectedTenant.ownerFullName}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "2px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "#EAF6F0",
                        border: "1px solid #B9DED4",
                        color: "#176B50",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                      }}
                    >
                      MANAGING PARTNER · MASTER ADMIN
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#647571",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Login ID (Email)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "2px",
                        flexWrap: "wrap",
                      }}
                    >
                      <code
                        data-testid="tenant-owner-login-id"
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 650,
                          color: "#063C3D",
                          background: "#F4F8F6",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        {selectedTenant.ownerEmail}
                      </code>
                      <button
                        type="button"
                        data-testid="copy-owner-login-id-btn"
                        onClick={() =>
                          onCopyText(
                            selectedTenant.ownerEmail,
                            `Login ID (${selectedTenant.ownerEmail})`
                          )
                        }
                        style={{
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#384A46",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Copy ID
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#647571",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Password
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "2px",
                        flexWrap: "wrap",
                      }}
                    >
                      {selectedTenantCredentials?.ownerPassword ? (
                        <>
                          <code
                            data-testid="tenant-owner-password"
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 700,
                              color: "#063C3D",
                              background: "#F4F8F6",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              border: "1px solid #DCE5E1",
                            }}
                          >
                            {showTenantPasswords
                              ? selectedTenantCredentials.ownerPassword
                              : "••••••••••••"}
                          </code>
                          <button
                            type="button"
                            data-testid="copy-owner-password-btn"
                            onClick={() =>
                              onCopyText(
                                selectedTenantCredentials.ownerPassword!,
                                `password for ${selectedTenant.ownerEmail}`
                              )
                            }
                            style={{
                              padding: "2px 7px",
                              borderRadius: "4px",
                              border: "1px solid #DCE5E1",
                              background: "#FFFFFF",
                              color: "#384A46",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Copy Password
                          </button>
                        </>
                      ) : (
                        <span
                          data-testid="tenant-owner-password"
                          style={{ fontSize: "12px", fontWeight: 600, color: "#8A5A10" }}
                        >
                          Not stored — click Set / Auto-Reset
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      data-testid="open-custom-owner-password-btn"
                      onClick={onToggleEditOwnerPassword}
                      style={{
                        padding: "5px 9px",
                        borderRadius: "4px",
                        border: "1px solid #BDCDC7",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {isEditingOwnerPassword ? "Cancel" : "Set Password"}
                    </button>
                    <button
                      type="button"
                      data-testid="auto-reset-owner-password-btn"
                      onClick={onAutoResetOwnerPassword}
                      style={{
                        padding: "5px 9px",
                        borderRadius: "4px",
                        border: "1px solid #0D6866",
                        background: "#F2F9F6",
                        color: "#063C3D",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Auto-Reset
                    </button>
                  </div>
                </div>

                {isEditingOwnerPassword && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      flexWrap: "wrap",
                      paddingTop: "8px",
                      borderTop: "1px solid #EFF3F1",
                    }}
                  >
                    <input
                      type="text"
                      data-testid="custom-owner-password-input"
                      placeholder="Enter new Managing Partner password (min 8 characters)..."
                      value={customOwnerPasswordDraft}
                      onChange={(e) => onChangeCustomOwnerPassword(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "230px",
                        padding: "7px 10px",
                        borderRadius: "5px",
                        border: "1px solid #BDCDC7",
                        fontSize: "12.5px",
                      }}
                    />
                    <button
                      type="button"
                      data-testid="save-custom-owner-password-btn"
                      onClick={onSaveCustomOwnerPassword}
                      style={{
                        padding: "7px 13px",
                        borderRadius: "5px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Save Password
                    </button>
                  </div>
                )}
              </div>

              {/* Provisioned Agency Staff Seats (Case Managers & Paralegals) */}
              {(selectedTenantCredentials?.teamSeats || []).map((seat) => (
                <div
                  key={seat.id}
                  className="hq-cred-grid"
                  data-testid={`tenant-staff-credential-row-${seat.id}`}
                  style={{
                    border: "1px solid #E4ECE8",
                    borderRadius: "6px",
                    background: "#FFFFFF",
                    padding: "9px 12px",
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(170px, 1.3fr) minmax(210px, 1.8fr) minmax(190px, 1.5fr) auto",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12.5px", fontWeight: 650, color: "#172322" }}>
                      {seat.fullName}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "2px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "#F4F8F6",
                        border: "1px solid #DCE5E1",
                        color: "#384A46",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {formatStaffRoleLabel(seat.role).toUpperCase()} · {seat.branchOffice}
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#647571",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Login ID (Email)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "2px",
                        flexWrap: "wrap",
                      }}
                    >
                      <code
                        data-testid={`tenant-staff-login-id-${seat.id}`}
                        style={{
                          fontSize: "12px",
                          fontWeight: 650,
                          color: "#063C3D",
                          background: "#F4F8F6",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        {seat.email}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          onCopyText(seat.email, `Staff Login ID (${seat.email})`)
                        }
                        style={{
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#384A46",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Copy ID
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#647571",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Staff Passcode
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "2px",
                        flexWrap: "wrap",
                      }}
                    >
                      <code
                        data-testid={`tenant-staff-password-${seat.id}`}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#063C3D",
                          background: "#F4F8F6",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        {showTenantPasswords ? seat.passcode : "••••••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          onCopyText(seat.passcode, `passcode for ${seat.email}`)
                        }
                        style={{
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#384A46",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Copy Password
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      data-testid={`reset-staff-passcode-btn-${seat.id}`}
                      onClick={() => onResetStaffSeatPasscode(seat)}
                      style={{
                        padding: "5px 9px",
                        borderRadius: "4px",
                        border: "1px solid #BDCDC7",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Auto-Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                SaaS Plan Tier
              </label>
              <select
                value={govPlanDraft}
                onChange={(e) => {
                  const next = e.target.value as AgencyPlanTier;
                  onChangeGovPlan(next);
                  onChangeGovSeat(AGENCY_PLAN_SPECS[next].seatLimit);
                  onChangeGovCase(AGENCY_PLAN_SPECS[next].monthlyCaseQuota);
                  onChangeGovAi(AGENCY_PLAN_SPECS[next].monthlyAiExtractions);
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Seat Cap
              </label>
              <input
                type="number"
                min={1}
                value={govSeatDraft}
                onChange={(e) => onChangeGovSeat(Number(e.target.value) || 1)}
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Monthly Case Quota
              </label>
              <input
                type="number"
                min={1}
                value={govCaseDraft}
                onChange={(e) => onChangeGovCase(Number(e.target.value) || 1)}
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Monthly AI Extraction Quota
              </label>
              <input
                type="number"
                min={0}
                value={govAiDraft}
                onChange={(e) => onChangeGovAi(Number(e.target.value) || 0)}
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
                  onClick={() => onToggleFeatureFlag(fl.key)}
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
              onChange={(e) => onChangeGovReason(e.target.value)}
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
              onClick={onSaveGovernance}
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
            <button
              type="button"
              data-testid="delete-tenant-drawer-btn"
              onClick={() => onDeleteTenant(selectedTenant)}
              style={{
                padding: "9px 18px",
                borderRadius: "6px",
                border: "1px solid #FECACA",
                background: "#FEF2F2",
                color: "#991B1B",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              🗑️ Delete Agency Tenant
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
