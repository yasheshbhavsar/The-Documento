"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CountryDivisionMatrix } from "./CountryDivisionMatrix";
import { CountryFlagBadge } from "./CountryVisualIdentity";
import {
  AgencyTenantRecord,
  resolveActiveCobrandedAgency,
  submitCobrandedCalculatorLead,
  withAgencyAttribution,
} from "../../lib/agencyPlatformStore";
import {
  CALCULATOR_COUNTRY_GROUPS,
  CalculatorCountryId,
  getCountryGroupById,
  GlobalCalculatorEntry,
} from "../../lib/calculators/catalog";

interface RadarCountrySnapshot {
  countryId: CalculatorCountryId;
  isoCode: "CA" | "AU" | "NZ" | "GB" | "DE";
  countryName: string;
  statutoryCode: string;
  passMarkMetric: string;
  offshoreDirectPr: string;
  prHorizon: string;
  ageRule: string;
  primaryHref: string;
  primaryCta: string;
}

const RADAR_SNAPSHOTS: RadarCountrySnapshot[] = [
  {
    countryId: "canada",
    isoCode: "CA",
    countryName: "Canada",
    statutoryCode: "IRCC Express Entry & 6 Provincial PNP Grids",
    passMarkMetric: "1,270 Max CRS • Category & PNP Draws",
    offshoreDirectPr: "Yes — FSW, French NCLC 7+ & Outland PNP",
    prHorizon: "Direct PR (~6 mos post-ITA)",
    ageRule: "No hard age ban (Peak 20–29 yrs)",
    primaryHref: "/crs-calculator",
    primaryCta: "Open Canada CRS Calculator →",
  },
  {
    countryId: "australia",
    isoCode: "AU",
    countryName: "Australia",
    statutoryCode: "Migration Regulations 1994 — Schedule 6D",
    passMarkMetric: "65 Pts Minimum (189 / 190 +5 / 491 +15)",
    offshoreDirectPr: "Yes — Subclass 189 & State-Nominated 190/491",
    prHorizon: "Direct PR (189/190) or 3-Yr 191 PR",
    ageRule: "Strict < 45 yrs at invitation",
    primaryHref: "/calculators/australia-pr",
    primaryCta: "Open Australia SkillSelect →",
  },
  {
    countryId: "new_zealand",
    isoCode: "NZ",
    countryName: "New Zealand",
    statutoryCode: "INZ Skilled Migrant Category (Aug 24, 2026)",
    passMarkMetric: "6 Pts OR Experience / Trades Route (NZD $35/hr)",
    offshoreDirectPr: "Requires Accredited NZ Employer Job / Offer",
    prHorizon: "Immediate Resident → PR Visa at 24 mos",
    ageRule: "Strict ≤ 55 yrs at residence filing",
    primaryHref: "/calculators/new-zealand-smc",
    primaryCta: "Open New Zealand SMC →",
  },
  {
    countryId: "united_kingdom",
    isoCode: "GB",
    countryName: "United Kingdom",
    statutoryCode: "Appendix Skilled Worker & Settlement (2026)",
    passMarkMetric: "70 / 70 Pts (50 Mandatory + 20 Salary/PhD)",
    offshoreDirectPr: "Sponsor CoS Required (£41,700 std / £33,400 PhD·NE)",
    prHorizon: "Indefinite Leave to Remain (ILR) at 5 yrs",
    ageRule: "No upper age cap (<26 New Entrant bonus)",
    primaryHref: "/calculators/uk-skilled-worker",
    primaryCta: "Open UK 70-Pt & ILR Tool →",
  },
  {
    countryId: "germany",
    isoCode: "DE",
    countryName: "Germany",
    statutoryCode: "§ 20b Chancenkarte & § 18g EU Blue Card",
    passMarkMetric: "6 Pts (Job-Search) • €50,700 / €45,934 Blue Card",
    offshoreDirectPr: "Unsponsored Entry via Chancenkarte → Blue Card",
    prHorizon: "Fast-Track PR in 21 mos (B1) or 27 mos (A1)",
    ageRule: "No Blue Card cap (≤35 = +2 Chancenkarte pts)",
    primaryHref: "/calculators/germany-pr",
    primaryCta: "Open Germany PR Calculator →",
  },
];

interface ScoreSegment {
  label: string;
  weightPct: number;
  ptsLabel: string;
  color: string;
}

const SCORE_ARCHITECTURE_BY_CALC: Record<string, ScoreSegment[]> = {
  ca_crs: [
    { label: "Core / Spouse", weightPct: 42, ptsLabel: "500 pts", color: "#063C3D" },
    { label: "Skill Transferability", weightPct: 14, ptsLabel: "100 pts", color: "#0D6866" },
    { label: "PNP / French / Additional", weightPct: 44, ptsLabel: "600 pts", color: "#169B77" },
  ],
  ca_pnp: [
    { label: "Human Capital & CLB", weightPct: 38, ptsLabel: "Language & Edu", color: "#063C3D" },
    { label: "Job Offer & Wage Tier", weightPct: 36, ptsLabel: "TEER & Wage", color: "#0D6866" },
    { label: "Regional & Provincial Ties", weightPct: 26, ptsLabel: "Adaptability", color: "#169B77" },
  ],
  au_skillselect: [
    { label: "Age", weightPct: 24, ptsLabel: "30 pts", color: "#063C3D" },
    { label: "English & Edu", weightPct: 32, ptsLabel: "40 pts", color: "#0D6866" },
    { label: "Work (Cap 20)", weightPct: 18, ptsLabel: "20 pts", color: "#169B77" },
    { label: "STEM / Partner / State", weightPct: 26, ptsLabel: "Up to 45 pts", color: "#4BA88E" },
  ],
  nz_smc: [
    { label: "Primary Anchor (Deg / Reg / Wage)", weightPct: 67, ptsLabel: "3–6 pts", color: "#063C3D" },
    { label: "Skilled NZ Work Top-Up", weightPct: 33, ptsLabel: "1–3 pts", color: "#169B77" },
  ],
  uk_skilled_ilr: [
    { label: "CoS + RQF 6+", weightPct: 57, ptsLabel: "40 Mandatory", color: "#063C3D" },
    { label: "CEFR B2 English", weightPct: 14, ptsLabel: "10 Mandatory", color: "#0D6866" },
    { label: "Tradeable Salary / PhD", weightPct: 29, ptsLabel: "20 Tradeable", color: "#169B77" },
  ],
  de_chancenkarte_bluecard: [
    { label: "Partial Eq. / Shortage", weightPct: 36, ptsLabel: "Up to 5 pts", color: "#063C3D" },
    { label: "Experience & German/EN", weightPct: 42, ptsLabel: "Up to 7 pts", color: "#0D6866" },
    { label: "Age & German Ties", weightPct: 22, ptsLabel: "Up to 4 pts", color: "#169B77" },
  ],
};

