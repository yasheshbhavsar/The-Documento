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
      fetchClientWaitingState(caseId)
        .then((res) => {
          if (res) setData(res);
        })
        .catch(() => {
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
      {/* 1. Primary Immediate Next Action Card (Light Mode: Teal, Mint & Cream) */}
      {primary_next_action && (
        <div
          data-testid="primary-next-action-card"
          style={{
            background: "#F8F7F2",
            border: "1.5px solid #B9DED4",
            borderRadius: "14px",
            padding: "20px 24px",
            boxShadow: "0 2px 10px rgba(6, 60, 61, 0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "15px" }}>⚡</span>
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
                fontSize: "18px",
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
                padding: "10px 18px",
                boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Waiting on You (Client) */}
        <div
          data-testid="waiting-on-client-box"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderTop: "3.5px solid #0D6866",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 2px 6px rgba(6, 60, 61, 0.04)",
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
              <span style={{ fontSize: "16px" }}>👤</span>
              <strong style={{ fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
                Waiting on You (Client)
              </strong>
            </div>
            <Badge variant={waiting_on_client.length > 0 ? "action" : "success"} size="sm">
              {waiting_on_client.length} Action{waiting_on_client.length === 1 ? "" : "s"} Needed
            </Badge>
          </div>

          {waiting_on_client.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#176B50" }}>
              ✓ All required evidentiary items submitted. Nothing currently pending on your end!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {waiting_on_client.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAction(item)}
                  style={{
                    padding: "10px 12px",
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
                    <strong style={{ fontSize: "13px", display: "block", color: "#172322" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#445451" }}>
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
            borderTop: "3.5px solid #176B50",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 2px 6px rgba(6, 60, 61, 0.04)",
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
              <span style={{ fontSize: "16px" }}>⚖️</span>
              <strong style={{ fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
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
                  <strong style={{ fontSize: "13px", display: "block", color: "#172322" }}>
                    {item.title}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#445451" }}>
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

      {/* 3. Filing Readiness Meter with Legal Precision Disclaimer */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "10px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <span style={{ fontWeight: 650, color: "#063C3D" }}>
            Petition Filing &amp; Onboarding Readiness
          </span>
          <strong style={{ color: "#0D6866" }}>
            {profile_completeness_percentage}% Ready
          </strong>
        </div>
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#E7EFEB",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${profile_completeness_percentage}%`,
              height: "100%",
              background: "linear-gradient(90deg, #0D6866 0%, #2A9288 100%)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px", lineHeight: 1.4 }}>
          * Workflow progress measures procedural evidentiary milestone completion and does not predict USCIS processing times, statutory eligibility, or petition adjudication outcome.
        </div>
      </div>
    </div>
  );
}
