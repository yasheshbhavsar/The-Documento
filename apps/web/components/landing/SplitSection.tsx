"use client";

import React from "react";

export interface SplitSectionProps {
  id?: string;
  eyebrow?: string;
  heading: React.ReactNode;
  description?: React.ReactNode;
  leftAddon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  borderBottom?: boolean;
}

/**
 * SplitSection
 * Reusable Minimalist Left/Right Layout from Documento Section Design Guide:
 * - Desktop: Max-width ~1280px, 1/3 Left Column, 2/3 Right Column, 56px gap
 * - Mobile/Tablet (<=1024px): Stacks cleanly with proper reading order
 * - Fine vertical hairline separator
 */
export function SplitSection({
  id,
  eyebrow,
  heading,
  description,
  leftAddon,
  children,
  className = "",
  style,
  borderBottom = true,
}: SplitSectionProps) {
  return (
    <section
      id={id}
      className={`relative w-full ${className}`}
      style={{
        padding: "88px 24px",
        scrollMarginTop: "80px",
        borderBottom: borderBottom ? "1px solid #DCE7E3" : "none",
        ...style,
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
        {/* LEFT COLUMN: ~1/3 (4 cols on desktop, 12 on mobile) */}
        <div
          className="animate-on-scroll split-col-left"
          style={{
            gridColumn: "span 4",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            position: "sticky",
            top: "100px",
          }}
        >
          {eyebrow && (
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
              <span>{eyebrow}</span>
            </div>
          )}

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
            {heading}
          </h2>

          {description && (
            <div
              style={{
                fontSize: "15.5px",
                color: "#5D6E7F",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {description}
            </div>
          )}

          {leftAddon && (
            <div style={{ marginTop: "12px" }}>
              {leftAddon}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ~2/3 (8 cols on desktop, 12 on mobile) */}
        <div
          className="animate-on-scroll split-col-right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .split-col-left,
              .split-col-right {
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
