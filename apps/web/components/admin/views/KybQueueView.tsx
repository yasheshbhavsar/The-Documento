"use client";

import React, { useState } from "react";
import {
  AGENCY_PLAN_SPECS,
  AgencyKybApplication,
  AgencyPlanTier,
  KybVerificationChecklist,
  REGULATORY_BODIES,
} from "../../../lib/agencyPlatformStore";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export interface KybQueueViewProps {
  applications: AgencyKybApplication[];
  selectedApp: AgencyKybApplication | null;
  reviewerNoteDraft: string;
  overridePlanDraft: AgencyPlanTier | "";
  kybDecisionError: string | null;
  onSelectApp: (appId: string) => void;
  onChangeReviewerNote: (note: string) => void;
  onChangeOverridePlan: (plan: AgencyPlanTier) => void;
  onToggleChecklistField: (field: keyof KybVerificationChecklist) => void;
  onKybDecision: (decision: "approve" | "request_clarification" | "reject") => void;
  onDeleteApplication: (app: AgencyKybApplication) => void;
}

export function KybQueueView({
  applications,
  selectedApp,
  reviewerNoteDraft,
  overridePlanDraft,
  kybDecisionError,
  onSelectApp,
  onChangeReviewerNote,
  onChangeOverridePlan,
  onToggleChecklistField,
  onKybDecision,
  onDeleteApplication,
}: KybQueueViewProps) {
  const [showKybOwnerPassword, setShowKybOwnerPassword] = useState<boolean>(false);

  return (
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
            <div
              key={app.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectApp(app.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectApp(app.id);
                }
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#172322" }}>
                  {app.tradingName}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                  <button
                    type="button"
                    data-testid={`delete-kyb-app-btn-${app.id}`}
                    title={`Delete application for ${app.tradingName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteApplication(app);
                    }}
                    style={{
                      padding: "2px 6px",
                      fontSize: "11px",
                      borderRadius: "4px",
                      border: "1px solid #FECACA",
                      background: "#FFFFFF",
                      color: "#991B1B",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={{ fontSize: "11.5px", color: "#5C6E6A", marginTop: "3px" }}>
                {app.dossierCode} · {app.regulatoryBody} ({app.licenseNumber}) ·{" "}
                {(app.uploadedDocuments || []).length} doc(s)
              </div>
            </div>
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
              <h2
                style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", margin: "4px 0" }}
              >
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
              <div style={{ color: "#647571", fontSize: "11.5px" }}>
                KYB Track &amp; Regulator
              </div>
              <div style={{ fontWeight: 650, marginTop: "2px" }}>
                {selectedApp.regulatoryBody} · {selectedApp.licenseNumber}
              </div>
            </div>
            <div>
              <div style={{ color: "#647571", fontSize: "11.5px" }}>
                Corporate Tax / Business ID
              </div>
              <div style={{ fontWeight: 650, marginTop: "2px" }}>
                {selectedApp.taxRegistrationId} ({selectedApp.hqCity}, {selectedApp.hqCountry})
              </div>
            </div>
            <div>
              <div style={{ color: "#647571", fontSize: "11.5px" }}>
                Principal Contact &amp; Email Domain
              </div>
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
              <div style={{ color: "#647571", fontSize: "11.5px" }}>
                Requested Tier &amp; Corridors
              </div>
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
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#063C3D",
                marginBottom: "8px",
              }}
            >
              Uploaded KYB Verification Evidence ({(selectedApp.uploadedDocuments || []).length})
            </div>
            {(selectedApp.uploadedDocuments || []).length === 0 ? (
              <div style={{ fontSize: "12px", color: "#8A5A10" }}>
                No certificate PDF uploaded yet — applicant deferred document upload during 14-day
                trial signup. Request clarification or ask firm to upload via Launchpad.
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
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#063C3D",
                marginBottom: "8px",
              }}
            >
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
                    onChange={() => onToggleChecklistField(chk.key)}
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
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div>
                ✓ Approved and provisioned as tenant{" "}
                <code>{selectedApp.provisionedOrganizationId}</code>.
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "14px",
                  fontSize: "12px",
                  color: "#063C3D",
                  fontWeight: 600,
                }}
              >
                <span>
                  Login ID: <code>{selectedApp.contactWorkEmail}</code>
                </span>
                {(selectedApp.temporaryOwnerPassword || selectedApp.ownerPassword) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Password:{" "}
                    <code data-testid="kyb-owner-password-value">
                      {showKybOwnerPassword
                        ? selectedApp.temporaryOwnerPassword || selectedApp.ownerPassword
                        : "••••••••••••"}
                    </code>
                    <button
                      type="button"
                      data-testid="toggle-kyb-owner-password-btn"
                      onClick={() => setShowKybOwnerPassword((prev) => !prev)}
                      style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        border: "1px solid #B9DED4",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {showKybOwnerPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid #E5ECE9", paddingTop: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <label
                    htmlFor="kyb-reviewer-note"
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      marginBottom: "5px",
                    }}
                  >
                    KYB Adjudication Note (Recorded in Governance Log)
                  </label>
                  <input
                    id="kyb-reviewer-note"
                    type="text"
                    placeholder="e.g. Confirmed active RCIC standing on CICC register..."
                    value={reviewerNoteDraft}
                    onChange={(e) => onChangeReviewerNote(e.target.value)}
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
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      marginBottom: "5px",
                    }}
                  >
                    Provisioned Plan Tier
                  </label>
                  <select
                    id="kyb-plan-override"
                    value={overridePlanDraft || selectedApp.selectedPlanTier}
                    onChange={(e) => onChangeOverridePlan(e.target.value as AgencyPlanTier)}
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
                  onClick={() => onKybDecision("approve")}
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
                  onClick={() => onKybDecision("request_clarification")}
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
                  onClick={() => onKybDecision("reject")}
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
                <button
                  type="button"
                  data-testid="delete-kyb-app-panel-btn"
                  onClick={() => onDeleteApplication(selectedApp)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "6px",
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#991B1B",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🗑️ Delete Dossier
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
