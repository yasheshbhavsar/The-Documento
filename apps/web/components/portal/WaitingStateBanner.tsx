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

export function WaitingStateBanner({
  waitingState: initialWaitingState,
  caseId,
  onActionClick,
  onOpenQuestionnaire,
  onOpenUpload,
}: WaitingStateBannerProps) {
  const [data, setData] = useState<WaitingStateData>(initialWaitingState || FALLBACK_WAITING_STATE);

  useEffect(() => {
    if (initialWaitingState) {
      setData(initialWaitingState);
    } else {
      fetchClientWaitingState(caseId).then((res) => {
        if (res) setData(res);
      }).catch(() => {
        setData(FALLBACK_WAITING_STATE);
      });
    }
  }, [initialWaitingState, caseId]);

  const {
    primary_next_action,
    waiting_on_client,
    waiting_on_firm,
    profile_completeness_percentage,
  } = data || FALLBACK_WAITING_STATE;

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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 1. Primary Immediate Next Action Banner */}
      {primary_next_action && (
        <div
          data-testid="primary-next-action-card"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
            color: "#ffffff",
            padding: "20px 24px",
            borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(30, 58, 138, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "16px" }}>⚡</span>
              <strong style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85 }}>
                Immediate Next Action Required
              </strong>
              {primary_next_action.due_date && (
                <span
                  style={{
                    fontSize: "11px",
                    background: "rgba(255, 255, 255, 0.2)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  Due: {new Date(primary_next_action.due_date).toLocaleDateString()}
                </span>
              )}
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
              {primary_next_action.title}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.9, lineHeight: 1.5, maxWidth: "720px" }}>
              {primary_next_action.description}
            </p>
          </div>

          <div style={{ flexShrink: 0 }}>
            <Button
              variant="secondary"
              size="md"
              data-testid="complete-next-action-btn"
              onClick={() => handleAction(primary_next_action)}
              style={{
                background: "#ffffff",
                color: "#1e3a8a",
                fontWeight: 700,
                border: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Waiting on You (Client) */}
        <div
          data-testid="waiting-on-client-box"
          style={{
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderTop: "4px solid var(--accent, #3b82f6)",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>👤</span>
              <strong style={{ fontSize: "14px", color: "var(--text, #0f172a)" }}>
                Waiting on You (Client)
              </strong>
            </div>
            <Badge variant={waiting_on_client.length > 0 ? "action" : "success"} size="sm">
              {waiting_on_client.length} Action{waiting_on_client.length === 1 ? "" : "s"} Needed
            </Badge>
          </div>

          {waiting_on_client.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #64748b)" }}>
              ✓ All required items submitted. Nothing currently pending on your end!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {waiting_on_client.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAction(item)}
                  style={{
                    padding: "10px 12px",
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px", display: "block", color: "var(--text, #0f172a)" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
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
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderTop: "4px solid #10b981",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>⚖️</span>
              <strong style={{ fontSize: "14px", color: "var(--text, #0f172a)" }}>
                Waiting on the Firm (In Progress)
              </strong>
            </div>
            <Badge variant="info" size="sm">
              {waiting_on_firm.length} Active Task{waiting_on_firm.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {waiting_on_firm.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "13px", display: "block", color: "var(--text, #0f172a)" }}>
                    {item.title}
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
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

      {/* 3. Filing Readiness Meter */}
      <div
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "8px",
          padding: "14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <span style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
            Petition Filing & Onboarding Readiness
          </span>
          <strong style={{ color: "var(--accent, #3b82f6)" }}>
            {profile_completeness_percentage}% Ready
          </strong>
        </div>
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#e2e8f0",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${profile_completeness_percentage}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6 0%, #10b981 100%)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
