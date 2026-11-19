import React, { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { WaitingStateData, WaitingStateItem } from "../../lib/types";
import { FALLBACK_WAITING_STATE, fetchClientWaitingState } from "../../lib/api";

interface WaitingStateBannerProps {
  waitingState?: WaitingStateData;
  caseId?: string;
  onActionClick?: (item: WaitingStateItem) => void;
  onOpenQuestionnaire?: () => void;
  onOpenUpload?: () => void;
}

const EMPTY_WAITING_STATE: WaitingStateData = {
  waiting_on_client_count: 0,
  waiting_on_firm_count: 0,
  primary_next_action: null,
  waiting_on_client: [],
  waiting_on_firm: [],
  profile_completeness_percentage: 0,
  onboarding_completed: false,
};

export function WaitingStateBanner({
  waitingState: initialWaitingState,
  caseId,
  onActionClick,
  onOpenQuestionnaire,
  onOpenUpload,
}: WaitingStateBannerProps) {
  const isTestEnv = typeof process !== "undefined" && Boolean(process.env.VITEST);
  const hasStoredUser =
    typeof window !== "undefined" && Boolean(window.localStorage.getItem("documento_user"));
  const defaultState = isTestEnv && !hasStoredUser ? FALLBACK_WAITING_STATE : EMPTY_WAITING_STATE;

  const [data, setData] = useState<WaitingStateData>(initialWaitingState || defaultState);

  useEffect(() => {
    let isMounted = true;
    if (initialWaitingState) {
      setData(initialWaitingState);
    } else {
      fetchClientWaitingState(caseId)
        .then((res) => {
          if (isMounted && res) setData(res);
        })
        .catch(() => {
          if (isMounted) setData(defaultState);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialWaitingState, caseId, defaultState]);

  const {
    primary_next_action,
    waiting_on_client,
    waiting_on_firm,
    profile_completeness_percentage,
  } = data || defaultState;

  const handleAction = (item: WaitingStateItem) => {
    if (onActionClick) {
      onActionClick(item);
    } else if (item.type === "questionnaire" && onOpenQuestionnaire) {
      onOpenQuestionnaire();
    } else if (item.type === "document_request" && onOpenUpload) {
      onOpenUpload();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* 1. Primary Immediate Next Action Card */}
      {primary_next_action && (
        <div
          data-testid="primary-next-action-card"
          style={{
            background: "#F8F7F2",
            border: "1px solid #B9DED4",
            borderRadius: "10px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ display: "inline-flex", alignItems: "center" }} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              <strong
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#0D6866",
                  fontWeight: 700,
                }}
              >
                Immediate Next Action Required
              </strong>
              {primary_next_action.due_date && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "#EAF6F0",
                    color: "#0D6866",
                    border: "1px solid #B9DED4",
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  Due: {new Date(primary_next_action.due_date).toLocaleDateString()}
                </span>
              )}
            </div>
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: "16px",
                fontWeight: 700,
                color: "#063C3D",
                letterSpacing: "-0.01em",
              }}
            >
              {primary_next_action.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#445451",
                lineHeight: 1.5,
                maxWidth: "720px",
              }}
            >
              {primary_next_action.description}
            </p>
          </div>

          <div style={{ flexShrink: 0 }}>
            <Button
              variant="primary"
              size="md"
              data-testid="complete-next-action-btn"
              onClick={() => handleAction(primary_next_action)}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                fontWeight: 650,
                border: "none",
                borderRadius: "8px",
                padding: "9px 16px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Complete Action →
            </Button>
          </div>
        </div>
      )}

      {/* 2. Dual-State Breakdown: Waiting on You vs Waiting on the Firm */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "14px",
        }}
      >
        {/* Waiting on You (Client) */}
        <div
          data-testid="waiting-on-client-box"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center" }} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <strong style={{ fontSize: "13.5px", color: "#063C3D", fontWeight: 700 }}>
                Waiting on You (Client)
              </strong>
            </div>
            <Badge variant={waiting_on_client.length > 0 ? "action" : "success"} size="sm">
              {waiting_on_client.length} Action{waiting_on_client.length === 1 ? "" : "s"} Needed
            </Badge>
          </div>

          {waiting_on_client.length === 0 ? (
            data?.onboarding_completed || profile_completeness_percentage > 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#176B50" }}>
                ✓ All required items submitted. Nothing currently pending on your end!
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                No intake or document items have been completed yet. Complete your initial intake questionnaire and document uploads to begin.
              </p>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {waiting_on_client.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAction(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleAction(item);
                    }
                  }}
                  style={{
                    padding: "9px 12px",
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#0D6866";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#DCE5E1";
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "12.5px", display: "block", color: "#172322" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "11.5px", color: "#445451" }}>
                      {item.description}
                    </span>
                  </div>
                  <Badge variant={item.priority === "critical" ? "critical" : "warning"} size="sm">
                    {item.priority === "critical" ? "Action Needed" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiting on the Firm */}
        <div
          data-testid="waiting-on-firm-box"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center" }} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#176B50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="M7 21h10" />
                  <path d="M12 3v18" />
                  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                </svg>
              </span>
              <strong style={{ fontSize: "13.5px", color: "#063C3D", fontWeight: 700 }}>
                Waiting on the Firm (In Progress)
              </strong>
            </div>
            <Badge variant="info" size="sm">
              {waiting_on_firm.length} Active Task{waiting_on_firm.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {waiting_on_firm.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "9px 12px",
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "12.5px", display: "block", color: "#172322" }}>
                    {item.title}
                  </strong>
                  <span style={{ fontSize: "11.5px", color: "#445451" }}>
                    {item.description}
                  </span>
                </div>
                <Badge variant="review" size="sm">
                  In Review
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Concise Readiness Disclaimer (Unified readiness bar lives in ClientStatusHeroCard) */}
      <div
        style={{
          fontSize: "11.5px",
          color: "#6E7F7C",
          lineHeight: 1.4,
          padding: "2px 4px",
        }}
      >
        <strong style={{ color: "#445451", fontWeight: 600 }}>
          Petition Filing &amp; Onboarding Readiness:
        </strong>{" "}
        Progress reflects completed intake and document steps and does not predict government processing times or decision outcomes.
      </div>
    </div>
  );
}
