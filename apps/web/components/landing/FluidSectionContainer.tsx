"use client";

import React, { useEffect, useRef, useState } from "react";
import FluidSpatialCanvas from "./FluidSpatialCanvas";
import WaveLettering from "../ui/WaveLettering";

export interface FluidSectionContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function FluidSectionContainer({
  children,
  className = "",
}: FluidSectionContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalScrollable = rect.height - windowHeight;

      if (totalScrollable <= 0) {
        setScrollProgress(0);
        return;
      }

      // Calculate progress from 0 (when top of container enters view) to 1 (when bottom reaches view)
      const current = -rect.top;
      const progress = Math.max(0, Math.min(1, current / totalScrollable));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ backgroundColor: "#ffffff" }}
    >
      {/* 
        Sticky Viewport 3D Canvas:
        Stays locked in place across all sections between Hero and Footer.
        Scroll progress seamlessly rotates and curves the 3D fluid particle vortex and wave.
      */}
      <div
        className="sticky top-0 h-screen w-full pointer-events-none overflow-hidden select-none"
        style={{
          zIndex: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          willChange: "transform",
        }}
        aria-hidden="true"
      >
        {/* Layer 1: Ambient 3D Wave Lettering (subtle binary texture) */}
        <div className="absolute inset-0 opacity-40">
          <WaveLettering
            text="011001000110111101100011011101010110110101100101011011100111010001101111"
            colors={["#0d6866", "#0d6967"]}
            backgroundColor="#ffffff"
            glyphSize={11}
            rows={40}
            direction={75}
            hoverFocus={false}
            depthOfField={0.25}
            strumStrength={1.2}
            tension={1.5}
            className="w-full h-full"
          />
        </div>

        {/* Layer 2: Spatial 3D Fluid Particle Vortex (Vexel-inspired spatial fluidity in light theme) */}
        <div className="absolute inset-0">
          <FluidSpatialCanvas scrollProgress={scrollProgress} />
        </div>
      </div>

      {/* 
        Foreground Interactive Sections:
        Positioned relative with negative margin top to overlay the sticky background seamlessly.
      */}
      <div
        className="relative z-10 w-full"
        style={{
          marginTop: "-100vh",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default FluidSectionContainer;
