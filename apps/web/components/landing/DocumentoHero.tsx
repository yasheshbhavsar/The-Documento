"use client";

import React, { useState } from "react";

interface DocumentoHeroProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoHero({ onOpenLogin }: DocumentoHeroProps) {
  return (
    <section
      id="hero"
      suppressHydrationWarning
      style={{
        position: "relative",
        padding: "72px 24px 80px 24px",
        background: "linear-gradient(180deg, #F8F7F2 0%, #FFFFFF 100%)",
        borderBottom: "1px solid #DCE5E1",
        overflow: "hidden",
      }}
    >
      {/* Organic decorative ambient glows in pale seafoam & mint */}
      <div
        suppressHydrationWarning
        style={{
          position: "absolute",
          top: "-15%",
          right: "5%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(185, 222, 212, 0.35) 0%, rgba(221, 239, 232, 0.1) 60%, transparent 80%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        suppressHydrationWarning
        style={{
          position: "absolute",
          top: "20%",
          left: "-10%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(221, 239, 232, 0.45) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      <div
        suppressHydrationWarning
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="animate-on-scroll" suppressHydrationWarning style={{ maxWidth: "880px", margin: "0 auto", textAlign: "center" }}>
          {/* Eyebrow Badge */}
          <div
            className="documento-hero-badge"
            suppressHydrationWarning
          >
            <span
              className="documento-hero-badge-dot"
              suppressHydrationWarning
            />
            <span>Immigration Case Management &amp; Evidence Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 64px)",
              fontWeight: 750,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "#063C3D",
              margin: "0 0 24px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Every immigration case.
            <br />
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontWeight: 400,
                fontStyle: "italic",
                color: "#0D6866",
              }}
            >
              Clearer by design.
            </span>
          </h1>

          {/* Subheading emphasizing reduced administrative burden, organized evidence, and coordination */}
          <p
            style={{
              fontSize: "clamp(16px, 2.2vw, 20px)",
              lineHeight: 1.6,
              color: "#445451",
              margin: "0 auto 36px auto",
              maxWidth: "760px",
              fontWeight: 400,
            }}
          >
            Eliminate administrative paperwork chaos. Documento organizes evidentiary exhibits, maps statutory requirements, tracks procedural filing clocks, and unifies applicants with their legal counsel in one transparent workspace.
          </p>

          {/* Prominent Primary Calls to Action */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => onOpenLogin("firm")}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                border: "1px solid #063C3D",
                padding: "14px 28px",
                borderRadius: "10px",
                fontWeight: 650,
                fontSize: "16px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 4px 14px rgba(13, 104, 102, 0.25)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#063C3D";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 60, 61, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0D6866";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(13, 104, 102, 0.25)";
              }}
            >
              <span>Get Started</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <a
              href="#workflow"
              style={{
                background: "#FFFFFF",
                color: "#063C3D",
                border: "1px solid #DCE5E1",
                padding: "14px 24px",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "16px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 4px rgba(6, 60, 61, 0.04)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0D6866";
                e.currentTarget.style.background = "#F8F7F2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#DCE5E1";
                e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="#0D6866" stroke="none" />
              </svg>
              <span>Explore How It Works</span>
            </a>

            <a
              href="#preview"
              style={{
                background: "transparent",
                color: "#0D6866",
                border: "1px solid transparent",
                padding: "14px 20px",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "15px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DDEFE8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span>Test Interactive Demo ↓</span>
            </a>
          </div>

          {/* Quick Scope & Trust Verification Bar */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "16px",
              fontSize: "13px",
              color: "#6E7F7C",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>3 Verified Jurisdictions</strong> (US, UK, Canada)</span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>6 Operational Pathways</strong></span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>100% SHA-256 Provenance</strong></span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>Mandatory Attorney Sign-Off</strong></span>
            </div>
          </div>
        </div>

        {/* Hero Visual Banner: 3 Core Pillars */}
        <div
          style={{
            marginTop: "52px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Card 1 */}
          <a
            href="#preview"
            className="animate-on-scroll delay-100"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                100% Provenance Tracking
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                Every data extraction and timeline fact is anchored to exact source exhibit pages with cryptographic SHA-256 hashes.
              </div>
            </div>
          </a>

          {/* Card 2 */}
          <a
            href="#coverage"
            className="animate-on-scroll delay-200"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                Versioned Statutory Rules
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                Evaluate evidence against authoritative USCIS policy memos, statutory criteria, and filing guidelines with audit diffs.
              </div>
            </div>
          </a>

          {/* Card 3 */}
          <a
            href="#trust"
            className="animate-on-scroll delay-300"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                Accountable Attorney Review
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                AI findings serve as assistive suggestions. Consequential petition filings require licensed attorney adjudication.
              </div>
            </div>
          </a>
        </div>

        {/* Interactive Live AI Dossier Showcase */}
        <div
          className="animate-on-scroll delay-300 glass-panel"
          style={{
            marginTop: "36px",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid rgba(185, 222, 212, 0.8)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "18px",
              borderBottom: "1px solid #DCE5E1",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#176B50",
                }}
                className="status-dot-pulse"
              />
              <span style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                Live Verification Radar: Canadian Super Visa Dossier
              </span>
              <span
                style={{
                  background: "#DDEFE8",
                  color: "#063C3D",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                Applicant: PANKAJ KALIDAS PATEL
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6E7F7C" }}>
              <span style={{ color: "#176B50", fontWeight: 650 }}>16/16 Files Verified</span>
              <span>•</span>
              <span>100% Field Precision</span>
              <span>•</span>
              <span style={{ color: "#0D6866", fontWeight: 600 }}>SHA-256 Provenance</span>
            </div>
          </div>

          <LiveDossierHeroDemo onOpenLogin={onOpenLogin} />
        </div>
      </div>
    </section>
  );
}

const DOSSIER_DEMO_ITEMS = [
  {
    id: "imm5257",
    filename: "0. IMM5257e - Application for Visitor Visa",
    tag: "IRCC XFA Form",
    category: "Government Forms & Correspondence",
    conf: "0.99",
    source: "Adobe LiveCycle XFA XML Dataset",
    hash: "sha256:7f8a91c2...b42e90",
    fields: [
      { label: "Unique Client Identifier (UCI)", value: "1113386574", conf: 0.99, tag: "AcroForm XFA" },
      { label: "Available Funds (CAD)", value: "$20,000 CAD", conf: 0.99, tag: "Liquidity Check" },
      { label: "Prior Visa Refusal Disclosure", value: "Declared: 2023 Study Visa Refusal", conf: 0.98, tag: "Statutory Admissibility" },
      { label: "Principal Applicant", value: "Pankaj Kalidas Patel", conf: 0.98, tag: "Biographic Match" },
    ],
  },
  {
    id: "medical",
    filename: "11. PROOF OF UPFRONT MEDICAL",
    tag: "Apollo Hospitals",
    category: "Police and Medical Documents",
    conf: "0.99",
    source: "RapidOCR Neural Layout Engine (150 DPI)",
    hash: "sha256:9e3c11da...884fc1",
    fields: [
      { label: "Upfront Medical Identifier (UMI)", value: "U012019036", conf: 0.98, tag: "eMedical Record" },
      { label: "Immigration Medical Exam (IME)", value: "22007306", conf: 0.98, tag: "IRCC Verified" },
      { label: "Medical Examiner Doctor", value: "Dr. Dhiraj Saxena", conf: 0.96, tag: "Panel Physician" },
      { label: "Medical Examination Date", value: "2025-04-29", conf: 0.98, tag: "Validity 12mo" },
    ],
  },
  {
    id: "finance",
    filename: "6. PROOF OF FINANCIAL SUPPORT - CA Net Worth",
    tag: "Net Worth Valuation",
    category: "Financial Evidence & Forensics",
    conf: "0.99",
    source: "Financial Forensics & Property Parser",
    hash: "sha256:3a4b5c77...771ad2",
    fields: [
      { label: "CA Certified Total Net Worth (INR)", value: "Rs. 1,69,45,000/-", conf: 0.98, tag: "Liquid + Immovable" },
      { label: "CA Certified Total Net Worth (CAD)", value: "CAD $260,692", conf: 0.98, tag: "LICO Met (382%)" },
      { label: "Chartered Accountant Firm", value: "JAISHIL PATEL & CO", conf: 0.95, tag: "ICAI Registered" },
      { label: "CA Unique Document Identification (UDIN)", value: "25137580BMUOISI831", conf: 0.99, tag: "ICAI Portal Verified" },
    ],
  },
  {
    id: "insurance",
    filename: "12. CLIENT INFORMATION - Super Visa Insurance",
    tag: "Manulife Super Visa",
    category: "Insurance & Accommodation Evidence",
    conf: "0.99",
    source: "Statutory Insurance Policy Inspector",
    hash: "sha256:1d2e3f44...990b7a",
    fields: [
      { label: "Insurance Provider", value: "Manulife Financial", conf: 0.95, tag: "Approved Canadian Underwriter" },
      { label: "Insurance Policy Number", value: "CMX217018133", conf: 0.98, tag: "Policy Bound" },
      { label: "Coverage Amount", value: "$100,000 USD / CAD", conf: 0.98, tag: "IRCC Super Visa Compliant" },
      { label: "Insurance Deductible", value: "$0.00 (Nil)", conf: 0.95, tag: "Zero Out-of-Pocket" },
    ],
  },
];

function LiveDossierHeroDemo({ onOpenLogin }: { onOpenLogin: (portal?: "firm" | "client") => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeDoc = DOSSIER_DEMO_ITEMS[selectedIdx];

  return (
    <div>
      {/* Exhibit selector tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "12px",
          marginBottom: "14px",
        }}
      >
        {DOSSIER_DEMO_ITEMS.map((item, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              style={{
                background: isSelected ? "#0D6866" : "#FFFFFF",
                color: isSelected ? "#FFFFFF" : "#063C3D",
                border: isSelected ? "1px solid #063C3D" : "1px solid #DCE5E1",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.18s ease",
                boxShadow: isSelected ? "0 4px 12px rgba(13, 104, 102, 0.22)" : "0 1px 2px rgba(6, 60, 61, 0.03)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isSelected ? "#2A9288" : "#B9DED4",
                }}
              />
              <span>{item.tag}</span>
            </button>
          );
        })}
      </div>

      {/* Main split-view showcase card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "14px",
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          boxShadow: "0 4px 16px rgba(6, 60, 61, 0.04)",
        }}
      >
        {/* Left Side: Document Metadata & Classification */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span
                style={{
                  background: "#EAF6F0",
                  color: "#176B50",
                  padding: "3px 9px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "1px solid #B9DED4",
                }}
              >
                CONFIDENCE: {activeDoc.conf} (Match)
              </span>
              <span style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "monospace" }}>
                {activeDoc.hash}
              </span>
            </div>

            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0" }}>
              {activeDoc.filename}
            </h3>
            <p style={{ fontSize: "13px", color: "#445451", margin: "0 0 14px 0" }}>
              Category: <strong>{activeDoc.category}</strong>
            </p>

            <div
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "12px",
                color: "#445451",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                Extraction Method: {activeDoc.source}
              </div>
              <div style={{ color: "#6E7F7C" }}>
                Extracted with zero manual entry, anchored to page geometry with tamper-evident audit trail.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            className="hover-lift"
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(13, 104, 102, 0.25)",
            }}
          >
            <span>Open in Full Legal AI Dossier Workbench</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Right Side: Structured Fields Verified */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#6E7F7C", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Extracted Structured Entities ({activeDoc.fields.length})
          </div>

          {activeDoc.fields.map((field) => (
            <div
              key={field.label}
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0D6866";
                e.currentTarget.style.background = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#DCE5E1";
                e.currentTarget.style.background = "#F8F7F2";
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 550, marginBottom: "2px" }}>
                  {field.label}
                </div>
                <div style={{ fontSize: "13px", color: "#063C3D", fontWeight: 700 }}>
                  {field.value}
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span
                  style={{
                    background: "#DDEFE8",
                    color: "#063C3D",
                    fontSize: "11px",
                    fontWeight: 650,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {field.tag}
                </span>
                <div style={{ fontSize: "10px", color: "#176B50", fontWeight: 600, marginTop: "2px" }}>
                  ✓ {(field.conf * 100).toFixed(0)}% Conf
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

