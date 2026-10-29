"use client";

import React from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import GradientWaves from "../ui/GradientWaves";

interface DocumentoFooterProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoFooter({ onOpenLogin }: DocumentoFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #063C3D 0%, #032525 100%)",
        borderTop: "1px solid rgba(185, 222, 212, 0.22)",
        padding: "72px 24px 44px 24px",
        overflow: "hidden",
        color: "#FFFFFF",
      }}
    >
      {/* Background Gradient Waves Animation - Balanced Luxury Silk Motion */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "auto",
        }}
      >
        <GradientWaves
          horizonColor="#022121"
          waveColor="#074e4c"
          crestColor="#2dd4bf"
          speed={0.22}
          amplitude={2.0}
          relief={0.75}
          sheen={0.25}
          brightness={0.92}
          lightAngle={150}
          height={5.6}
          tilt={64}
          waveScale={0.65}
          waveRatio={1.15}
          swell={12}
          turbulence={10}
          fogDepth={16}
          mouseInteraction
          swellOnClick={false}
          lightMode={false}
        />
      </div>

      {/* Content Layer on Top */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
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
            <DocumentoLogo size="lg" showWordmark showDomain theme="dark" />
            <p
              style={{
                fontSize: "14px",
                color: "#E2F2ED",
                lineHeight: 1.6,
                margin: "18px 0 0 0",
                textShadow: "0 1px 4px rgba(0, 15, 15, 0.9), 0 2px 8px rgba(0, 10, 10, 0.8)",
              }}
            >
              Clarity through organized evidence, declarative statutory requirements, and unified case pipelines for immigration law firms and applicants.
            </p>
          </div>

          {/* Product & Explorers */}
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "16px",
                textShadow: "0 1px 4px rgba(0, 15, 15, 0.9)",
              }}
            >
              Explore Platform
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              {[
                { href: "#preview", label: "Interactive Case Preview" },
                { href: "#coverage", label: "Visa & Jurisdiction Coverage" },
                { href: "#comparison", label: "Problem vs. Solution Matrix" },
                { href: "#workflow", label: "6-Stage Casework Journey" },
                { href: "#pathway-finder", label: "Case Fit Matcher" },
                { href: "#capabilities", label: "Core Capabilities" },
                { href: "#faq", label: "Frequently Asked Questions" },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    style={{
                      color: "#E2F2ED",
                      fontWeight: 500,
                      textDecoration: "none",
                      textShadow: "0 1px 3px rgba(0, 15, 15, 0.95)",
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#E2F2ED")}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Secure Portals & Access */}
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "16px",
                textShadow: "0 1px 4px rgba(0, 15, 15, 0.9)",
              }}
            >
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
                    color: "#5EEAD4",
                    fontWeight: 650,
                    cursor: "pointer",
                    textAlign: "left",
                    textShadow: "0 1px 4px rgba(0, 15, 15, 0.95)",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#A7F3D0")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#5EEAD4")}
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
                    color: "#5EEAD4",
                    fontWeight: 650,
                    cursor: "pointer",
                    textAlign: "left",
                    textShadow: "0 1px 4px rgba(0, 15, 15, 0.95)",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#A7F3D0")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#5EEAD4")}
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
                    border: "1px solid rgba(52, 211, 153, 0.4)",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(13, 104, 102, 0.4)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#128280";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(52, 211, 153, 0.45)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#0D6866";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(13, 104, 102, 0.4)";
                  }}
                >
                  Launch Workspace
                </button>
              </li>
            </ul>
          </div>

          {/* Platform Security & Architecture */}
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "16px",
                textShadow: "0 1px 4px rgba(0, 15, 15, 0.9)",
              }}
            >
              Integrity &amp; Security
            </div>
            <div style={{ fontSize: "13px", color: "#E2F2ED", lineHeight: 1.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399" }} />
                <span style={{ fontWeight: 600, color: "#FFFFFF", textShadow: "0 1px 3px rgba(0, 15, 15, 0.95)" }}>100% SHA-256 Provenance</span>
              </div>
              <div style={{ textShadow: "0 1px 3px rgba(0, 15, 15, 0.9)" }}>
                Multi-tenant schema boundaries with strict row-level isolation.
              </div>
              <div style={{ marginTop: "8px", textShadow: "0 1px 3px rgba(0, 15, 15, 0.9)" }}>
                Encryption: TLS 1.3 in transit • AES-256 at rest.
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#B8E2D8", textShadow: "0 1px 3px rgba(0, 15, 15, 0.9)" }}>
                Canonical domain: <strong style={{ color: "#FFFFFF" }}>thedocumento.com</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Boundaries & Regulatory Disclaimer */}
        <div
          style={{
            background: "rgba(2, 26, 26, 0.45)",
            border: "1px solid rgba(52, 211, 153, 0.18)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
            fontSize: "12px",
            color: "#B8E2D8",
            lineHeight: 1.6,
            backdropFilter: "blur(4px)",
            textShadow: "0 1px 2px rgba(0, 10, 10, 0.8)",
          }}
        >
          <strong style={{ color: "#FFFFFF" }}>Legal Disclaimer:</strong> Documento is immigration casework and evidence intelligence software. Documento is not an immigration law firm, does not provide legal advice, representation, or opinions, and is not affiliated with or endorsed by USCIS, the Department of Homeland Security, the UK Home Office, IRCC, or any government authority. Immigration requirements differ by country, visa category, and individual circumstances; final adjudicative decisions rest solely with sovereign government authorities. Consequential petition filings require the evaluation and signature of a licensed immigration attorney or accredited representative.
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
            color: "#99C5BC",
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
