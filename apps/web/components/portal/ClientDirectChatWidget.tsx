import React from "react";

export interface ClientDirectChatWidgetProps {
  hasAssignedOfficer: boolean;
  displayOfficerTitle: string;
  firmDisplayName?: string;
  quickChatMessage: string;
  onQuickChatChange: (text: string) => void;
  onSendMessage?: (text: string) => void;
  onOpenMessagesTab?: () => void;
  quickChatSentFeedback: boolean;
  setQuickChatSentFeedback: (val: boolean) => void;
}

export function ClientDirectChatWidget({
  hasAssignedOfficer,
  displayOfficerTitle,
  firmDisplayName = "LexImmigration Law Firm",
  quickChatMessage,
  onQuickChatChange,
  onSendMessage,
  onOpenMessagesTab,
  quickChatSentFeedback,
  setQuickChatSentFeedback,
}: ClientDirectChatWidgetProps) {
  const officerInitials = hasAssignedOfficer
    ? displayOfficerTitle
        .replace(/^(Officer|Counsel|Attorney)\s+/i, "")
        .replace(/,\s*Esq\.?$/i, "")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "⚖️";

  const handleSend = () => {
    if (!quickChatMessage.trim()) return;
    onSendMessage?.(quickChatMessage);
    setQuickChatSentFeedback(true);
    onQuickChatChange("");
    setTimeout(() => {
      setQuickChatSentFeedback(false);
    }, 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1.5px solid #B9DED4",
        borderRadius: "14px",
        padding: "22px 24px",
        boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Officer Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #DCE5E1",
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: hasAssignedOfficer ? "#0D6866" : "#F1F5F9",
                color: hasAssignedOfficer ? "#FFFFFF" : "#64748B",
                fontSize: hasAssignedOfficer ? "15px" : "20px",
                fontWeight: 750,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: hasAssignedOfficer ? "1.5px solid #B9DED4" : "1.5px solid #CBD5E1",
              }}
            >
              {officerInitials}
            </div>
            {hasAssignedOfficer ? (
              <span
                style={{
                  position: "absolute",
                  bottom: "0px",
                  right: "0px",
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "#22C55E",
                  border: "2px solid #FFFFFF",
                }}
                title="Online Now"
              />
            ) : (
              <span
                style={{
                  position: "absolute",
                  bottom: "0px",
                  right: "0px",
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "#F59E0B",
                  border: "2px solid #FFFFFF",
                }}
                title="Assignment Pending"
              />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                {hasAssignedOfficer ? displayOfficerTitle : "No Officer Assigned Yet"}
              </h3>
              {hasAssignedOfficer ? (
                <span
                  style={{
                    background: "#DCFCE7",
                    color: "#166534",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid #86EFAC",
                  }}
                >
                  ONLINE NOW
                </span>
              ) : (
                <span
                  style={{
                    background: "#FEF3C7",
                    color: "#92400E",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid #FCD34D",
                  }}
                >
                  PENDING ALLOCATION
                </span>
              )}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
              {hasAssignedOfficer
                ? `Supervising Immigration Counsel • ${firmDisplayName} • Direct Encrypted Portal Line`
                : "Legal counsel assignment in progress • Inquiries routed to firm intake supervisory desk"}
            </p>
          </div>
        </div>

        {onOpenMessagesTab && (
          <button
            type="button"
            onClick={onOpenMessagesTab}
            style={{
              background: "#EAF6F0",
              color: "#0D6866",
              border: "1px solid #B9DED4",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "11.5px",
              fontWeight: 650,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>Open Full Communications Hub →</span>
          </button>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div>
        <span
          style={{
            fontSize: "11px",
            color: "#64748B",
            fontWeight: 650,
            display: "block",
            marginBottom: "6px",
          }}
        >
          {hasAssignedOfficer
            ? "Quick Question Prompts (Click to ask your caseworker):"
            : "Quick Question Prompts (Click to ask the legal intake desk):"}
        </span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            "How long will the IRCC AOR take after filing?",
            "Does the spousal residential lease need both our signatures?",
            "When should I complete the upfront medical examination?",
            "Do we need certified translations for Gujarati marriage card?",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickChatChange(prompt)}
              style={{
                padding: "4px 9px",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: "14px",
                border: "1px solid #B9DED4",
                background: "#F8FAF9",
                color: "#0D6866",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EAF6F0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F8FAF9";
              }}
            >
              💬 {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Direct Chat Input */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          value={quickChatMessage}
          onChange={(e) => onQuickChatChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasAssignedOfficer
              ? `Type a direct message to ${displayOfficerTitle}...`
              : "Type a direct message to the firm legal intake desk (Counsel pending allocation)..."
          }
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid #DCE5E1",
            background: "#F8FAF9",
            fontSize: "12.5px",
            color: "#172322",
            outline: "none",
          }}
        />
        <button
          type="button"
          disabled={!quickChatMessage.trim()}
          onClick={handleSend}
          style={{
            background: quickChatMessage.trim() ? "#0D6866" : "#E2E8F0",
            color: quickChatMessage.trim() ? "#FFFFFF" : "#94A3B8",
            border: "none",
            borderRadius: "8px",
            padding: "9px 16px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: quickChatMessage.trim() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            boxShadow: quickChatMessage.trim() ? "0 2px 6px rgba(13, 104, 102, 0.2)" : "none",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          <span>Send Message →</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {quickChatSentFeedback && (
        <div
          style={{
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "#063C3D",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>✓</span>
          <span>
            Message delivered to {hasAssignedOfficer ? displayOfficerTitle : "the firm legal intake desk"}. Your supervising counsel has been notified.
          </span>
        </div>
      )}
    </div>
  );
}
