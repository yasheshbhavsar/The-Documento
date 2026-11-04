"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalculatorCountryId } from "../../lib/calculators/catalog";

export type CountryMatrixVariant = CalculatorCountryId | "explorer" | "usa";

export interface CountryDivisionMatrixProps {
  variant: CountryMatrixVariant;
  className?: string;
}

function buildMapleLeafPath(): Path2D {
  const p = new Path2D();
  const pts: Array<[number, number]> = [
    [0, -1.0],
    [0.17, -0.58],
    [0.41, -0.7],
    [0.31, -0.31],
    [0.67, -0.44],
    [0.6, -0.18],
    [0.95, -0.11],
    [0.65, 0.16],
    [0.74, 0.34],
    [0.21, 0.3],
    [0.08, 0.42],
    [0.1, 0.98],
    [-0.1, 0.98],
    [-0.08, 0.42],
    [-0.21, 0.3],
    [-0.74, 0.34],
    [-0.65, 0.16],
    [-0.95, -0.11],
    [-0.6, -0.18],
    [-0.67, -0.44],
    [-0.31, -0.31],
    [-0.41, -0.7],
    [-0.17, -0.58],
  ];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    p.lineTo(pts[i][0], pts[i][1]);
  }
  p.closePath();
  return p;
}

function buildStarPath(points: number, innerRatio: number): Path2D {
  const p = new Path2D();
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? 1.0 : innerRatio;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function buildSilverFernPath(): Path2D {
  const p = new Path2D();
  const pts: Array<[number, number]> = [
    [0, -1.0],
    [0.13, -0.68],
    [0.54, -0.8],
    [0.16, -0.44],
    [0.76, -0.52],
    [0.19, -0.14],
    [0.86, -0.18],
    [0.17, 0.22],
    [0.68, 0.22],
    [0.08, 0.56],
    [0.08, 0.98],
    [-0.08, 0.98],
    [-0.08, 0.56],
    [-0.68, 0.22],
    [-0.17, 0.22],
    [-0.86, -0.18],
    [-0.19, -0.14],
    [-0.76, -0.52],
    [-0.16, -0.44],
    [-0.54, -0.8],
    [-0.13, -0.68],
  ];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    p.lineTo(pts[i][0], pts[i][1]);
  }
  p.closePath();
  return p;
}

