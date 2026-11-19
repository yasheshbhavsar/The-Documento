import React, { useMemo } from "react";
import { MessageThreadItem, ThreadMessageItem } from "../../lib/types";
import { ClientLanguage } from "../../lib/clientLocalization";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";

export const CANONICAL_MESSAGING_SYNC_EVENT = "documento-canonical-messaging-updated";

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
  caseId?: string;
  caseNumber?: string;
  jurisdiction?: string;
  language?: ClientLanguage;
  clientName?: string;
}

export function resolveQuickChatPrompts(
  jurisdiction?: string | null,
  language: ClientLanguage = "en"
): string[] {
  const jur = (jurisdiction || "").trim().toLowerCase();
  const isCanada = !jur || jur.includes("canada") || jur.includes("ircc") || jur === "ca";
  const isUS = jur.includes("united states") || jur.includes("uscis") || jur.includes("usa") || jur === "us";
  const isUK = jur.includes("united kingdom") || jur.includes("ukvi") || jur.includes("home office") || jur === "uk";
  const isAU = jur.includes("australia") || jur.includes("home affairs") || jur === "au";
  const isDE = jur.includes("germany") || jur === "de";
  const isNZ = jur.includes("new zealand") || jur.includes("inz") || jur === "nz";

  const translationPrompt =
    language === "gu"
      ? "Do we need certified translations for Gujarati marriage card?"
      : language === "hi"
        ? "Do we need certified translations for Hindi civil documents?"
        : "Do we need certified translations for non-English civil documents?";

  if (isUS) {
    return [
      "How long will the USCIS Form I-797C Receipt Notice take after filing?",
      "Should we request USCIS Premium Processing (Form I-907)?",
      "When should I schedule the Form I-693 civil surgeon medical exam?",
      translationPrompt,
    ];
  }

  if (isUK) {
    return [
      "How long will UKVI biometric enrolment and decision take after submission?",
      "Do my bank statements meet the 28-day UKVI financial evidence rule?",
      "When should we generate the sponsor's UKVI right-to-reside share code?",
      translationPrompt,
    ];
  }

  if (isAU) {
    return [
      "How long will the ImmiAccount acknowledgement take after lodgement?",
      "When will the HAP ID be generated for my Bupa medical examination?",
      "Do we need Form 80 and AFP / overseas police clearances ready now?",
      language === "en"
        ? "Do we need NAATI-certified translations for non-English documents?"
        : translationPrompt,
    ];
  }

  if (isDE) {
    return [
      "How long will the German Embassy / Ausländerbehörde visa processing take?",
      "Has my university degree been verified in the Anabin / ZAB database?",
      "What is the required Sperrkonto (blocked account) or salary threshold?",
      language === "en"
        ? "Do we need sworn German translations for civil and academic records?"
        : translationPrompt,
    ];
  }

  if (isNZ) {
    return [
      "How long will Immigration New Zealand (INZ) take to allocate a case officer?",
      "When should I complete my eMedical chest X-ray and general medical exam?",
      "Do my employment reference letters meet INZ Skilled Migrant criteria?",
      translationPrompt,
    ];
  }

  // Default / Canada (IRCC)
  return [
    "How long will the IRCC AOR take after filing?",
    "Does the spousal residential lease need both our signatures?",
    "When should I complete the upfront medical examination?",
    isCanada && language === "gu"
      ? "Do we need certified translations for Gujarati marriage card?"
      : translationPrompt,
  ];
}

