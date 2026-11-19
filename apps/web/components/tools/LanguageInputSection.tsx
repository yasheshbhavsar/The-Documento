"use client";

import React from "react";
import {
  LANGUAGE_TEST_LABELS,
  type ActiveLanguageTestType,
  type CLBLevel,
  type LanguageAbilities,
  type LanguageTestType,
} from "../../lib/crs/calculator";

export type LanguageAbility = keyof LanguageAbilities;
export type LanguageScores = LanguageAbilities;
export type RawAbilityScores = Record<LanguageAbility, string>;

export const ABILITY_META: Array<{
  key: LanguageAbility;
  label: string;
  shortLabel: string;
}> = [
  { key: "speaking", label: "Speaking", shortLabel: "SPK" },
  { key: "listening", label: "Listening", shortLabel: "LST" },
  { key: "reading", label: "Reading", shortLabel: "RDG" },
  { key: "writing", label: "Writing", shortLabel: "WRT" },
];

export const FIRST_LANG_TEST_ORDER: ActiveLanguageTestType[] = [
  "celpip_g",
  "ielts_gt",
  "pte_core",
  "tef_canada",
  "tcf_canada",
];

export const EMPTY_RAW_SCORES: RawAbilityScores = {
  speaking: "",
  listening: "",
  reading: "",
  writing: "",
};

export interface LanguageInputSectionProps {
  title: string;
  subtitle?: string;
  testType: LanguageTestType;
  scores: LanguageScores;
  onTestTypeChange: (nextTest: ActiveLanguageTestType) => void;
  onAbilityClbChange: (ability: LanguageAbility, clb: CLBLevel) => void;
  testOptions?: ActiveLanguageTestType[];
}

export function LanguageInputSection({
  title,
  subtitle,
  testType,
  scores,
  onTestTypeChange,
  onAbilityClbChange,
  testOptions = FIRST_LANG_TEST_ORDER,
}: LanguageInputSectionProps) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #DCE5E1",
        borderRadius: "12px",
        padding: "18px 20px",
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: "12px", color: "#526360", marginTop: "2px" }}>{subtitle}</div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
        {testOptions.map((t) => {
          const active = testType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTestTypeChange(t)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: active ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                background: active ? "#EAF4F0" : "#FFFFFF",
                color: active ? "#063C3D" : "#526360",
                fontSize: "12px",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {LANGUAGE_TEST_LABELS[t] || t}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
        }}
      >
        {ABILITY_META.map((ab) => (
          <label
            key={ab.key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#374744",
            }}
          >
            <span>{ab.label} (CLB)</span>
            <select
              value={scores[ab.key]}
              onChange={(e) => onAbilityClbChange(ab.key, Number(e.target.value) as CLBLevel)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                fontSize: "13px",
                color: "#063C3D",
              }}
            >
              {[0, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl === 0 ? "Below CLB 4" : lvl === 10 ? "CLB 10+" : `CLB ${lvl}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
