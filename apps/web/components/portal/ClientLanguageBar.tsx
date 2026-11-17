"use client";

import React from "react";
import {
  ClientLanguage,
  SUPPORTED_CLIENT_LANGUAGES,
  CLIENT_TRANSLATIONS,
} from "../../lib/clientLocalization";

interface ClientLanguageBarProps {
  currentLanguage: ClientLanguage;
  onLanguageChange: (lang: ClientLanguage) => void;
}

function GlobeIcon({ className = "w-3.5 h-3.5 text-emerald-800" }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0D6866"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function ClientLanguageBar({
  currentLanguage,
  onLanguageChange,
}: ClientLanguageBarProps) {
  const t = CLIENT_TRANSLATIONS[currentLanguage];

  return (
    <div
      role="region"
      aria-label="Client Language Selection"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DCE5E1",
        borderRadius: "8px",
        padding: "6px 14px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
      className="documento-client-language-bar"
    >
      {/* Left: Language indicator and compact helper text */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "6px",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <GlobeIcon />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: 700,
              color: "#063C3D",
            }}
          >
            {currentLanguage === "en"
              ? "Portal Language / ભાષા પસંદગી / भाषा चयन"
              : currentLanguage === "gu"
              ? "પોર્ટલ ભાષા પસંદગી (Language)"
              : "पोर्टल भाषा चयन (Language)"}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "4px",
              background: currentLanguage !== "en" ? "#EAF6F0" : "#F1F6F4",
              color: currentLanguage !== "en" ? "#0D6866" : "#6E7F7C",
              border: `1px solid ${currentLanguage !== "en" ? "#B9DED4" : "#DCE5E1"}`,
            }}
          >
            {t.languageHelpBadge}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "#6E7F7C",
              lineHeight: 1.3,
            }}
          >
            {currentLanguage === "en"
              ? "Select Gujarati (ગુજરાતી) or Hindi (हिन्दी) for native language coordination."
              : currentLanguage === "gu"
              ? "તમે ગુજરાતીમાં વિઝા અપડેટ્સ વાંચી શકો છો અને અધિકારી સાથે વાતચીત કરી શકો છો."
              : "आप हिन्दी में वीज़ा अपडेट पढ़ सकते हैं और अधिकारी के साथ समन्वय कर सकते हैं।"}
          </span>
        </div>
      </div>

      {/* Right: Language Toggle Segmented Control */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#F8F7F2",
          border: "1px solid #DCE5E1",
          borderRadius: "6px",
          padding: "2px",
          gap: "2px",
        }}
      >
        {SUPPORTED_CLIENT_LANGUAGES.map((lang) => {
          const isSelected = currentLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onLanguageChange(lang.code)}
              style={{
                padding: "5px 10px",
                borderRadius: "5px",
                border: isSelected ? "1px solid #0D6866" : "1px solid transparent",
                background: isSelected ? "#063C3D" : "transparent",
                color: isSelected ? "#FFFFFF" : "#445451",
                fontSize: "12px",
                fontWeight: isSelected ? 700 : 550,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "#EAF6F0";
                  e.currentTarget.style.color = "#0D6866";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#445451";
                }
              }}
            >
              <span>{lang.flag}</span>
              <span>{lang.nativeLabel}</span>
              {lang.code !== "en" && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: isSelected ? 0.9 : 0.7,
                    fontFamily: "monospace",
                  }}
                >
                  ({lang.code.toUpperCase()})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
