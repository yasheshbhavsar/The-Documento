"use client";

import React from "react";
import WaveLettering from "../ui/WaveLettering";

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
      className={`relative w-full overflow-hidden ${className}`}
      style={{ backgroundColor: "#ffffff", ...style }}
    >
      {/* Background WebGL WaveLettering Canvas */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden select-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <WaveLettering
          text="011001000110111101100011011101010110110101100101011011100111010001101111"
          colors={["#0d6866", "#0d6967"]}
          backgroundColor="#ffffff"
          glyphSize={11}
          rows={50}
          direction={75}
          hoverFocus={false}
          depthOfField={0.2}
          strumStrength={1.3}
          tension={1.55}
          className="w-full h-full"
        />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export default SectionWaveBackground;
