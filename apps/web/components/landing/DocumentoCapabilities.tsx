"use client";

import React, { useState } from "react";

interface CapabilityItem {
  id: string;
  title: string;
  description: string;
  tag: string;
  icon: React.ReactNode;
}

export function DocumentoCapabilities() {
  const [selectedId, setSelectedId] = useState<string>("intake");

  const capabilities: CapabilityItem[] = [
    {
      id: "intake",
      title: "Intake & Organization",
      description:
        "Collect and structure client evidence in a centralized repository with automated categorization and cryptographic audit stamping.",
      tag: "SHA-256 Provenance",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "ocr",
      title: "OCR & Field Extraction",
      description:
        "Extract dates, biographic details, and form fields directly from PDFs and scanned documents to eliminate manual transcription.",
      tag: "RapidOCR Engine",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: "verification",
      title: "Cross-Document Verification",
      description:
        "Compare dates, names, and employer entities across multiple exhibits to identify conflicting facts before filing.",
      tag: "Deterministic Audits",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="m9 11 2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "mapping",
      title: "Requirements Mapping",
      description:
        "Map submitted documents directly against visa criteria and jurisdictional checklists with real-time gap analysis.",
      tag: "Statutory Rulesets",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "coordination",
      title: "Caseload Coordination",
      description:
        "Balance workflow across attorneys and paralegals with role-based permissions and strict ethical wall boundaries.",
      tag: "Ethical Wall RBAC",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "assembly",
      title: "Package Assembly",
      description:
        "Generate sequential exhibit tabs, tables of contents, and organized filing packages ready for final legal review.",
      tag: "Deterministic Indexing",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="capabilities"
      style={{
        padding: "88px 24px",
        scrollMarginTop: "80px",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "48px 56px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: ~1/3 */}
        <div
          className="animate-on-scroll cap-col-left"
          style={{
            gridColumn: "span 4",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            position: "sticky",
            top: "100px",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 650,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#169B77",
              }}
            />
            <span>Core Capabilities</span>
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: "clamp(28px, 3.2vw, 42px)",
              fontWeight: 700,
              color: "#073D40",
              lineHeight: 1.18,
              letterSpacing: "-0.025em",
              margin: 0,
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Engineered for high-volume legal precision.
          </h2>

          {/* Subheading */}
          <p
            style={{
              fontSize: "15.5px",
              color: "#5D6E7F",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Six core operational areas designed to organize evidence, extract key data, verify cross-document consistency, and assemble complete filing packages.
          </p>

          {/* Feature List Navigator */}
          <div
            role="navigation"
            aria-label="Capabilities Overview"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginTop: "8px",
              borderTop: "1px solid #DCE7E3",
              paddingTop: "14px",
            }}
          >
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 650,
                color: "#7B8E8B",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Operational Modules
            </div>

            {capabilities.map((cap) => {
              const isSelected = selectedId === cap.id;
              return (
                <button
                  key={cap.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(cap.id);
                    const el = document.getElementById(`cap-row-${cap.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    background: isSelected ? "#EAF5EF" : "transparent",
                    color: isSelected ? "#073D40" : "#5D6E7F",
                    border: "none",
                    borderLeft: isSelected ? "3px solid #169B77" : "3px solid transparent",
                    fontSize: "13.5px",
                    fontWeight: isSelected ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{cap.title}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: isSelected ? "#07594F" : "#7B8E8B",
                      fontWeight: 600,
                    }}
                  >
                    {cap.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Clean open rows separated by hairlines) */}
        <div
          className="animate-on-scroll delay-150 cap-col-right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            borderTop: "1px solid #DCE7E3",
          }}
        >
          {capabilities.map((cap) => {
            const isSelected = selectedId === cap.id;
            return (
              <div
                key={cap.id}
                id={`cap-row-${cap.id}`}
                onClick={() => setSelectedId(cap.id)}
                style={{
                  padding: "24px 0",
                  borderBottom: "1px solid #DCE7E3",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  background: isSelected ? "rgba(234, 245, 239, 0.3)" : "transparent",
                  transition: "background-color 0.15s ease",
                  cursor: "pointer",
                }}
              >
                {/* Icon in soft mint badge */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#EAF5EF",
                    border: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {cap.icon}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <h3
                      style={{
                        fontSize: "17.5px",
                        fontWeight: 700,
                        color: "#073D40",
                        margin: 0,
                      }}
                    >
                      {cap.title}
                    </h3>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 650,
                        color: "#07594F",
                        background: "#EAF5EF",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {cap.tag}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "#5D6E7F",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {cap.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .cap-col-left,
              .cap-col-right {
                grid-column: span 12 !important;
                position: static !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}
