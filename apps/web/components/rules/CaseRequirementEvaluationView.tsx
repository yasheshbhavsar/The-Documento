import React, { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  CaseRequirementEvaluation,
  RequirementEvaluationItem,
  RequirementEvaluationStatus,
  ImmigrationCase,
} from "../../lib/types";
import { api, FALLBACK_EVALUATION } from "../../lib/api";

interface CaseRequirementEvaluationViewProps {
  caseId?: string;
  cases?: ImmigrationCase[];
  isLiveBackend?: boolean;
  onSelectCase?: (c: ImmigrationCase) => void;
}

export function CaseRequirementEvaluationView({
  caseId = "case-01",
  cases,
  isLiveBackend = false,
  onSelectCase,
}: CaseRequirementEvaluationViewProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId);
  const [evaluation, setEvaluation] = useState<CaseRequirementEvaluation>(FALLBACK_EVALUATION);
  const [evaluationHistory, setEvaluationHistory] = useState<CaseRequirementEvaluation[]>([FALLBACK_EVALUATION]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Adjudication state for local interactive review
  const [localSignoffs, setLocalSignoffs] = useState<Record<string, boolean>>({});
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<RequirementEvaluationItem | null>(null);
  const [adjudicationNote, setAdjudicationNote] = useState<string>("");

  useEffect(() => {
    setSelectedCaseId(caseId);
  }, [caseId]);

  useEffect(() => {
    loadEvaluations(selectedCaseId);
  }, [selectedCaseId]);

  const loadEvaluations = async (targetCaseId: string) => {
    if (!isLiveBackend) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getCaseEvaluations(targetCaseId);
      if (res.data && res.data.length > 0) {
        setEvaluation(res.data[0]);
        setEvaluationHistory(res.data);
      } else {
        // Run initial evaluation if none exist
        const evalRes = await api.evaluateCaseRequirements(targetCaseId);
        if (evalRes.data) {
          setEvaluation(evalRes.data);
          setEvaluationHistory([evalRes.data]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load case requirement evaluations.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setErrorMsg(null);
    try {
      const res = await api.evaluateCaseRequirements(selectedCaseId);
      if (res.data) {
        setEvaluation(res.data);
        const histRes = await api.getCaseEvaluations(selectedCaseId);
        if (histRes.data) setEvaluationHistory(histRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Evaluation execution failed.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSignoffItem = (itemCode: string) => {
    setLocalSignoffs((prev) => ({ ...prev, [itemCode]: true }));
    if (selectedItemForDetails && selectedItemForDetails.code === itemCode) {
      setSelectedItemForDetails({
        ...selectedItemForDetails,
        human_signoff_completed: true,
        status: selectedItemForDetails.evidence_matched.length > 0 ? "complete" : "needs_review",
      });
    }
    // Update active evaluation in memory
    if (evaluation) {
      const updatedReqs = evaluation.results.requirements.map((r) => {
        if (r.code === itemCode) {
          const newStatus: RequirementEvaluationStatus =
            r.evidence_matched.length > 0 ? "complete" : "needs_review";
          return {
            ...r,
            human_signoff_completed: true,
            status: newStatus,
            validation_details: [
              ...r.validation_details,
              `Adjudicated by Legal Specialist: ${adjudicationNote || "Evidentiary standard satisfied."}`,
            ],
          };
        }
        return r;
      });
      setEvaluation({
        ...evaluation,
        results: {
          ...evaluation.results,
          requirements: updatedReqs,
        },
      });
    }
    setAdjudicationNote("");
  };

  const getStatusBadge = (status: RequirementEvaluationStatus) => {
    switch (status) {
      case "complete":
        return <Badge variant="success">✓ COMPLETE</Badge>;
      case "missing":
        return <Badge variant="action">✕ MISSING</Badge>;
      case "needs_review":
        return <Badge variant="review">⚠ NEEDS REVIEW</Badge>;
      case "unknown":
        return <Badge variant="neutral">? UNKNOWN</Badge>;
      case "not_applicable":
        return <Badge variant="neutral">NOT APPLICABLE</Badge>;
      case "expired":
        return <Badge variant="action">⏱ EXPIRED</Badge>;
      case "blocked":
        return <Badge variant="review">⛔ BLOCKED</Badge>;
      default:
        return <Badge variant="neutral">{(status as string).toUpperCase()}</Badge>;
    }
  };

  const currentCase = cases?.find((c) => c.id === selectedCaseId);
  const summary = evaluation?.results?.summary;
  const rawRequirements = evaluation?.results?.requirements || [];

  const filteredRequirements = rawRequirements.filter((req) => {
    const isSignedOff = localSignoffs[req.code] || req.human_signoff_completed;
    const effectiveStatus = isSignedOff && req.status === "needs_review" ? "complete" : req.status;

    if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
    if (categoryFilter !== "all" && req.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = req.title.toLowerCase().includes(query);
      const matchesCode = req.code.toLowerCase().includes(query);
      const matchesCitation = req.statutory_citation?.toLowerCase().includes(query) || false;
      if (!matchesTitle && !matchesCode && !matchesCitation) return false;
    }
    return true;
  });

  const categories = Array.from(new Set(rawRequirements.map((r) => r.category).filter(Boolean)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Banner & Case Selector */}
      <Card
        title="Immigration Requirements & Rule Engine Evaluation"
        subtitle="Declarative rule evaluation against official statutory and regulatory criteria. Zero hardcoded rules."
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {cases && cases.length > 0 && (
              <select
                aria-label="Select Target Case"
                value={selectedCaseId}
                onChange={(e) => {
                  setSelectedCaseId(e.target.value);
                  const found = cases.find((c) => c.id === e.target.value);
                  if (found && onSelectCase) onSelectCase(found);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #334155)",
                  background: "var(--surface, #0f172a)",
                  color: "var(--text, #f8fafc)",
                  fontSize: "12px",
                }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.client_name} ({c.visa_category})
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunEvaluation}
              disabled={isEvaluating}
            >
              {isEvaluating ? "Evaluating Rules..." : "⚡ Re-evaluate Requirements"}
            </Button>
          </div>
        }
      >
        {/* Provenance and Case Information Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid var(--border, #334155)",
            marginBottom: "16px",
            fontSize: "12px",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Active Case:</span>
            <strong style={{ color: "var(--text, #f8fafc)" }}>
              {currentCase?.case_number || "CASE-US-8841"} ({currentCase?.jurisdiction || "US"} {currentCase?.visa_category || "EB-1A"})
            </strong>
          </div>
          <div style={{ borderLeft: "1px solid #334155", paddingLeft: "14px" }}>
            <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Rule Set:</span>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>
              {evaluation?.results?.rule_set_id || "US-USCIS-EB1A"}
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #334155", paddingLeft: "14px" }}>
            <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Codified Version:</span>
            <span
              style={{
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                padding: "2px 8px",
                borderRadius: "999px",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              v{evaluation?.version_number || "1.0.0"} (Published)
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #334155", paddingLeft: "14px" }}>
            <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Evaluated At:</span>
            <span style={{ color: "var(--text, #f8fafc)" }}>
              {evaluation?.evaluated_at ? new Date(evaluation.evaluated_at).toLocaleString() : "Just now"}
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #334155", paddingLeft: "14px" }}>
            <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Execution Safety:</span>
            <span style={{ color: "#10b981", fontWeight: 600 }}>
              🛡️ AST Constrained (Zero DB Python)
            </span>
          </div>
        </div>

        {/* Progress & Summary Metrics */}
        {summary && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text, #f8fafc)" }}>
                  Overall Evidentiary Fulfillment Rate:
                </span>
                <strong style={{ fontSize: "16px", color: evaluation.overall_fulfillment_percentage >= 70 ? "#10b981" : "#f59e0b" }}>
                  {`${evaluation.overall_fulfillment_percentage.toFixed(1)}%`}
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                {summary.complete} of {summary.applicable} applicable criteria satisfied
              </span>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: "100%",
                height: "10px",
                background: "#1e293b",
                borderRadius: "999px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${evaluation.overall_fulfillment_percentage}%`,
                  height: "100%",
                  background:
                    evaluation.overall_fulfillment_percentage >= 80
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : evaluation.overall_fulfillment_percentage >= 50
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
                  borderRadius: "999px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            {/* Status Breakdown Chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <div
                onClick={() => setStatusFilter(statusFilter === "complete" ? "all" : "complete")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "complete" ? "rgba(16, 185, 129, 0.25)" : "#0f172a",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#10b981", display: "block" }}>✓ Complete</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.complete}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "missing" ? "all" : "missing")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "missing" ? "rgba(239, 68, 68, 0.25)" : "#0f172a",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#ef4444", display: "block" }}>✕ Missing</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.missing}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "needs_review" ? "all" : "needs_review")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "needs_review" ? "rgba(245, 158, 11, 0.25)" : "#0f172a",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#f59e0b", display: "block" }}>⚠ Needs Review</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.needs_review}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "blocked" ? "all" : "blocked")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "blocked" ? "rgba(249, 115, 22, 0.25)" : "#0f172a",
                  border: "1px solid rgba(249, 115, 22, 0.4)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#f97316", display: "block" }}>⛔ Blocked</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.blocked}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "expired" ? "rgba(244, 63, 94, 0.25)" : "#0f172a",
                  border: "1px solid rgba(244, 63, 94, 0.4)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#f43f5e", display: "block" }}>⏱ Expired</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.expired}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "unknown" ? "all" : "unknown")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: statusFilter === "unknown" ? "rgba(148, 163, 184, 0.25)" : "#0f172a",
                  border: "1px solid #334155",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>? Unknown</span>
                <strong style={{ fontSize: "18px", color: "#f8fafc" }}>{summary.unknown}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Legal Engineering Callout */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            fontSize: "12px",
            color: "#93c5fd",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>⚖️</span>
          <span>
            <strong>Evidentiary Completion Principle:</strong> A document being present in storage does not
            automatically satisfy a legal requirement. Evidence completion strictly requires passing declarative
            field checks, OCR validity thresholds, and required human specialist sign-offs.
          </span>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "16px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Search requirement code, title, or citation (e.g. 8 CFR § 204.5)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: "1 1 240px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border, #334155)",
              background: "var(--surface, #0f172a)",
              color: "var(--text, #f8fafc)",
              fontSize: "12px",
            }}
          />

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border, #334155)",
              background: "var(--surface, #0f172a)",
              color: "var(--text, #f8fafc)",
              fontSize: "12px",
            }}
          >
            <option value="all">All Statuses ({rawRequirements.length})</option>
            <option value="complete">✓ Complete</option>
            <option value="missing">✕ Missing</option>
            <option value="needs_review">⚠ Needs Review</option>
            <option value="blocked">⛔ Blocked</option>
            <option value="expired">⏱ Expired</option>
            <option value="not_applicable">Not Applicable</option>
            <option value="unknown">? Unknown</option>
          </select>

          {categories.length > 0 && (
            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border, #334155)",
                background: "var(--surface, #0f172a)",
                color: "var(--text, #f8fafc)",
                fontSize: "12px",
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c?.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}

          {statusFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}>
              Clear Filter
            </Button>
          )}
        </div>

        {/* Requirements Evaluation Grid */}
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted, #94a3b8)" }}>
            Loading codified rules and evaluating evidence...
          </div>
        ) : filteredRequirements.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "#0f172a",
              borderRadius: "8px",
              border: "1px dashed #334155",
              color: "var(--muted, #94a3b8)",
            }}
          >
            No requirements match the current filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredRequirements.map((item) => {
              const isSignedOff = localSignoffs[item.code] || item.human_signoff_completed;
              const displayStatus: RequirementEvaluationStatus =
                isSignedOff && item.status === "needs_review" ? "complete" : item.status;

              return (
                <div
                  key={item.code}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#0f172a",
                    border:
                      displayStatus === "complete"
                        ? "1px solid rgba(16, 185, 129, 0.4)"
                        : displayStatus === "missing"
                        ? "1px solid rgba(239, 68, 68, 0.4)"
                        : displayStatus === "needs_review"
                        ? "1px solid rgba(245, 158, 11, 0.4)"
                        : "1px solid #334155",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Item Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#1e293b",
                            color: "#38bdf8",
                            fontWeight: 600,
                          }}
                        >
                          {item.code}
                        </span>
                        {item.statutory_citation && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: "rgba(148, 163, 184, 0.15)",
                              color: "#cbd5e1",
                            }}
                          >
                            📖 {item.statutory_citation}
                          </span>
                        )}
                        {item.is_mandatory ? (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              fontWeight: 700,
                            }}
                          >
                            MANDATORY BASELINE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(168, 85, 247, 0.15)",
                              color: "#c084fc",
                              fontWeight: 600,
                            }}
                          >
                            REGULATORY CRITERION (1 OF 10)
                          </span>
                        )}
                      </div>
                      <strong style={{ fontSize: "14px", color: "#f8fafc" }}>{item.title}</strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {getStatusBadge(displayStatus)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItemForDetails(item)}
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>

                  {/* Evidentiary & Validation Findings */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "10px",
                      background: "rgba(15, 23, 42, 0.6)",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    {/* Evidence Column */}
                    <div>
                      <span style={{ color: "var(--muted, #94a3b8)", display: "block", marginBottom: "4px" }}>
                        Evidentiary Matches ({item.evidence_matched.length}):
                      </span>
                      {item.evidence_matched.length > 0 ? (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {item.evidence_matched.map((docId) => (
                            <span
                              key={docId}
                              style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: "#1e293b",
                                color: "#38bdf8",
                                fontSize: "11px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              📄 {docId} (Verified)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#f87171" }}>
                          ✕ No qualifying evidence documents uploaded
                        </span>
                      )}
                    </div>

                    {/* Declarative Validation Details */}
                    <div>
                      <span style={{ color: "var(--muted, #94a3b8)", display: "block", marginBottom: "4px" }}>
                        Declarative AST Checks:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: "16px", color: "#cbd5e1" }}>
                        {item.validation_details.map((v, idx) => (
                          <li key={idx}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Blocking & Review Notices */}
                  {item.blocking_reasons.length > 0 && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#fb923c",
                        background: "rgba(249, 115, 22, 0.1)",
                        padding: "6px 10px",
                        borderRadius: "4px",
                      }}
                    >
                      ⛔ <strong>Blocked:</strong> Prerequisite requirement{" "}
                      {item.blocking_reasons.join(", ")} must be satisfied first.
                    </div>
                  )}

                  {/* Specialist Adjudication Bar */}
                  {item.requires_human_signoff && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        background: isSignedOff ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        border: isSignedOff ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{isSignedOff ? "🛡️" : "👤"}</span>
                        <span style={{ color: isSignedOff ? "#34d399" : "#fbbf24" }}>
                          {isSignedOff
                            ? "Human Review Complete: Legal specialist verified evidentiary merit under Kazarian Step 2."
                            : "Human Review Required: Official rules require specialist sign-off before completion."}
                        </span>
                      </div>
                      {!isSignedOff && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedItemForDetails(item);
                          }}
                        >
                          Adjudicate
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Historical Case Evaluations Traceability Drawer */}
      <Card
        title="Rule Version Traceability & Audit History"
        subtitle="Historical case evaluations are permanently preserved when rules change. Zero silent overwrites."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {evaluationHistory.map((hist, index) => (
            <div
              key={hist.id || index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "6px",
                background: hist.is_superseded ? "#0f172a" : "rgba(30, 41, 59, 0.6)",
                border: hist.is_superseded ? "1px solid #334155" : "1px solid #38bdf8",
                fontSize: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ color: "#f8fafc" }}>
                    Evaluation #{hist.id.slice(0, 8)}
                  </strong>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "#1e293b",
                      color: "#38bdf8",
                      fontSize: "11px",
                    }}
                  >
                    Rule Version v{hist.version_number}
                  </span>
                  {hist.is_superseded ? (
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>[Superseded]</span>
                  ) : (
                    <span style={{ color: "#10b981", fontSize: "11px", fontWeight: 700 }}>[Current Active]</span>
                  )}
                </div>
                <div style={{ color: "var(--muted, #94a3b8)", marginTop: "2px" }}>
                  Evaluated: {new Date(hist.evaluated_at).toLocaleString()} • Fulfillment:{" "}
                  {hist.overall_fulfillment_percentage.toFixed(1)}% ({hist.status.toUpperCase()})
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEvaluation(hist)}
              >
                Inspect Snapshot
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Inspection & Adjudication Modal */}
      {selectedItemForDetails && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              maxWidth: "640px",
              width: "100%",
              padding: "24px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  {selectedItemForDetails.code}
                </span>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>
                  {selectedItemForDetails.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6 }}>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Statutory Citation:</span>
                <strong>{selectedItemForDetails.statutory_citation || "N/A"}</strong>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Official Validation Status:</span>
                {getStatusBadge(
                  (localSignoffs[selectedItemForDetails.code] || selectedItemForDetails.human_signoff_completed) &&
                    selectedItemForDetails.status === "needs_review"
                    ? "complete"
                    : selectedItemForDetails.status
                )}
              </div>

              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Declarative Validation Results:</span>
                <div style={{ background: "#1e293b", padding: "10px", borderRadius: "6px", marginTop: "4px" }}>
                  <ul style={{ margin: 0, paddingLeft: "16px" }}>
                    {selectedItemForDetails.validation_details.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "var(--muted, #94a3b8)", display: "block" }}>Adjudication Notes / Rationale:</span>
                <textarea
                  placeholder="Enter specialist review findings, Kazarian step 2 assessment, or reason for sign-off..."
                  value={adjudicationNote}
                  onChange={(e) => setAdjudicationNote(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    marginTop: "6px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#f8fafc",
                    fontSize: "12px",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItemForDetails(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleSignoffItem(selectedItemForDetails.code);
                  setSelectedItemForDetails(null);
                }}
              >
                Sign Off & Satisfy Requirement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
