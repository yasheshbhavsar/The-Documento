"use client";

import React from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";

interface DocumentoFooterProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoFooter({ onOpenLogin }: DocumentoFooterProps) {
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "36px",
            marginBottom: "48px",
          }}
        >
          {/* Brand & Mission */}
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
              Clarity through organized evidence, declarative statutory requirements, and unified case pipelines for immigration law firms and applicants.
            </p>
          </div>

          {/* Product & Explorers */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Explore Platform
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <li>
                <a href="#preview" style={{ color: "#445451", textDecoration: "none" }}>
                  Interactive Case Preview
                </a>
              </li>
              <li>
                <a href="#coverage" style={{ color: "#445451", textDecoration: "none" }}>
                  Visa &amp; Jurisdiction Coverage
                </a>
              </li>
              <li>
                <a href="#comparison" style={{ color: "#445451", textDecoration: "none" }}>
                  Problem vs. Solution Matrix
                </a>
              </li>
              <li>
                <a href="#workflow" style={{ color: "#445451", textDecoration: "none" }}>
                  6-Stage Casework Journey
                </a>
              </li>
              <li>
                <a href="#pathway-finder" style={{ color: "#445451", textDecoration: "none" }}>
                  Case Fit Matcher
                </a>
              </li>
              <li>
                <a href="#capabilities" style={{ color: "#445451", textDecoration: "none" }}>
                  Core Capabilities
                </a>
              </li>
              <li>
                <a href="#faq" style={{ color: "#445451", textDecoration: "none" }}>
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Secure Portals & Access */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Secure Portals
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin("firm")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0D6866",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Law Firm &amp; Attorney Sign In →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin("client")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0D6866",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Client &amp; Applicant Portal Sign In →
                </button>
              </li>
              <li style={{ marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => onOpenLogin("firm")}
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Launch Workspace
                </button>
              </li>
            </ul>
          </div>

          {/* Platform Security & Architecture */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "16px" }}>
              Integrity &amp; Security
            </div>
            <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#176B50" }} />
                <span style={{ fontWeight: 600, color: "#063C3D" }}>100% SHA-256 Provenance</span>
              </div>
              <div>Multi-tenant schema boundaries with strict row-level isolation.</div>
              <div style={{ marginTop: "8px" }}>
                Encryption: TLS 1.3 in transit • AES-256 at rest.
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#6E7F7C" }}>
                Canonical domain: <strong>thedocumento.com</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Boundaries & Regulatory Disclaimer */}
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
          <strong>Legal Disclaimer:</strong> Documento is immigration casework and evidence intelligence software. Documento is not an immigration law firm, does not provide legal advice, representation, or opinions, and is not affiliated with or endorsed by USCIS, the Department of Homeland Security, the UK Home Office, IRCC, or any government authority. Immigration requirements differ by country, visa category, and individual circumstances; final adjudicative decisions rest solely with sovereign government authorities. Consequential petition filings require the evaluation and signature of a licensed immigration attorney or accredited representative.
        </div>

        {/* Bottom Copyright & Standards */}
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
