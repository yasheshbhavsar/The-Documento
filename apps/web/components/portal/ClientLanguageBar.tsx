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
        border: "1px solid #B9DED4",
        borderRadius: "12px",
        padding: "10px 18px",
        marginBottom: "20px",
        boxShadow: "0 2px 6px rgba(6, 60, 61, 0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
      className="documento-client-language-bar"
    >
      {/* Left: Language indicator and helper text */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "15px",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          🌐
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "13px",
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
                padding: "2px 8px",
                borderRadius: "10px",
                background: currentLanguage !== "en" ? "#EAF6F0" : "#F1F6F4",
                color: currentLanguage !== "en" ? "#0D6866" : "#6E7F7C",
                border: `1px solid ${currentLanguage !== "en" ? "#B9DED4" : "#DCE5E1"}`,
              }}
            >
              {t.languageHelpBadge}
            </span>
          </div>
          <p
            style={{
              margin: "2px 0 0 0",
              fontSize: "11px",
              color: "#6E7F7C",
              lineHeight: 1.3,
            }}
          >
            {currentLanguage === "en"
              ? "Select Gujarati (ગુજરાતી) or Hindi (हिन्दी) if you prefer reading your case dashboard and coordinating in your native language."
              : currentLanguage === "gu"
              ? "તમે ગુજરાતીમાં વિઝા અપડેટ્સ વાંચી શકો છો અને તમારા કેસ અધિકારી સાથે દ્વિભાષી વાતચીત કરી શકો છો."
              : "आप हिन्दी में वीज़ा अपडेट पढ़ सकते हैं और अपने केस अधिकारी के साथ द्विभाषी समन्वय कर सकते हैं।"}
          </p>
        </div>
      </div>

      {/* Right: Language Toggle Segmented Control */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#F8F7F2",
          border: "1px solid #DCE5E1",
          borderRadius: "8px",
          padding: "3px",
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
                padding: "6px 12px",
                borderRadius: "6px",
                border: isSelected ? "1px solid #0D6866" : "1px solid transparent",
                background: isSelected ? "#063C3D" : "transparent",
                color: isSelected ? "#FFFFFF" : "#445451",
                fontSize: "12px",
                fontWeight: isSelected ? 700 : 550,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
                boxShadow: isSelected ? "0 1px 3px rgba(6, 60, 61, 0.2)" : "none",
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
                    opacity: isSelected ? 0.85 : 0.65,
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