export function syncClientMessageToCanonicalThreadStore(params: {
  content: string;
  caseId?: string;
  caseNumber?: string;
  senderName?: string;
  senderId?: string;
  senderRole?: "client" | "lawyer";
}): ThreadMessageItem | null {
  if (typeof window === "undefined" || !params.content.trim()) return null;
  const trimmed = params.content.trim();
  const nowIso = new Date().toISOString();
  const resolvedCaseId = params.caseId || "";
  const resolvedCaseNumber = params.caseNumber || (resolvedCaseId ? resolvedCaseId.toUpperCase() : "ACTIVE-CASE");

  try {
    const rawThreads = window.localStorage.getItem("documento_msg_threads_v3_clean");
    const parsedThreads: MessageThreadItem[] = rawThreads ? JSON.parse(rawThreads) : [];
    const threadsList = Array.isArray(parsedThreads) ? parsedThreads : [];

    const rawMsgs = window.localStorage.getItem("documento_thread_msgs_v3_clean");
    const parsedMsgs: ThreadMessageItem[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    const msgsList = Array.isArray(parsedMsgs) ? parsedMsgs : [];

    let targetThread = threadsList.find(
      (t) =>
        (resolvedCaseId && t.case_id === resolvedCaseId) ||
        (params.caseNumber && t.case_number === params.caseNumber)
    );

    if (!targetThread) {
      targetThread = {
        id: `thread-${resolvedCaseId || "active-case"}`,
        case_id: resolvedCaseId,
        case_number: resolvedCaseNumber,
        subject: `Case Correspondence — ${resolvedCaseNumber}`,
        thread_type: "client_inquiry",
        status: "open",
        created_at: nowIso,
        updated_at: nowIso,
        messages_count: 1,
        unread_count: 0,
        last_message_preview: trimmed,
      };
      threadsList.unshift(targetThread);
    } else {
      targetThread.messages_count = (targetThread.messages_count || 0) + 1;
      targetThread.last_message_preview = trimmed;
      targetThread.updated_at = nowIso;
    }

    const duplicateExists = msgsList.some(
      (m) =>
        m.thread_id === targetThread!.id &&
        m.content === trimmed &&
        Math.abs(new Date(m.created_at).getTime() - Date.now()) < 2000
    );

    const newMsg: ThreadMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      thread_id: targetThread.id,
      sender_id: params.senderId || "client-applicant",
      sender_name: params.senderName || "Primary Applicant",
      sender_role: params.senderRole || "client",
      content: trimmed,
      is_internal: false,
      attachment_document_ids: [],
      delivery_status: "delivered",
      created_at: nowIso,
    };

    if (!duplicateExists) {
      msgsList.push(newMsg);
      window.localStorage.setItem("documento_msg_threads_v3_clean", JSON.stringify(threadsList));
      window.localStorage.setItem("documento_thread_msgs_v3_clean", JSON.stringify(msgsList));
    }

    window.dispatchEvent(
      new CustomEvent(CANONICAL_MESSAGING_SYNC_EVENT, {
        detail: {
          caseId: resolvedCaseId,
          threadId: targetThread.id,
          message: newMsg,
        },
      })
    );
    return newMsg;
  } catch {
    return null;
  }
}

export function ClientDirectChatWidget({
  hasAssignedOfficer,
  displayOfficerTitle,
  firmDisplayName = "Legal Practice Portal",
  quickChatMessage,
  onQuickChatChange,
  onSendMessage,
  onOpenMessagesTab,
  quickChatSentFeedback,
  setQuickChatSentFeedback,
  caseId,
  caseNumber,
  jurisdiction,
  language = "en",
  clientName = "Primary Applicant",
}: ClientDirectChatWidgetProps) {
  const ws = useWorkspaceSafe();
  const activeCase = useMemo(
    () =>
      ws?.cases?.find((c) => (caseId ? c.id === caseId : true)) || null,
    [ws?.cases, caseId]
  );
  const effectiveCaseId = caseId || activeCase?.id;
  const effectiveCaseNumber = caseNumber || activeCase?.case_number;
  const effectiveJurisdiction = jurisdiction || activeCase?.jurisdiction;

  const quickPrompts = useMemo(
    () => resolveQuickChatPrompts(effectiveJurisdiction, language),
    [effectiveJurisdiction, language]
  );

  const officerInitials = hasAssignedOfficer
    ? displayOfficerTitle
        .replace(/^(Officer|Counsel|Attorney)\s+/i, "")
        .replace(/,\s*Esq\.?$/i, "")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  const handleSend = () => {
    const sentText = quickChatMessage.trim();
    if (!sentText) return;
    onSendMessage?.(sentText);
    if (ws?.handleSendMessage && onSendMessage !== ws.handleSendMessage) {
      void ws.handleSendMessage(sentText);
    }
    syncClientMessageToCanonicalThreadStore({
      content: sentText,
      caseId: effectiveCaseId,
      caseNumber: effectiveCaseNumber,
      senderName: ws?.currentUser?.full_name || clientName,
      senderId: ws?.currentUser?.id || "client-applicant",
      senderRole: "client",
    });
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
        border: "1px solid #DCE5E1",
        borderRadius: "12px",
        padding: "20px 22px",
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
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: hasAssignedOfficer ? "#0D6866" : "#F1F5F9",
                color: hasAssignedOfficer ? "#FFFFFF" : "#64748B",
                fontSize: hasAssignedOfficer ? "14px" : "16px",
                fontWeight: 750,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: hasAssignedOfficer ? "1.5px solid #B9DED4" : "1.5px solid #CBD5E1",
              }}
            >
              {hasAssignedOfficer ? (
                officerInitials
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="M7 21h10" />
                  <path d="M12 3v18" />
                  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                </svg>
              )}
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
          {quickPrompts.map((prompt) => (
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {prompt}
              </span>
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
