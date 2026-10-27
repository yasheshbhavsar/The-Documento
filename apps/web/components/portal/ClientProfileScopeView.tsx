import React from "react";
import { ImmigrationCase } from "../../lib/types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export interface ClientProfileScopeViewProps {
  myCase: ImmigrationCase | null;
  onNavigateTab?: (tab: string) => void;
  onOpenUploadModal?: () => void;
}

export function ClientProfileScopeView({
  myCase,
  onNavigateTab,
  onOpenUploadModal,
}: ClientProfileScopeViewProps) {
  const isCanada =
    !myCase ||
    myCase.jurisdiction?.toLowerCase().includes("canada") ||
    myCase.visa_category?.toLowerCase().includes("canada") ||
    myCase.visa_category?.toLowerCase().includes("spous");

  const visaCategoryTitle = myCase
    ? myCase.visa_category
    : "In-Canada Spousal Sponsorship (Family Class / SCLPC)";

  const caseNumber = myCase?.case_number || "CASE-CA-2026-SP";
  const jurisdiction = myCase?.jurisdiction || "Canada (IRCC)";
  const assignedOfficer = myCase?.assigned_manager || "Officer Sarah Jenkins, Esq.";

  const clientName = myCase?.client_name || "Principal Applicant";
  const clientInitials =
    clientName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PA";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* 1. Header Banner: Active Visa File Scope */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          color: "#FFFFFF",
          borderRadius: "14px",
          padding: "24px 28px",
          boxShadow: "0 4px 14px rgba(6, 60, 61, 0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Visa File Scope &amp; Composition
            </span>
            <Badge variant="verified" style={{ background: "#22C55E", color: "#FFFFFF", border: "none" }}>
              Active Legal Representation
            </Badge>
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.01em" }}>
            {visaCategoryTitle}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#DCE5E1", lineHeight: 1.5 }}>
            File Docket: <strong>#{caseNumber}</strong> • Authority: <strong>{jurisdiction}</strong> • Supervised by: <strong>{assignedOfficer}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {onNavigateTab && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("documents")}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                fontWeight: 650,
                borderRadius: "8px",
              }}
            >
              📄 Required Documents
            </Button>
          )}
          {onNavigateTab && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab("initial_sheet")}
              style={{
                background: "#FFFFFF",
                color: "#063C3D",
                fontWeight: 700,
                border: "none",
                borderRadius: "8px",
              }}
            >
              📝 Initial Information Sheet
            </Button>
          )}
        </div>
      </div>

      {/* 2. Family Composition Breakdown Overview Metric */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "14px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>👥</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
              Family Members Included in This Visa File
            </h3>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Breakdown of the retained client and family members on the active immigration matter.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "8px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0D6866" }}>2</div>
            <div style={{ fontSize: "11px", fontWeight: 650, color: "#176B50" }}>
              Active Matter Members
            </div>
          </div>
          <div
            style={{
              background: "#F8FAF9",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "8px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#475569" }}>IMM 5406</div>
            <div style={{ fontSize: "11px", fontWeight: 650, color: "#64748B" }}>
              Declared Immediate Relatives
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Roster Cards for Included Family Members */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Member 1: Retained Client (Principal Beneficiary) */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1.5px solid #0D6866",
            borderRadius: "14px",
            padding: "22px 24px",
            boxShadow: "0 2px 6px rgba(13, 104, 102, 0.06)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "20px",
              display: "flex",
              gap: "8px",
            }}
          >
            <span
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 750,
                padding: "3px 10px",
                borderRadius: "20px",
              }}
            >
              Principal Applicant (Retained Client)
            </span>
            <span
              style={{
                background: "#DCFCE7",
                color: "#166534",
                fontSize: "11px",
                fontWeight: 650,
                padding: "3px 8px",
                borderRadius: "20px",
                border: "1px solid #86EFAC",
              }}
            >
              Inland Class Beneficiary
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#EAF6F0",
                color: "#0D6866",
                fontSize: "18px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #B9DED4",
                flexShrink: 0,
              }}
            >
              {clientInitials}
            </div>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                {clientName}
              </h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748B" }}>
                Primary Retained Client • Applying for Permanent Residence under Spousal / Family Sponsorship Class
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  background: "#F8FAF9",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Date of Birth</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    {myCase ? "Registered on Civil Record" : "Pending Intake Form"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Place of Birth</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    {myCase?.client_nationality ? `${myCase.client_nationality} (as declared)` : "As recorded on official civil records"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Passport &amp; Expiry</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    {myCase ? "On file with legal counsel (Verified)" : "Pending Submission"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Current Address</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    {myCase ? "On file in client intake records" : "Pending Submission"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                  Official Government Application Forms Prepared:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    "IMM 0008 (Generic Application for Canada)",
                    "IMM 5532 (Relationship Information & Evaluation)",
                    "IMM 5669 (Schedule A Background/Declaration)",
                    "IMM 5406 (Additional Family Information)",
                    "IMM 5710 (In-Canada Open Work Permit - SOWP)",
                  ].map((form) => (
                    <span
                      key={form}
                      style={{
                        background: "#EAF6F0",
                        color: "#0D6866",
                        fontSize: "11px",
                        fontWeight: 650,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #B9DED4",
                      }}
                    >
                      ✓ {form}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Member 2: Sponsor & Spouse */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1.5px solid #B9DED4",
            borderRadius: "14px",
            padding: "22px 24px",
            boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "20px",
              display: "flex",
              gap: "8px",
            }}
          >
            <span
              style={{
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 750,
                padding: "3px 10px",
                borderRadius: "20px",
              }}
            >
              Sponsor &amp; Co-Signer
            </span>
            <span
              style={{
                background: "#DCFCE7",
                color: "#166534",
                fontSize: "11px",
                fontWeight: 650,
                padding: "3px 8px",
                borderRadius: "20px",
                border: "1px solid #86EFAC",
              }}
            >
              Canadian Permanent Resident
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#F8F7F2",
                color: "#063C3D",
                fontSize: "18px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #DCE5E1",
                flexShrink: 0,
              }}
            >
              SP
            </div>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                Sponsor &amp; Co-Signer
              </h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748B" }}>
                Eligible Canadian Sponsor • Providing 3-Year Statutory Financial Support Undertaking
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  background: "#F8FAF9",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Date of Birth</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    Recorded on Official Canadian Identification
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Status in Canada</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                    PR (Permanent Resident Verified)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>UCI / Client ID &amp; PR Card</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    Statutory Identification On File
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Current Employment</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                    Employment &amp; Income Verification On File
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                  Sponsorship Filings &amp; Undertakings Prepared:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    "IMM 1344 (Application to Sponsor & Sponsorship Agreement)",
                    "IMM 5532 Part A & C (Sponsor Evaluation & Declarations)",
                    "3-Year Statutory Support Undertaking (Zero Social Assistance Liability)",
                    "Sponsor Notice of Assessment (NOA) & Employment Proof",
                  ].map((form) => (
                    <span
                      key={form}
                      style={{
                        background: "#F1F5F9",
                        color: "#334155",
                        fontSize: "11px",
                        fontWeight: 650,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      ✓ {form}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Declared Non-Accompanying Relatives on File */}
        <div
          style={{
            background: "#F8FAF9",
            border: "1px dashed #CBD5E1",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>📋</span>
            <strong style={{ fontSize: "13px", color: "#475569" }}>
              Declared Immediate Family Members (IRPA § 117(9)(d) Compliance)
            </strong>
          </div>
          <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#64748B", lineHeight: 1.4 }}>
            Under Canadian immigration regulations, all immediate relatives must be truthfully listed on Form IMM 5406 to prevent statutory bars:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <span
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#1E293B",
              }}
            >
              <strong>Immediate Relatives (Parents, Children, Siblings)</strong> declared via Form IMM 5406
            </span>
            <span
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#1E293B",
              }}
            >
              <strong>Non-Accompanying Dependents</strong> evaluated under statutory compliance
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
