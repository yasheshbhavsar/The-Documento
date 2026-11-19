"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

interface CapabilityItem {
  id: string;
  title: string;
  description: string;
  tag: string;
}

const CORE_CAPABILITIES: CapabilityItem[] = [
  {
    id: "intake",
    title: "Intake & Organization",
    description: "Collect applicant and Canadian host/sponsor records in a centralized vault with multi-lingual intake and cryptographic audit stamping.",
    tag: "SHA-256 Provenance",
  },
  {
    id: "ocr",
    title: "OCR & Field Extraction",
    description: "Extract ICAO/Indian passport MRZ fields, CRA NOA Line 15000 income, WES ECAs, and IMM form fields automatically.",
    tag: "MRZ & RapidOCR Engine",
  },
  {
    id: "verification",
    title: "Cross-Document Verification",
    description: "Compare dates, NOC 2021 TEER duties, and personal history across IMM 5669 and employer letters to prevent IRCC PFLs.",
    tag: "Deterministic Audits",
  },
  {
    id: "mapping",
    title: "Requirements Mapping",
    description: "Map submitted documents directly against IRCC checklists, Super Visa LICO thresholds, PAL rules, and CRS/PNP criteria.",
    tag: "IRPA / IRPR Rulesets",
  },
  {
    id: "coordination",
    title: "Caseload Coordination",
    description: "Balance workflow across RCICs, immigration lawyers, and case managers with role-based permissions and strict ethical walls.",
    tag: "Ethical Wall RBAC",
  },
  {
    id: "assembly",
    title: "Package Assembly",
    description: "Generate structured CIC/IRCC 5-folder dossiers, sequential exhibit tabs, and validated IMM filing packages ready for sign-off.",
    tag: "IRCC 5-Folder Packaging",
  },
];