function buildHexagonPath(): Path2D {
  const p = new Path2D();
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/**
 * Dot-free, passport-watermark-inspired interactive sovereign motif matrix
 * rendered exclusively in the lower divisions of /calculators:
 * - "explorer": Cartographic meridian crosshairs + hollow diamonds
 * - "canada": Staggered 11-point Canadian Maple Leaf matrix
 * - "australia": 7-Point Commonwealth Federation Star + 4-point Southern Cross stars
 * - "new_zealand": Botanical Silver Fern fronds + 4-point Southern Cross stars
 * - "united_kingdom": Symmetrical Union 8-ray rosettes + heraldic diamonds
 * - "germany": Bauhaus precision hollow hexagons + drafting chevrons
 * - "usa": Classic 5-point stars + twin micro-stripes
 */
export function CountryDivisionMatrix({
  variant,
  className = "",
}: CountryDivisionMatrixProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

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
      { threshold: 0.01, rootMargin: "180px 0px 180px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    if (!canvas || !container || !parent || typeof Path2D === "undefined") {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const maplePath = buildMapleLeafPath();
    const star7Path = buildStarPath(7, 0.42);
    const star5Path = buildStarPath(5, 0.4);
    const star4Path = buildStarPath(4, 0.28);
    const fernPath = buildSilverFernPath();
    const hexPath = buildHexagonPath();

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
      width = Math.max(
        1,
        Math.floor(Math.max(rect.width, parent.offsetWidth, parent.clientWidth))
      );
      height = Math.max(
        1,
        Math.floor(Math.max(rect.height, parent.offsetHeight, parent.clientHeight))
      );
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
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(parent);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active =
        mouse.targetX >= -70 &&
        mouse.targetX <= width + 70 &&
        mouse.targetY >= -70 &&
        mouse.targetY <= height + 70;
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

    const getAccentRgb = (proximity: number): string => {
      if (proximity <= 0.08) return "13, 104, 102";
      switch (variant) {
        case "canada":
          return "168, 52, 58";
        case "australia":
          return "15, 118, 110";
        case "new_zealand":
          return "18, 134, 104";
        case "united_kingdom":
          return "28, 78, 118";
        case "germany":
          return "138, 92, 24";
        case "usa":
          return "30, 74, 118";
        default:
          return "22, 155, 119";
      }
    };

    const renderFrame = (now: number) => {
      if (!ctx) return;
      const elapsed = (now - startTime) * 0.001;

      if (mouse.active) {
        if (mouse.x < -1000) {
          mouse.x = mouse.targetX;
          mouse.y = mouse.targetY;
        } else {
          mouse.x += (mouse.targetX - mouse.x) * 0.15;
          mouse.y += (mouse.targetY - mouse.y) * 0.15;
        }
      } else {
        mouse.x += (-9999 - mouse.x) * 0.08;
        mouse.y += (-9999 - mouse.y) * 0.08;
      }

      ctx.clearRect(0, 0, width, height);

      const spacing = variant === "canada" ? 50 : 46;
      const interactionRadius = 210;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const offsetX = (width - (cols - 1) * spacing) * 0.5;
      const offsetY = (height - (rows - 1) * spacing) * 0.5;

      if (variant === "united_kingdom") {
        ctx.strokeStyle = "rgba(13, 104, 102, 0.025)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const diagStep = spacing * 2;
        for (let x = -height; x < width + height; x += diagStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + height, height);
          ctx.moveTo(x + height, 0);
          ctx.lineTo(x, height);
        }
        ctx.stroke();
      }

      for (let r = 0; r < rows; r++) {
        const baseY = offsetY + r * spacing;
        const edgeFadeY = Math.min(
          1,
          Math.max(0.18, Math.min(baseY / 34, (height - baseY) / 34))
        );

        for (let c = 0; c < cols; c++) {
          const staggerX =
            variant === "united_kingdom" || variant === "explorer"
              ? 0
              : (r % 2) * (spacing * 0.5);
          const baseX =
            offsetX + c * spacing + staggerX - (staggerX ? spacing * 0.25 : 0);

          const dx = mouse.x - baseX;
          const dy = mouse.y - baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity =
            dist < interactionRadius
              ? Math.pow(1 - dist / interactionRadius, 1.65)
              : 0;

          const wave = reducedMotion
            ? 0.5
            : Math.sin(c * 0.28 + r * 0.24 + elapsed * 1.1) * 0.5 + 0.5;

          const pullX =
            proximity > 0 && dist > 1 ? (dx / dist) * proximity * 2.8 : 0;
          const pullY =
            proximity > 0 && dist > 1 ? (dy / dist) * proximity * 2.8 : 0;
          const driftY = reducedMotion
            ? 0
            : Math.sin(c * 0.3 + r * 0.2 + elapsed * 1.0) * 0.85;

          const x = baseX + pullX;
          const y = baseY + pullY + driftY;
          const isPrimaryCell = (r + c) % 2 === 0;
          const rgb = getAccentRgb(proximity);

          const motifAlpha =
            edgeFadeY * (0.082 + wave * 0.024 + proximity * 0.175);
          const secondaryAlpha =
            edgeFadeY * (0.062 + wave * 0.02 + proximity * 0.135);

          if (variant === "canada") {
            // Pure staggered Maple Leaf watermark matrix (zero circular dots)
            const scale = (isPrimaryCell ? 6.4 : 4.4) + wave * 0.3 + proximity * 1.5;
            const rot = reducedMotion
              ? 0
              : Math.sin(c * 0.4 + r * 0.3 + elapsed * 0.85) * 0.08 +
              proximity * 0.07;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.scale(scale, scale);
            ctx.fillStyle = `rgba(${rgb}, ${(isPrimaryCell ? motifAlpha : secondaryAlpha).toFixed(3)})`;
            ctx.fill(maplePath);
            ctx.restore();
          } else if (variant === "australia") {
            if (isPrimaryCell) {
              const scale = 6.0 + wave * 0.3 + proximity * 1.5;
              const rot = reducedMotion
                ? 0
                : elapsed * 0.07 * ((r + c) % 4 === 0 ? 1 : -1);
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(rot);
              ctx.scale(scale, scale);
              ctx.fillStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.fill(star7Path);
              ctx.restore();
            } else {
              const s4 = 3.2 + proximity * 0.9;
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(s4, s4);
              ctx.fillStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.fill(star4Path);
              ctx.restore();
            }
          } else if (variant === "new_zealand") {
            if (isPrimaryCell) {
              const scale = 6.5 + wave * 0.3 + proximity * 1.55;
              const sway =
                -0.34 +
                (reducedMotion
                  ? 0
                  : Math.sin(c * 0.35 + elapsed * 0.95) * 0.07 + proximity * 0.07);
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(sway);
              ctx.scale(scale, scale);
              ctx.fillStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.fill(fernPath);
              ctx.restore();
            } else {
              const s4 = 3.3 + proximity * 0.95;
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(s4, s4);
              ctx.fillStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.fill(star4Path);
              ctx.restore();
            }
          } else if (variant === "united_kingdom") {
            if (isPrimaryCell) {
              const arm = 4.6 + proximity * 1.35;
              const diag = arm * 0.64;
              ctx.strokeStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.05;
              ctx.beginPath();
              ctx.moveTo(x - arm, y);
              ctx.lineTo(x + arm, y);
              ctx.moveTo(x, y - arm);
              ctx.lineTo(x, y + arm);
              ctx.moveTo(x - diag, y - diag);
              ctx.lineTo(x + diag, y + diag);
              ctx.moveTo(x + diag, y - diag);
              ctx.lineTo(x - diag, y + diag);
              ctx.stroke();
            } else {
              const d = 2.7 + proximity * 0.85;
              ctx.strokeStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(x, y - d);
              ctx.lineTo(x + d, y);
              ctx.lineTo(x, y + d);
              ctx.lineTo(x - d, y);
              ctx.closePath();
              ctx.stroke();
            }
          } else if (variant === "germany") {
            if (isPrimaryCell) {
              const scale = 5.5 + proximity * 1.35;
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(scale, scale);
              ctx.strokeStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.15 / scale;
              ctx.stroke(hexPath);
              ctx.restore();
            } else {
              const w = 3.3 + proximity * 0.85;
              const h = 2.1 + proximity * 0.6;
              ctx.strokeStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.05;
              ctx.beginPath();
              ctx.moveTo(x - w, y + h * 0.5);
              ctx.lineTo(x, y - h * 0.5);
              ctx.lineTo(x + w, y + h * 0.5);
              ctx.stroke();
            }
          } else if (variant === "usa") {
            if (isPrimaryCell) {
              const scale = 5.3 + proximity * 1.3;
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(scale, scale);
              ctx.fillStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.fill(star5Path);
              ctx.restore();
            } else {
              const barW = 3.2 + proximity * 0.8;
              ctx.strokeStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.lineWidth = 0.95;
              ctx.beginPath();
              ctx.moveTo(x - barW, y - 1.3);
              ctx.lineTo(x + barW, y - 1.3);
              ctx.moveTo(x - barW, y + 1.3);
              ctx.lineTo(x + barW, y + 1.3);
              ctx.stroke();
            }
          } else {
            // "explorer": Crisp meridian crosshairs + hollow diamonds (zero dots)
            if (isPrimaryCell) {
              const arm = 2.9 + proximity * 1.1;
              ctx.strokeStyle = `rgba(${rgb}, ${motifAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(x - arm, y);
              ctx.lineTo(x + arm, y);
              ctx.moveTo(x, y - arm);
              ctx.lineTo(x, y + arm);
              ctx.stroke();
            } else {
              const d = 2.2 + proximity * 0.75;
              ctx.strokeStyle = `rgba(${rgb}, ${secondaryAlpha.toFixed(3)})`;
              ctx.lineWidth = 0.95;
              ctx.beginPath();
              ctx.moveTo(x, y - d);
              ctx.lineTo(x + d, y);
              ctx.lineTo(x, y + d);
              ctx.lineTo(x - d, y);
              ctx.closePath();
              ctx.stroke();
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
      data-testid={`country-pattern-${variant}`}
      data-pattern-variant={variant}
      className={`country-division-matrix ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 500ms ease",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