type MatcherAge = "" | "18_29" | "30_35" | "36_44" | "45_55" | "56_plus";
type MatcherDegree = "" | "trade_diploma" | "bachelors" | "masters" | "phd";
type MatcherLanguage = "" | "competent_b2" | "strong_clb9" | "superior_clb10" | "bilingual_fr_de";
type MatcherTies = "" | "offshore_no_offer" | "sponsored_offer" | "local_study_or_work";

interface MatcherState {
  age: MatcherAge;
  degree: MatcherDegree;
  language: MatcherLanguage;
  ties: MatcherTies;
}

const EMPTY_MATCHER: MatcherState = {
  age: "",
  degree: "",
  language: "",
  ties: "",
};

interface CountryMatchEvaluation {
  countryId: CalculatorCountryId;
  isoCode: string;
  countryName: string;
  href: string;
  readinessPct: number;
  statusLabel: string;
  tone: "strong" | "moderate" | "gated" | "neutral";
  pathwayNote: string;
}

function evaluateLiveCountryFit(state: MatcherState): {
  hasInput: boolean;
  rows: CountryMatchEvaluation[];
} {
  const hasInput = Boolean(state.age || state.degree || state.language || state.ties);
  if (!hasInput) {
    return {
      hasInput: false,
      rows: [
        {
          countryId: "canada",
          isoCode: "CA",
          countryName: "Canada",
          href: "/crs-calculator",
          readinessPct: 0,
          statusLabel: "Awaiting Selection",
          tone: "neutral",
          pathwayNote: "Express Entry CRS & 6-Province PNP grids start at 0.",
        },
        {
          countryId: "australia",
          isoCode: "AU",
          countryName: "Australia",
          href: "/calculators/australia-pr",
          readinessPct: 0,
          statusLabel: "Awaiting Selection",
          tone: "neutral",
          pathwayNote: "SkillSelect Subclasses 189, 190 & 491 (65-pt pass mark).",
        },
        {
          countryId: "new_zealand",
          isoCode: "NZ",
          countryName: "New Zealand",
          href: "/calculators/new-zealand-smc",
          readinessPct: 0,
          statusLabel: "Awaiting Selection",
          tone: "neutral",
          pathwayNote: "Aug 24, 2026 SMC 6-Point, Experience & Trades routes.",
        },
        {
          countryId: "united_kingdom",
          isoCode: "GB",
          countryName: "United Kingdom",
          href: "/calculators/uk-skilled-worker",
          readinessPct: 0,
          statusLabel: "Awaiting Selection",
          tone: "neutral",
          pathwayNote: "70-Point Skilled Worker sponsorship & 5-year ILR.",
        },
        {
          countryId: "germany",
          isoCode: "DE",
          countryName: "Germany",
          href: "/calculators/germany-pr",
          readinessPct: 0,
          statusLabel: "Awaiting Selection",
          tone: "neutral",
          pathwayNote: "6-Point Chancenkarte & 21/27-month EU Blue Card PR.",
        },
      ],
    };
  }

  let caScore = 32;
  if (state.age === "18_29") caScore += 24;
  else if (state.age === "30_35") caScore += 18;
  else if (state.age === "36_44") caScore += 8;
  if (state.degree === "masters" || state.degree === "phd") caScore += 20;
  else if (state.degree === "bachelors") caScore += 14;
  else if (state.degree === "trade_diploma") caScore += 8;
  if (state.language === "bilingual_fr_de") caScore += 26;
  else if (state.language === "superior_clb10") caScore += 20;
  else if (state.language === "strong_clb9") caScore += 16;
  else if (state.language === "competent_b2") caScore += 6;
  if (state.ties === "local_study_or_work") caScore += 18;
  else if (state.ties === "sponsored_offer") caScore += 16;
  else if (state.ties === "offshore_no_offer") caScore += 6;
  caScore = Math.min(98, caScore);

  const caNote =
    state.language === "bilingual_fr_de"
      ? "French NCLC 7+ unlocks +50 CRS & priority category-based draws."
      : state.ties === "sponsored_offer"
        ? "Provincial Nomination (PNP) adds +600 CRS for guaranteed ITA."
        : state.age === "45_55" || state.age === "56_plus"
          ? "Age CRS drops to 0 at 45+; target Provincial Nominee (PNP) or French draws."
          : "Strong fit for Express Entry CEC / FSW or category-based draws.";

  const auAgeBlocked = state.age === "45_55" || state.age === "56_plus";
  let auScore = 28;
  if (auAgeBlocked) {
    auScore = 0;
  } else {
    if (state.age === "18_29" || state.age === "30_35") auScore += 24;
    else if (state.age === "36_44") auScore += 14;
    if (state.degree === "phd") auScore += 20;
    else if (state.degree === "masters" || state.degree === "bachelors") auScore += 15;
    else if (state.degree === "trade_diploma") auScore += 10;
    if (state.language === "superior_clb10") auScore += 22;
    else if (state.language === "strong_clb9" || state.language === "bilingual_fr_de") auScore += 14;
    else if (state.language === "competent_b2") auScore += 4;
    if (state.ties === "local_study_or_work") auScore += 16;
    else if (state.ties === "sponsored_offer") auScore += 14;
    else if (state.ties === "offshore_no_offer") auScore += 8;
    auScore = Math.min(97, auScore);
  }

  const nzAgeBlocked = state.age === "56_plus";
  const nzNeedsJob = state.ties === "offshore_no_offer";
  let nzScore = 26;
  if (nzAgeBlocked) {
    nzScore = 0;
  } else {
    if (state.age) nzScore += 12;
    if (state.degree === "phd") nzScore += 28;
    else if (state.degree === "masters") nzScore += 22;
    else if (state.degree === "bachelors") nzScore += 16;
    else if (state.degree === "trade_diploma") nzScore += 12;
    if (state.language) nzScore += 10;
    if (state.ties === "sponsored_offer") nzScore += 26;
    else if (state.ties === "local_study_or_work") nzScore += 24;
    else if (nzNeedsJob) nzScore = Math.min(nzScore, 42);
    nzScore = Math.min(96, nzScore);
  }

  let ukScore = 24;
  if (state.degree === "phd") ukScore += 22;
  else if (state.degree === "masters" || state.degree === "bachelors") ukScore += 16;
  else if (state.degree === "trade_diploma") ukScore += 6;
  if (state.language) ukScore += 14;
  if (state.age === "18_29") ukScore += 10;
  if (state.ties === "sponsored_offer") ukScore += 32;
  else if (state.ties === "local_study_or_work") ukScore += 22;
  else if (state.ties === "offshore_no_offer") ukScore = Math.min(ukScore, 38);
  ukScore = Math.min(96, ukScore);

  let deScore = 30;
  if (state.age === "18_29" || state.age === "30_35") deScore += 16;
  else if (state.age === "36_44") deScore += 10;
  else if (state.age === "45_55" || state.age === "56_plus") deScore += 6;
  if (state.degree === "phd" || state.degree === "masters" || state.degree === "bachelors") deScore += 20;
  else if (state.degree === "trade_diploma") deScore += 14;
  if (state.language === "bilingual_fr_de") deScore += 22;
  else if (state.language === "superior_clb10" || state.language === "strong_clb9") deScore += 14;
  else if (state.language === "competent_b2") deScore += 10;
  if (state.ties === "sponsored_offer") deScore += 20;
  else if (state.ties === "offshore_no_offer") deScore += 14;
  else if (state.ties === "local_study_or_work") deScore += 18;
  deScore = Math.min(97, deScore);

  return {
    hasInput: true,
    rows: [
      {
        countryId: "canada",
        isoCode: "CA",
        countryName: "Canada",
        href: state.age === "45_55" || state.ties === "sponsored_offer" ? "/pnp-calculator" : "/crs-calculator",
        readinessPct: caScore,
        statusLabel: caScore >= 72 ? "Strong Direct PR Fit" : "Competitive via PNP / Draws",
        tone: caScore >= 72 ? "strong" : "moderate",
        pathwayNote: caNote,
      },
      {
        countryId: "australia",
        isoCode: "AU",
        countryName: "Australia",
        href: "/calculators/australia-pr",
        readinessPct: auScore,
        statusLabel: auAgeBlocked
          ? "Ineligible (Age 45+ Gate)"
          : auScore >= 72
            ? "Strong 189 / 190 / 491 Fit"
            : "Target 190 (+5) or 491 (+15)",
        tone: auAgeBlocked ? "gated" : auScore >= 72 ? "strong" : "moderate",
        pathwayNote: auAgeBlocked
          ? "Schedule 6D requires applicants to be under 45 at invitation."
          : state.language === "superior_clb10"
            ? "Superior English (+20 pts) puts Subclass 189 & 190 in reach."
            : "State Nomination (+5) or Regional 491 (+15) boosts EOI rank.",
      },
      {
        countryId: "new_zealand",
        isoCode: "NZ",
        countryName: "New Zealand",
        href: "/calculators/new-zealand-smc",
        readinessPct: nzScore,
        statusLabel: nzAgeBlocked
          ? "Ineligible (Age 56+ Gate)"
          : nzNeedsJob
            ? "Needs Accredited NZ Job"
            : nzScore >= 70
              ? "Ready for 6-Pt SMC"
              : "Top-Up w/ 1–3 Yr NZ Work",
        tone: nzAgeBlocked || nzNeedsJob ? "gated" : nzScore >= 70 ? "strong" : "moderate",
        pathwayNote: nzAgeBlocked
          ? "SMC Residence requires filing on or before age 55."
          : nzNeedsJob
            ? "SMC allows age up to 55, but requires an Accredited NZ Employer role."
            : state.degree === "trade_diploma"
              ? "Check the Aug 24, 2026 Trades & Technician Residence Pathway."
              : "6-Point grid combines degree/wage anchor + NZ work top-up.",
      },
      {
        countryId: "united_kingdom",
        isoCode: "GB",
        countryName: "United Kingdom",
        href: "/calculators/uk-skilled-worker",
        readinessPct: ukScore,
        statusLabel:
          state.ties === "offshore_no_offer"
            ? "Requires Licensed CoS"
            : ukScore >= 70
              ? "Strong 70-Pt & ILR Path"
              : "Verify £41,700 / £33,400 Floor",
        tone: state.ties === "offshore_no_offer" ? "gated" : ukScore >= 70 ? "strong" : "moderate",
        pathwayNote:
          state.ties === "offshore_no_offer"
            ? "Requires a UK Licensed Sponsor Certificate of Sponsorship (CoS)."
            : state.age === "18_29" || state.degree === "phd"
              ? "Eligible for £33,400 New Entrant / STEM PhD discounted threshold."
              : "No upper age limit; leads to Indefinite Leave to Remain in 5 yrs.",
      },
      {
        countryId: "germany",
        isoCode: "DE",
        countryName: "Germany",
        href: "/calculators/germany-pr",
        readinessPct: deScore,
        statusLabel:
          state.ties === "sponsored_offer"
            ? "21–27 Mo EU Blue Card PR"
            : deScore >= 70
              ? "Strong Chancenkarte Fit"
              : "6-Pt Chancenkarte Route",
        tone: deScore >= 70 ? "strong" : "moderate",
        pathwayNote:
          state.ties === "sponsored_offer"
            ? "EU Blue Card (€45,934–€50,700) grants PR in 21 mos (B1) or 27 mos."
            : "Chancenkarte grants 12-mo unsponsored entry in Germany to secure a role.",
      },
    ],
  };
}

