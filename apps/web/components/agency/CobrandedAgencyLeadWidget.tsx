"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Send, CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  type AgencyTenantRecord,
  clearActiveCobrandedAgency,
  resolveActiveCobrandedAgency,
  submitCobrandedCalculatorLead,
} from "../../lib/agencyPlatformStore";

export interface CobrandedAgencyLeadWidgetProps {
  calculatorId: string;
  calculatorTitle: string;
  countryCode: string;
  liveScoreSummary: string;
  hasCalculatedScore: boolean;
  scorePayload?: Record<string, unknown>;
  initialAgencySlug?: string;
}

export function CobrandedAgencyLeadWidget({
  calculatorId,
  calculatorTitle,
  countryCode,
  liveScoreSummary,
  hasCalculatedScore,
  scorePayload,
  initialAgencySlug,
}: CobrandedAgencyLeadWidgetProps) {
  const [partnerAgency, setPartnerAgency] = useState<AgencyTenantRecord | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedAtScore, setSubmittedAtScore] = useState<string | null>(null);

  useEffect(() => {
    setPartnerAgency(resolveActiveCobrandedAgency(initialAgencySlug));
  }, [initialAgencySlug]);

  if (!partnerAgency) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasCalculatedScore) {
      setErrorMsg(
        "Complete your statutory profile inputs first so counsel receives your computed points rather than a 0-point blank scorecard."
      );
      return;
    }

    if (!applicantName.trim() || !applicantEmail.trim() || !applicantEmail.includes("@")) {
      setErrorMsg("Enter your full name and a valid email address to transmit your scorecard.");
      return;
    }

    try {
      submitCobrandedCalculatorLead({
        agencySlug: partnerAgency.slug,
        applicantName,
        applicantEmail,
        applicantPhone,
        calculatorId,
        calculatorTitle,
        countryCode,
        scoreSummary: liveScoreSummary,
        scorePayload,
      });
      setSubmittedAtScore(liveScoreSummary);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not transmit scorecard to partner agency.");
    }
  };

  const handleClearAttribution = () => {
    clearActiveCobrandedAgency();
    setPartnerAgency(null);
  };

  return (
    <section
      data-testid="cobranded-calculator-lead-widget"
      className="mt-5 rounded-xl border border-[#0D6866]/35 bg-[#FFFFFF] p-4 text-left"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5ECE9] pb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0D6866]/25 bg-[#F2F7F5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#063C3D]">
            <ShieldCheck className="h-3 w-3 text-[#0D6866]" />
            KYB Verified Partner • {partnerAgency.regulatoryBody} ({partnerAgency.licenseNumber})
          </div>
          <h4 className="mt-1.5 text-sm font-bold text-[#063C3D]">
            Send Live Scorecard to {partnerAgency.tradingName}
          </h4>
          <p className="text-xs text-[#4A6566]">
            {partnerAgency.hqCity}, {partnerAgency.hqCountry} • Direct counsel intake with your computed breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calculators?agency=${encodeURIComponent(partnerAgency.slug)}`}
            className="text-[11px] font-semibold text-[#0D6866] hover:underline"
          >
            All Partner Grids
          </Link>
          <button
            type="button"
            onClick={handleClearAttribution}
            title="Exit co-branded partner session"
            className="inline-flex items-center gap-1 rounded-md border border-[#DCE5E1] px-2 py-1 text-[11px] font-medium text-[#566E6F] hover:bg-[#F8F7F2]"
          >
            <X className="h-3 w-3" />
            Unbranded
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#DCE5E1] bg-[#F8F7F2] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#566E6F]">
          Attached Statutory Score
        </span>
        <span
          data-testid="cobranded-live-score-badge"
          className="font-mono text-xs font-bold tabular-nums text-[#063C3D]"
        >
          {liveScoreSummary}
        </span>
      </div>

      {submittedAtScore ? (
        <div
          data-testid="cobranded-lead-submitted-banner"
          className="mt-3 rounded-lg border border-[#0D6866]/30 bg-[#F2F7F5] p-3 text-xs text-[#063C3D]"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-[#0D6866]" />
            Scorecard Transmitted to {partnerAgency.tradingName}
          </div>
          <p className="mt-1 text-[#355253]">
            Recorded <span className="font-semibold tabular-nums">{submittedAtScore}</span> for{" "}
            <span className="font-semibold">{applicantName}</span> ({applicantEmail}). Licensed counsel can now
            convert your breakdown directly into a consultation dossier.
          </p>
          {partnerAgency.branding.consultationBookingUrl && (
            <div className="mt-2.5">
              <a
                href={partnerAgency.branding.consultationBookingUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="cobranded-book-consultation-link"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#063C3D] px-3 py-1.5 text-[11px] font-bold text-[#F8F7F2] hover:bg-[#0D6866]"
              >
                Book Consultation with {partnerAgency.tradingName} ↗
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
          {!hasCalculatedScore && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/80 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Select your age, credentials, or language scores above first — zero-point blank sheets cannot be
                transmitted to counsel.
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="Full legal name"
              aria-label="Applicant full name"
              className="rounded-lg border border-[#DCE5E1] bg-white px-3 py-2 text-xs text-[#063C3D] placeholder:text-[#7A9192] focus:border-[#0D6866] focus:outline-none"
            />
            <input
              type="email"
              value={applicantEmail}
              onChange={(e) => setApplicantEmail(e.target.value)}
              placeholder="Email address"
              aria-label="Applicant email address"
              className="rounded-lg border border-[#DCE5E1] bg-white px-3 py-2 text-xs text-[#063C3D] placeholder:text-[#7A9192] focus:border-[#0D6866] focus:outline-none"
            />
            <input
              type="tel"
              value={applicantPhone}
              onChange={(e) => setApplicantPhone(e.target.value)}
              placeholder="Phone / WhatsApp (optional)"
              aria-label="Applicant phone"
              className="rounded-lg border border-[#DCE5E1] bg-white px-3 py-2 text-xs text-[#063C3D] placeholder:text-[#7A9192] focus:border-[#0D6866] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!hasCalculatedScore}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#063C3D] px-4 py-2.5 text-xs font-bold text-[#F8F7F2] transition-colors hover:bg-[#0D6866] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Transmit Verified Scorecard to {partnerAgency.tradingName}
          </button>
        </form>
      )}
    </section>
  );
}
