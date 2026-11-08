"use client";

import React from "react";
import { Button } from "./Button";

export interface UnassignedClientEmptyStateProps {
  clientName?: string;
  firmName?: string;
  onOpenQuestionnaire?: () => void;
  onOpenOcrFaq?: () => void;
  onOpenProfile?: () => void;
}

export function UnassignedClientEmptyState({
  clientName = "Valued Applicant",
  firmName = "Your Law Firm",
  onOpenQuestionnaire,
  onOpenOcrFaq,
  onOpenProfile,
}: UnassignedClientEmptyStateProps) {
  return (
    <div
      data-testid="unassigned-client-empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "960px",
        margin: "24px auto",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
      }}
    >
      {/* Welcoming Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          borderRadius: "16px",
          padding: "32px 36px",
          color: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(6, 60, 61, 0.15)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255, 255, 255, 0.15)",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            marginBottom: "14px",
          }}
        >
          <span>PORTAL ACCOUNT ACTIVE • CASE FILE PENDING INITIALIZATION</span>
        </div>
        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Welcome to Documento, {clientName}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#E0EFEB",
            maxWidth: "680px",
          }}
        >
          Your legal representatives at <strong>{firmName}</strong> have provisioned your encrypted transparency portal. Your supervising attorney is currently setting up your formal petition docket and statutory requirements.
        </p>
      </div>

      {/* 3-Step Legal Onboarding Roadmap */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1.5px solid #B9DED4",
          borderRadius: "14px",
          padding: "24px 28px",
          boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
        }}
      >
        <h2 style={{ margin: "0 0 18px 0", fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
          Your Immigration Onboarding Roadmap
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              background: "#F8FAF9",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  background: "#22C55E",
                  color: "#FFFFFF",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
              <strong style={{ fontSize: "14px", color: "#063C3D" }}>
                1. Retainer &amp; Portal Setup
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#445451", lineHeight: 1.5 }}>
              Your secure client account is verified and ready.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              background: "#FEF7EA",
              border: "1px solid #FCD34D",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  background: "#F59E0B",
                  color: "#FFFFFF",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                ⏳
              </span>
              <strong style={{ fontSize: "14px", color: "#8A5A10" }}>
                2. Case Docket &amp; Stream
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#8A5A10", lineHeight: 1.5 }}>
              Attorney assigning petition classification and lead caseworker.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #CBD5E1",
              borderRadius: "10px",
              padding: "16px 18px",
              opacity: 0.85,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  background: "#94A3B8",
                  color: "#FFFFFF",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                3
              </span>
              <strong style={{ fontSize: "14px", color: "#475569" }}>
                3. Evidence Checklist
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748B", lineHeight: 1.5 }}>
              Will unlock automatically once your matter file is initialized.
            </p>
          </div>
        </div>
      </div>

      {/* Proactive Actions Card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1.5px solid #DCE5E1",
          borderRadius: "14px",
          padding: "24px 28px",
          boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
          Proactive Preparation (Recommended Next Steps)
        </h3>
        <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#6E7F7C" }}>
          You can expedite your petition right now by completing your background details and reviewing upload guidelines:
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: "14px",
                  color: "#063C3D",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                📝 Applicant Background Questionnaire
              </strong>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>
                Provide your employment, education, and travel history so your legal team has verified facts from Day 1.
              </p>
            </div>
            {onOpenQuestionnaire && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenQuestionnaire}
                style={{ background: "#0D6866", color: "#FFFFFF" }}
              >
                Open Background Wizard →
              </Button>
            )}
          </div>

          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: "14px",
                  color: "#063C3D",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                💡 Document Scanning &amp; OCR Guidelines
              </strong>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>
                Learn how to scan passports and official certificates at 300 DPI to avoid government verification delays.
              </p>
            </div>
            {onOpenOcrFaq && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenOcrFaq}
                style={{ background: "#FFFFFF", color: "#063C3D", border: "1px solid #B9DED4" }}
              >
                View Scanning Standards →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface FirmCleanSlateEmptyStateProps {
  firmName?: string;
  onOpenCreateClient?: () => void;
  onNavigateToCalculators?: () => void;
  onNavigateToExtractorLab?: () => void;
}

export function FirmCleanSlateEmptyState({
  firmName = "Firm Workspace",
  onOpenCreateClient,
  onNavigateToCalculators,
  onNavigateToExtractorLab,
}: FirmCleanSlateEmptyStateProps) {
  return (
    <div
      data-testid="firm-clean-slate-empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "960px",
        margin: "24px auto",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          borderRadius: "16px",
          padding: "36px 36px",
          color: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(6, 60, 61, 0.15)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255, 255, 255, 0.15)",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            marginBottom: "14px",
          }}
        >
          <span>FIRM WORKSPACE • DAY 0 CLEAN SLATE READY</span>
        </div>
        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          {firmName} is Initialized and Ready
        </h1>
        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#E0EFEB",
            maxWidth: "680px",
          }}
        >
          Zero active client records or open matters are currently in this tenant partition. Retained client data isolation and regulatory compliance rules are active.
        </p>
        {onOpenCreateClient && (
          <Button
            variant="primary"
            onClick={onOpenCreateClient}
            style={{
              background: "#FFFFFF",
              color: "#063C3D",
              fontWeight: 700,
              fontSize: "14px",
              padding: "10px 22px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            + Onboard First Client &amp; Open Matter →
          </Button>
        )}
      </div>

      {/* 3 Quickstart Pillars */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>👥</div>
            <strong
              style={{
                fontSize: "15px",
                color: "#063C3D",
                display: "block",
                marginBottom: "6px",
              }}
            >
              1. Retain Client &amp; Issue Portal
            </strong>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
              Register retained client biodata, assign supervising case managers, and issue portal credentials.
            </p>
          </div>
          {onOpenCreateClient && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCreateClient}
              style={{ background: "#F8FAF9", color: "#063C3D", border: "1px solid #B9DED4" }}
            >
              + Retain Client
            </Button>
          )}
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔬</div>
            <strong
              style={{
                fontSize: "15px",
                color: "#063C3D",
                display: "block",
                marginBottom: "6px",
              }}
            >
              2. Test Document Extractor Lab
            </strong>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
              Test multi-person packet splitting, OCR extraction, and MRZ parsing with sample documents in sandbox mode.
            </p>
          </div>
          {onNavigateToExtractorLab && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToExtractorLab}
              style={{ background: "#F8FAF9", color: "#063C3D", border: "1px solid #B9DED4" }}
            >
              Open Extractor Lab →
            </Button>
          )}
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>🌐</div>
            <strong
              style={{
                fontSize: "15px",
                color: "#063C3D",
                display: "block",
                marginBottom: "6px",
              }}
            >
              3. Evaluate PR Pathways
            </strong>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
              Calculate Express Entry CRS, Germany Chancenkarte, or UK Skilled Worker points for prospective leads.
            </p>
          </div>
          {onNavigateToCalculators && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToCalculators}
              style={{ background: "#F8FAF9", color: "#063C3D", border: "1px solid #B9DED4" }}
            >
              Open Calculators →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
