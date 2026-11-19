"use client";

import React from "react";
import {
  AGENCY_PLAN_SPECS,
  AgencyPlanTier,
  KybTrack,
  REGULATORY_BODIES,
  SOVEREIGN_CORRIDORS,
} from "../../../lib/agencyPlatformStore";

export interface SalesProvisionModalProps {
  isOpen: boolean;
  salesError: string | null;
  salesLegalName: string;
  salesTradingName: string;
  salesOwnerName: string;
  salesOwnerEmail: string;
  salesOwnerPassword: string;
  salesCountry: string;
  salesCity: string;
  salesTrack: KybTrack;
  salesRegulator: string;
  salesLicense: string;
  salesCorridors: string[];
  salesPlan: AgencyPlanTier;
  salesCustomMrr: number;
  salesCustomSeats: number;
  salesPaymentMethod: "stripe_card" | "wire_invoice" | "trial";
  salesVerifiedOnCall: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeLegalName: (val: string) => void;
  onChangeTradingName: (val: string) => void;
  onChangeOwnerName: (val: string) => void;
  onChangeOwnerEmail: (val: string) => void;
  onChangeOwnerPassword: (val: string) => void;
  onChangeCountry: (val: string) => void;
  onChangeCity: (val: string) => void;
  onChangeTrack: (val: KybTrack) => void;
  onChangeRegulator: (val: string) => void;
  onChangeLicense: (val: string) => void;
  onToggleCorridor: (corridorCode: string) => void;
  onChangePlan: (plan: AgencyPlanTier) => void;
  onChangeCustomMrr: (val: number) => void;
  onChangeCustomSeats: (val: number) => void;
  onChangePaymentMethod: (method: "stripe_card" | "wire_invoice" | "trial") => void;
  onChangeVerifiedOnCall: (val: boolean) => void;
}

export function SalesProvisionModal({
  isOpen,
  salesError,
  salesLegalName,
  salesTradingName,
  salesOwnerName,
  salesOwnerEmail,
  salesOwnerPassword,
  salesCountry,
  salesCity,
  salesTrack,
  salesRegulator,
  salesLicense,
  salesCorridors,
  salesPlan,
  salesCustomMrr,
  salesCustomSeats,
  salesPaymentMethod,
  salesVerifiedOnCall,
  onClose,
  onSubmit,
  onChangeLegalName,
  onChangeTradingName,
  onChangeOwnerName,
  onChangeOwnerEmail,
  onChangeOwnerPassword,
  onChangeCountry,
  onChangeCity,
  onChangeTrack,
  onChangeRegulator,
  onChangeLicense,
  onToggleCorridor,
  onChangePlan,
  onChangeCustomMrr,
  onChangeCustomSeats,
  onChangePaymentMethod,
  onChangeVerifiedOnCall,
}: SalesProvisionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(6, 60, 61, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sales-Led Agency Provisioning"
        data-testid="sales-led-provision-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "980px",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          padding: "22px 24px",
          borderRadius: "8px",
          border: "1px solid #063C3D",
          background: "#F9FBFA",
          boxShadow: "0 20px 50px rgba(6, 60, 61, 0.25)",
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
              Create a dedicated agency workspace with custom negotiated MRR, seat allocation, and
              Stripe/Wire billing.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
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
                Legal Entity Name
              </label>
              <input
                type="text"
                placeholder="Practice Legal Entity Name (e.g. Pacific Rim Immigration Law PC)"
                value={salesLegalName}
                onChange={(e) => onChangeLegalName(e.target.value)}
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
                Public Brand Name
              </label>
              <input
                type="text"
                placeholder="Public Trading Brand (e.g. Pacific Rim Visas)"
                value={salesTradingName}
                onChange={(e) => onChangeTradingName(e.target.value)}
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
                Managing Partner Name
              </label>
              <input
                type="text"
                placeholder="Full name and bar/license title"
                value={salesOwnerName}
                onChange={(e) => onChangeOwnerName(e.target.value)}
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
                Owner Login Email
              </label>
              <input
                type="email"
                placeholder="owner@practice-domain.com"
                value={salesOwnerEmail}
                onChange={(e) => onChangeOwnerEmail(e.target.value)}
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
                Initial Password (Optional)
              </label>
              <input
                type="password"
                aria-label="Sales initial owner password"
                placeholder="Auto-generates if blank"
                value={salesOwnerPassword}
                onChange={(e) => onChangeOwnerPassword(e.target.value)}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "10px",
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
                HQ Country
              </label>
              <input
                type="text"
                value={salesCountry}
                onChange={(e) => onChangeCountry(e.target.value)}
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
                HQ City
              </label>
              <input
                type="text"
                value={salesCity}
                onChange={(e) => onChangeCity(e.target.value)}
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
                Practice Track
              </label>
              <select
                value={salesTrack}
                onChange={(e) => onChangeTrack(e.target.value as KybTrack)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13px",
                  background: "#FFFFFF",
                }}
              >
                <option value="regulated_counsel">Licensed Lawyer / Consultant</option>
                <option value="overseas_consultancy">Visa / Study Abroad Agency</option>
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
                Regulator / Register
              </label>
              <select
                value={salesRegulator}
                onChange={(e) => onChangeRegulator(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13px",
                  background: "#FFFFFF",
                }}
              >
                {REGULATORY_BODIES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code}
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
                License / Reg #
              </label>
              <input
                type="text"
                placeholder="e.g. R708112"
                value={salesLicense}
                onChange={(e) => onChangeLicense(e.target.value)}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "10px",
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
                Plan Tier
              </label>
              <select
                value={salesPlan}
                onChange={(e) => {
                  const next = e.target.value as AgencyPlanTier;
                  onChangePlan(next);
                  onChangeCustomMrr(AGENCY_PLAN_SPECS[next].mrrUsd);
                  onChangeCustomSeats(AGENCY_PLAN_SPECS[next].seatLimit);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13px",
                  background: "#FFFFFF",
                }}
              >
                {(Object.keys(AGENCY_PLAN_SPECS) as AgencyPlanTier[]).map((k) => (
                  <option key={k} value={k}>
                    {AGENCY_PLAN_SPECS[k].label}
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
                Negotiated MRR ($ USD)
              </label>
              <input
                type="number"
                min={0}
                aria-label="Negotiated MRR USD"
                value={salesCustomMrr}
                onChange={(e) => onChangeCustomMrr(Number(e.target.value) || 0)}
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
                Custom Seat Cap
              </label>
              <input
                type="number"
                min={1}
                aria-label="Custom Seat Cap"
                value={salesCustomSeats}
                onChange={(e) => onChangeCustomSeats(Number(e.target.value) || 1)}
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
                Billing Method
              </label>
              <select
                aria-label="Sales billing method"
                value={salesPaymentMethod}
                onChange={(e) =>
                  onChangePaymentMethod(
                    e.target.value as "stripe_card" | "wire_invoice" | "trial"
                  )
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13px",
                  background: "#FFFFFF",
                }}
              >
                <option value="stripe_card">Stripe Corporate Card</option>
                <option value="wire_invoice">SWIFT / Bank Wire Invoice</option>
                <option value="trial">14-Day Pilot ($0)</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {SOVEREIGN_CORRIDORS.map((c) => {
                  const on = salesCorridors.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => onToggleCorridor(c.code)}
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
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12.5px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={salesVerifiedOnCall}
                  onChange={(e) => onChangeVerifiedOnCall(e.target.checked)}
                  style={{ accentColor: "#063C3D" }}
                />
                <span>
                  KYB license verified on sales call (activate co-branded calculators immediately)
                </span>
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
    </div>
  );
}
