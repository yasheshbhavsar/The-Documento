"use client";

import React from "react";

export function SectionWaveBackground({
  children,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative w-full ${className}`}
      style={{ backgroundColor: "#ffffff", ...style }}
    >
      {/* Foreground Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export default SectionWaveBackground;
