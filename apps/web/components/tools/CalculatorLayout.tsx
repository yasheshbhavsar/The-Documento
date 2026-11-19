"use client";

import React from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CobrandedAgencyLeadWidget } from "../agency/CobrandedAgencyLeadWidget";

export interface CalculatorLayoutProps {
  calculatorId: string;
  calculatorTitle: string;
  countryCode: "CA" | "AU" | "NZ" | "UK" | "DE";
  scoreSummary?: string;
  badgeLabel?: string;
  headerRight?: React.ReactNode;
  heroSection?: React.ReactNode;
  children: React.ReactNode;
  footerSection?: React.ReactNode;
}

export function encodeCalculatorShareUrl<T>(paramKey: string, state: T): string {
  if (typeof window === "undefined") return "";
  try {
    const encoded = window.btoa(encodeURIComponent(JSON.stringify(state)));
    const url = new URL(window.location.href);
    url.searchParams.set(paramKey, encoded);
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function downloadCalculatorSummaryTxt(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CalculatorLayout({
  calculatorId,
  calculatorTitle,
  countryCode,
  scoreSummary,
  badgeLabel,
  headerRight,
  heroSection,
  children,
  footerSection,
}: CalculatorLayoutProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2", color: "#063C3D" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div
          style={{
            maxWidth: "1320px",
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
              <DocumentoLogo size="sm" />
            </Link>
            {badgeLabel && (
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#EAF4F0",
                  color: "#0D6866",
                  border: "1px solid #B9DED4",
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {headerRight}
          </div>
        </div>
        <CalculatorCountrySwitchBar activeCalculatorId={calculatorId} />
      </header>

      {heroSection}

      <main style={{ maxWidth: "1320px", margin: "0 auto", padding: "28px 24px 64px 24px" }}>
        {children}

        {scoreSummary && (
          <div style={{ marginTop: "32px" }}>
            <CobrandedAgencyLeadWidget
              calculatorId={calculatorId}
              calculatorTitle={calculatorTitle}
              countryCode={countryCode}
              liveScoreSummary={scoreSummary}
              hasCalculatedScore={Boolean(scoreSummary)}
            />
          </div>
        )}

        {footerSection}
      </main>
    </div>
  );
}
