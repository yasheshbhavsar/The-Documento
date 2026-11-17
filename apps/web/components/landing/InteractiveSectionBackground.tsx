"use client";

import React from "react";

export type SectionBgVariant =
  | "dot-matrix"
  | "architectural-grid"
  | "ambient-mesh"
  | "cta-dot-wave";

export interface InteractiveSectionBackgroundProps {
  variant: SectionBgVariant;
  className?: string;
}

const VARIANT_STYLES: Record<SectionBgVariant, React.CSSProperties> = {
  "dot-matrix": {
    backgroundImage:
      "radial-gradient(rgba(13, 104, 102, 0.11) 1px, transparent 1px)",
    backgroundSize: "26px 26px",
  },
  "architectural-grid": {
    backgroundImage:
      "linear-gradient(to right, rgba(13, 104, 102, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(13, 104, 102, 0.045) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
  },
  "ambient-mesh": {
    background:
      "radial-gradient(ellipse 60% 50% at 18% 20%, rgba(221, 239, 232, 0.38), transparent 70%), radial-gradient(ellipse 55% 45% at 84% 75%, rgba(185, 222, 212, 0.28), transparent 70%)",
  },
  "cta-dot-wave": {
    backgroundImage:
      "radial-gradient(rgba(185, 222, 212, 0.18) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  },
};

/**
 * Lightweight, zero-JS static CSS architectural background.
 * Uses pure compositor-friendly CSS backgrounds with zero canvas loops or event listeners.
 */
export function InteractiveSectionBackground({
  variant,
  className = "",
}: InteractiveSectionBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`documento-interactive-bg documento-bg-${variant} ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        ...VARIANT_STYLES[variant],
      }}
    />
  );
}

export default InteractiveSectionBackground;