export function DocumentoTrust() {
  const [activePrincipleIdx, setActivePrincipleIdx] = useState<number>(0);
  const [activeCapabilityId, setActiveCapabilityId] = useState<string>("intake");
  const [activeViewMode, setActiveViewMode] = useState<"principles" | "capabilities">("principles");

  const principles = [
    {
      title: "Human-in-the-Loop Review",
      description:
        "Consequential IRCC filings, submission letters, and client applications require licensed RCIC or immigration attorney adjudication and authorization.",
      tag: "RCIC & Counsel Led",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
    },
    {
      title: "Evidence-Linked Findings",
      description:
        "Automated IRCC checks cite specific exhibit coordinates and page numbers, surfacing low-confidence indicators when text is ambiguous.",
      tag: "100% Cited",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      title: "Tenant & Role Isolation",
      description:
        "Internal firm strategies, Canadian sponsor CRA NOAs, and staff notes are separated by role-based permissions and privacy-shielded portals.",
      tag: "Ethical Wall",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: "Provenance & Audit Trails",
      description:
        "Uploaded IRCC exhibits and IMM form drafts are recorded with cryptographic SHA-256 verification and immutable activity timestamps.",
      tag: "SHA-256 Vault",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="trust-content"
      className="relative w-full"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "88px 24px",
        scrollMarginTop: "80px",
        background: "#F8FAF9",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <InteractiveSectionBackground variant="ambient-mesh" />
      {/* Anchor for #trust links */}
      <div id="trust" style={{ position: "relative", top: "-80px", visibility: "hidden" }} />
      {/* Anchor for #capabilities links */}
      <div id="capabilities" style={{ position: "relative", top: "-80px", visibility: "hidden" }} />
      <div id="capabilities-content" style={{ position: "relative", top: "-80px", visibility: "hidden" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto" }}>
        {/* Section Header */}
        <div
          className="animate-on-scroll section-header-reveal"
          data-motion="up"
          style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 44px auto" }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
              marginBottom: "12px",
            }}
          >
            Governance &amp; Safeguards
          </div>

          <h2
            style={{
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.14,
              letterSpacing: "-0.03em",
              margin: "0 0 16px 0",
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
            }}
          >
            Built for qualified legal judgment, not unverified automation.
          </h2>

          <p
            style={{
              fontSize: "15.5px",
              color: "#475955",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "680px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Immigration casework demands accountable human oversight. Documento pairs verified operational capabilities with immutable governance guardrails.
          </p>

          {/* Segmented Mode Switcher */}
          <div
            className="animate-on-scroll"
            data-motion="scale"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#FFFFFF",
              padding: "4px",
              borderRadius: "8px",
              border: "1px solid #DCE5E1",
              marginTop: "24px",
              boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveViewMode("principles")}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                background: activeViewMode === "principles" ? "#07594F" : "transparent",
                color: activeViewMode === "principles" ? "#FFFFFF" : "#526663",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              4 Core Trust Principles
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode("capabilities")}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                background: activeViewMode === "capabilities" ? "#07594F" : "transparent",
                color: activeViewMode === "capabilities" ? "#FFFFFF" : "#526663",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              6 Core Platform Capabilities
            </button>
          </div>
        </div>

        {/* View Mode 1: Trust Principles & Operational Boundaries */}
        {activeViewMode === "principles" && (
          <div>
            {/* 4 Interactive Trust Principle Cards Grid */}
            <div
              className="stagger-children animate-on-scroll"
              data-motion="scale"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
                marginBottom: "28px",
              }}
            >
              {principles.map((p, idx) => {
                const isSelected = activePrincipleIdx === idx;
                return (
                  <button
                    key={p.title}
                    id={`principle-row-${idx}`}
                    type="button"
                    className="hover-lift spotlight-card"
                    onClick={() => setActivePrincipleIdx(idx)}
                    style={{
                      background: "#FFFFFF",
                      border: isSelected ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "24px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "16px",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected
                        ? "0 8px 24px -8px rgba(13, 104, 102, 0.1)"
                        : "0 2px 10px rgba(6, 60, 61, 0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "#EAF5EF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#07594F",
                        }}
                      >
                        {p.icon}
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#07594F",
                          background: "#EAF5EF",
                          padding: "3px 9px",
                          borderRadius: "4px",
                          border: "1px solid #B9DED4",
                        }}
                      >
                        {p.tag}
                      </span>
                    </div>

                    <div>
                      <h3
                        style={{
                          fontSize: "16.5px",
                          fontWeight: 700,
                          color: "#063C3D",
                          margin: "0 0 6px 0",
                          fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                        }}
                      >
                        {p.title}
                      </h3>
                      <p style={{ fontSize: "13.5px", color: "#475955", lineHeight: 1.55, margin: 0 }}>
                        {p.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Operational Boundaries Matrix */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px",
                marginBottom: "28px",
              }}
            >
              {/* Helps With */}
              <div
                className="animate-on-scroll hover-lift spotlight-card"
                data-motion="left"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #DCE5E1",
                  padding: "28px",
                  boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#169B77" }} />
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                    Documento helps with
                  </span>
                </div>

                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13.5px", color: "#475955", lineHeight: 1.55 }}>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Document organization:</strong> Structuring client records and exhibits in an audited repository.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Administrative checks:</strong> Verifying completeness against published criteria and identifying missing items.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Source-linked discrepancy flags:</strong> Highlighting date, name, or employer variances across exhibits for human review.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Workflow transparency:</strong> Providing clear status tracking and waiting-state visibility between teams and applicants.</span>
                  </li>
                </ul>
              </div>

              {/* Does Not Do */}
              <div
                className="animate-on-scroll hover-lift spotlight-card"
                data-motion="right"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #DCE5E1",
                  padding: "28px",
                  boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C0392B" }} />
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                    Documento does not do
                  </span>
                </div>

                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13.5px", color: "#475955", lineHeight: 1.55 }}>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#C0392B", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Replace legal professionals:</strong> Software cannot substitute for the legal analysis, strategy, and advice of licensed counsel.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#C0392B", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Guarantee immigration outcomes:</strong> No petition approval, expedite request, or visa issuance can ever be guaranteed.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#C0392B", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Make final legal determinations:</strong> AI suggestions are unadjudicated findings that require attorney verification.</span>
                  </li>
                  <li style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: "#C0392B", fontWeight: 700 }}>•</span>
                    <span><strong style={{ color: "#063C3D" }}>Claim government endorsement:</strong> Documento is independent software not affiliated with or endorsed by any immigration authority.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 2: 6 Core Platform Capabilities */}
        {activeViewMode === "capabilities" && (
          <div
            className="stagger-children animate-on-scroll"
            data-motion="scale"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
              marginBottom: "28px",
            }}
          >
            {CORE_CAPABILITIES.map((cap) => {
              const isSelected = activeCapabilityId === cap.id;
              return (
                <div
                  key={cap.id}
                  className="hover-lift spotlight-card"
                  onClick={() => setActiveCapabilityId(cap.id)}
                  style={{
                    padding: "24px",
                    borderRadius: "12px",
                    background: "#FFFFFF",
                    border: isSelected ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#07594F",
                        background: "#EAF5EF",
                        padding: "3px 10px",
                        borderRadius: "4px",
                        marginBottom: "10px",
                        border: "1px solid #B9DED4",
                      }}
                    >
                      {cap.tag}
                    </span>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D", marginBottom: "6px", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      {cap.title}
                    </div>
                    <p style={{ fontSize: "13.5px", color: "#475955", lineHeight: 1.55, margin: 0 }}>
                      {cap.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legal Disclaimer Footer Bar */}
        <div
          className="animate-on-scroll spotlight-card"
          data-motion="up"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "18px 24px",
            fontSize: "12.5px",
            color: "#475955",
            lineHeight: 1.6,
          }}
        >
          <span style={{ fontWeight: 700, color: "#063C3D" }}>
            Legal Safeguards &amp; Regulatory Boundaries:
          </span>{" "}
          Documento is an immigration casework and evidence intelligence platform, not a law firm or regulated immigration consultancy. Documento does not provide legal representation, statutory interpretation, or legal advice, and is not affiliated with IRCC, USCIS, UKVI, or any government body. Consequential legal conclusions, submission letters, and final case authorization strictly require the evaluation and signature of a licensed Regulated Canadian Immigration Consultant (RCIC), immigration lawyer, or accredited representative.
        </div>
      </div>
    </section>
  );
}

export default DocumentoTrust;
