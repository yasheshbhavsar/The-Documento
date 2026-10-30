"use client";

import React, {
  useEffect,
  useRef,
  useSyncExternalStore,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as THREE from "three";

export interface WaveLetteringProps {
  text?: string;
  colors?: [string, string];
  backgroundColor?: string;
  mode?: "auto" | "ink" | "light" | "dark";
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
  glyphSize?: number;
  rows?: number;
  perspective?: number;
  tilt?: number;
  horizon?: number;
  amplitude?: number;
  wavelength?: number;
  speed?: number;
  direction?: number;
  sharpness?: number;
  envelope?: number;
  flow?: number;
  alternate?: boolean;
  fog?: number;
  interactive?: boolean;
  hoverFocus?: boolean;
  focusDepth?: number;
  depthOfField?: number;
  focusRange?: number;
  clickStrum?: boolean;
  strumStrength?: number;
  tension?: number;
  sustain?: number;
  paused?: boolean;
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface WaveLetteringHandle {
  strum: (x?: number, y?: number) => void;
}

const DT = 1 / 240;

const subscribeReducedMotion = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const clamp = (val: number, min: number, max: number) =>
  Math.min(max, Math.max(min, val));

let cachedColorCtx: CanvasRenderingContext2D | null = null;
const parseColor = (
  colorStr: string,
  fallback: [number, number, number]
): [number, number, number] => {
  if (typeof document === "undefined") return fallback;
  if (!cachedColorCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    cachedColorCtx = c.getContext("2d");
  }
  if (!cachedColorCtx) return fallback;
  cachedColorCtx.fillStyle = "#010203";
  cachedColorCtx.fillStyle = colorStr;
  const computed = String(cachedColorCtx.fillStyle);
  if (
    computed === "#010203" &&
    "#010203" !== colorStr.trim().toLowerCase()
  ) {
    return fallback;
  }
  if (computed.startsWith("#")) {
    const hex = computed.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const parts = computed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return [
    Number(parts[0]) / 255,
    Number(parts[1]) / 255,
    Number(parts[2]) / 255,
  ];
};

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const rgbToOklab = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const waveGlslCommon = `
uniform float uTime;
uniform float uAmp;
uniform float uK;
uniform float uSharp;
uniform vec2 uDir;
uniform float uEnvelope;
uniform float uHalf;
uniform sampler2D uStrings;
uniform float uRowZ[64];
uniform float uRowHalf[64];

float crest(float p) {
  float s = 0.5 + 0.5 * sin(p);
  return pow(s, uSharp) * 2.0 - 1.0;
}

float swellAt(vec2 q) {
  vec2 d2 = vec2(uDir.x * 0.8 - uDir.y * 0.6, uDir.x * 0.6 + uDir.y * 0.8);
  vec2 d3 = vec2(uDir.x * 0.9 + uDir.y * 0.44, -uDir.x * 0.44 + uDir.y * 0.9);
  vec2 d4 = vec2(uDir.y, -uDir.x);
  float w = sqrt(uK * 9.8) * 0.42;
  float t = uTime;
  float h = crest(dot(q, uDir) * uK - t * w) * 0.56;
  h += crest(dot(q, d2) * uK * 1.71 + 1.3 - t * w * 1.31) * 0.27;
  h += sin(dot(q, d3) * uK * 2.93 + 2.1 - t * w * 1.71) * 0.13;
  float group = 0.7 + 0.3 * sin(dot(q, d4) * uK * 0.37 + t * 0.21) * sin(dot(q, uDir) * uK * 0.19 - t * 0.13 + 1.7);
  float env = mix(1.0, 0.16 + 1.3 * exp(-pow(q.x / (uHalf * 0.6), 2.0)), uEnvelope);
  return uAmp * h * group * env;
}

float stringAt(float x, int row) {
  float u = clamp((x / uRowHalf[row] * 0.5 + 0.5) * 159.0, 0.0, 159.0);
  float i = floor(u);
  float a = texelFetch(uStrings, ivec2(int(i), row), 0).r;
  float b = texelFetch(uStrings, ivec2(int(min(i + 1.0, 159.0)), row), 0).r;
  return mix(a, b, u - i);
}

float lineAt(float x, float z, int row) {
  return swellAt(vec2(x, z)) + stringAt(x, row);
}
`;

const bgVertexShader = `
precision highp float;
${waveGlslCommon}
in float aRow;
in float aX;
in float aBottom;

void main() {
  int row = int(aRow);
  float z = uRowZ[row];
  float h = lineAt(aX, z, row);
  vec3 p = vec3(aX, aBottom > 0.5 ? h - 60.0 : h, z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const bgFragmentShader = `
precision highp float;
uniform vec3 uBackground;
out vec4 fragColor;

void main() {
  fragColor = vec4(uBackground, 1.0);
}
`;

const textVertexShader = `
precision highp float;
${waveGlslCommon}
in float aRow;
in float aX;
in vec4 aRect;
in float aWidth;
uniform float uRowLength[64];
uniform float uRowShift[64];
uniform float uRowCount;
uniform float uGlyph;
uniform float uLean;
uniform float uGap;
uniform float uFocus;
uniform float uDof;
uniform float uRange;
uniform float uPad;
out vec2 vUv;
out float vLift;
out float vNear;
out float vRing;
out float vBlur;

void main() {
  int row = int(aRow);
  float z = uRowZ[row];
  float span = uRowLength[row];
  float x = mod(aX + uRowShift[row] + span * 0.5, span) - span * 0.5;
  float swell = swellAt(vec2(x, z));
  float ring = stringAt(x, row);
  float h = swell + ring;
  float e = uGlyph * 0.45;
  float slope = (lineAt(x + e, z, row) - lineAt(x - e, z, row)) / (2.0 * e);
  vec4 view = modelViewMatrix * vec4(x, h, z, 1.0);
  vec2 corner = position.xy;
  vec2 local = vec2(corner.x * aWidth, mix(-0.32 - uPad, 0.98 + uPad, corner.y + 0.5) * uGlyph);
  float angle = atan(slope) * uLean;
  float c = cos(angle);
  float s = sin(angle);
  view.xy += vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  view.z += uGlyph * 0.02;
  gl_Position = projectionMatrix * view;
  vUv = vec2(aRect.x + (corner.x + 0.5) * aRect.z, aRect.y + (0.5 - corner.y) * aRect.w);
  vLift = clamp(swell / max(uAmp, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
  vNear = 1.0 - aRow / max(uRowCount - 1.0, 1.0);
  vRing = clamp(abs(ring) / max(uGap, 1e-4), 0.0, 1.0);
  float off = abs((1.0 - vNear) - uFocus);
  vBlur = uDof * smoothstep(uRange * 0.5, uRange * 0.5 + 0.42, off);
}
`;

const textFragmentShader = `
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uLabHigh;
uniform vec3 uLabLow;
uniform float uInk;
uniform float uFog;
uniform vec2 uAtlasSize;
in vec2 vUv;
in float vLift;
in float vNear;
in float vRing;
in float vBlur;
out vec4 fragColor;

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0);
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  float radius = vBlur * 26.0;
  float coverage;
  if (radius < 0.6) {
    coverage = texture(uAtlas, vUv).r;
  } else {
    float lod = log2(max(radius * 0.55, 1.0));
    vec2 step_ = radius * 0.62 / uAtlasSize;
    coverage = textureLod(uAtlas, vUv, lod).r * 0.28;
    coverage += textureLod(uAtlas, vUv + vec2(step_.x, 0.0), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv - vec2(step_.x, 0.0), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv + vec2(0.0, step_.y), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv - vec2(0.0, step_.y), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv + step_ * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv - step_ * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv + vec2(step_.x, -step_.y) * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv + vec2(-step_.x, step_.y) * 0.7071, lod).r * 0.06;
    coverage *= 1.0 + vBlur * 0.35;
  }
  if (coverage < 0.004) discard;
  float ring = smoothstep(0.02, 0.6, vRing);
  float t = clamp(0.2 + 0.5 * smoothstep(0.25, 0.95, vLift) + 0.42 * vNear * vNear, 0.0, 1.0);
  t = max(t, 0.55 + 0.45 * ring);
  vec3 lab = mix(uLabLow, uLabHigh, t);
  if (uInk < 0.5) lab = mix(lab, vec3(min(uLabHigh.x * 1.04 + 0.04, 0.99), uLabHigh.yz * 0.25), smoothstep(0.84, 1.0, t) * 0.55);
  vec3 color = encode(labToLinear(lab));
  float fog = exp(-(1.0 - vNear) * uFog * 2.4);
  float strength = (0.34 + 0.66 * smoothstep(0.0, 0.85, t)) * mix(fog, 1.0, ring * 0.6) * (1.0 - vBlur * 0.3);
  float alpha = coverage * clamp(strength, 0.0, 1.0);
  fragColor = vec4(color * alpha, alpha);
}
`;

export const WaveLettering = forwardRef<WaveLetteringHandle, WaveLetteringProps>(
  function WaveLettering(
    {
      text = "011001000110111101100011011101010110110101100101011011100111010001101111",
      colors = ["#0d6866", "#0d6967"],
      backgroundColor = "#ffffff",
      mode = "auto",
      fontFamily = "",
      fontWeight = 500,
      letterSpacing = 0.08,
      glyphSize = 11,
      rows = 50,
      perspective = 0.55,
      tilt = 24,
      horizon = 0.36,
      amplitude = 1.6,
      wavelength = 0.7,
      speed = 1,
      direction = 75,
      sharpness = 0.5,
      envelope = 0,
      flow = 0.8,
      alternate = false,
      fog = 0.6,
      interactive = true,
      hoverFocus = false,
      focusDepth = 0.3,
      depthOfField = 0.2,
      focusRange = 0.14,
      clickStrum = true,
      strumStrength = 1.3,
      tension = 1.55,
      sustain = 1.6,
      paused = false,
      quality = 1,
      className,
      style,
      children,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<{
      sync: () => void;
      destroy: () => void;
      strum: (x: number, y: number) => void;
    } | null>(null);

    const isReduced = useSyncExternalStore(
      subscribeReducedMotion,
      getReducedMotion,
      () => false
    );

    const configRef = useRef({
      text,
      colors,
      backgroundColor,
      mode,
      fontFamily,
      fontWeight,
      letterSpacing,
      glyphSize,
      rows,
      perspective,
      tilt,
      horizon,
      amplitude,
      wavelength,
      speed,
      direction,
      sharpness,
      envelope,
      flow,
      alternate,
      fog,
      interactive,
      hoverFocus,
      focusDepth,
      depthOfField,
      focusRange,
      clickStrum,
      strumStrength,
      tension,
      sustain,
      paused,
      quality,
      reduced: isReduced,
    });

    useEffect(() => {
      configRef.current = {
        text,
        colors,
        backgroundColor,
        mode,
        fontFamily,
        fontWeight,
        letterSpacing,
        glyphSize,
        rows,
        perspective,
        tilt,
        horizon,
        amplitude,
        wavelength,
        speed,
        direction,
        sharpness,
        envelope,
        flow,
        alternate,
        fog,
        interactive,
        hoverFocus,
        focusDepth,
        depthOfField,
        focusRange,
        clickStrum,
        strumStrength,
        tension,
        sustain,
        paused,
        quality,
        reduced: isReduced,
      };
      engineRef.current?.sync();
    });

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
      container.prepend(canvas);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
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

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
      const scene = new THREE.Scene();

      const rowZ = new Float32Array(64);
      const rowHalf = new Float32Array(64).fill(1);
      const rowLength = new Float32Array(64).fill(1);
      const rowShift = new Float32Array(64);
      const rowOffsets = new Float64Array(64);
      const stringData = new Float32Array(10240);
      const stringVelocities = new Float32Array(10240);

      const stringsTexture = new THREE.DataTexture(
        stringData,
        160,
        64,
        THREE.RedFormat,
        THREE.FloatType
      );
      stringsTexture.minFilter = THREE.NearestFilter;
      stringsTexture.magFilter = THREE.NearestFilter;
      stringsTexture.needsUpdate = true;

      const sharedUniforms = {
        uTime: { value: 0 },
        uAmp: { value: 0.3 },
        uK: { value: 2 },
        uSharp: { value: 1.6 },
        uDir: { value: new THREE.Vector2(0, -1) },
        uEnvelope: { value: 0 },
        uHalf: { value: 4 },
        uStrings: { value: stringsTexture },
        uRowZ: { value: rowZ },
        uRowHalf: { value: rowHalf },
      };

      const bgMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: bgVertexShader,
        fragmentShader: bgFragmentShader,
        uniforms: {
          ...sharedUniforms,
          uBackground: { value: new THREE.Vector3() },
        },
        depthTest: true,
        depthWrite: true,
      });

      const textMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: textVertexShader,
        fragmentShader: textFragmentShader,
        uniforms: {
          ...sharedUniforms,
          uRowLength: { value: rowLength },
          uRowShift: { value: rowShift },
          uRowCount: { value: 2 },
          uGlyph: { value: 0.1 },
          uLean: { value: 0.6 },
          uGap: { value: 0.3 },
          uFocus: { value: 0.3 },
          uDof: { value: 0.6 },
          uRange: { value: 0.12 },
          uPad: { value: 0.3888888888888889 },
          uAtlasSize: { value: new THREE.Vector2(1, 1) },
          uAtlas: { value: null },
          uLabHigh: { value: new THREE.Vector3() },
          uLabLow: { value: new THREE.Vector3() },
          uInk: { value: 0 },
          uFog: { value: 0.5 },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        premultipliedAlpha: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      });

      let bgGeom = new THREE.BufferGeometry();
      let textGeom = new THREE.InstancedBufferGeometry();

      const bgMesh = new THREE.Mesh(bgGeom, bgMaterial);
      const textMesh = new THREE.Mesh(textGeom, textMaterial);
      bgMesh.frustumCulled = false;
      textMesh.frustumCulled = false;
      bgMesh.renderOrder = 0;
      textMesh.renderOrder = 1;

      scene.add(bgMesh);
      scene.add(textMesh);

      let atlasData: {
        texture: THREE.CanvasTexture;
        glyphs: Map<
          string,
          {
            u: number;
            v: number;
            w: number;
            h: number;
            advance: number;
            width: number;
          }
        >;
        size: [number, number];
      } | null = null;

      let lastFontKey = "";
      let lastConfigKey = "";
      let width = 1;
      let height = 1;
      let pixelRatio = 1;
      let activeRowCount = 2;
      let worldGlyphSize = 0.1;
      let halfSpan = 4;
      let timeElapsed = 0;
      let waveAcc = 0;
      let rafId = 0;
      let lastTime = 0;
      let frameCounter = 0;
      let isReady = false;
      let isIntersecting = true;
      let isDestroyed = false;

      const pointerPos = { x: 0, y: 0, inside: false };
      const focusSpring = {
        value: clamp(configRef.current.focusDepth, 0, 1),
        velocity: 0,
      };
      const pendingStrums: {
        row: number;
        x: number;
        at: number;
        amount: number;
      }[] = [];
      const activePulses: {
        row: number;
        center: number;
        spread: number;
        amount: number;
        left: number;
      }[] = [];

      const tempVec3 = new THREE.Vector3();
      const frustumConfig = { k: 0.3, aspect: 1, depthNear: 8 };

      const getPlaneDistance = (zVal: number) => {
        const rad = (clamp(configRef.current.tilt, 4, 85) * Math.PI) / 180;
        return (
          camera.position.y * Math.sin(rad) +
          (camera.position.z - zVal) * Math.cos(rad)
        );
      };

      const updateCamera = () => {
        const cfg = configRef.current;
        const aspect = width / height;
        const fov = 3 + 57 * clamp(cfg.perspective, 0, 1);
        const tanFov = Math.tan((fov * Math.PI) / 360);
        const radTilt = (clamp(cfg.tilt, 4, 85) * Math.PI) / 180;
        const sinTilt = Math.sin(radTilt);
        const cosTilt = Math.cos(radTilt);
        const factor = (0.92 * Math.tan(radTilt)) / tanFov;
        const horizon = Math.min(
          1 - 2 * clamp(cfg.horizon, 0.02, 0.9),
          factor,
          0.96
        );

        const projectZ = (yVal: number) =>
          (sinTilt - yVal * tanFov * cosTilt) /
          (cosTilt + yVal * tanFov * sinTilt);

        const nearPlane = projectZ(-1.18);
        const farPlane = projectZ(horizon);
        const camZ = (10 * farPlane) / Math.max(nearPlane - farPlane, 1e-4);
        const camY = camZ * nearPlane;

        camera.fov = fov;
        camera.aspect = aspect;
        camera.position.set(0, camY, camZ);
        camera.lookAt(0, camY - sinTilt, camZ - cosTilt);
        camera.near = Math.max(0.01, 0.05 * Math.min(camZ, camY));
        camera.far = (camZ + camY + 10) * 4 + 50;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        frustumConfig.k = tanFov;
        frustumConfig.aspect = aspect;
        frustumConfig.depthNear = getPlaneDistance(0);
        halfSpan = frustumConfig.depthNear * tanFov * aspect;

        const pixelsPerUnit = height / 2 / (frustumConfig.depthNear * tanFov);
        worldGlyphSize = Math.min(
          clamp(cfg.glyphSize, 4, 120) / pixelsPerUnit,
          frustumConfig.depthNear * tanFov * 0.25
        );
      };

      const crestFn = (phase: number, sharp: number) =>
        2 * Math.pow(0.5 + 0.5 * Math.sin(phase), sharp) - 1;

      const evalSwell = (posX: number, posZ: number) => {
        const dirX = sharedUniforms.uDir.value.x;
        const dirY = sharedUniforms.uDir.value.y;
        const k = sharedUniforms.uK.value;
        const sharp = sharedUniforms.uSharp.value;
        const time = sharedUniforms.uTime.value;
        const w = 0.42 * Math.sqrt(9.8 * k);
        const dotP = posX * dirX + posZ * dirY;

        let h = 0.56 * crestFn(dotP * k - time * w, sharp);
        h +=
          0.27 *
          crestFn(
            (posX * (0.8 * dirX - 0.6 * dirY) +
              posZ * (0.6 * dirX + 0.8 * dirY)) *
              k *
              1.71 +
              1.3 -
              time * w * 1.31,
            sharp
          );
        h +=
          0.13 *
          Math.sin(
            (posX * (0.9 * dirX + 0.44 * dirY) +
              posZ * (-0.44 * dirX + 0.9 * dirY)) *
              k *
              2.93 +
              2.1 -
              time * w * 1.71
          );

        const group =
          0.7 +
          0.3 *
            Math.sin((posX * dirY - posZ * dirX) * k * 0.37 + 0.21 * time) *
            Math.sin(dotP * k * 0.19 - 0.13 * time + 1.7);
        const env =
          1 +
          (0.16 +
            1.3 *
              Math.exp(
                -Math.pow(posX / (0.6 * sharedUniforms.uHalf.value), 2)
              ) -
            1) *
            sharedUniforms.uEnvelope.value;

        return sharedUniforms.uAmp.value * h * group * env;
      };

      const rebuildScene = () => {
        const cfg = configRef.current;
        const domFont =
          typeof window !== "undefined"
            ? getComputedStyle(container).fontFamily
            : "sans-serif";
        const currentKey = [
          cfg.text,
          cfg.fontFamily,
          cfg.fontWeight,
          cfg.letterSpacing,
          cfg.glyphSize,
          cfg.rows,
          cfg.perspective,
          cfg.tilt,
          cfg.horizon,
          Math.round(width),
          Math.round(height),
          domFont,
        ].join("|");

        if (currentKey !== lastConfigKey) {
          lastConfigKey = currentKey;
          updateCamera();

          const activeFontFamily = cfg.fontFamily || domFont;
          const fontSpec = `${clamp(cfg.fontWeight, 100, 900)} 72px ${activeFontFamily}`;
          const trimmed = cfg.text.trim() ? cfg.text.trim() : "·";
          const fullText = `${trimmed} `;
          const graphemes =
            typeof Intl !== "undefined" && (Intl as any).Segmenter
              ? Array.from(
                  new (Intl as any).Segmenter(undefined, {
                    granularity: "grapheme",
                  }).segment(fullText),
                  (item: any) => item.segment as string
                )
              : Array.from(fullText);

          const fontKey = `${fontSpec}|${graphemes.join("")}`;
          if (fontKey !== lastFontKey || !atlasData) {
            lastFontKey = fontKey;
            atlasData?.texture.dispose();

            const uniqueGraphemes = Array.from(
              new Set(graphemes.filter((c) => c.trim()))
            );
            const measureCanvas = document.createElement("canvas");
            const measureCtx = measureCanvas.getContext("2d");
            const getAdvance = (char: string) => {
              if (!measureCtx) return 36;
              measureCtx.font = fontSpec;
              return measureCtx.measureText(char).width;
            };

            const advances = uniqueGraphemes.map(getAdvance);
            const rowH = Math.ceil(149.6);
            let curX = 0;
            let curY = 0;
            const glyphRects: { x: number; y: number; w: number }[] = [];

            advances.forEach((adv) => {
              const charW = Math.ceil(adv) + 56;
              if (curX + charW > 2048) {
                curX = 0;
                curY += rowH;
              }
              glyphRects.push({ x: curX, y: curY, w: charW });
              curX += charW;
            });

            const atlasHeight = Math.max(
              rowH,
              Math.pow(2, Math.ceil(Math.log2(curY + rowH)))
            );
            const atlasCanvas = document.createElement("canvas");
            atlasCanvas.width = 2048;
            atlasCanvas.height = atlasHeight;
            const atlasCtx = atlasCanvas.getContext("2d");
            const glyphMap = new Map();

            if (atlasCtx) {
              atlasCtx.fillStyle = "#000";
              atlasCtx.fillRect(0, 0, 2048, atlasHeight);
              atlasCtx.fillStyle = "#fff";
              atlasCtx.font = fontSpec;
              atlasCtx.textBaseline = "alphabetic";
              atlasCtx.textAlign = "left";

              uniqueGraphemes.forEach((char, idx) => {
                const rect = glyphRects[idx];
                atlasCtx.fillText(char, rect.x + 28, rect.y + 28 + 70.56);
                glyphMap.set(char, {
                  u: rect.x / 2048,
                  v: rect.y / atlasHeight,
                  w: rect.w / 2048,
                  h: rowH / atlasHeight,
                  advance: advances[idx] / 72,
                  width: rect.w / 72,
                });
              });
            }

            const spaceAdv = getAdvance(" ") / 72;
            glyphMap.set(" ", {
              u: 0,
              v: 0,
              w: 0,
              h: 0,
              advance: spaceAdv,
              width: 0,
            });

            const canvasTexture = new THREE.CanvasTexture(atlasCanvas);
            canvasTexture.flipY = false;
            canvasTexture.minFilter = THREE.LinearMipmapLinearFilter;
            canvasTexture.magFilter = THREE.LinearFilter;
            canvasTexture.generateMipmaps = true;
            canvasTexture.anisotropy = 4;
            canvasTexture.colorSpace = THREE.SRGBColorSpace;
            canvasTexture.needsUpdate = true;

            atlasData = {
              texture: canvasTexture,
              glyphs: glyphMap,
              size: [2048, atlasHeight],
            };

            textMaterial.uniforms.uAtlas.value = atlasData.texture;
            textMaterial.uniforms.uAtlasSize.value.set(
              atlasData.size[0],
              atlasData.size[1]
            );
          }

          activeRowCount = Math.round(clamp(cfg.rows, 2, 64));
          const spacingVal = clamp(cfg.letterSpacing, -0.1, 1);
          const getCharWidth = (char: string) =>
            ((atlasData?.glyphs.get(char)?.advance ?? 0.3) + spacingVal) *
            worldGlyphSize;

          const stringWidth = graphemes.reduce(
            (acc, char) => acc + getCharWidth(char),
            0
          );
          const instanceRows: number[] = [];
          const instanceXs: number[] = [];
          const instanceRects: number[] = [];
          const instanceWidths: number[] = [];
          const bgRows: number[] = [];
          const bgXs: number[] = [];
          const bgBottoms: number[] = [];
          const bgIndices: number[] = [];

          for (let r = 0; r < activeRowCount; r++) {
            const zPlane = -(
              (r / Math.max(activeRowCount - 1, 1)) *
              10
            );
            rowZ[r] = zPlane;
            const rowSpan =
              getPlaneDistance(zPlane) *
                frustumConfig.k *
                frustumConfig.aspect *
                1.1 +
              3 * worldGlyphSize;
            rowHalf[r] = rowSpan;
            const repeatCount = Math.max(
              1,
              Math.ceil((2 * rowSpan) / Math.max(stringWidth, 1e-4)) + 1
            );
            const totalRowLen = repeatCount * stringWidth;
            rowLength[r] = totalRowLen;
            if (rowOffsets[r] <= 0) {
              rowOffsets[r] = Math.random() * totalRowLen;
            }

            let startX = -totalRowLen / 2;
            for (let rep = 0; rep < repeatCount; rep++) {
              for (const char of graphemes) {
                const cw = getCharWidth(char);
                const glyphInfo = atlasData?.glyphs.get(char);
                if (glyphInfo && glyphInfo.width > 0) {
                  instanceRows.push(r);
                  instanceXs.push(
                    startX + cw / 2 - (spacingVal * worldGlyphSize) / 2
                  );
                  instanceRects.push(
                    glyphInfo.u,
                    glyphInfo.v,
                    glyphInfo.w,
                    glyphInfo.h
                  );
                  instanceWidths.push(glyphInfo.width * worldGlyphSize);
                }
                startX += cw;
              }
            }

            const baseIdx = bgRows.length;
            for (let step = 0; step <= 260; step++) {
              const xPos = -rowSpan + (2 * rowSpan * step) / 260;
              bgRows.push(r, r);
              bgXs.push(xPos, xPos);
              bgBottoms.push(0, 1);
              if (step < 260) {
                const i = baseIdx + 2 * step;
                bgIndices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
              }
            }
          }

          const newBgGeom = new THREE.BufferGeometry();
          newBgGeom.setAttribute(
            "position",
            new THREE.BufferAttribute(
              new Float32Array(3 * bgRows.length),
              3
            )
          );
          newBgGeom.setAttribute(
            "aRow",
            new THREE.BufferAttribute(new Float32Array(bgRows), 1)
          );
          newBgGeom.setAttribute(
            "aX",
            new THREE.BufferAttribute(new Float32Array(bgXs), 1)
          );
          newBgGeom.setAttribute(
            "aBottom",
            new THREE.BufferAttribute(new Float32Array(bgBottoms), 1)
          );
          newBgGeom.setIndex(bgIndices);

          bgGeom.dispose();
          bgGeom = newBgGeom;
          bgMesh.geometry = newBgGeom;

          const newTextGeom = new THREE.InstancedBufferGeometry();
          newTextGeom.setAttribute(
            "position",
            new THREE.BufferAttribute(
              new Float32Array([
                -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5,
                0.5, 0, -0.5, 0.5, 0,
              ]),
              3
            )
          );
          newTextGeom.setAttribute(
            "aRow",
            new THREE.InstancedBufferAttribute(
              new Float32Array(instanceRows),
              1
            )
          );
          newTextGeom.setAttribute(
            "aX",
            new THREE.InstancedBufferAttribute(new Float32Array(instanceXs), 1)
          );
          newTextGeom.setAttribute(
            "aRect",
            new THREE.InstancedBufferAttribute(
              new Float32Array(instanceRects),
              4
            )
          );
          newTextGeom.setAttribute(
            "aWidth",
            new THREE.InstancedBufferAttribute(
              new Float32Array(instanceWidths),
              1
            )
          );
          newTextGeom.instanceCount = instanceRows.length;

          textGeom.dispose();
          textGeom = newTextGeom;
          textMesh.geometry = newTextGeom;

          stringData.fill(0);
          stringVelocities.fill(0);
        } else {
          updateCamera();
        }

        const cfgNow = configRef.current;
        const bgRgb = parseColor(cfgNow.backgroundColor, [0.04, 0.04, 0.04]);
        const lum =
          0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2];
        const isInk =
          cfgNow.mode === "ink" ||
          (cfgNow.mode === "auto" && lum > 0.5);

        const labHigh = rgbToOklab(
          parseColor(cfgNow.colors[0], [1, 1, 1])
        );
        const labLow = rgbToOklab(
          parseColor(cfgNow.colors[1], [0.49, 0.36, 1])
        );
        const rowGap = 10 / Math.max(activeRowCount - 1, 1);
        const dirRad =
          (clamp(cfgNow.direction, -180, 180) * Math.PI) / 180;

        sharedUniforms.uTime.value = timeElapsed;
        sharedUniforms.uAmp.value =
          clamp(cfgNow.amplitude, 0, 8) * rowGap;
        sharedUniforms.uK.value =
          (2 * Math.PI) /
          Math.max(clamp(cfgNow.wavelength, 0.05, 4) * halfSpan * 2, 0.001);
        sharedUniforms.uSharp.value =
          1 + 2.4 * clamp(cfgNow.sharpness, 0, 1);
        sharedUniforms.uDir.value.set(Math.sin(dirRad), -Math.cos(dirRad));
        sharedUniforms.uEnvelope.value = clamp(cfgNow.envelope, 0, 1);
        sharedUniforms.uHalf.value = halfSpan;

        const tu = textMaterial.uniforms;
        tu.uRowCount.value = activeRowCount;
        tu.uGlyph.value = worldGlyphSize;
        tu.uFocus.value = cfgNow.reduced
          ? clamp(cfgNow.focusDepth, 0, 1)
          : focusSpring.value;
        tu.uDof.value = clamp(cfgNow.depthOfField, 0, 1);
        tu.uRange.value = clamp(cfgNow.focusRange, 0, 1);
        tu.uGap.value = rowGap;
        tu.uLabHigh.value.set(labHigh[0], labHigh[1], labHigh[2]);
        tu.uLabLow.value.set(labLow[0], labLow[1], labLow[2]);
        tu.uInk.value = +isInk;
        tu.uFog.value = clamp(cfgNow.fog, 0, 3);

        bgMaterial.uniforms.uBackground.value.set(
          bgRgb[0],
          bgRgb[1],
          bgRgb[2]
        );
        renderer.setClearColor(
          new THREE.Color().setRGB(
            bgRgb[0],
            bgRgb[1],
            bgRgb[2],
            THREE.SRGBColorSpace
          ),
          1
        );

        for (let r = 0; r < activeRowCount; r++) {
          const span = rowLength[r];
          rowShift[r] = ((rowOffsets[r] % span) + span) % span;
        }

        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      };

      const addPulse = (
        rowIndex: number,
        xPos: number,
        pulseAmount: number
      ) => {
        const half = rowHalf[rowIndex];
        const centerIndex =
          159 * clamp((xPos / half) * 0.5 + 0.5, 0, 1);
        const spreadRadius = Math.max(
          3,
          ((7 * worldGlyphSize) / (2 * half)) * 159
        );
        activePulses.push({
          row: rowIndex,
          center: centerIndex,
          spread: spreadRadius,
          amount: pulseAmount,
          left: 0.09,
        });
      };

      const stepWavePhysics = (dtSec: number) => {
        for (let idx = activePulses.length - 1; idx >= 0; idx--) {
          const pulse = activePulses[idx];
          const decay = Math.min(dtSec, pulse.left) / 0.09;
          pulse.left -= dtSec;

          const startIdx = Math.max(1, Math.floor(pulse.center - 3 * pulse.spread));
          const endIdx = Math.min(158, Math.ceil(pulse.center + 3 * pulse.spread));
          const rowOffset = 160 * pulse.row;

          for (let i = startIdx; i <= endIdx; i++) {
            const dist = (i - pulse.center) / pulse.spread;
            stringData[rowOffset + i] +=
              pulse.amount * decay * Math.exp(-dist * dist);
          }

          if (pulse.left <= 0) {
            activePulses.splice(idx, 1);
          }
        }
      };

      const projectPoint = (rowIndex: number, screenX: number): [number, number] => {
        const ndcX = (screenX / width) * 2 - 1;
        const zCoord = rowZ[rowIndex];
        const worldX =
          ndcX *
          getPlaneDistance(zCoord) *
          frustumConfig.k *
          frustumConfig.aspect;
        const worldY = evalSwell(worldX, zCoord);
        tempVec3.set(worldX, worldY, zCoord).project(camera);
        return [worldX, (1 - tempVec3.y) * 0.5 * height];
      };

      const renderLoop = (timeMs: number) => {
        rafId = 0;
        if (isDestroyed) return;

        const dtSec = Math.min(0.05, Math.max(0, (timeMs - lastTime) / 1000));
        lastTime = timeMs;
        const cfg = configRef.current;
        const isRunning = !cfg.paused && !cfg.reduced;

        frameCounter++;
        if (
          frameCounter % 30 === 0 &&
          (Math.abs(container.clientWidth - width) > 1 ||
            Math.abs(container.clientHeight - height) > 1)
        ) {
          handleResize();
        }

        if (!isReady) {
          if (isIntersecting && !document.hidden) {
            rafId = requestAnimationFrame(renderLoop);
          }
          return;
        }

        if (isRunning) {
          timeElapsed += dtSec * clamp(cfg.speed, 0, 4);
          const flowStep = clamp(cfg.flow, -20, 20) * worldGlyphSize;

          for (let r = 0; r < activeRowCount; r++) {
            const dir = cfg.alternate && r % 2 === 1 ? -1 : 1;
            rowOffsets[r] += flowStep * dir * dtSec;
          }

          for (let sIdx = pendingStrums.length - 1; sIdx >= 0; sIdx--) {
            const item = pendingStrums[sIdx];
            if (item.at <= timeElapsed) {
              if (item.row < activeRowCount) {
                addPulse(item.row, item.x, item.amount);
              }
              pendingStrums.splice(sIdx, 1);
            }
          }

          let targetFocus = clamp(configRef.current.focusDepth, 0, 1);
          if (
            pointerPos.inside &&
            configRef.current.interactive &&
            configRef.current.hoverFocus
          ) {
            targetFocus = ((mx: number, my: number) => {
              const topY = projectPoint(0, mx)[1];
              if (my >= topY) return 0;
              for (let r = 1; r < activeRowCount; r++) {
                const curY = projectPoint(r, mx)[1];
                if (my >= curY) {
                  const span = topY - curY;
                  return (
                    (r - 1 + clamp(span > 0.001 ? (topY - my) / span : 0, 0, 1)) /
                    Math.max(activeRowCount - 1, 1)
                  );
                }
              }
              return 1;
            })(pointerPos.x, pointerPos.y);
          }

          focusSpring.velocity +=
            (42.25 * (targetFocus - focusSpring.value) -
              13 * focusSpring.velocity) *
            dtSec;
          focusSpring.value += focusSpring.velocity * dtSec;

          // Physics wave equation on strings
          const tensionParam = clamp(cfg.tension, 0.1, 3);
          const cSpeed =
            Math.pow(Math.min(0.95, 62 * tensionParam * DT), 2) / (DT * DT);
          const damping = 1 / clamp(cfg.sustain, 0.2, 10);

          waveAcc += dtSec;
          let subSteps = 0;
          while (waveAcc >= DT && subSteps < 16) {
            waveAcc -= DT;
            subSteps++;
            stepWavePhysics(DT);

            for (let r = 0; r < activeRowCount; r++) {
              const rowStart = 160 * r;
              for (let col = 1; col < 159; col++) {
                const idx = rowStart + col;
                const laplacian =
                  stringData[idx - 1] + stringData[idx + 1] - 2 * stringData[idx];
                const edgeDist = Math.min(col, 159 - col);
                const boundaryDamp =
                  edgeDist < 14 ? (14 - edgeDist) * 1.6 : 0;
                stringVelocities[idx] +=
                  (cSpeed * laplacian -
                    (damping + boundaryDamp) * stringVelocities[idx]) *
                  DT;
              }
              for (let col = 1; col < 159; col++) {
                stringData[rowStart + col] +=
                  stringVelocities[rowStart + col] * DT;
              }
            }
          }

          if (subSteps === 16) waveAcc = 0;
          stringsTexture.needsUpdate = true;
        }

        rebuildScene();

        if (isIntersecting && !document.hidden && isRunning) {
          rafId = requestAnimationFrame(renderLoop);
        }
      };

      const kickLoop = () => {
        if (!isDestroyed && !rafId && isIntersecting) {
          lastTime = performance.now();
          rafId = requestAnimationFrame(renderLoop);
        }
      };

      const handleResize = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
          isReady = false;
          kickLoop();
          return;
        }

        isReady = true;
        width = rect.width;
        height = rect.height;
        pixelRatio =
          Math.min(window.devicePixelRatio || 1, 2) *
          clamp(configRef.current.quality, 0.25, 1);

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        lastConfigKey = "";
        rebuildScene();
        kickLoop();
      };

      const getLocalCoords = (e: MouseEvent | PointerEvent) => {
        const rect = container.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const [px, py] = getLocalCoords(e);
        pointerPos.x = px;
        pointerPos.y = py;
        pointerPos.inside = true;
        kickLoop();
      };

      const onPointerLeave = () => {
        pointerPos.inside = false;
      };

      const triggerStrumAt = (xPos: number, yPos: number) => {
        const cfg = configRef.current;
        if (cfg.reduced || cfg.paused) return;

        const rowGap = 10 / Math.max(activeRowCount - 1, 1);
        let nearestRow = 0;
        let minDist = Infinity;

        for (let r = 0; r < activeRowCount; r++) {
          const [, screenY] = projectPoint(r, xPos);
          const dist = Math.abs(screenY - yPos);
          if (dist < minDist) {
            minDist = dist;
            nearestRow = r;
          }
        }

        const strumIntensity =
          0.75 * rowGap * clamp(cfg.strumStrength, 0, 3);
        for (let r = 0; r < activeRowCount; r++) {
          const [worldX] = projectPoint(r, xPos);
          const rowDiff = Math.abs(r - nearestRow);
          pendingStrums.push({
            row: r,
            x: worldX,
            at: timeElapsed + 0.045 * rowDiff,
            amount: strumIntensity * Math.exp(-rowDiff / 12),
          });
        }

        kickLoop();
      };

      const onClick = (e: MouseEvent) => {
        const cfg = configRef.current;
        if (!cfg.interactive || !cfg.clickStrum) return;
        const [px, py] = getLocalCoords(e);
        triggerStrumAt(px, py);
      };

      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);
      container.addEventListener("click", onClick);

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      const intersectionObserver = new IntersectionObserver(
        (entries) => {
          isIntersecting = entries.some((entry) => entry.isIntersecting);
          if (isIntersecting) kickLoop();
        },
        { rootMargin: "80px" }
      );
      intersectionObserver.observe(container);

      const onVisibilityChange = () => {
        if (!document.hidden) kickLoop();
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      if (document.fonts?.ready) {
        document.fonts.ready
          .then(() => {
            if (!isDestroyed) {
              lastFontKey = "";
              lastConfigKey = "";
              if (isReady) rebuildScene();
            }
          })
          .catch(() => {});
      }

      const onContextLost = (e: Event) => e.preventDefault();
      canvas.addEventListener("webglcontextlost", onContextLost);

      handleResize();

      engineRef.current = {
        sync: () => {
          const newRatio =
            Math.min(window.devicePixelRatio || 1, 2) *
            clamp(configRef.current.quality, 0.25, 1);
          if (!isReady || Math.abs(newRatio - pixelRatio) > 0.001) {
            handleResize();
          } else {
            rebuildScene();
          }
          kickLoop();
        },
        destroy: () => {
          isDestroyed = true;
          cancelAnimationFrame(rafId);
          container.removeEventListener("pointermove", onPointerMove);
          container.removeEventListener("pointerleave", onPointerLeave);
          container.removeEventListener("click", onClick);
          document.removeEventListener(
            "visibilitychange",
            onVisibilityChange
          );
          canvas.removeEventListener("webglcontextlost", onContextLost);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();

          atlasData?.texture.dispose();
          stringsTexture.dispose();
          bgGeom.dispose();
          textGeom.dispose();
          bgMaterial.dispose();
          textMaterial.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        },
        strum: (nx = 0.5, ny = 0.6) => {
          triggerStrumAt(
            clamp(nx, 0, 1) * width,
            clamp(ny, 0, 1) * height
          );
        },
      };

      return () => {
        engineRef.current?.destroy();
        engineRef.current = null;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        strum: (nx = 0.5, ny = 0.6) => {
          engineRef.current?.strum(nx, ny);
        },
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        role="img"
        aria-label={text}
        className={["relative isolate h-full min-h-[240px] w-full overflow-hidden", className]
          .filter(Boolean)
          .join(" ")}
        style={{ backgroundColor, ...style }}
      >
        {children && (
          <div className="relative z-10 h-full w-full">{children}</div>
        )}
      </div>
    );
  }
);

WaveLettering.displayName = "WaveLettering";
export default WaveLettering;
