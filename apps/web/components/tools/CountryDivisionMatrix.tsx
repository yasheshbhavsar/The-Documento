"use client";

import React from "react";
import { CalculatorCountryId } from "../../lib/calculators/catalog";

export type CountryMatrixVariant = CalculatorCountryId | "explorer" | "usa";

export interface CountryDivisionMatrixProps {
  variant: CountryMatrixVariant;
  className?: string;
}

const ACCENT_TINT_BY_VARIANT: Record<CountryMatrixVariant, string> = {
  explorer: "rgba(13, 104, 102, 0.06)",
  canada: "rgba(185, 28, 28, 0.05)",
  australia: "rgba(13, 104, 102, 0.05)",
  new_zealand: "rgba(15, 23, 42, 0.05)",
  united_kingdom: "rgba(29, 78, 216, 0.05)",
  germany: "rgba(180, 83, 9, 0.05)",
  usa: "rgba(30, 58, 138, 0.05)",
};

export function CountryDivisionMatrix({ variant, className = "" }: CountryDivisionMatrixProps) {
  const tint = ACCENT_TINT_BY_VARIANT[variant] || ACCENT_TINT_BY_VARIANT.explorer;

  return (
    <div
      aria-hidden="true"
      data-testid={`country-division-matrix-${variant}`}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        backgroundImage: `radial-gradient(${tint} 1px, transparent 1px), linear-gradient(180deg, ${tint} 0%, transparent 100%)`,
        backgroundSize: "24px 24px, 100% 100%",
      }}
    />
  );
}
