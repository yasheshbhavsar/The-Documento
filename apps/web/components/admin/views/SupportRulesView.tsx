"use client";

import React from "react";
import {
  AgencySupportTicket,
  StatutoryRuleBroadcast,
} from "../../../lib/agencyPlatformStore";

export interface SupportRulesViewProps {
  supportTickets: AgencySupportTicket[];
  ticketRepliesDraft: Record<string, string>;
  supportActionError: string | null;
  broadcasts: StatutoryRuleBroadcast[];
  broadcastCorridor: string;
  broadcastTitle: string;
  broadcastSummary: string;
  broadcastEffectiveDate: string;
  broadcastError: string | null;
  onChangeTicketReply: (ticketId: string, reply: string) => void;
  onResolveSupportTicket: (ticket: AgencySupportTicket) => void;
  onChangeBroadcastCorridor: (corridor: string) => void;
  onChangeBroadcastTitle: (title: string) => void;
  onChangeBroadcastSummary: (summary: string) => void;
  onChangeBroadcastEffectiveDate: (date: string) => void;
  onPublishRuleBroadcast: (e: React.FormEvent) => void;
}

export function SupportRulesView({
  supportTickets,
  ticketRepliesDraft,
  supportActionError,
  broadcasts,
  broadcastCorridor,
  broadcastTitle,
  broadcastSummary,
  broadcastEffectiveDate,
  broadcastError,
  onChangeTicketReply,
  onResolveSupportTicket,
  onChangeBroadcastCorridor,
  onChangeBroadcastTitle,
  onChangeBroadcastSummary,
  onChangeBroadcastEffectiveDate,
  onPublishRuleBroadcast,
}: SupportRulesViewProps) {
  return (
    <div
      data-testid="hq-support-rules-view"
      className="hq-split-2col"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 6fr) minmax(0, 6fr)",
        gap: "20px",
        alignItems: "start",
      }}
    >
      {/* Left: Partner Agency Support Inbox */}
      <section
        style={{
          border: "1px solid #DCE5E1",
          borderRadius: "6px",
          background: "#FFFFFF",
          padding: "18px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
          Partner Agency Support Inbox ({supportTickets.length})
        </h2>
        <p style={{ fontSize: "12px", color: "#5C6E6A", margin: "0 0 14px 0" }}>
          Respond to seat upgrade requests, OCR pipeline questions, and statutory checklist
          inquiries.
        </p>

        {supportActionError && (
          <div
            role="alert"
            style={{
              padding: "8px 11px",
              borderRadius: "6px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {supportActionError}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {supportTickets.map((tkt) => (
            <div
              key={tkt.id}
              style={{
                padding: "12px 14px",
                borderRadius: "6px",
                border: "1px solid #DCE5E1",
                background: tkt.status === "resolved" ? "#F8FAF9" : "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                  {tkt.ticketCode} · {tkt.tradingName}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {tkt.breakGlassAttached && (
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "#FEF7EA",
                        color: "#8A5A10",
                      }}
                    >
                      2h Break-Glass Active
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: tkt.status === "resolved" ? "#176B50" : "#8A5A10",
                    }}
                  >
                    {tkt.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 650,
                  color: "#172322",
                  marginTop: "4px",
                }}
              >
                {tkt.subject}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#445451",
                  marginTop: "3px",
                  lineHeight: 1.45,
                }}
              >
                {tkt.message}
              </div>

              {tkt.status === "resolved" ? (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "8px 10px",
                    borderRadius: "5px",
                    background: "#EAF6F0",
                    color: "#176B50",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Official HQ Reply ({tkt.repliedByEmail}): {tkt.hqReply}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <input
                    type="text"
                    data-testid={`hq-ticket-reply-input-${tkt.ticketCode}`}
                    placeholder="Write official HQ response to partner firm..."
                    value={ticketRepliesDraft[tkt.id] || ""}
                    onChange={(e) => onChangeTicketReply(tkt.id, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #BDCDC7",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    data-testid={`hq-resolve-ticket-btn-${tkt.ticketCode}`}
                    onClick={() => onResolveSupportTicket(tkt)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#063C3D",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 650,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Send Reply &amp; Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Right: Statutory Rule & Draw Cutoff Broadcast Publisher */}
      <section
        style={{
          border: "1px solid #DCE5E1",
          borderRadius: "6px",
          background: "#FFFFFF",
          padding: "18px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
          Statutory Rule &amp; Draw Cutoff Publisher
        </h2>
        <p style={{ fontSize: "12px", color: "#5C6E6A", margin: "0 0 14px 0" }}>
          Broadcast IRCC, SkillSelect, Home Office, INZ, or Germany rule updates directly to
          partner agency Launchpads.
        </p>

        {broadcastError && (
          <div
            role="alert"
            style={{
              padding: "8px 11px",
              borderRadius: "6px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {broadcastError}
          </div>
        )}

        <form
          onSubmit={onPublishRuleBroadcast}
          style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Jurisdiction Corridor
              </label>
              <select
                aria-label="Broadcast jurisdiction corridor"
                value={broadcastCorridor}
                onChange={(e) => onChangeBroadcastCorridor(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "12.5px",
                  background: "#FFFFFF",
                }}
              >
                <option value="ALL">All Corridors (Global)</option>
                <option value="CA">Canada (IRCC / PNP)</option>
                <option value="AU">Australia (SkillSelect)</option>
                <option value="NZ">New Zealand (INZ SMC)</option>
                <option value="UK">United Kingdom (Home Office)</option>
                <option value="DE">Germany (Make it in Germany)</option>
                <option value="US">United States (USCIS)</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Effective Date
              </label>
              <input
                type="date"
                value={broadcastEffectiveDate}
                onChange={(e) => onChangeBroadcastEffectiveDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "12.5px",
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Bulletin Headline
            </label>
            <input
              type="text"
              data-testid="hq-broadcast-title-input"
              placeholder="e.g. IRCC French Proficiency Category Draw #325 — 478 CRS Cutoff"
              value={broadcastTitle}
              onChange={(e) => onChangeBroadcastTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #BDCDC7",
                fontSize: "12.5px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Checklist &amp; Calculator Impact Summary
            </label>
            <textarea
              rows={2}
              data-testid="hq-broadcast-summary-input"
              placeholder="Describe updated statutory thresholds, checklists, or point rules..."
              value={broadcastSummary}
              onChange={(e) => onChangeBroadcastSummary(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #BDCDC7",
                fontSize: "12.5px",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              data-testid="hq-publish-broadcast-btn"
              style={{
                padding: "8px 15px",
                borderRadius: "6px",
                border: "none",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Publish Rule Update to Agencies
            </button>
          </div>
        </form>

        <div
          style={{
            borderTop: "1px solid #E5ECE9",
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              color: "#5C6E6A",
              textTransform: "uppercase",
            }}
          >
            Published Bulletins ({broadcasts.length})
          </div>
          {broadcasts.slice(0, 4).map((b) => (
            <div
              key={b.id}
              style={{
                padding: "9px 11px",
                borderRadius: "6px",
                background: "#F8FAF9",
                border: "1px solid #E4ECE8",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#063C3D" }}>
                [{b.corridorCode}] {b.title}
              </div>
              <div style={{ color: "#445451", marginTop: "2px" }}>{b.summary}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
