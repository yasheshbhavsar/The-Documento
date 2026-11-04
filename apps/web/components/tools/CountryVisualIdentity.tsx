"use client";

import React from "react";
import {
  CalculatorCountryId,
  getCountryGroupById,
} from "../../lib/calculators/catalog";

interface CountryFlagBadgeProps {
  src: string;
  alt: string;
  size?: number;
  rounded?: number;
}

/**
 * Renders sovereign flag icons edge-to-edge by cropping out the outer white
 * icon margin present in /public/flags/*.png.
 */
export function CountryFlagBadge({
  src,
  alt,
  size = 22,
  rounded = 6,
}: CountryFlagBadgeProps) {
  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${rounded}px`,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "#FFFFFF",
        border: "1px solid rgba(6, 60, 61, 0.14)",
        boxShadow: "0 1px 2px rgba(6, 60, 61, 0.08)",
      }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.26)",
          display: "block",
        }}
      />
    </span>
  );
}

interface CountryCalculatorHeroCardProps {
  countryId: CalculatorCountryId;
  authorityLabel: string;
  headlineMetric: string;
  subMetric?: string;
  children?: React.ReactNode;
}

/**
 * Editorial personalized country identity card displayed in the top-right hero
 * column of individual PR calculators.
 */
export function CountryCalculatorHeroCard({
  countryId,
  authorityLabel,
  headlineMetric,
  subMetric,
  children,
}: CountryCalculatorHeroCardProps) {
  const group = getCountryGroupById(countryId);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #CFDCD7",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 14px 32px -18px rgba(6, 60, 61, 0.14)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "118px",
          overflow: "hidden",
          background: "#0A3A3A",
        }}
      >
        <img
          src={group.heroImageSrc}
          alt={`${group.countryName} — ${group.landmarkLabel}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 42%",
            display: "block",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(6, 36, 37, 0.08) 0%, rgba(6, 36, 37, 0.72) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "12px",
            right: "12px",
            bottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "4px 9px 4px 5px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontSize: "11.5px",
              fontWeight: 750,
              color: "#063C3D",
            }}
          >
            <CountryFlagBadge
              src={group.flagSrc}
              alt={`${group.countryName} flag`}
              size={18}
              rounded={999}
            />
            <span>{group.countryName}</span>
          </span>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.94)",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.45)",
            }}
          >
            {group.landmarkLabel}
          </span>
        </div>
      </div>

      <div style={{ padding: "13px 16px", textAlign: "left" }}>
        <div
          style={{
            fontSize: "11.5px",
            fontWeight: 700,
            color: "#0D6866",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {authorityLabel}
        </div>
        <div
          style={{
            fontSize: "13.5px",
            fontWeight: 700,
            color: "#063C3D",
            marginTop: "3px",
            lineHeight: 1.35,
          }}
        >
          {headlineMetric}
        </div>
        {subMetric && (
          <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
            {subMetric}
          </div>
        )}
        {children && <div style={{ marginTop: "10px" }}>{children}</div>}
      </div>
    </div>
  );
}