function CalculatorSpotlightCard({
  calc,
  agencySlug,
}: {
  calc: GlobalCalculatorEntry;
  agencySlug?: string | null;
}) {
  const [spot, setSpot] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const segments = SCORE_ARCHITECTURE_BY_CALC[calc.id] ?? [];

  return (
    <div
      className="hub-spotlight-card"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSpot({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
          });
        }
      }}
      onMouseLeave={() => setSpot((prev) => ({ ...prev, active: false }))}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "rgba(255, 255, 255, 0.93)",
        border: "1px solid #D8E3DF",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "18px",
        transition:
          "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.22s ease",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: spot.active ? 1 : 0,
          transition: "opacity 0.25s ease",
          background: `radial-gradient(460px circle at ${spot.x}% ${spot.y}%, rgba(22, 155, 119, 0.08), transparent 65%)`,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 650, color: "#0D6866" }}>
            {calc.authority}
          </span>
          <span
            style={{
              fontSize: "11.5px",
              fontWeight: 750,
              padding: "3px 9px",
              borderRadius: "999px",
              background: "#EAF6F0",
              color: "#07594F",
              border: "1px solid #B9DED4",
            }}
          >
            {calc.badgeLabel}
          </span>
        </div>

        <h3
          style={{
            fontSize: "19.5px",
            fontWeight: 750,
            color: "#063C3D",
            margin: "0 0 8px 0",
            lineHeight: 1.24,
            letterSpacing: "-0.015em",
          }}
        >
          {calc.fullTitle}
        </h3>

        <p
          style={{
            fontSize: "13.8px",
            color: "#445451",
            lineHeight: 1.58,
            margin: "0 0 16px 0",
          }}
        >
          {calc.description}
        </p>

        {segments.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4EDE9",
              borderRadius: "10px",
              padding: "11px 12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "7px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#526663",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Statutory Score Architecture</span>
              <span style={{ color: "#0D6866" }}>0-Point Default</span>
            </div>
            <div
              style={{
                display: "flex",
                height: "7px",
                borderRadius: "999px",
                overflow: "hidden",
                gap: "2px",
                background: "#EBF1EE",
              }}
            >
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  title={`${seg.label}: ${seg.ptsLabel}`}
                  style={{
                    width: `${seg.weightPct}%`,
                    background: seg.color,
                    borderRadius: "999px",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              {segments.map((seg) => (
                <span
                  key={seg.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11.5px",
                    color: "#445451",
                    fontWeight: 550,
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: seg.color,
                      display: "inline-block",
                    }}
                  />
                  <span>{seg.label}</span>
                  <strong style={{ color: "#063C3D", fontWeight: 700 }}>({seg.ptsLabel})</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
            gap: "10px",
            paddingTop: "12px",
            borderTop: "1px solid #E2ECE8",
            fontSize: "12.5px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#063C3D" }}>Pass Mark / Threshold</div>
            <div style={{ color: "#445451", marginTop: "2px" }}>{calc.passMarkSummary}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#063C3D" }}>Pathway to PR</div>
            <div style={{ color: "#445451", marginTop: "2px" }}>{calc.prTimelineSummary}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          paddingTop: "6px",
        }}
      >
        <Link
          href={withAgencyAttribution(calc.href, agencySlug)}
          className="hub-primary-calc-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            borderRadius: "9px",
            background: "linear-gradient(135deg, #063C3D 0%, #095250 100%)",
            color: "#FFFFFF",
            fontSize: "13.5px",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(6, 60, 61, 0.16)",
            transition: "all 0.2s ease",
          }}
        >
          <span>Open {calc.shortTitle}</span>
          <span aria-hidden="true">→</span>
        </Link>
        <a
          href={calc.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "12.5px",
            fontWeight: 650,
            color: "#0D6866",
            textDecoration: "none",
            borderBottom: "1px solid rgba(13, 104, 102, 0.35)",
            paddingBottom: "1px",
          }}
        >
          Official Government Rules ↗
        </a>
      </div>
    </div>
  );
}

