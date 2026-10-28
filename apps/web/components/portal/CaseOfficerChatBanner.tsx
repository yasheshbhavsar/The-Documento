import React from "react";
import { ClientLanguage, CLIENT_TRANSLATIONS } from "../../lib/clientLocalization";

interface CaseOfficerChatBannerProps {
  caseNumber?: string;
  visaCategory?: string;
  assignedOfficer?: string | null;
  onSelectPrompt?: (prompt: string) => void;
  language?: ClientLanguage;
}

export function CaseOfficerChatBanner({
  caseNumber = "CASE-US-8841",
  visaCategory = "EB-1A Extraordinary Ability",
  assignedOfficer,
  onSelectPrompt,
  language = "en",
}: CaseOfficerChatBannerProps) {
  const t = CLIENT_TRANSLATIONS[language];

  // If assignedOfficer is explicitly undefined (e.g. standalone tests), default to Sarah Jenkins.
  // If assignedOfficer is null or empty, it indicates no officer has been assigned yet.
  const isOfficerAssigned =
    assignedOfficer !== undefined
      ? Boolean(
          assignedOfficer &&
          !assignedOfficer.toLowerCase().includes("unassigned") &&
          assignedOfficer.toLowerCase() !== "none"
        )
      : true;

  const resolvedOfficerName = isOfficerAssigned
    ? (assignedOfficer || "Officer Sarah Jenkins, Esq.")
    : null;

  const displayOfficerName = resolvedOfficerName
    ? (resolvedOfficerName.startsWith("Officer") ? resolvedOfficerName : `Officer ${resolvedOfficerName}`)
    : "No Officer Assigned Yet";

  const initials = isOfficerAssigned && resolvedOfficerName
    ? resolvedOfficerName
        .replace(/^(Officer|Dr\.|Attorney)\s+/i, "")
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "SJ"
    : "—";

  const quickPrompts = [
    {
      title: t.promptChips.timeline.title,
      prompt: t.promptChips.timeline.prompt,
    },
    {
      title: t.promptChips.travel.title,
      prompt: t.promptChips.travel.prompt,
    },
    {
      title: t.promptChips.taxReturns.title,
      prompt: t.promptChips.taxReturns.prompt,
    },
    {
      title: t.promptChips.approvalCopy.title,
      prompt: t.promptChips.approvalCopy.prompt,
    },
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #B9DED4",
        borderRadius: "14px",
        padding: "18px 22px",
        boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Top Officer Info Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                background: isOfficerAssigned ? "#0D6866" : "#F1F5F9",
                color: isOfficerAssigned ? "#FFFFFF" : "#64748B",
                fontSize: isOfficerAssigned ? "16px" : "18px",
                fontWeight: 750,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isOfficerAssigned ? "0 2px 6px rgba(13, 104, 102, 0.25)" : "none",
                border: isOfficerAssigned ? "none" : "1.5px solid #CBD5E1",
              }}
            >
              {isOfficerAssigned ? initials : "⚖️"}
            </div>
            {/* Live Green Online Dot (only if officer is assigned) */}
            {isOfficerAssigned && (
              <span
                style={{
                  position: "absolute",
                  bottom: "0",
                  right: "0",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#22C55E",
                  border: "2px solid #FFFFFF",
                }}
                title="Online now"
              />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: isOfficerAssigned ? "#063C3D" : "#475569" }}>
                {displayOfficerName}
              </h3>
              {isOfficerAssigned ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 650,
                    background: "#EAF6F0",
                    color: "#0D6866",
                    border: "1px solid #B9DED4",
                    padding: "1px 7px",
                    borderRadius: "12px",
                  }}
                >
                  {t.assignedOfficerTitle}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#FEF3C7",
                    color: "#92400E",
                    border: "1px solid #FCD34D",
                    padding: "1px 7px",
                    borderRadius: "12px",
                  }}
                >
                  PENDING ALLOCATION
                </span>
              )}
              <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                {isOfficerAssigned
                  ? "Bar #NY-519284 • Assisted by Officer Marcus Vance"
                  : "Counsel allocation in progress • Vanguard Immigration Law Group"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", fontSize: "12px", color: "#445451" }}>
              {isOfficerAssigned ? (
                <>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#166534", fontWeight: 600 }}>
                    <span>●</span> {t.officerBannerTitle}
                  </span>
                  <span>•</span>
                  <span style={{ color: "#6E7F7C" }}>
                    {t.officerOnlineStatusText}
                  </span>
                </>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#B45309", fontWeight: 600 }}>
                  <span>●</span> Awaiting Case Manager Allocation
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Case Badge & Legal Privilege Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "6px 10px",
              fontSize: "11px",
              color: "#063C3D",
              fontFamily: "monospace",
              fontWeight: 600,
            }}
          >
            Ref: {caseNumber} ({visaCategory})
          </div>
          <span
            style={{
              background: "#F1F6F4",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "6px 10px",
              fontSize: "11px",
              color: "#445451",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>🛡️</span> {t.officerLegalPrivilegeBadge}
          </span>
        </div>
      </div>

      {/* Suggested Quick Inquiry Chips */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t.quickInquiryHeader}
          </div>
          {language !== "en" && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#0D6866",
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                padding: "1px 6px",
                borderRadius: "4px",
              }}
            >
              🌐 Bilingual English Coordination Active
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {quickPrompts.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectPrompt?.(item.prompt)}
              style={{
                background: "#F8F7F2",
                border: "1px solid #B9DED4",
                borderRadius: "20px",
                padding: "6px 13px",
                fontSize: "12px",
                color: "#0D6866",
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "left",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EAF6F0";
                e.currentTarget.style.borderColor = "#0D6866";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F8F7F2";
                e.currentTarget.style.borderColor = "#B9DED4";
              }}
            >
              <span>💬</span>
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

