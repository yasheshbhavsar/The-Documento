import React from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { UserExperience } from "../../lib/types";

interface DocumentoFooterProps {
  onSelectRole: (role: UserExperience) => void;
  onOpenApp: () => void;
}

export function DocumentoFooter({ onSelectRole, onOpenApp }: DocumentoFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      style={{
        background: "#F8F7F2",
        borderTop: "1px solid #DCE5E1",
        padding: "64px 24px 40px 24px",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "40px",
            marginBottom: "48px",
          }}
        >
          {/* Brand & Purpose */}
          <div style={{ maxWidth: "340px" }}>
            <DocumentoLogo size="lg" showWordmark showDomain />
            <p
              style={{
                fontSize: "14px",
                color: "#445451",
                lineHeight: 1.6,
                margin: "18px 0 0 0",
              }}
            >
              Clarity through organized documents, requirements, deadlines, and case workflows for immigration law firms and applicants.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Product &amp; Workflow
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
              <li>
                <a href="#hero" style={{ color: "#445451", textDecoration: "none" }}>
                  Overview
                </a>
              </li>
              <li>
                <a href="#preview" style={{ color: "#445451", textDecoration: "none" }}>
                  Interactive Case Preview
                </a>
              </li>
              <li>
                <a href="#capabilities" style={{ color: "#445451", textDecoration: "none" }}>
                  Core Capabilities
                </a>
              </li>
              <li>
                <a href="#workflow" style={{ color: "#445451", textDecoration: "none" }}>
                  4-Step Workflow
                </a>
              </li>
              <li>
                <a href="#trust" style={{ color: "#445451", textDecoration: "none" }}>
                  Human Oversight
                </a>
              </li>
            </ul>
          </div>

          {/* Role Workspaces */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Interactive Workspaces
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectRole("master_admin")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0D6866",
                    fontWeight: 550,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Managing Partner Executive Dashboard →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectRole("case_manager")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0D6866",
                    fontWeight: 550,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Senior Paralegal Casework Hub →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectRole("client_applicant")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0D6866",
                    fontWeight: 550,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Client &amp; Applicant Portal →
                </button>
              </li>
              <li style={{ marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={onOpenApp}
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Launch Full Sandbox
                </button>
              </li>
            </ul>
          </div>

          {/* Technical Specs */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Platform Reliability
            </div>
            <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#176B50" }} />
                <span style={{ fontWeight: 600, color: "#063C3D" }}>Python FastAPI &amp; PostgreSQL</span>
              </div>
              <div>Multi-tenant schema boundaries with strict row-level isolation.</div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#6E7F7C" }}>
                Canonical domain: <strong>thedocumento.com</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div
          style={{
            borderTop: "1px solid #DCE5E1",
            paddingTop: "24px",
            marginBottom: "24px",
            fontSize: "12px",
            color: "#6E7F7C",
            lineHeight: 1.6,
          }}
        >
          <strong>Legal Disclaimer:</strong> Documento is immigration case management and evidence intelligence technology. Documento is not an immigration law firm, does not provide legal advice, and is not affiliated with or endorsed by USCIS, the U.S. Department of Homeland Security, the Department of State, or any other government authority. Consequential legal conclusions and petition filings require the evaluation and signature of a licensed immigration attorney or accredited representative.
        </div>

        {/* Bottom Copyright */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "13px",
            color: "#6E7F7C",
          }}
        >
          <div>
            © {currentYear} Documento. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <span>Design System: Documento Light</span>
            <span>•</span>
            <span>WCAG 2.2 AA Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
