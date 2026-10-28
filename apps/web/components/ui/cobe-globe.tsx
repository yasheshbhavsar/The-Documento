"use client";

import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";

export interface Marker {
  id: string;
  location: [number, number];
  label: string;
}

export interface Arc {
  id: string;
  from: [number, number];
  to: [number, number];
  label?: string;
}

export interface GlobeProps {
  markers?: Marker[];
  arcs?: Arc[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  arcColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  markerElevation?: number;
  arcWidth?: number;
  arcHeight?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
  opacity?: number;
  canvasOpacity?: number;
  showMarkerLabels?: boolean;
}

export function Globe({
  markers = [],
  arcs = [],
  className = "",
  markerColor = [0.051, 0.408, 0.400],
  baseColor = [0.051, 0.408, 0.400],
  arcColor = [0.051, 0.408, 0.400],
  glowColor = [0.74, 0.90, 0.85],
  dark = 1,
  mapBrightness = 6,
  markerSize = 0.045,
  markerElevation = 0.01,
  arcWidth = 0.5,
  arcHeight = 0.25,
  speed = 0.003,
  theta = 0.2,
  diffuse = 1.5,
  mapSamples = 16000,
  opacity = 0.65,
  canvasOpacity = 0.82,
  showMarkerLabels = false,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerInteracting.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
      isPausedRef.current = true;
    },
    []
  );

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (pointerInteracting.current !== null) {
      const deltaX = e.clientX - pointerInteracting.current.x;
      const deltaY = e.clientY - pointerInteracting.current.y;
      dragOffset.current = { phi: deltaX / 300, theta: deltaY / 1000 };
      const now = Date.now();
      if (lastPointer.current) {
        const dt = Math.max(now - lastPointer.current.t, 1);
        const maxVelocity = 0.15;
        velocity.current = {
          phi: Math.max(
            -maxVelocity,
            Math.min(maxVelocity, ((e.clientX - lastPointer.current.x) / dt) * 0.3)
          ),
          theta: Math.max(
            -maxVelocity,
            Math.min(maxVelocity, ((e.clientY - lastPointer.current.y) / dt) * 0.08)
          ),
        };
      }
      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId: number;
    let phi = 1.6;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Enhance WebGL shader to adapt #0D6866 dot color and translucent glass body
      const origGetContext = canvas.getContext.bind(canvas);
      canvas.getContext = function (type: string, attrs?: any) {
        const gl = origGetContext(type, { ...attrs, alpha: true }) as (WebGLRenderingContext & { __cobePatched?: boolean }) | null;
        if (gl && !gl.__cobePatched) {
          gl.__cobePatched = true;
          const origShaderSource = gl.shaderSource.bind(gl);
          gl.shaderSource = function (shader: WebGLShader, source: string) {
            if (source.includes("gl_FragColor") && source.includes("mix((1.-q)")) {
              source = source.replace(
                "m+=vec4(F*(mix((1.-q)*pow(i,.4),q,n.z)+.1)+pow(1.-i,4.)*w,1),l+=m*(1.+n.w)*.5,f=",
                "float isDot=smoothstep(0.01,0.10,q);vec3 dotCol=vec3(0.051,0.408,0.400);vec3 oceanCol=vec3(0.95,0.97,0.96);vec3 auroraCol=vec3(0.08,0.54,0.50);float fresnel=pow(1.-i,2.6);float rim=pow(1.-i,4.0);vec3 col=mix(oceanCol*(0.90+0.10*pow(i,0.6)),dotCol,isDot);col=mix(col,auroraCol,fresnel*0.35)+auroraCol*rim*0.6;float alpha=mix(0.72,0.99,isDot);alpha=clamp(alpha+fresnel*0.25,0.0,1.0);m=vec4(col,alpha);l=m;f="
              );
            }
            return origShaderSource(shader, source);
          };
        }
        return gl;
      } as any;

      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width,
          height: width,
          phi: 1.6,
          theta,
          dark,
          diffuse,
          mapSamples,
          mapBrightness,
          baseColor,
          markerColor,
          glowColor,
          markerElevation,
          markers: markers.map((m) => ({
            location: m.location,
            size: markerSize,
            id: m.id,
          })),
          arcs: arcs.map((a) => ({
            from: a.from,
            to: a.to,
            id: a.id,
          })),
          arcColor,
          arcWidth,
          arcHeight,
          opacity,
        });
      } catch (err) {
        // Fallback for headless/unsupported WebGL environments
        return;
      }

      function animate() {
        if (!isPausedRef.current) {
          phi += speed;
          if (
            Math.abs(velocity.current.phi) > 0.0001 ||
            Math.abs(velocity.current.theta) > 0.0001
          ) {
            phiOffsetRef.current += velocity.current.phi;
            thetaOffsetRef.current += velocity.current.theta;
            velocity.current.phi *= 0.95;
            velocity.current.theta *= 0.95;
          }
          const thetaMin = -0.4,
            thetaMax = 0.4;
          if (thetaOffsetRef.current < thetaMin) {
            thetaOffsetRef.current += (thetaMin - thetaOffsetRef.current) * 0.1;
          } else if (thetaOffsetRef.current > thetaMax) {
            thetaOffsetRef.current += (thetaMax - thetaOffsetRef.current) * 0.1;
          }
        }
        if (globe) {
          globe.update({
            phi: phi + phiOffsetRef.current + dragOffset.current.phi,
            theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
            dark,
            mapBrightness,
            markerColor,
            baseColor,
            arcColor,
            markerElevation,
            opacity,
            markers: markers.map((m) => ({
              location: m.location,
              size: markerSize,
              id: m.id,
            })),
            arcs: arcs.map((a) => ({
              from: a.from,
              to: a.to,
              id: a.id,
            })),
          });
        }
        animationId = requestAnimationFrame(animate);
      }
      animate();
      setTimeout(() => canvas && (canvas.style.opacity = String(canvasOpacity)));
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect();
          init();
        }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [
    markers,
    arcs,
    markerColor,
    baseColor,
    arcColor,
    glowColor,
    dark,
    mapBrightness,
    markerSize,
    markerElevation,
    arcWidth,
    arcHeight,
    speed,
    theta,
    diffuse,
    mapSamples,
  ]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />
      {showMarkerLabels &&
        markers.map((m) => (
          <div
            key={m.id}
            style={
              {
                position: "absolute",
                positionAnchor: `--cobe-${m.id}`,
                bottom: "anchor(top)",
                left: "anchor(center)",
                translate: "-50% 0",
                marginBottom: 8,
                padding: "3px 8px",
                background: "#063C3D",
                color: "#FFFFFF",
                borderRadius: "4px",
                fontFamily: "var(--font-sans, Inter, sans-serif)",
                fontSize: "0.68rem",
                fontWeight: 650,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.25)",
                border: "1px solid rgba(220, 229, 225, 0.4)",
                opacity: `var(--cobe-visible-${m.id}, 0)`,
                filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
                transition: "opacity 0.8s, filter 0.8s",
              } as React.CSSProperties
            }
          >
            {m.label}
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translate3d(-50%, -1px, 0)",
                border: "5px solid transparent",
                borderTopColor: "#063C3D",
              }}
            />
          </div>
        ))}
      {showMarkerLabels &&
        arcs
          .filter((a) => a.label)
          .map((a) => (
            <div
              key={a.id}
              style={
                {
                  position: "absolute",
                  positionAnchor: `--cobe-arc-${a.id}`,
                  bottom: "anchor(top)",
                  left: "anchor(center)",
                  translate: "-50% 0",
                  marginBottom: 8,
                  padding: "2px 6px",
                  background: "#fff",
                  color: "#1a1a2e",
                  fontFamily: "monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  opacity: `var(--cobe-visible-arc-${a.id}, 0)`,
                  filter: `blur(calc((1 - var(--cobe-visible-arc-${a.id}, 0)) * 8px))`,
                  transition: "opacity 0.8s, filter 0.8s",
                } as React.CSSProperties
              }
            >
              {a.label}
              <span
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translate3d(-50%, -1px, 0)",
                  border: "5px solid transparent",
                  borderTopColor: "#fff",
                }}
              />
            </div>
          ))}
    </div>
  );
}

export default Globe;