const COBRANDED_CALC_OPTIONS = [
  { id: "canada-crs", title: "Canada Express Entry CRS", countryCode: "CA" },
  { id: "canada-pnp", title: "Canada Provincial Nominee (PNP)", countryCode: "CA" },
  { id: "australia-pr", title: "Australia SkillSelect (189 / 190 / 491)", countryCode: "AU" },
  { id: "new-zealand-smc", title: "New Zealand 6-Point SMC", countryCode: "NZ" },
  { id: "uk-skilled-worker", title: "UK 70-Point Skilled Worker & ILR", countryCode: "UK" },
  { id: "germany-pr", title: "Germany Chancenkarte & EU Blue Card", countryCode: "DE" },
] as const;

export function PrCalculatorsHubView({ initialAgencySlug }: { initialAgencySlug?: string } = {}) {
  const [selectedCountry, setSelectedCountry] = useState<"all" | CalculatorCountryId>("all");
  const [radarCountry, setRadarCountry] = useState<CalculatorCountryId>("canada");
  const [matcher, setMatcher] = useState<MatcherState>(EMPTY_MATCHER);

  // Co-Branded Partner Agency Lead Bridge (?agency=<slug>)
  const [partnerAgency, setPartnerAgency] = useState<AgencyTenantRecord | null>(null);
  const [leadFormOpen, setLeadFormOpen] = useState<boolean>(false);
  const [leadName, setLeadName] = useState<string>("");
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [leadCalcId, setLeadCalcId] = useState<string>("canada-crs");
  const [leadScoreSummary, setLeadScoreSummary] = useState<string>("");
  const [leadSubmittedMsg, setLeadSubmittedMsg] = useState<string | null>(null);
  const [leadErrorMsg, setLeadErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setPartnerAgency(resolveActiveCobrandedAgency(initialAgencySlug));
  }, [initialAgencySlug]);

  const handleSubmitCobrandedLead = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadErrorMsg(null);
    if (!partnerAgency) return;
    if (!leadName.trim() || !leadEmail.includes("@") || !leadScoreSummary.trim()) {
      setLeadErrorMsg("Please enter your full name, valid email, and calculated score summary.");
      return;
    }
    const calcSpec =
      COBRANDED_CALC_OPTIONS.find((c) => c.id === leadCalcId) || COBRANDED_CALC_OPTIONS[0];
    try {
      submitCobrandedCalculatorLead({
        agencySlug: partnerAgency.slug,
        applicantName: leadName,
        applicantEmail: leadEmail,
        applicantPhone: leadPhone,
        calculatorId: calcSpec.id,
        calculatorTitle: calcSpec.title,
        countryCode: calcSpec.countryCode,
        scoreSummary: leadScoreSummary,
      });
      setLeadSubmittedMsg(
        `Your ${calcSpec.title} scorecard (${leadScoreSummary.trim()}) has been routed securely to ${partnerAgency.tradingName}.`
      );
      setLeadName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadScoreSummary("");
      setLeadFormOpen(false);
    } catch (err: any) {
      setLeadErrorMsg(err?.message || "Unable to submit scorecard right now.");
    }
  };

  const visibleGroups =
    selectedCountry === "all"
      ? CALCULATOR_COUNTRY_GROUPS
      : CALCULATOR_COUNTRY_GROUPS.filter((g) => g.countryId === selectedCountry);

  const activeRadar =
    RADAR_SNAPSHOTS.find((s) => s.countryId === radarCountry) ?? RADAR_SNAPSHOTS[0];
  const activeRadarGroup = getCountryGroupById(activeRadar.countryId);

  const liveMatch = useMemo(() => evaluateLiveCountryFit(matcher), [matcher]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F7F2",
        color: "#172322",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Frosted Sticky Documento Navigation Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div
          style={{
            maxWidth: "1320px",
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              <DocumentoLogo size="md" showWordmark showDomain />
            </Link>
            <span
              aria-hidden="true"
              style={{
                width: "1px",
                height: "20px",
                background: "#DCE5E1",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
              PR Calculators
            </span>
          </div>

          <nav
            aria-label="Calculator Hub Navigation"
            style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
          >
            <Link
              href="/"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#445451",
                padding: "8px 12px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Platform Overview
            </Link>
            <Link
              href="/agency-onboarding"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#445451",
                padding: "8px 12px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              For Visa Agencies
            </Link>
            <Link
              href="/extractor"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#0D6866",
                background: "#EAF5EF",
                border: "1px solid #CBE4DA",
                padding: "8px 14px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              AI Document Lab
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: "13.5px",
                fontWeight: 650,
                color: "#FFFFFF",
                background: "#063C3D",
                padding: "8px 16px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Open Legal Workspace
            </Link>
          </nav>
        </div>
      </header>

      {/* Co-Branded Partner Agency Assessment Strip (?agency=<slug>) */}
      {partnerAgency && (
        <section
          data-testid="cobranded-agency-banner"
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid #B9DED4",
          }}
        >
          <div
            style={{
              maxWidth: "1320px",
              margin: "0 auto",
              padding: "16px 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 750,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "#EAF6F0",
                      color: "#176B50",
                      border: "1px solid #B9DED4",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Verified Documento Partner • {partnerAgency.regulatoryBody} ({partnerAgency.licenseNumber})
                  </span>
                  <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    {partnerAgency.hqCity}, {partnerAgency.hqCountry}
                  </span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
                  {partnerAgency.tradingName} — Official PR &amp; Skilled Points Assessment Portal
                </div>
                {partnerAgency.branding.tagline && (
                  <div style={{ fontSize: "12.5px", color: "#445451", marginTop: "2px" }}>
                    {partnerAgency.branding.tagline}
                  </div>
                )}
              </div>

              <button
                type="button"
                data-testid="open-cobranded-lead-form-btn"
                onClick={() => {
                  setLeadSubmittedMsg(null);
                  setLeadFormOpen((prev) => !prev);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #063C3D",
                  background: partnerAgency.branding.primaryColor || "#063C3D",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {leadFormOpen
                  ? "Close Scorecard Submission"
                  : `Submit PR Scorecard to ${partnerAgency.tradingName} →`}
              </button>
            </div>

            {leadSubmittedMsg && (
              <div
                data-testid="cobranded-lead-confirmation"
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#EAF6F0",
                  border: "1px solid #B9DED4",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#063C3D",
                }}
              >
                {leadSubmittedMsg}
              </div>
            )}

            {leadFormOpen && (
              <form
                data-testid="cobranded-lead-form"
                onSubmit={handleSubmitCobrandedLead}
                style={{
                  marginTop: "14px",
                  padding: "16px 18px",
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label htmlFor="cb-lead-name" style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                    Applicant Full Name *
                  </label>
                  <input
                    id="cb-lead-name"
                    type="text"
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="e.g. Rohan Deshmukh"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFFFFF" }}
                  />
                </div>

                <div>
                  <label htmlFor="cb-lead-email" style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                    Email Address *
                  </label>
                  <input
                    id="cb-lead-email"
                    type="email"
                    required
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="rohan@example.com"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFFFFF" }}
                  />
                </div>

                <div>
                  <label htmlFor="cb-lead-calc" style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                    Calculator / Corridor *
                  </label>
                  <select
                    id="cb-lead-calc"
                    value={leadCalcId}
                    onChange={(e) => setLeadCalcId(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFFFFF" }}
                  >
                    {COBRANDED_CALC_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cb-lead-score" style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                    Calculated Score Summary *
                  </label>
                  <input
                    id="cb-lead-score"
                    type="text"
                    required
                    value={leadScoreSummary}
                    onChange={(e) => setLeadScoreSummary(e.target.value)}
                    placeholder="e.g. 518 CRS (CLB 9 + Master's)"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFFFFF" }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    data-testid="submit-cobranded-lead-btn"
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: "6px",
                      border: "1px solid #0D6866",
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Send Scorecard
                  </button>
                </div>

                {leadErrorMsg && (
                  <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#B91C1C", fontWeight: 600 }}>
                    {leadErrorMsg}
                  </div>
                )}
              </form>
            )}
          </div>
        </section>
      )}

      {/* Clean, Dot-Free Editorial Hero Banner */}
      <section
        data-testid="hub-hero-section"
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid #DCE5E1",
          background: "linear-gradient(180deg, #FAF9F5 0%, #F4F6F4 100%)",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "1320px",
            margin: "0 auto",
            padding: "44px 24px 40px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "28px",
            alignItems: "center",
          }}
        >
          <div className="hub-hero-left" style={{ gridColumn: "span 7" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 12px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid #CBE4DA",
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#07594F",
                marginBottom: "16px",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              }}
            >
              <span
                className="status-dot-pulse"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#169B77",
                  display: "inline-block",
                }}
              />
              <span>2026 Sovereign Statutory Rules • Audited &amp; Zero-Preset</span>
            </div>

            <h1
              style={{
                fontSize: "clamp(32px, 3.8vw, 48px)",
                fontWeight: 750,
                color: "#063C3D",
                lineHeight: 1.06,
                letterSpacing: "-0.03em",
                margin: "0 0 14px 0",
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              PR &amp; Skilled Migration Calculators
            </h1>

            <p
              style={{
                fontSize: "16px",
                color: "#445451",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
                maxWidth: "64ch",
              }}
            >
              Country-separated permanent residence and skilled points engines across{" "}
              <strong style={{ color: "#063C3D" }}>
                Canada, Australia, New Zealand, the United Kingdom, and Germany
              </strong>
              . Every calculator starts strictly at zero points and enforces live 2026 statutory
              caps, wage floors, and settlement rules.
            </p>

            {/* Interactive Sovereign Flag Medallion Strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "18px",
              }}
            >
              {CALCULATOR_COUNTRY_GROUPS.map((grp) => {
                const isRadar = grp.countryId === radarCountry;
                return (
                  <button
                    key={grp.countryId}
                    type="button"
                    onClick={() => setRadarCountry(grp.countryId)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "5px 11px 5px 6px",
                      borderRadius: "999px",
                      border: isRadar ? "1.5px solid #063C3D" : "1px solid #D5E2DD",
                      background: isRadar ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
                      color: "#063C3D",
                      fontSize: "12.5px",
                      fontWeight: isRadar ? 750 : 600,
                      cursor: "pointer",
                      boxShadow: isRadar
                        ? "0 6px 14px -6px rgba(6, 60, 61, 0.18)"
                        : "0 1px 3px rgba(6, 60, 61, 0.04)",
                      transition: "all 0.18s ease",
                    }}
                  >
                    <CountryFlagBadge
                      src={grp.flagSrc}
                      alt={`${grp.countryName} flag`}
                      size={20}
                      rounded={999}
                    />
                    <span>{grp.countryName}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {[
                { k: "5", v: "Sovereign Jurisdictions" },
                { k: "11", v: "Federal & Provincial Grids" },
                { k: "0-Pt", v: "Unbiased Default State" },
              ].map((pill) => (
                <div
                  key={pill.v}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: "7px",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.86)",
                    border: "1px solid #DCE5E1",
                    boxShadow: "0 2px 6px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "#063C3D" }}>
                    {pill.k}
                  </span>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#526663" }}>
                    {pill.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Sovereign Jurisdiction Radar Card with Country Photography */}
          <div
            className="hub-hero-right"
            data-testid="sovereign-radar-card"
            style={{
              gridColumn: "span 5",
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid #C9DAD4",
              borderRadius: "18px",
              padding: "18px 20px",
              boxShadow: "0 20px 44px -18px rgba(6, 60, 61, 0.16)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 750,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "#0D6866",
                }}
              >
                Interactive Statutory Radar
              </span>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C6E6A" }}>
                Click country to inspect
              </span>
            </div>

            {/* 5-Country Switcher Pills with Sovereign Flags */}
            <div
              role="tablist"
              aria-label="Inspect Jurisdiction Rules"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "5px",
                padding: "4px",
                borderRadius: "10px",
                background: "#F2F6F4",
                border: "1px solid #E1EBE7",
                marginBottom: "14px",
              }}
            >
              {RADAR_SNAPSHOTS.map((snap) => {
                const isSelected = snap.countryId === activeRadar.countryId;
                const snapGroup = getCountryGroupById(snap.countryId);
                return (
                  <button
                    key={snap.countryId}
                    type="button"
                    role="tab"
                    aria-label={snap.isoCode}
                    aria-selected={isSelected}
                    onClick={() => setRadarCountry(snap.countryId)}
                    style={{
                      padding: "6px 4px",
                      borderRadius: "7px",
                      border: "none",
                      background: isSelected ? "#063C3D" : "transparent",
                      color: isSelected ? "#FFFFFF" : "#384A46",
                      fontSize: "11.5px",
                      fontWeight: 750,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.18s ease",
                    }}
                  >
                    <CountryFlagBadge
                      src={snapGroup.flagSrc}
                      alt=""
                      size={16}
                      rounded={999}
                    />
                    <span>{snap.isoCode}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Country Editorial Architectural Window + Telemetry */}
            <div key={activeRadar.countryId} className="radar-panel-fade">
              <div
                style={{
                  position: "relative",
                  height: "144px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  marginBottom: "12px",
                  background: "#073435",
                  border: "1px solid #D5E2DD",
                }}
              >
                <img
                  src={activeRadarGroup.heroImageSrc}
                  alt={`${activeRadar.countryName} — ${activeRadarGroup.landmarkLabel}`}
                  className="radar-country-photo"
                  data-testid="radar-country-photo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center 45%",
                    display: "block",
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(6, 36, 37, 0.05) 0%, rgba(6, 36, 37, 0.78) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "12px",
                    right: "12px",
                    bottom: "10px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        marginBottom: "2px",
                      }}
                    >
                      <CountryFlagBadge
                        src={activeRadarGroup.flagSrc}
                        alt={`${activeRadar.countryName} flag`}
                        size={22}
                        rounded={6}
                      />
                      <span
                        style={{
                          fontSize: "19px",
                          fontWeight: 800,
                          color: "#FFFFFF",
                          letterSpacing: "-0.02em",
                          textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                        }}
                      >
                        {activeRadar.countryName}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "rgba(234, 246, 240, 0.95)",
                      }}
                    >
                      {activeRadar.statutoryCode}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgba(255, 255, 255, 0.18)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255, 255, 255, 0.28)",
                      fontSize: "10.5px",
                      fontWeight: 650,
                      color: "#FFFFFF",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeRadarGroup.landmarkLabel}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                  padding: "11px 13px",
                  borderRadius: "10px",
                  background: "#F8FAF9",
                  border: "1px solid #E3ECE8",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ color: "#5C6E6A", fontWeight: 600 }}>Pass Mark</span>
                  <strong style={{ color: "#063C3D", textAlign: "right" }}>
                    {activeRadar.passMarkMetric}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ color: "#5C6E6A", fontWeight: 600 }}>Offshore Route</span>
                  <strong style={{ color: "#063C3D", textAlign: "right" }}>
                    {activeRadar.offshoreDirectPr}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ color: "#5C6E6A", fontWeight: 600 }}>Age Ceiling</span>
                  <strong style={{ color: "#063C3D", textAlign: "right" }}>
                    {activeRadar.ageRule}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ color: "#5C6E6A", fontWeight: 600 }}>PR Horizon</span>
                  <strong style={{ color: "#07594F", textAlign: "right" }}>
                    {activeRadar.prHorizon}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCountry(activeRadar.countryId)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontSize: "12px",
                    fontWeight: 650,
                    color: "#526663",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Filter list to {activeRadar.countryName}
                </button>
                <Link
                  href={withAgencyAttribution(activeRadar.primaryHref, partnerAgency?.slug)}
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 750,
                    color: "#0D6866",
                    textDecoration: "none",
                  }}
                >
                  {activeRadar.primaryCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main style={{ width: "100%" }}>
        {/* Division 1: 5-Country Explorer & Filter Bar with Subtle Meridian Crosshair Matrix */}
        <div
          data-testid="hub-division-explorer"
          style={{
            position: "relative",
            overflow: "hidden",
            borderBottom: "1px solid #DCE5E1",
            background: "#F7F6F0",
          }}
        >
          <CountryDivisionMatrix variant="explorer" />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "1320px",
              margin: "0 auto",
              padding: "36px 24px 28px 24px",
            }}
          >
            <section
              data-testid="pr-pathway-pulse"
              aria-labelledby="pathway-pulse-heading"
              style={{
                background: "rgba(255, 255, 255, 0.90)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "1px solid #D5E2DD",
                borderRadius: "16px",
                padding: "26px 28px",
                marginBottom: "28px",
                boxShadow: "0 12px 32px -18px rgba(6, 60, 61, 0.09)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 750,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "#0D6866",
                      marginBottom: "4px",
                    }}
                  >
                    Interactive Cross-Border Diagnostic
                  </div>
                  <h2
                    id="pathway-pulse-heading"
                    style={{
                      fontSize: "20px",
                      fontWeight: 750,
                      color: "#063C3D",
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    5-Country PR Fit &amp; Statutory Gate Explorer
                  </h2>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {liveMatch.hasInput ? (
                    <button
                      type="button"
                      onClick={() => setMatcher(EMPTY_MATCHER)}
                      style={{
                        padding: "7px 13px",
                        borderRadius: "8px",
                        border: "1px solid #BDCDC7",
                        background: "#F4F8F6",
                        color: "#063C3D",
                        fontSize: "12.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Reset Explorer to 0
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#5C6E6A",
                        background: "#F4F8F6",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: "1px solid #E3ECE8",
                      }}
                    >
                      Select any trait below to compare live country eligibility
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: "24px",
                  alignItems: "start",
                }}
              >
                <div
                  className="hub-matcher-col"
                  style={{
                    gridColumn: "span 6",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: "#063C3D",
                        marginBottom: "6px",
                      }}
                    >
                      1. Age Bracket
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(
                        [
                          ["18_29", "18–29 yrs"],
                          ["30_35", "30–35 yrs"],
                          ["36_44", "36–44 yrs"],
                          ["45_55", "45–55 yrs"],
                          ["56_plus", "56+ yrs"],
                        ] as Array<[MatcherAge, string]>
                      ).map(([val, lbl]) => {
                        const active = matcher.age === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setMatcher((prev) => ({ ...prev, age: prev.age === val ? "" : val }))
                            }
                            style={{
                              padding: "6px 11px",
                              borderRadius: "8px",
                              border: active ? "1px solid #063C3D" : "1px solid #D5E2DD",
                              background: active ? "#063C3D" : "#F9FAF9",
                              color: active ? "#FFFFFF" : "#243533",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.16s ease",
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: "#063C3D",
                        marginBottom: "6px",
                      }}
                    >
                      2. Highest Recognized Credential
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(
                        [
                          ["trade_diploma", "Trade / Diploma"],
                          ["bachelors", "Bachelor's"],
                          ["masters", "Master's"],
                          ["phd", "Doctorate / PhD"],
                        ] as Array<[MatcherDegree, string]>
                      ).map(([val, lbl]) => {
                        const active = matcher.degree === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setMatcher((prev) => ({
                                ...prev,
                                degree: prev.degree === val ? "" : val,
                              }))
                            }
                            style={{
                              padding: "6px 11px",
                              borderRadius: "8px",
                              border: active ? "1px solid #063C3D" : "1px solid #D5E2DD",
                              background: active ? "#063C3D" : "#F9FAF9",
                              color: active ? "#FFFFFF" : "#243533",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.16s ease",
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: "#063C3D",
                        marginBottom: "6px",
                      }}
                    >
                      3. Language Benchmark
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(
                        [
                          ["competent_b2", "Competent (IELTS 6 / B2)"],
                          ["strong_clb9", "Strong (CLB 9 / IELTS 7+)"],
                          ["superior_clb10", "Superior (IELTS 8+ / PTE 79+)"],
                          ["bilingual_fr_de", "+ French NCLC 7 / German B1+"],
                        ] as Array<[MatcherLanguage, string]>
                      ).map(([val, lbl]) => {
                        const active = matcher.language === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setMatcher((prev) => ({
                                ...prev,
                                language: prev.language === val ? "" : val,
                              }))
                            }
                            style={{
                              padding: "6px 11px",
                              borderRadius: "8px",
                              border: active ? "1px solid #063C3D" : "1px solid #D5E2DD",
                              background: active ? "#063C3D" : "#F9FAF9",
                              color: active ? "#FFFFFF" : "#243533",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.16s ease",
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: "#063C3D",
                        marginBottom: "6px",
                      }}
                    >
                      4. Employment Offer / Destination Ties
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(
                        [
                          ["offshore_no_offer", "Offshore — No Job Offer"],
                          ["sponsored_offer", "Local Sponsored Job Offer"],
                          ["local_study_or_work", "Onshore Study / Skilled Work"],
                        ] as Array<[MatcherTies, string]>
                      ).map(([val, lbl]) => {
                        const active = matcher.ties === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setMatcher((prev) => ({
                                ...prev,
                                ties: prev.ties === val ? "" : val,
                              }))
                            }
                            style={{
                              padding: "6px 11px",
                              borderRadius: "8px",
                              border: active ? "1px solid #063C3D" : "1px solid #D5E2DD",
                              background: active ? "#063C3D" : "#F9FAF9",
                              color: active ? "#FFFFFF" : "#243533",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.16s ease",
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div
                  className="hub-matcher-col"
                  style={{
                    gridColumn: "span 6",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {liveMatch.rows.map((row) => {
                    const rowGroup = getCountryGroupById(row.countryId);
                    const barColor =
                      row.tone === "strong"
                        ? "#169B77"
                        : row.tone === "moderate"
                          ? "#0D6866"
                          : row.tone === "gated"
                            ? "#C47F17"
                            : "#DCE5E1";
                    const pillBg =
                      row.tone === "strong"
                        ? "#E8F6F0"
                        : row.tone === "moderate"
                          ? "#EEF5F3"
                          : row.tone === "gated"
                            ? "#FEF7EA"
                            : "#F4F7F6";
                    const pillColor =
                      row.tone === "strong"
                        ? "#07594F"
                        : row.tone === "moderate"
                          ? "#063C3D"
                          : row.tone === "gated"
                            ? "#8A5A10"
                            : "#5C6E6A";

                    return (
                      <div
                        key={row.countryId}
                        style={{
                          padding: "11px 14px",
                          borderRadius: "10px",
                          background: "#F9FAF9",
                          border: "1px solid #E3ECE8",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            marginBottom: "6px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <CountryFlagBadge
                              src={rowGroup.flagSrc}
                              alt={`${row.countryName} flag`}
                              size={22}
                              rounded={6}
                            />
                            <span style={{ fontSize: "13.5px", fontWeight: 750, color: "#063C3D" }}>
                              {row.countryName}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: pillBg,
                                color: pillColor,
                              }}
                            >
                              {row.statusLabel}
                            </span>
                            <Link
                              href={withAgencyAttribution(row.href, partnerAgency?.slug)}
                              style={{
                                fontSize: "12px",
                                fontWeight: 750,
                                color: "#0D6866",
                                textDecoration: "none",
                              }}
                            >
                              Score →
                            </Link>
                          </div>
                        </div>

                        <div
                          style={{
                            height: "6px",
                            borderRadius: "999px",
                            background: "#E6EEEB",
                            overflow: "hidden",
                            marginBottom: "6px",
                          }}
                        >
                          <div
                            style={{
                              width: `${row.readinessPct}%`,
                              height: "100%",
                              borderRadius: "999px",
                              background: barColor,
                              transition: "width 0.48s cubic-bezier(0.16, 1, 0.3, 1)",
                            }}
                          />
                        </div>

                        <div style={{ fontSize: "12px", color: "#4E605D", lineHeight: 1.4 }}>
                          {row.pathwayNote}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              aria-label="Filter Calculators by Country"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  aria-pressed={selectedCountry === "all"}
                  onClick={() => setSelectedCountry("all")}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "999px",
                    border: selectedCountry === "all" ? "1px solid #063C3D" : "1px solid #DCE5E1",
                    background: selectedCountry === "all" ? "#063C3D" : "#FFFFFF",
                    color: selectedCountry === "all" ? "#FFFFFF" : "#172322",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  All Countries (6)
                </button>

                {CALCULATOR_COUNTRY_GROUPS.map((group) => {
                  const active = selectedCountry === group.countryId;
                  return (
                    <button
                      key={group.countryId}
                      type="button"
                      data-testid={`hub-filter-${group.countryId}`}
                      aria-pressed={active}
                      onClick={() => setSelectedCountry(group.countryId)}
                      style={{
                        padding: "7px 15px 7px 9px",
                        borderRadius: "999px",
                        border: active ? "1px solid #063C3D" : "1px solid #DCE5E1",
                        background: active ? "#063C3D" : "#FFFFFF",
                        color: active ? "#FFFFFF" : "#172322",
                        fontSize: "13px",
                        fontWeight: 650,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <CountryFlagBadge
                        src={group.flagSrc}
                        alt={`${group.countryName} flag`}
                        size={20}
                        rounded={999}
                      />
                      <span>
                        {group.countryName} ({group.calculators.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#5C6E6A" }}>
                Showing {visibleGroups.reduce((acc, g) => acc + g.calculators.length, 0)} official
                calculator(s)
              </span>
            </section>
          </div>
        </div>

        {/* Country-Separated Divisions: Each Jurisdiction Has Its Own Sovereign Motif Matrix */}
        <div>
          {visibleGroups.map((group, idx) => (
            <div
              key={group.countryId}
              data-testid={`hub-division-${group.countryId}`}
              style={{
                position: "relative",
                overflow: "hidden",
                borderBottom: "1px solid #DCE5E1",
                background: idx % 2 === 0 ? "#FAF9F5" : "#F3F7F5",
              }}
            >
              <CountryDivisionMatrix variant={group.countryId} />

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  maxWidth: "1320px",
                  margin: "0 auto",
                  padding: "32px 24px",
                }}
              >
                <section
                  className="hub-country-section"
                  aria-labelledby={`country-heading-${group.countryId}`}
                  style={{
                    background: "rgba(255, 255, 255, 0.64)",
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                    border: "1px solid #D5E2DD",
                    borderRadius: "18px",
                    overflow: "hidden",
                    boxShadow: "0 14px 34px -20px rgba(6, 60, 61, 0.11)",
                    animationDelay: `${idx * 55}ms`,
                  }}
                >
                  <div
                    className="hub-country-banner"
                    style={{
                      position: "relative",
                      minHeight: "152px",
                      padding: "24px 28px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "14px",
                      background: "#063435",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={group.heroImageSrc}
                      alt={`${group.countryName} — ${group.landmarkLabel}`}
                      className="hub-country-banner-img"
                      loading="lazy"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center 44%",
                        display: "block",
                      }}
                    />
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, rgba(5, 36, 37, 0.88) 0%, rgba(5, 36, 37, 0.62) 48%, rgba(5, 36, 37, 0.18) 100%)",
                      }}
                    />

                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      <CountryFlagBadge
                        src={group.flagSrc}
                        alt={`${group.countryName} flag`}
                        size={44}
                        rounded={11}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 750,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#A7E3CE",
                            marginBottom: "2px",
                          }}
                        >
                          {group.isoCode} • {group.capitalCity} Sovereign Jurisdiction
                        </div>
                        <h2
                          id={`country-heading-${group.countryId}`}
                          style={{
                            fontSize: "26px",
                            fontWeight: 800,
                            color: "#FFFFFF",
                            margin: 0,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.12,
                            textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                          }}
                        >
                          {group.countryName}
                        </h2>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 550,
                            color: "rgba(241, 248, 245, 0.92)",
                            marginTop: "3px",
                          }}
                        >
                          {group.regionTag}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.18)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        fontSize: "11.5px",
                        fontWeight: 650,
                        color: "#FFFFFF",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        aria-hidden="true"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{group.landmarkLabel}</span>
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "24px 26px 26px 26px",
                      display: "grid",
                      gridTemplateColumns:
                        group.calculators.length > 1
                          ? "repeat(auto-fit, minmax(360px, 1fr))"
                          : "1fr",
                      gap: "18px",
                    }}
                  >
                    {group.calculators.map((calc) => (
                      <CalculatorSpotlightCard
                        key={calc.id}
                        calc={calc}
                        agencySlug={partnerAgency?.slug}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ))}
        </div>

        {/* United States Merit-Based Green Card Note Division with Subtle 5-Point Star Matrix */}
        <div
          data-testid="hub-division-usa"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#FAF9F5",
          }}
        >
          <CountryDivisionMatrix variant="usa" />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "1320px",
              margin: "0 auto",
              padding: "36px 24px 88px 24px",
            }}
          >
            <section
              aria-labelledby="us-statutory-note"
              style={{
                background: "rgba(255, 255, 255, 0.90)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "1px solid #D5E2DD",
                borderRadius: "14px",
                padding: "22px 26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  maxWidth: "820px",
                }}
              >
                <CountryFlagBadge
                  src="/flags/usa.png"
                  alt="United States flag"
                  size={36}
                  rounded={9}
                />
                <div>
                  <h2
                    id="us-statutory-note"
                    style={{
                      fontSize: "16px",
                      fontWeight: 750,
                      color: "#063C3D",
                      margin: "0 0 6px 0",
                    }}
                  >
                    Why isn&apos;t the United States listed in the numerical points calculators?
                  </h2>
                  <p style={{ margin: 0, fontSize: "13.5px", color: "#445451", lineHeight: 1.55 }}>
                    Unlike Canada, Australia, New Zealand, the UK, and Germany, U.S. permanent
                    residence (EB-1A Extraordinary Ability, EB-2 NIW, O-1A) is adjudicated through
                    qualitative statutory frameworks (<em>Kazarian</em> 10-criteria two-step review
                    and <em>Matter of Dhanasar</em> 3-prong test) rather than a numerical points
                    grid. Documento evaluates U.S. petitions directly inside the Evidence &amp;
                    Statutory Rules Workspace.
                  </p>
                </div>
              </div>
              <Link
                href="/#pathway-finder"
                style={{
                  padding: "10px 16px",
                  borderRadius: "9px",
                  border: "1px solid #063C3D",
                  background: "#FFFFFF",
                  color: "#063C3D",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Explore U.S. EB-1A &amp; NIW Matrix →
              </Link>
            </section>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes hubFadeSlide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes radarPhotoSettle {
          from {
            transform: scale(1.05);
          }
          to {
            transform: scale(1);
          }
        }
        .hub-country-section {
          animation: hubFadeSlide 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .radar-panel-fade {
          animation: hubFadeSlide 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .radar-country-photo {
          animation: radarPhotoSettle 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hub-country-banner-img {
          transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hub-country-section:hover .hub-country-banner-img {
          transform: scale(1.03);
        }
        .hub-spotlight-card:hover {
          transform: translateY(-3px);
          border-color: #9AC6B8 !important;
          box-shadow: 0 18px 36px -18px rgba(6, 60, 61, 0.16);
        }
        .hub-primary-calc-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(6, 60, 61, 0.24) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-country-section,
          .radar-panel-fade,
          .radar-country-photo,
          .hub-country-banner-img,
          .hub-spotlight-card,
          .hub-primary-calc-btn {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
        @media (max-width: 960px) {
          .hub-hero-left,
          .hub-hero-right,
          .hub-matcher-col {
            grid-column: span 12 !important;
          }
        }
      `}</style>
    </div>
  );
}

