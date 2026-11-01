"use client";

import React, { useEffect, useRef, useState } from "react";

export type SectionBgVariant =
  | "dot-matrix"
  | "architectural-grid"
  | "ambient-mesh"
  | "cta-dot-wave";

export interface InteractiveSectionBackgroundProps {
  variant: SectionBgVariant;
  className?: string;
}

/**
 * Full-bleed 60fps interactive section background system.
 * Covers 100% of the section width (left edge to right edge across ultrawide viewports)
 * and height using ResizeObserver + HTML5 Canvas for all variants:
 * - "dot-matrix": Cursor-reactive halftone dot matrix with undulating wave ripples
 * - "architectural-grid": Full-width precision grid with glowing emerald data pulses & interactive nodes
 * - "ambient-mesh": Full-width interactive crosshair constellation & cursor spotlight field
 * - "cta-dot-wave": Dark-emerald 3D undulating dot-wave matrix for the pre-footer CTA banner
 */
export function InteractiveSectionBackground({
  variant,
  className = "",
}: InteractiveSectionBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Track section visibility for smooth cross-fade and rAF suspension off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.01, rootMargin: "200px 0px 200px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track cursor & scroll progress for CSS spotlight layers
  useEffect(() => {
    const container = containerRef.current;
    const parent = container?.parentElement;
    if (!container || !parent || typeof window === "undefined") return;

    let rafId: number | null = null;
    let targetX = parent.clientWidth * 0.5;
    let targetY = parent.clientHeight * 0.4;
    let currentX = targetX;
    let currentY = targetY;

    const updateSpotlight = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      container.style.setProperty("--bg-mouse-x", `${currentX.toFixed(1)}px`);
      container.style.setProperty("--bg-mouse-y", `${currentY.toFixed(1)}px`);
      if (
        Math.abs(targetX - currentX) > 0.5 ||
        Math.abs(targetY - currentY) > 0.5
      ) {
        rafId = requestAnimationFrame(updateSpotlight);
      } else {
        rafId = null;
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      if (rafId === null) {
        rafId = requestAnimationFrame(updateSpotlight);
      }
    };

    const handleScroll = () => {
      if (!isVisible) return;
      const rect = parent.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const progress = Math.max(
        0,
        Math.min(1, (vh - rect.top) / (vh + rect.height))
      );
      container.style.setProperty("--scroll-progress", progress.toFixed(3));
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [variant, isVisible]);

  // 60fps Full-Bleed HTML5 Canvas for ALL variants ("dot-matrix", "architectural-grid", "ambient-mesh", "cta-dot-wave")
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip canvas rendering in headless JSDOM test environments
    if (
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent || "")
    ) {
      return;
    }

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const parent = container?.parentElement;
    if (!canvas || !container || !parent) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId: number | null = null;

    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      active: false,
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const fullWidth = Math.max(
        rect.width,
        parent.offsetWidth,
        parent.clientWidth,
        1
      );
      const fullHeight = Math.max(
        rect.height,
        parent.offsetHeight,
        parent.clientHeight,
        1
      );
      width = Math.floor(fullWidth);
      height = Math.floor(fullHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(parent);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active =
        mouse.targetX >= -80 &&
        mouse.targetX <= width + 80 &&
        mouse.targetY >= -80 &&
        mouse.targetY <= height + 80;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    parent.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    const startTime = performance.now();

    const renderFrame = (now: number) => {
      if (!ctx) return;
      const elapsed = (now - startTime) * 0.001;

      // Smooth cursor interpolation
      if (mouse.active) {
        if (mouse.x < -1000) {
          mouse.x = mouse.targetX;
          mouse.y = mouse.targetY;
        } else {
          mouse.x += (mouse.targetX - mouse.x) * 0.16;
          mouse.y += (mouse.targetY - mouse.y) * 0.16;
        }
      } else {
        mouse.x += (-9999 - mouse.x) * 0.08;
        mouse.y += (-9999 - mouse.y) * 0.08;
      }

      ctx.clearRect(0, 0, width, height);

      if (variant === "cta-dot-wave") {
        const spacing = 18;
        const interactionRadius = 220;
        const cols = Math.ceil(width / spacing) + 1;
        const rows = Math.ceil(height / spacing) + 1;
        const offsetX = (width - (cols - 1) * spacing) * 0.5;
        const offsetY = (height - (rows - 1) * spacing) * 0.5;

        for (let r = 0; r < rows; r++) {
          const baseY = offsetY + r * spacing;
          for (let c = 0; c < cols; c++) {
            const baseX = offsetX + c * spacing;
            const dx = mouse.x - baseX;
            const dy = mouse.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const proximity =
              dist < interactionRadius
                ? Math.pow(1 - dist / interactionRadius, 1.65)
                : 0;

            const wave = reducedMotion
              ? 0
              : Math.sin(c * 0.32 + elapsed * 2.2) *
                Math.cos(r * 0.28 + elapsed * 1.7);
            const waveShiftY = wave * 2.6 + proximity * -5.0;
            const radius = 1.25 + (wave + 1) * 0.35 + proximity * 2.4;
            const alpha = Math.min(
              0.94,
              0.18 + (wave + 1) * 0.08 + proximity * 0.68
            );

            ctx.beginPath();
            ctx.arc(baseX, baseY + waveShiftY, radius, 0, Math.PI * 2);
            if (proximity > 0.12) {
              ctx.fillStyle = `rgba(94, 234, 212, ${alpha.toFixed(3)})`;
            } else {
              ctx.fillStyle = `rgba(185, 222, 212, ${alpha.toFixed(3)})`;
            }
            ctx.fill();
          }
        }
      } else if (variant === "dot-matrix") {
        const spacing = 24;
        const interactionRadius = 260;
        const cols = Math.ceil(width / spacing) + 1;
        const rows = Math.ceil(height / spacing) + 1;
        const offsetX = (width - (cols - 1) * spacing) * 0.5;
        const offsetY = (height - (rows - 1) * spacing) * 0.5;

        for (let r = 0; r < rows; r++) {
          const baseY = offsetY + r * spacing;
          const edgeFadeY = Math.min(
            1,
            Math.min(baseY / 48, (height - baseY) / 48)
          );
          for (let c = 0; c < cols; c++) {
            const baseX = offsetX + c * spacing;

            const dx = mouse.x - baseX;
            const dy = mouse.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const proximity =
              dist < interactionRadius
                ? Math.pow(1 - dist / interactionRadius, 1.6)
                : 0;

            // Continuous full-width wave across both left and right sides
            const ambientWave = reducedMotion
              ? 0.5
              : Math.sin(c * 0.22 + r * 0.18 + elapsed * 1.65) * 0.5 +
                Math.cos(c * 0.14 - elapsed * 1.1) * 0.25 +
                0.5;

            const pullX =
              proximity > 0 && dist > 1 ? (dx / dist) * proximity * 4.2 : 0;
            const pullY =
              proximity > 0 && dist > 1 ? (dy / dist) * proximity * 4.2 : 0;
            const waveOffsetY = reducedMotion
              ? 0
              : Math.sin(c * 0.25 + elapsed * 1.5) * 1.2;

            const radius = 1.25 + ambientWave * 0.35 + proximity * 2.35;
            const alpha =
              Math.max(0.08, edgeFadeY) *
              (0.17 + ambientWave * 0.065 + proximity * 0.52);

            ctx.beginPath();
            ctx.arc(
              baseX + pullX,
              baseY + pullY + waveOffsetY,
              radius,
              0,
              Math.PI * 2
            );
            if (proximity > 0.1) {
              ctx.fillStyle = `rgba(22, 155, 119, ${alpha.toFixed(3)})`;
            } else {
              ctx.fillStyle = `rgba(13, 104, 102, ${alpha.toFixed(3)})`;
            }
            ctx.fill();
          }
        }
      } else if (variant === "architectural-grid") {
        const gridSize = 48;
        const interactionRadius = 280;
        const cols = Math.ceil(width / gridSize) + 1;
        const rows = Math.ceil(height / gridSize) + 1;

        // 1. Draw full-width vertical & horizontal architectural grid lines
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(13, 104, 102, 0.065)";
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const x = c * gridSize + 0.5;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let r = 0; r <= rows; r++) {
          const y = r * gridSize + 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // 2. Draw animated glowing data-pulses traveling across full width (including right side)
        if (!reducedMotion && width > 0 && height > 0) {
          const hTracks = [
            Math.floor(rows * 0.22) * gridSize + 0.5,
            Math.floor(rows * 0.52) * gridSize + 0.5,
            Math.floor(rows * 0.78) * gridSize + 0.5,
          ];
          hTracks.forEach((y, idx) => {
            const speed = 160 + idx * 35;
            const pulseLen = 220;
            const dir = idx % 2 === 0 ? 1 : -1;
            const cycle = width + pulseLen * 2;
            const rawPos = ((elapsed * speed) % cycle) - pulseLen;
            const startX = dir === 1 ? rawPos : width - rawPos;
            const endX = startX + dir * pulseLen;

            const grad = ctx!.createLinearGradient(startX, y, endX, y);
            grad.addColorStop(0, "rgba(22, 155, 119, 0)");
            grad.addColorStop(0.5, "rgba(22, 155, 119, 0.55)");
            grad.addColorStop(1, "rgba(13, 104, 102, 0)");

            ctx!.strokeStyle = grad;
            ctx!.lineWidth = 1.8;
            ctx!.beginPath();
            ctx!.moveTo(startX, y);
            ctx!.lineTo(endX, y);
            ctx!.stroke();
          });

          const vTracks = [
            Math.floor(cols * 0.14) * gridSize + 0.5,
            Math.floor(cols * 0.5) * gridSize + 0.5,
            Math.floor(cols * 0.86) * gridSize + 0.5,
          ];
          vTracks.forEach((x, idx) => {
            const speed = 120 + idx * 28;
            const pulseLen = 180;
            const dir = idx % 2 === 0 ? 1 : -1;
            const cycle = height + pulseLen * 2;
            const rawPos = ((elapsed * speed) % cycle) - pulseLen;
            const startY = dir === 1 ? rawPos : height - rawPos;
            const endY = startY + dir * pulseLen;

            const grad = ctx!.createLinearGradient(x, startY, x, endY);
            grad.addColorStop(0, "rgba(13, 104, 102, 0)");
            grad.addColorStop(0.5, "rgba(22, 155, 119, 0.48)");
            grad.addColorStop(1, "rgba(13, 104, 102, 0)");

            ctx!.strokeStyle = grad;
            ctx!.lineWidth = 1.8;
            ctx!.beginPath();
            ctx!.moveTo(x, startY);
            ctx!.lineTo(x, endY);
            ctx!.stroke();
          });
        }

        // 3. Draw intersection nodes across full width with cursor reactivity
        for (let r = 0; r <= rows; r++) {
          const y = r * gridSize + 0.5;
          for (let c = 0; c <= cols; c++) {
            const x = c * gridSize + 0.5;
            const dx = mouse.x - x;
            const dy = mouse.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const proximity =
              dist < interactionRadius
                ? Math.pow(1 - dist / interactionRadius, 1.5)
                : 0;
            const pulse = reducedMotion
              ? 0.5
              : Math.sin(c * 0.4 + r * 0.35 + elapsed * 1.5) * 0.5 + 0.5;

            const radius = 1.2 + pulse * 0.35 + proximity * 2.4;
            const alpha = 0.14 + pulse * 0.06 + proximity * 0.55;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle =
              proximity > 0.1
                ? `rgba(22, 155, 119, ${alpha.toFixed(3)})`
                : `rgba(13, 104, 102, ${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }
      } else if (variant === "ambient-mesh") {
        // Full-width interactive crosshair & wave-dot constellation (covers 0 to 100vw evenly)
        const spacing = 36;
        const interactionRadius = 270;
        const cols = Math.ceil(width / spacing) + 1;
        const rows = Math.ceil(height / spacing) + 1;
        const offsetX = (width - (cols - 1) * spacing) * 0.5;
        const offsetY = (height - (rows - 1) * spacing) * 0.5;

        for (let r = 0; r < rows; r++) {
          const baseY = offsetY + r * spacing;
          for (let c = 0; c < cols; c++) {
            const baseX = offsetX + c * spacing;
            const dx = mouse.x - baseX;
            const dy = mouse.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const proximity =
              dist < interactionRadius
                ? Math.pow(1 - dist / interactionRadius, 1.55)
                : 0;

            const wave = reducedMotion
              ? 0.5
              : Math.sin(c * 0.28 - r * 0.22 + elapsed * 1.4) * 0.5 + 0.5;
            const driftX = reducedMotion
              ? 0
              : Math.cos(r * 0.3 + elapsed * 1.1) * 1.5;
            const driftY = reducedMotion
              ? 0
              : Math.sin(c * 0.3 + elapsed * 1.1) * 1.5;

            const x = baseX + driftX + (proximity > 0 && dist > 1 ? (dx / dist) * proximity * 3.8 : 0);
            const y = baseY + driftY + (proximity > 0 && dist > 1 ? (dy / dist) * proximity * 3.8 : 0);
            const alpha = 0.16 + wave * 0.07 + proximity * 0.52;

            // Every 3rd node renders a crisp architectural micro-crosshair; others render luminous dots
            if ((r + c) % 3 === 0) {
              const arm = 3.2 + proximity * 2.5;
              ctx.strokeStyle =
                proximity > 0.12
                  ? `rgba(22, 155, 119, ${alpha.toFixed(3)})`
                  : `rgba(13, 104, 102, ${alpha.toFixed(3)})`;
              ctx.lineWidth = 1.15;
              ctx.beginPath();
              ctx.moveTo(x - arm, y);
              ctx.lineTo(x + arm, y);
              ctx.moveTo(x, y - arm);
              ctx.lineTo(x, y + arm);
              ctx.stroke();
            } else {
              const radius = 1.2 + wave * 0.35 + proximity * 2.1;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fillStyle =
                proximity > 0.12
                  ? `rgba(22, 155, 119, ${alpha.toFixed(3)})`
                  : `rgba(13, 104, 102, ${alpha.toFixed(3)})`;
              ctx.fill();
            }
          }
        }
      }

      if (isVisible && !reducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    if (isVisible) {
      rafId = requestAnimationFrame(renderFrame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseleave", handleMouseLeave);
      if (resizeObserver) resizeObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [variant, isVisible]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`documento-interactive-bg documento-bg-${variant} ${
        isVisible ? "is-visible" : ""
      } ${className}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        maxWidth: "none",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 650ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {variant === "architectural-grid" && (
        <div className="documento-arch-grid-spotlight" />
      )}

      {variant === "ambient-mesh" && (
        <div className="documento-ambient-mesh-gradient" />
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

export default InteractiveSectionBackground;
