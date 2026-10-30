"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export interface FluidSpatialCanvasProps {
  scrollProgress?: number; // 0 to 1
  className?: string;
  style?: React.CSSProperties;
}

export function FluidSpatialCanvas({
  scrollProgress = 0,
  className = "",
  style,
}: FluidSpatialCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      canvas.remove();
      return;
    }

    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose();
      canvas.remove();
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(0, 0, 48);

    // Color definitions for light theme
    // Teal palette: #073D40 (dark), #0D6866 (brand), #169B77 (emerald), #2A9288 (mint-bright), #82C4B7 (pale)
    const colorStops = [
      new THREE.Color("#073D40"),
      new THREE.Color("#0D6866"),
      new THREE.Color("#169B77"),
      new THREE.Color("#2A9288"),
      new THREE.Color("#82C4B7"),
    ];

    // Build 3D spatial particle vortex
    const PARTICLE_COUNT = 4200;
    const STRAND_COUNT = 8;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);
    const scales = new Float32Array(PARTICLE_COUNT);
    const strands = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const strandIdx = i % STRAND_COUNT;
      const tNorm = i / PARTICLE_COUNT;
      const phase = tNorm * Math.PI * 4;

      // Base distribution
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

      // Color interpolation along strands
      const cIdx = Math.floor(tNorm * (colorStops.length - 1));
      const nextCIdx = Math.min(cIdx + 1, colorStops.length - 1);
      const frac = (tNorm * (colorStops.length - 1)) % 1;
      const color = colorStops[cIdx].clone().lerp(colorStops[nextCIdx], frac);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      phases[i] = phase;
      scales[i] = 0.6 + Math.random() * 0.9;
      strands[i] = strandIdx;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("aStrand", new THREE.BufferAttribute(strands, 1));

    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    };

    const vertexShader = `
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uMouse;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute float aPhase;
      attribute float aScale;
      attribute float aStrand;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;

        // Dynamic 3D spiral vortex mathematics
        float p = aPhase + uTime * 0.12 + uScroll * 3.8;
        float strandAngle = aStrand * (6.2831853 / 8.0);

        // Curving radius modulated by scroll depth and phase
        float radMod = sin(p * 1.5 + strandAngle + uScroll * 3.1415) * 6.0;
        float radius = 16.0 + radMod + sin(uTime * 0.3 + aStrand) * 2.0;

        // Dual spiral coordinates
        float spiral = p * 1.4 + uScroll * 4.2;
        float x = cos(spiral + strandAngle) * radius;
        float z = sin(spiral + strandAngle) * radius;

        // Vertical serpentine oscillation flowing down the page
        float y = sin(p * 2.4 + uTime * 0.25) * 10.0 + (1.0 - 2.0 * fract(aPhase / 12.56637)) * 26.0;
        y += (0.5 - uScroll) * 18.0;

        // Gentle perspective wave tilt driven by scroll
        float cosTilt = cos(uScroll * 1.57);
        float sinTilt = sin(uScroll * 1.57);
        float rotY = y * cosTilt - z * sinTilt;
        float rotZ = y * sinTilt + z * cosTilt;
        y = rotY;
        z = rotZ;

        // Subtle mouse repulsion ripple
        vec2 mouseWorld = uMouse * vec2(20.0, 14.0);
        float mouseDist = length(vec2(x, y) - mouseWorld);
        float mouseImpulse = exp(-mouseDist * 0.18);
        x += mouseImpulse * 4.5 * sin(uTime * 2.5);
        y += mouseImpulse * 3.5 * cos(uTime * 2.5);

        vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Perspective size attenuation
        gl_PointSize = (aScale * 36.0 * uPixelRatio) / max(-mvPosition.z, 1.0);

        // Distance depth-of-field alpha fading
        float depth = length(mvPosition.xyz);
        vAlpha = smoothstep(110.0, 35.0, depth) * smoothstep(6.0, 18.0, depth);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        // Soft glowing particle disc
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;

        // Smooth antialiased glow
        float glow = smoothstep(0.25, 0.0, distSq);
        float alpha = vAlpha * glow * 0.88;

        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Build delicate harmonic background waves (intertwining luminous ribbons)
    const ribbonCurvesCount = 4;
    const ribbonGroup = new THREE.Group();
    const ribbonMaterials: THREE.LineBasicMaterial[] = [];

    for (let r = 0; r < ribbonCurvesCount; r++) {
      const curvePoints: THREE.Vector3[] = [];
      const pts = 160;
      for (let j = 0; j <= pts; j++) {
        curvePoints.push(new THREE.Vector3(0, 0, 0));
      }
      const lineGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: colorStops[r % colorStops.length],
        transparent: true,
        opacity: 0.18,
        linewidth: 1,
      });
      ribbonMaterials.push(lineMat);
      const lineMesh = new THREE.Line(lineGeom, lineMat);
      ribbonGroup.add(lineMesh);
    }
    scene.add(ribbonGroup);

    let width = 1;
    let height = 1;
    let rafId = 0;
    let isIntersecting = true;
    let isDestroyed = false;
    let smoothScrollVal = scrollProgress;
    const targetMouse = { x: 0, y: 0 };
    const currentMouse = { x: 0, y: 0 };

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      uniforms.uPixelRatio.value = dpr;
    };

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      targetMouse.y = -(((e.clientY - rect.top) / height) * 2 - 1);
    };

    window.addEventListener("pointermove", onPointerMove);

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries.some((e) => e.isIntersecting);
        if (isIntersecting && !rafId) {
          rafId = requestAnimationFrame(render);
        }
      },
      { rootMargin: "100px" }
    );
    intersectionObserver.observe(container);

    updateDimensions();

    let clock = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      rafId = 0;
      if (isDestroyed) return;

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      clock += dt;

      // Smooth scroll interpolation (inertia follow)
      smoothScrollVal += (scrollRef.current - smoothScrollVal) * 0.1;
      uniforms.uScroll.value = smoothScrollVal;
      uniforms.uTime.value = clock;

      // Mouse smoothing
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.06;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.06;
      uniforms.uMouse.value.set(currentMouse.x, currentMouse.y);

      // Camera parallax drift
      camera.position.x = currentMouse.x * 3.5;
      camera.position.y = currentMouse.y * 2.5 + (0.5 - smoothScrollVal) * 8.0;
      camera.lookAt(0, (0.5 - smoothScrollVal) * 3.0, 0);

      // Update fluid spline ribbons
      ribbonGroup.children.forEach((child, rIdx) => {
        const line = child as THREE.Line;
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const pts = posAttr.count - 1;
        const rOffset = (rIdx * Math.PI) / 2;

        for (let j = 0; j <= pts; j++) {
          const t = (j / pts) * Math.PI * 4;
          const swirl = t * 1.2 + clock * 0.2 + smoothScrollVal * 3.5 + rOffset;
          const rad = 17.0 + 5.0 * sinTiltCurve(t + smoothScrollVal);
          const lx = Math.cos(swirl) * rad;
          const lz = Math.sin(swirl) * rad;
          const ly = Math.sin(t * 2.0 + clock * 0.3) * 8.0 + (1.0 - 2.0 * (j / pts)) * 24.0;
          posAttr.setXYZ(j, lx, ly, lz);
        }
        posAttr.needsUpdate = true;
      });

      // Slowly rotate the particle system
      particleSystem.rotation.y = clock * 0.04 + smoothScrollVal * 0.8;
      particleSystem.rotation.x = currentMouse.y * 0.08 + Math.sin(clock * 0.1) * 0.05;

      renderer.setClearColor(0xffffff, 0);
      renderer.render(scene, camera);

      if (isIntersecting && !document.hidden) {
        rafId = requestAnimationFrame(render);
      }
    };

    function sinTiltCurve(v: number) {
      return Math.sin(v) * Math.cos(v * 0.5);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      geometry.dispose();
      material.dispose();
      ribbonGroup.children.forEach((child) => {
        const line = child as THREE.Line;
        line.geometry.dispose();
      });
      ribbonMaterials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full pointer-events-none select-none ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default FluidSpatialCanvas;
