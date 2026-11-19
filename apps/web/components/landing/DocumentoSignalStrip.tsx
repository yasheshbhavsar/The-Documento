"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

interface ArchitectureSignal {
  code: string;
  tag: string;
  title: string;
  detail: string;
  stat: string;
  standard: string;
}

const signals: ArchitectureSignal[] = [
  {
    code: "SEC-256",
    tag: "SHA-256 Provenance",
    title: "Evidence stays traceable",
    detail: "Source-linked IRCC exhibits anchored by cryptographic hashing and exact page coordinates.",
    stat: "100% Merkle Root Hashing",
    standard: "IRPA / IRPR Evidentiary Standard",
  },
  {
    code: "RBAC-W1",
    tag: "Ethical Wall RBAC",
    title: "Every role has a boundary",
    detail: "Isolated workspaces separating applicant & Canadian sponsor portals from internal firm strategy.",
    stat: "Quarantined Strategy Records",
    standard: "CICC Code of Conduct",
  },
  {
    code: "HIL-REV",
    tag: "RCIC & Counsel-Led",
    title: "People stay accountable",
    detail: "Licensed RCICs and immigration counsel retain non-delegable review over every finding and IRCC filing.",
    stat: "Mandatory Adjudication Gate",
    standard: "Non-Delegable Legal Review",
  },
];

export function DocumentoSignalStrip() {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  return (
    <section
      className="documento-signal-strip"
      aria-label="Documento product principles"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "64px 24px",
        background: "#F8FAF9",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <InteractiveSectionBackground variant="architectural-grid" />

      <div
        className="documento-signal-inner"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1240px",
          margin: "0 auto",
        }}
      >
        {/* Modern Minimal Section Header */}
        <div
          className="documento-signal-intro section-header-reveal animate-on-scroll"
          data-motion="left"
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#07594F",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Architecture Standard
          </div>

          <h2
            style={{
              fontSize: "clamp(24px, 2.6vw, 32px)",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              color: "#063C3D",
              margin: "0 0 12px 0",
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
            }}
          >
            Structure for the details.
            <br />
            Clarity for the decisions.
          </h2>

          <p
            style={{
              fontSize: "14px",
              color: "#526663",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "360px",
            }}
          >
            Three non-negotiable architectural guarantees governing every Canadian IRCC document upload, client-sponsor boundary, and representative authorization.
          </p>
        </div>

        {/* 3-Pillar Architectural Ledger */}
        <div
          className="documento-signal-items stagger-children animate-on-scroll"
          data-motion="right"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          {signals.map((signal, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <article
                className="documento-signal-item"
                key={signal.code}
                onClick={() => setActiveIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveIdx(idx);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                style={{
                  cursor: "pointer",
                  padding: "26px 24px",
                  borderRadius: "12px",
                  background: isSelected ? "#FFFFFF" : "#F4F8F6",
                  border: isSelected
                    ? "1px solid rgba(13, 104, 102, 0.4)"
                    : "1px solid #DCE7E3",
                  boxShadow: isSelected
                    ? "0 4px 16px -4px rgba(6, 60, 61, 0.06)"
                    : "none",
                  transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                  minHeight: "190px",
                }}
              >
                {/* Header Row: Standard Protocol Tag & Reference Code */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "14px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 650,
                        color: isSelected ? "#07594F" : "#526663",
                        background: isSelected ? "#EAF5EF" : "#EAEFEA",
                        padding: "3px 9px",
                        borderRadius: "6px",
                        letterSpacing: "0.02em",
                        transition: "all 160ms ease",
                      }}
                    >
                      {signal.tag}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: isSelected ? "#169B77" : "#7A8F8B",
                        letterSpacing: "0.04em",
                      }}
                    >
                      § {signal.code}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "16.5px",
                      fontWeight: 700,
                      color: "#063C3D",
                      letterSpacing: "-0.015em",
                      margin: "0 0 8px 0",
                      lineHeight: 1.3,
                      fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                    }}
                  >
                    {signal.title}
                  </h3>

                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#475955",
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {signal.detail}
                  </p>
                </div>

                {/* Bottom Proof Strip: Concrete Legal Standard */}
                <div
                  style={{
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(13, 104, 102, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "11px",
                  }}
                >
                  <span style={{ color: "#169B77", fontWeight: 650 }}>
                    {signal.stat}
                  </span>
                  <span style={{ color: "#6E7F7C", fontWeight: 500 }}>
                    {signal.standard}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DocumentoSignalStrip;
