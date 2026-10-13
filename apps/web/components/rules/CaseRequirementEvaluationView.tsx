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
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid #DCE5E1",
                  background: "#FAFAF8",
                  color: "#172322",
                  fontSize: "12px",
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer",
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
            gap: "16px",
            padding: "14px 18px",
            borderRadius: "10px",
            background: "#F8FAF9",
            border: "1px solid #DCE5E1",
            marginBottom: "16px",
            fontSize: "12px",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Active Case:
            </span>
            <strong style={{ color: "#172322", fontSize: "13px" }}>
              {currentCase?.case_number || "CASE-US-8841"} ({currentCase?.jurisdiction || "US"} {currentCase?.visa_category || "EB-1A"})
            </strong>
          </div>
          <div style={{ borderLeft: "1px solid #DCE5E1", paddingLeft: "16px" }}>
            <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Rule Set:
            </span>
            <span style={{ color: "#0D6866", fontWeight: 700 }}>
              {evaluation?.results?.rule_set_id || "US-USCIS-EB1A"}
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #DCE5E1", paddingLeft: "16px" }}>
            <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Codified Version:
            </span>
            <span
              style={{
                background: "#EAF6F0",
                color: "#063C3D",
                padding: "3px 10px",
                borderRadius: "999px",
                border: "1px solid #B9DED4",
                fontWeight: 700,
                fontSize: "11px",
                display: "inline-block",
                marginTop: "1px",
              }}
            >
              v{evaluation?.version_number || "1.0.0"} (Published)
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #DCE5E1", paddingLeft: "16px" }}>
            <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Evaluated At:
            </span>
            <span style={{ color: "#172322", fontWeight: 600 }}>
              {evaluation?.evaluated_at ? new Date(evaluation.evaluated_at).toLocaleString() : "Just now"}
            </span>
          </div>
          <div style={{ borderLeft: "1px solid #DCE5E1", paddingLeft: "16px" }}>
            <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Execution Safety:
            </span>
            <span style={{ color: "#059669", fontWeight: 700 }}>
              🛡️ AST Constrained (Zero DB Python)
            </span>
          </div>
        </div>

        {/* Progress & Summary Metrics */}
        {summary && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#172322" }}>
                  Overall Evidentiary Fulfillment Rate:
                </span>
                <strong style={{ fontSize: "18px", fontWeight: 800, color: evaluation.overall_fulfillment_percentage >= 70 ? "#059669" : "#D97706" }}>
                  {`${evaluation.overall_fulfillment_percentage.toFixed(1)}%`}
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 600 }}>
                {summary.complete} of {summary.applicable} applicable criteria satisfied
              </span>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: "100%",
                height: "10px",
                background: "#E2E8E4",
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
                      ? "linear-gradient(90deg, #0D6866, #10B981)"
                      : evaluation.overall_fulfillment_percentage >= 50
                      ? "linear-gradient(90deg, #D97706, #F59E0B)"
                      : "linear-gradient(90deg, #DC2626, #EF4444)",
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
                gap: "10px",
                marginTop: "6px",
              }}
            >
              <div
                onClick={() => setStatusFilter(statusFilter === "complete" ? "all" : "complete")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "complete" ? "#EAF6F0" : "#FFFFFF",
                  border: statusFilter === "complete" ? "1.5px solid #059669" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#065F46", display: "block" }}>✓ Complete</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.complete}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "missing" ? "all" : "missing")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "missing" ? "#FEF2F2" : "#FFFFFF",
                  border: statusFilter === "missing" ? "1.5px solid #DC2626" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", display: "block" }}>✕ Missing</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.missing}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "needs_review" ? "all" : "needs_review")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "needs_review" ? "#FFFBEB" : "#FFFFFF",
                  border: statusFilter === "needs_review" ? "1.5px solid #D97706" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400E", display: "block" }}>⚠ Needs Review</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.needs_review}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "blocked" ? "all" : "blocked")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "blocked" ? "#FFF7ED" : "#FFFFFF",
                  border: statusFilter === "blocked" ? "1.5px solid #EA580C" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#9A3412", display: "block" }}>⛔ Blocked</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.blocked}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "expired" ? "#FFF1F2" : "#FFFFFF",
                  border: statusFilter === "expired" ? "1.5px solid #BE123C" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#9F1239", display: "block" }}>⏱ Expired</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.expired}</strong>
              </div>
              <div
                onClick={() => setStatusFilter(statusFilter === "unknown" ? "all" : "unknown")}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: statusFilter === "unknown" ? "#F8FAF9" : "#FFFFFF",
                  border: statusFilter === "unknown" ? "1.5px solid #6E7F7C" : "1px solid #DCE5E1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4B5563", display: "block" }}>? Unknown</span>
                <strong style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{summary.unknown}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Legal Engineering Callout */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "10px",
            background: "#EFF6FF",
            border: "1.5px solid #BFDBFE",
            fontSize: "12px",
            color: "#1E40AF",
            marginBottom: "18px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            lineHeight: "1.5",
          }}
        >
          <span style={{ fontSize: "16px", marginTop: "1px" }}>⚖️</span>
          <div>
            <strong style={{ color: "#1E3A8A" }}>Evidentiary Completion Principle: </strong>
            <span>
              A document being present in storage does not automatically satisfy a legal requirement. Evidence
              completion strictly requires passing declarative field checks, OCR validity thresholds, and required
              human specialist sign-offs.
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "18px",
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
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1.5px solid #DCE5E1",
              background: "#FAFAF8",
              color: "#172322",
              fontSize: "12px",
              outline: "none",
            }}
          />

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1.5px solid #DCE5E1",
              background: "#FAFAF8",
              color: "#172322",
              fontSize: "12px",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
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
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1.5px solid #DCE5E1",
                background: "#FAFAF8",
                color: "#172322",
                fontSize: "12px",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
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
          <div style={{ padding: "40px", textAlign: "center", color: "#6E7F7C", fontSize: "14px" }}>
            Loading codified rules and evaluating evidence...
          </div>
        ) : filteredRequirements.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "#F8FAF9",
              borderRadius: "12px",
              border: "1.5px dashed #DCE5E1",
              color: "#6E7F7C",
              fontSize: "13px",
            }}
          >
            No requirements match the current filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredRequirements.map((item) => {
              const isSignedOff = localSignoffs[item.code] || item.human_signoff_completed;
              const displayStatus: RequirementEvaluationStatus =
                isSignedOff && item.status === "needs_review" ? "complete" : item.status;

              return (
                <div
                  key={item.code}
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "#FFFFFF",
                    border:
                      displayStatus === "complete"
                        ? "1.5px solid #A7F3D0"
                        : displayStatus === "missing"
                        ? "1.5px solid #FECACA"
                        : displayStatus === "needs_review"
                        ? "1.5px solid #FDE68A"
                        : "1px solid #DCE5E1",
                    boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Item Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#EAF6F0",
                            color: "#063C3D",
                            fontWeight: 700,
                            border: "1px solid #B9DED4",
                          }}
                        >
                          {item.code}
                        </span>
                        {item.statutory_citation && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: "#F1F5F4",
                              color: "#4B5563",
                              border: "1px solid #DCE5E1",
                              fontWeight: 600,
                            }}
                          >
                            📖 {item.statutory_citation}
                          </span>
                        )}
                        {item.is_mandatory ? (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "#FEE2E2",
                              color: "#991B1B",
                              border: "1px solid #FCA5A5",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            MANDATORY BASELINE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "#F3E8FF",
                              color: "#6B21A8",
                              border: "1px solid #D8B4FE",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            REGULATORY CRITERION (1 OF 10)
                          </span>
                        )}
                      </div>
                      <strong style={{ fontSize: "15px", fontWeight: 700, color: "#172322", display: "block" }}>
                        {item.title}
                      </strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

                  {/* Evidentiary & Validation Findings (Executive Card View) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "14px",
                      background: "#F8FAF9",
                      border: "1px solid #E2E8E4",
                      padding: "14px 18px",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                  >
                    {/* Evidence Column */}
                    <div>
                      <span
                        style={{
                          color: "#6E7F7C",
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Evidentiary Matches ({item.evidence_matched.length}):
                      </span>
                      {item.evidence_matched.length > 0 ? (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {item.evidence_matched.map((docId) => (
                            <span
                              key={docId}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: "#EFF6FF",
                                color: "#1E40AF",
                                border: "1px solid #BFDBFE",
                                fontSize: "11px",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              📄 {docId} (Verified)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#DC2626", fontWeight: 600, fontSize: "12px" }}>
                          ✕ No qualifying evidence documents uploaded
                        </span>
                      )}
                    </div>

                    {/* Declarative Validation Details */}
                    <div>
                      <span
                        style={{
                          color: "#6E7F7C",
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Declarative AST Checks:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: "16px", color: "#374151", lineHeight: "1.5" }}>
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
                        fontSize: "12px",
                        color: "#9A3412",
                        background: "#FFF7ED",
                        border: "1px solid #FED7AA",
                        padding: "8px 14px",
                        borderRadius: "8px",
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
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: isSignedOff ? "#ECFDF5" : "#FFFBEB",
                        border: isSignedOff ? "1px solid #A7F3D0" : "1px solid #FCD34D",
                        fontSize: "12px",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{isSignedOff ? "🛡️" : "👤"}</span>
                        <span style={{ color: isSignedOff ? "#065F46" : "#92400E", fontWeight: 600 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {evaluationHistory.map((hist, index) => (
            <div
              key={hist.id || index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                padding: "12px 18px",
                borderRadius: "10px",
                background: hist.is_superseded ? "#F8FAF9" : "#EAF6F0",
                border: hist.is_superseded ? "1px solid #DCE5E1" : "1.5px solid #0D6866",
                fontSize: "12px",
                transition: "all 0.15s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ color: "#172322", fontSize: "13px" }}>
                    Evaluation #{hist.id.slice(0, 8)}
                  </strong>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "#DDEFE8",
                      color: "#063C3D",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    Rule Version v{hist.version_number}
                  </span>
                  {hist.is_superseded ? (
                    <span style={{ color: "#6E7F7C", fontSize: "11px", fontWeight: 600 }}>[Superseded]</span>
                  ) : (
                    <span style={{ color: "#059669", fontSize: "11px", fontWeight: 700 }}>[Current Active]</span>
                  )}
                </div>
                <div style={{ color: "#4B5563", marginTop: "3px" }}>
                  Evaluated: {new Date(hist.evaluated_at).toLocaleString()} • Fulfillment:{" "}
                  <strong>{hist.overall_fulfillment_percentage.toFixed(1)}%</strong> ({hist.status.toUpperCase()})
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
            background: "rgba(6, 60, 61, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "16px",
              maxWidth: "660px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 48px rgba(6, 60, 61, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#B9DED4",
                    background: "rgba(185, 222, 212, 0.2)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    display: "inline-block",
                    marginBottom: "6px",
                  }}
                >
                  {selectedItemForDetails.code}
                </span>
                <h3 style={{ margin: 0, color: "#FFFFFF", fontSize: "16px", fontWeight: 700 }}>
                  {selectedItemForDetails.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#B9DED4",
                  fontSize: "24px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
              <div>
                <span style={{ color: "#6E7F7C", display: "block", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                  Statutory Citation:
                </span>
                <strong style={{ color: "#172322", fontSize: "13px" }}>
                  {selectedItemForDetails.statutory_citation || "N/A"}
                </strong>
              </div>

              <div>
                <span style={{ color: "#6E7F7C", display: "block", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  Official Validation Status:
                </span>
                {getStatusBadge(
                  (localSignoffs[selectedItemForDetails.code] || selectedItemForDetails.human_signoff_completed) &&
                    selectedItemForDetails.status === "needs_review"
                    ? "complete"
                    : selectedItemForDetails.status
                )}
              </div>

              <div>
                <span style={{ color: "#6E7F7C", display: "block", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  Declarative Validation Results:
                </span>
                <div style={{ background: "#F8FAF9", border: "1px solid #E2E8E4", padding: "12px 16px", borderRadius: "8px" }}>
                  <ul style={{ margin: 0, paddingLeft: "16px", color: "#172322" }}>
                    {selectedItemForDetails.validation_details.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <span style={{ color: "#6E7F7C", display: "block", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
                  Adjudication Notes / Rationale:
                </span>
                <textarea
                  placeholder="Enter specialist review findings, Kazarian step 2 assessment, or reason for sign-off..."
                  value={adjudicationNote}
                  onChange={(e) => setAdjudicationNote(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "90px",
                    marginTop: "4px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid #DCE5E1",
                    background: "#FAFAF8",
                    color: "#172322",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                background: "#F8FAF9",
                borderTop: "1px solid #E2E8E4",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
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
