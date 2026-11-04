"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ALL_GLOBAL_CALCULATORS,
  getCountryGroupById,
} from "../../lib/calculators/catalog";
import {
  resolveActiveCobrandedAgency,
  withAgencyAttribution,
} from "../../lib/agencyPlatformStore";
import { CountryFlagBadge } from "./CountryVisualIdentity";

interface CalculatorCountrySwitchBarProps {
  activeCalculatorId: string;
}

const COMPACT_LABEL_BY_ID: Record<string, string> = {
  ca_crs: "Express Entry CRS",
  ca_pnp: "Provincial PNP (6)",
  au_skillselect: "SkillSelect (189/190/491)",
  nz_smc: "SMC 6-Point",
  uk_skilled_ilr: "Skilled Worker & ILR",
  de_chancenkarte_bluecard: "Chancenkarte & Blue Card",
};

export function CalculatorCountrySwitchBar({
  activeCalculatorId,
}: CalculatorCountrySwitchBarProps) {
  const [agencySlug, setAgencySlug] = useState<string | null>(null);

  useEffect(() => {
    const active = resolveActiveCobrandedAgency();
    setAgencySlug(active ? active.slug : null);
  }, []);

  return (
    <div
      className="calc-peer-switch-bar"
      role="navigation"
      aria-label="Switch Country PR Calculator"
      style={{
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E3ECE8",
      }}
    >
      <div
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <Link
          href={withAgencyAttribution("/calculators", agencySlug)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 11px",
            borderRadius: "999px",
            border: "1px solid #DCE5E1",
            background: "#FFFFFF",
            color: "#063C3D",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
            transition: "all 0.18s ease",
          }}
        >
          <span>← All Countries</span>
        </Link>

        <span
          aria-hidden="true"
          style={{
            width: "1px",
            height: "16px",
            background: "#DCE5E1",
            flexShrink: 0,
          }}
        />

        {ALL_GLOBAL_CALCULATORS.map((calc) => {
          const active = calc.id === activeCalculatorId;
          const group = getCountryGroupById(calc.countryId);
          const label = COMPACT_LABEL_BY_ID[calc.id] ?? calc.shortTitle;

          return (
            <Link
              key={calc.id}
              href={withAgencyAttribution(calc.href, agencySlug)}
              aria-current={active ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 11px 5px 6px",
                borderRadius: "999px",
                border: active ? "1px solid #063C3D" : "1px solid transparent",
                background: active ? "#063C3D" : "transparent",
                color: active ? "#FFFFFF" : "#445451",
                fontSize: "12px",
                fontWeight: active ? 700 : 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all 0.18s ease",
              }}
            >
              <CountryFlagBadge
                src={group.flagSrc}
                alt={`${group.countryName} flag`}
                size={18}
                rounded={999}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <style>{`
        @media print {
          .calc-peer-switch-bar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
