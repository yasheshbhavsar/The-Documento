"use client";

import React from "react";

/**
 * WaveBackground
 * Renders the Documento white canvas (#ffffff) wrapper.
 * Provides a calm, clean, distraction-free backdrop for all sections.
 */
export function WaveBackground({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        background: "#ffffff",
        color: "#172322",
        minHeight: "100%",
        ...style,
      }}
    >
      {/* Foreground Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
