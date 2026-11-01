"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

const signals = [
  {
    index: "01",
    tag: "SHA-256 Provenance",
    title: "Evidence stays traceable",
    detail: "Source-linked exhibits anchored by cryptographic hashing and exact page coordinates.",
  },
  {
    index: "02",
    tag: "Ethical Wall RBAC",
    title: "Every role has a boundary",
    detail: "Isolated workspaces separating client portals from internal firm strategy.",
  },
  {
    index: "03",
    tag: "Attorney-Led",
    title: "People stay accountable",
    detail: "Licensed counsel retain non-delegable review over every finding and filing.",
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
        padding: "44px 24px",
        background: "#FAFCFB",
        borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
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
        <div
          className="documento-signal-intro section-header-reveal animate-on-scroll"
          data-motion="left"
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "11.5px",
              fontWeight: 650,
              color: "#0D6866",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#169B77",
                display: "inline-block",
              }}
              className="status-dot-pulse"
            />
            Architecture Standard
          </span>
          <p
            style={{
              fontSize: "clamp(22px, 2.4vw, 28px)",
              fontWeight: 650,
              lineHeight: 1.2,
              letterSpacing: "-0.025em",
              color: "#063C3D",
              margin: 0,
            }}
          >
            Structure for the details.
            <br />
            <span style={{ color: "#0D6866", fontWeight: 500 }}>
              Clarity for the decisions.
            </span>
          </p>
        </div>

        <div
          className="documento-signal-items stagger-children animate-on-scroll"
          data-motion="right"
        >
          {signals.map((signal, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <article
                className="documento-signal-item spotlight-card hover-lift"
                key={signal.index}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => setActiveIdx(idx)}
                style={{
                  cursor: "pointer",
                  padding: "22px 24px",
                  borderRadius: "14px",
                  background: isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
                  border: isSelected
                    ? "1px solid rgba(13, 104, 102, 0.28)"
                    : "1px solid rgba(13, 104, 102, 0.1)",
                  boxShadow: isSelected
                    ? "0 16px 36px -12px rgba(6, 60, 61, 0.08)"
                    : "none",
                  transition: "all 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        color: isSelected ? "#07594F" : "#5D6E7F",
                        background: isSelected ? "#EAF5EF" : "#F2F7F5",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        transition: "all 200ms ease",
                      }}
                    >
                      {signal.tag}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: isSelected ? "#169B77" : "#94A8A4",
                        transition: "color 200ms ease",
                      }}
                    >
                      {/* taste-skill-ignore */}
                      {signal.index}
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: "16.5px",
                        fontWeight: 650,
                        color: "#063C3D",
                        letterSpacing: "-0.015em",
                        margin: "0 0 6px 0",
                      }}
                    >
                      {signal.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "13.5px",
                        color: "#526663",
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {signal.detail}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
