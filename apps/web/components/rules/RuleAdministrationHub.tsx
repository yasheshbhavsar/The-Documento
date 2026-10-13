"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { Modal } from "../common/Modal";
import {
  OfficialSource,
  SourceSnapshot,
  SnapshotCompareResult,
  RuleSet,
  RuleSetVersion,
  RuleRequirement,
  AffectedCasesImpactResult,
  RoleCode,
} from "../../lib/types";
import {
  api,
  DEMO_USERS,
  FALLBACK_OFFICIAL_SOURCES,
  FALLBACK_SNAPSHOTS,
  FALLBACK_RULE_SETS,
  FALLBACK_RULE_VERSIONS,
  FALLBACK_REQUIREMENTS,
} from "../../lib/api";

interface RuleAdministrationHubProps {
  userRole?: RoleCode;
  isLiveBackend?: boolean;
  onNotification?: (msg: string, type: "success" | "error" | "info") => void;
}

export function RuleAdministrationHub({
  userRole = "master_admin",
  isLiveBackend = false,
  onNotification,
}: RuleAdministrationHubProps) {
  const [activeTab, setActiveTab] = useState<"sources" | "rulesets" | "requirements" | "regression">("sources");
  const [isLoading, setIsLoading] = useState(false);

  // Sources State
  const [sources, setSources] = useState<OfficialSource[]>(FALLBACK_OFFICIAL_SOURCES);
  const [selectedSource, setSelectedSource] = useState<OfficialSource | null>(FALLBACK_OFFICIAL_SOURCES[0] || null);
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>(FALLBACK_SNAPSHOTS);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("ALL");
  const [isRegisterSourceModalOpen, setIsRegisterSourceModalOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<SnapshotCompareResult | null>(null);

  // New Source Form
  const [newSourceJurisdiction, setNewSourceJurisdiction] = useState("US");
  const [newSourceAuthority, setNewSourceAuthority] = useState("USCIS");
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceScope, setNewSourceScope] = useState("");

  // New Snapshot Form
  const [newSnapshotContent, setNewSnapshotContent] = useState("");
  const [newSnapshotPubDate, setNewSnapshotPubDate] = useState("");
  const [newSnapshotEffDate, setNewSnapshotEffDate] = useState("");

  // Rule Sets State
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(FALLBACK_RULE_SETS);
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(FALLBACK_RULE_SETS[0] || null);
  const [versions, setVersions] = useState<RuleSetVersion[]>(FALLBACK_RULE_VERSIONS);
  const [selectedVersion, setSelectedVersion] = useState<RuleSetVersion | null>(FALLBACK_RULE_VERSIONS[0] || null);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState("");
  const [newVersionSummary, setNewVersionSummary] = useState("");

  // Requirements State
  const [requirements, setRequirements] = useState<RuleRequirement[]>(FALLBACK_REQUIREMENTS);
  const [isAddRequirementModalOpen, setIsAddRequirementModalOpen] = useState(false);
  const [newReqCode, setNewReqCode] = useState("");
  const [newReqTitle, setNewReqTitle] = useState("");
  const [newReqDesc, setNewReqDesc] = useState("");
  const [newReqCategory, setNewReqCategory] = useState("regulatory_criteria");
  const [newReqCitation, setNewReqCitation] = useState("");
  const [newReqMandatory, setNewReqMandatory] = useState(false);
  const [newReqHumanReview, setNewReqHumanReview] = useState(true);
  const [newReqGuidance, setNewReqGuidance] = useState("");
  const [newReqEvidenceCategory, setNewReqEvidenceCategory] = useState("award_certificate");

  // Regression & Impact State
  const [regressionResult, setRegressionResult] = useState<any>(null);
  const [impactResult, setImpactResult] = useState<AffectedCasesImpactResult | null>(null);

  // Load Initial Data
  useEffect(() => {
    if (isLiveBackend) {
      loadSources();
      loadRuleSets();
    }
  }, [isLiveBackend]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const res = await api.getOfficialSources(undefined, undefined, userRole);
      setSources(res.data);
      if (res.data.length > 0 && !selectedSource) {
        setSelectedSource(res.data[0]);
        loadSnapshots(res.data[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSnapshots = async (sourceId: string) => {
    const res = await api.getSourceSnapshots(sourceId, userRole);
    setSnapshots(res.data);
  };

  const loadRuleSets = async () => {
    const res = await api.getRuleSets(undefined, undefined, userRole);
    setRuleSets(res.data);
    if (res.data.length > 0 && !selectedRuleSet) {
      const defaultSet = res.data[0];
      setSelectedRuleSet(defaultSet);
      loadVersions(defaultSet.id);
    }
  };

  const loadVersions = async (setId: string) => {
    const res = await api.getRuleSetVersions(setId, userRole);
    setVersions(res.data);
    if (res.data.length > 0) {
      const topV = res.data[0];
      setSelectedVersion(topV);
      loadRequirements(topV.id);
    }
  };

  const loadRequirements = async (versionId: string) => {
    const res = await api.getVersionRequirements(versionId, userRole);
    setRequirements(res.data);
  };

  const handleRegisterSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceTitle || !newSourceUrl || !newSourceScope) {
      onNotification?.("Please complete all required fields for the official source registration.", "error");
      return;
    }
    const res = await api.createOfficialSource({
      jurisdiction: newSourceJurisdiction,
      authority: newSourceAuthority,
      title: newSourceTitle,
      url: newSourceUrl,
      scope_limitations: newSourceScope,
    }, userRole);
    if (res.data) {
      setSources([res.data, ...sources]);
      setSelectedSource(res.data);
      setIsRegisterSourceModalOpen(false);
      onNotification?.(`Registered official government source: ${res.data.title}`, "success");
      setNewSourceTitle("");
      setNewSourceUrl("");
      setNewSourceScope("");
    }
  };

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !newSnapshotContent) return;
    const res = await api.captureSourceSnapshot(selectedSource.id, {
      raw_content: newSnapshotContent,
      publication_date: newSnapshotPubDate || undefined,
      effective_date: newSnapshotEffDate || undefined,
    }, userRole);
    if (res.data) {
      setSnapshots([res.data, ...snapshots]);
      setIsSnapshotModalOpen(false);
      onNotification?.("Cryptographic SHA-256 source content snapshot recorded.", "success");
      setNewSnapshotContent("");
      setNewSnapshotPubDate("");
      setNewSnapshotEffDate("");
    }
  };

  const handleCompareSnapshots = async () => {
    if (snapshots.length < 2) {
      onNotification?.("At least 2 snapshots are required to compute a cryptographic diff.", "info");
      return;
    }
    const res = await api.compareSourceSnapshots(selectedSource?.id || snapshots[0].source_id, snapshots[1].id, snapshots[0].id, userRole);
    setDiffResult(res.data);
    setIsDiffModalOpen(true);
  };

  const handleCreateNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleSet || !newVersionNumber) return;
    const res = await api.createRuleSetVersion(selectedRuleSet.id, {
      version_number: newVersionNumber,
      change_summary: newVersionSummary,
    }, userRole);
    if (res.data) {
      setVersions([res.data, ...versions]);
      setSelectedVersion(res.data);
      setIsNewVersionModalOpen(false);
      onNotification?.(`Drafted new rule version v${res.data.version_number}`, "success");
      setNewVersionNumber("");
      setNewVersionSummary("");
    }
  };

  const handleTransitionVersion = async (targetStatus: string) => {
    if (!selectedVersion) return;
    const res = await api.transitionVersionStatus(
      selectedVersion.id,
      targetStatus,
      `Administrative transition to ${targetStatus}`,
      userRole
    );
    if (res.data) {
      setSelectedVersion(res.data);
      setVersions(versions.map(v => (v.id === res.data.id ? res.data : v)));
      onNotification?.(`Version v${res.data.version_number} transition: ${targetStatus.toUpperCase()}`, "success");
    }
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersion || !newReqCode || !newReqTitle) return;
    const res = await api.createVersionRequirement(selectedVersion.id, {
      code: newReqCode,
      title: newReqTitle,
      description: newReqDesc,
      category: newReqCategory,
      statutory_citation: newReqCitation,
      is_mandatory: newReqMandatory,
      requires_human_review: newReqHumanReview,
      review_guidance: newReqGuidance,
      accepted_evidence_types: [newReqEvidenceCategory],
      validation_rules: [{ check: "doc_present", field_name: newReqEvidenceCategory }],
      blocking_dependencies: [],
      priority: 1,
    }, userRole);
    if (res.data) {
      setRequirements([...requirements, res.data]);
      setIsAddRequirementModalOpen(false);
      onNotification?.(`Added declarative requirement: ${res.data.code}`, "success");
      setNewReqCode("");
      setNewReqTitle("");
      setNewReqDesc("");
      setNewReqCitation("");
      setNewReqGuidance("");
    }
  };

  const handleRunRegression = async () => {
    if (!selectedVersion) return;
    setIsLoading(true);
    try {
      const res = await api.testVersionRegression(selectedVersion.id, userRole);
      setRegressionResult(res.data);
      onNotification?.("Automated Regression Suite execution completed.", "success");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentifyAffectedCases = async () => {
    if (!selectedVersion) return;
    setIsLoading(true);
    try {
      const res = await api.identifyAffectedCases(selectedVersion.id, true, userRole);
      setImpactResult(res.data);
      onNotification?.(`Impact Analysis complete: ${res.data.affected_cases_count} open cases queued for caseworker review.`, "info");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedEB1APilot = async () => {
    setIsLoading(true);
    try {
      const res = await api.seedEB1APilot(userRole);
      onNotification?.(res.data.message, "success");
      await loadSources();
      await loadRuleSets();
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSources = sources.filter(s => {
    if (selectedJurisdiction === "ALL") return true;
    return s.jurisdiction === selectedJurisdiction;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Executive Banner */}
      <div
        style={{
          padding: "24px 28px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
          color: "#FFFFFF",
          border: "1px solid rgba(185, 222, 212, 0.25)",
          boxShadow: "0 6px 24px rgba(6, 60, 61, 0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
              Immigration Rules & Requirement Engine
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "6px",
                background: "rgba(185, 222, 212, 0.18)",
                color: "#B9DED4",
                border: "1px solid rgba(185, 222, 212, 0.35)",
              }}
            >
              Phase 6 Subsystem
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "6px",
                background: "#D1FAE5",
                color: "#065F46",
                border: "1px solid #6EE7B7",
              }}
            >
              US EB-1A Pilot Active
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#DDEFE8", margin: 0, maxWidth: "680px", lineHeight: "1.5" }}>
            Configurable, versioned rules engine with official government provenance (USCIS, US DOS, IRCC, UKVI, DHA, BAMF).
            Evaluates statutory mandates with declarative logic without hardcoding frontend rules.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSeedEB1APilot}
            disabled={isLoading}
            style={{
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              background: "rgba(255, 255, 255, 0.12)",
              color: "#FFFFFF",
              border: "1px solid rgba(185, 222, 212, 0.35)",
              transition: "all 0.15s ease",
            }}
          >
            ✦ Re-seed US EB-1A Pilot
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterSourceModalOpen(true)}
            style={{
              padding: "9px 18px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "8px",
              cursor: "pointer",
              background: "#0D6866",
              color: "#FFFFFF",
              border: "none",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            + Register Official Source
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1.5px solid #E2E8E4",
          paddingBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "sources" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "sources" ? "#EAF6F0" : "transparent",
            color: activeTab === "sources" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "sources" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "sources" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>🏛️</span> Official Sources & Snapshots ({sources.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rulesets")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "rulesets" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "rulesets" ? "#EAF6F0" : "transparent",
            color: activeTab === "rulesets" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "rulesets" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "rulesets" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>📜</span> Rule Sets & Version Lifecycle ({ruleSets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requirements")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "requirements" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "requirements" ? "#EAF6F0" : "transparent",
            color: activeTab === "requirements" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "requirements" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "requirements" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>⚙️</span> Declarative Requirements ({requirements.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("regression")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "regression" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "regression" ? "#EAF6F0" : "transparent",
            color: activeTab === "regression" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "regression" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "regression" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>🛡️</span> Regression Testing & Impact Analyzer
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: OFFICIAL SOURCES & SNAPSHOTS */}
      {/* ============================================================== */}
      {activeTab === "sources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Jurisdiction Filters */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              padding: "12px 18px",
              background: "#F8FAF9",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E7F7C" }}>
                Filter Authority Jurisdiction:
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {["ALL", "US", "CA", "GB", "AU", "DE"].map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setSelectedJurisdiction(j)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: selectedJurisdiction === j ? 700 : 600,
                      cursor: "pointer",
                      background: selectedJurisdiction === j ? "#0D6866" : "#FFFFFF",
                      color: selectedJurisdiction === j ? "#FFFFFF" : "#4B5563",
                      border: selectedJurisdiction === j ? "1px solid #0D6866" : "1px solid #DCE5E1",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>
              Showing <strong style={{ color: "#172322" }}>{filteredSources.length}</strong> registered government authority URLs
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
            {/* Sources List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredSources.map((s) => {
                const isSelected = selectedSource?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSource(s);
                      loadSnapshots(s.id);
                    }}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "12px",
                      background: isSelected ? "#EAF6F0" : "#FFFFFF",
                      border: isSelected ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                      boxShadow: isSelected ? "0 4px 12px rgba(13, 104, 102, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#EAF6F0",
                            color: "#063C3D",
                            border: "1px solid #B9DED4",
                            borderRadius: "4px",
                          }}
                        >
                          {s.jurisdiction}
                        </span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#172322" }}>
                          {s.authority}
                        </span>
                      </div>
                      <span
                        style={{
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "999px",
                          background: "#F1F5F4",
                          color: "#4B5563",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        • {s.snapshots_count} Snapshots
                      </span>
                    </div>

                    <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#172322", margin: "0 0 6px 0", lineHeight: "1.4" }}>
                      {s.title}
                    </h4>
                    <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "0 0 10px 0", lineHeight: "1.4" }}>
                      {s.scope_limitations}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#6E7F7C", borderTop: "1px solid #E5EBE8", paddingTop: "8px" }}>
                      <span>
                        Last checked: {s.last_retrieved_at ? new Date(s.last_retrieved_at).toLocaleDateString() : "Never"}
                      </span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#0D6866", fontWeight: 700, textDecoration: "none" }}
                      >
                        Official URL ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Source Details & Snapshots */}
            {selectedSource ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <Card style={{ background: "#FFFFFF", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "#EAF6F0",
                            color: "#063C3D",
                            border: "1px solid #B9DED4",
                          }}
                        >
                          {selectedSource.jurisdiction} Authority
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#172322" }}>
                          {selectedSource.authority}
                        </span>
                      </div>
                      <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#172322", margin: 0 }}>
                        {selectedSource.title}
                      </h3>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCompareSnapshots}
                        disabled={snapshots.length < 2}
                      >
                        ⚖ Compare Diff
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setIsSnapshotModalOpen(true)}
                      >
                        + Capture Snapshot
                      </Button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "#FFFBEB",
                      border: "1px solid #FCD34D",
                      marginBottom: "14px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#92400E",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Legal Scope & Limitations (Authoritative Boundaries)
                    </span>
                    <p style={{ fontSize: "12px", color: "#78350F", margin: 0, lineHeight: "1.5" }}>
                      {selectedSource.scope_limitations}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6E7F7C", borderTop: "1px solid #E2E8E4", paddingTop: "12px" }}>
                    <span>Government Canonical URL:</span>
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#0D6866", fontFamily: "ui-monospace, monospace", textDecoration: "none", fontWeight: 600 }}
                    >
                      {selectedSource.url}
                    </a>
                  </div>
                </Card>

                {/* Snapshots History Table */}
                <Card style={{ background: "#FFFFFF", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#172322", margin: 0 }}>
                      Cryptographic Source Snapshot Provenance
                    </h4>
                    <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                      {snapshots.length} Historical Snapshots
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAF9", color: "#6E7F7C", borderBottom: "1.5px solid #E2E8E4" }}>
                          <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Retrieval Timestamp</th>
                          <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Publication Date</th>
                          <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Effective Date</th>
                          <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>SHA-256 Hash</th>
                          <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.map((snap, idx) => (
                          <tr key={snap.id} style={{ borderBottom: "1px solid #F0F4F2" }}>
                            <td style={{ padding: "12px 14px", color: "#172322", fontWeight: 600 }}>
                              {new Date(snap.retrieval_timestamp).toLocaleString()}
                              {idx === 0 && (
                                <span
                                  style={{
                                    marginLeft: "8px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "#ECFDF5",
                                    color: "#065F46",
                                    border: "1px solid #A7F3D0",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  Latest
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", color: "#4B5563" }}>
                              {snap.publication_date ? new Date(snap.publication_date).toLocaleDateString() : "Undated"}
                            </td>
                            <td style={{ padding: "12px 14px", color: "#4B5563" }}>
                              {snap.effective_date ? new Date(snap.effective_date).toLocaleDateString() : "Immediate"}
                            </td>
                            <td style={{ padding: "12px 14px", fontFamily: "ui-monospace, monospace", fontSize: "11px", color: "#6E7F7C" }}>
                              {snap.content_hash.slice(0, 16)}...
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  alert(`Full Snapshot Content:\n\n${snap.raw_content}`);
                                }}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#0D6866",
                                  background: "#EAF6F0",
                                  border: "1px solid #B9DED4",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                }}
                              >
                                View Text
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "#6E7F7C",
                  border: "1.5px dashed #DCE5E1",
                  borderRadius: "12px",
                  background: "#F8FAF9",
                }}
              >
                Select an official source to inspect legal scope and snapshot provenance
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: RULE SETS & VERSION LIFECYCLE */}
      {/* ============================================================== */}
      {activeTab === "rulesets" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
          {/* Rule Sets Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E7F7C" }}>
                Configured Immigration Pathways
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, background: "#EAF6F0", color: "#063C3D", border: "1px solid #B9DED4", padding: "2px 8px", borderRadius: "999px" }}>
                {ruleSets.length} Sets
              </span>
            </div>
            {ruleSets.map((rs) => {
              const isSelected = selectedRuleSet?.id === rs.id;
              return (
                <div
                  key={rs.id}
                  onClick={() => {
                    setSelectedRuleSet(rs);
                    loadVersions(rs.id);
                  }}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "12px",
                    background: isSelected ? "#EAF6F0" : "#FFFFFF",
                    border: isSelected ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                    boxShadow: isSelected ? "0 4px 12px rgba(13, 104, 102, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        background: "#EAF6F0",
                        color: "#063C3D",
                        border: "1px solid #B9DED4",
                        borderRadius: "4px",
                      }}
                    >
                      {rs.code}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#6E7F7C" }}>
                      {rs.jurisdiction} · {rs.program_pathway}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#172322", margin: "0 0 4px 0" }}>
                    {rs.name}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#6E7F7C", margin: 0, lineHeight: "1.4" }}>
                    {rs.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Version Lifecycle Administration */}
          {selectedRuleSet && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <Card style={{ background: "#FFFFFF", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 700, background: "#EAF6F0", color: "#063C3D", border: "1px solid #B9DED4", borderRadius: "4px" }}>
                        {selectedRuleSet.jurisdiction}
                      </span>
                      <span style={{ fontSize: "12px", color: "#6E7F7C" }}>Pathway: {selectedRuleSet.program_pathway}</span>
                      <span style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "ui-monospace, monospace" }}>({selectedRuleSet.code})</span>
                    </div>
                    <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#172322", margin: 0 }}>
                      {selectedRuleSet.name}
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsNewVersionModalOpen(true)}
                  >
                    + Draft New Version
                  </Button>
                </div>

                {/* Version List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E7F7C" }}>
                    Version History & Administrative Lifecycle
                  </span>
                  {versions.map((v) => {
                    const isSelectedVer = selectedVersion?.id === v.id;
                    const getStatusBadge = (st: string) => {
                      switch (st) {
                        case "published": return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>PUBLISHED (Active)</span>;
                        case "validated": return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" }}>VALIDATED</span>;
                        case "under_review": return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>UNDER REVIEW</span>;
                        case "draft": return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>DRAFT</span>;
                        case "superseded": return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>SUPERSEDED</span>;
                        default: return <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#F3F4F6", color: "#374151" }}>{st.toUpperCase()}</span>;
                      }
                    };

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVersion(v);
                          loadRequirements(v.id);
                        }}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          background: isSelectedVer ? "#EAF6F0" : "#FAFAF8",
                          border: isSelectedVer ? "1.5px solid #0D6866" : "1px solid #E2E8E4",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 800, color: "#172322", fontFamily: "ui-monospace, monospace" }}>
                              v{v.version_number}
                            </span>
                            {getStatusBadge(v.status)}
                            <span style={{ fontSize: "12px", color: "#6E7F7C" }}>({v.requirements_count} Requirements)</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                            Created {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#4B5563", margin: "0 0 10px 0" }}>
                          {v.change_summary || "Standard baseline revision"}
                        </p>

                        {/* Lifecycle Controls */}
                        {isSelectedVer && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #DCE5E1", fontSize: "12px" }}>
                            <span style={{ color: "#6E7F7C", fontSize: "11px" }}>
                              Administrative Actions (Separation of Duty Protected):
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {v.status === "draft" && (
                                <Button size="sm" variant="outline" onClick={() => handleTransitionVersion("under_review")}>
                                  Submit for Review →
                                </Button>
                              )}
                              {v.status === "under_review" && (
                                <Button size="sm" variant="outline" onClick={() => handleTransitionVersion("validated")}>
                                  ✓ Validate Version
                                </Button>
                              )}
                              {v.status === "validated" && (
                                <Button size="sm" variant="primary" onClick={() => handleTransitionVersion("published")}>
                                  🚀 Publish Version
                                </Button>
                              )}
                              {v.status === "published" && (
                                <Button size="sm" variant="outline" onClick={() => handleTransitionVersion("suspended")}>
                                  Suspend
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Audit & Approval History */}
                {selectedVersion && selectedVersion.approval_history && selectedVersion.approval_history.length > 0 && (
                  <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#F8FAF9", border: "1px solid #E2E8E4" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E7F7C", display: "block", marginBottom: "8px" }}>
                      Approval & Publication Traceability Log (v{selectedVersion.version_number})
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                      {selectedVersion.approval_history.map((h, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#4B5563" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#0D6866", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                              [{h.action || h.stage}]
                            </span>
                            <span style={{ color: "#172322" }}>{h.comments || "Approved"}</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: DECLARATIVE REQUIREMENTS */}
      {/* ============================================================== */}
      {activeTab === "requirements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#F8FAF9", padding: "16px 20px", borderRadius: "12px", border: "1px solid #DCE5E1" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#172322", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Declarative Requirements for {selectedRuleSet?.name || "Pathway"}</span>
                {selectedVersion && (
                  <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EAF6F0", color: "#063C3D", border: "1px solid #B9DED4" }}>
                    v{selectedVersion.version_number}
                  </span>
                )}
              </h3>
              <p style={{ fontSize: "12px", color: "#6E7F7C", margin: 0 }}>
                Purely declarative rules evaluated by constrained AST engine. No arbitrary database code execution.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setIsAddRequirementModalOpen(true)}
            >
              + Add Declarative Requirement
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {requirements.map((req) => (
              <Card key={req.id} style={{ background: "#FFFFFF", padding: "18px 20px", border: "1px solid #DCE5E1", borderRadius: "12px", boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#EAF6F0",
                          color: "#063C3D",
                          border: "1px solid #B9DED4",
                        }}
                      >
                        {req.code}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "#F1F5F4", color: "#4B5563", textTransform: "uppercase" }}>
                        {req.category}
                      </span>
                      {req.is_mandatory ? (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>
                          Mandatory
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "#F3E8FF", color: "#6B21A8", border: "1px solid #D8B4FE" }}>
                          Discretionary Prongs
                        </span>
                      )}
                      {req.statutory_citation && (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                          § {req.statutory_citation}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: "15px", fontWeight: 800, color: "#172322", margin: 0 }}>{req.title}</h4>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Priority: {req.priority}</span>
                    {req.requires_human_review && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                        Requires Human Sign-off
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "#4B5563", margin: "0 0 12px 0", lineHeight: "1.5" }}>{req.description}</p>

                {/* Evidence & Validation Details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    background: "#F8FAF9",
                    border: "1px solid #E2E8E4",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6E7F7C", display: "block", marginBottom: "6px" }}>
                      Accepted Evidence
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {req.accepted_evidence_types.map((ev: any, idx: number) => {
                        const name = typeof ev === "string" ? ev : ev.category;
                        return (
                          <span key={idx} style={{ padding: "3px 8px", borderRadius: "4px", background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6E7F7C", display: "block", marginBottom: "6px" }}>
                      Declarative Validation Rules
                    </span>
                    {req.validation_rules.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {req.validation_rules.map((vr: any, idx: number) => (
                          <span key={idx} style={{ color: "#374151", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>
                            • {vr.check}: {vr.field_name || vr.min_confidence || vr.min_pages || "active"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>None specified</span>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6E7F7C", display: "block", marginBottom: "6px" }}>
                      Prerequisite Dependencies
                    </span>
                    {req.blocking_dependencies.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {req.blocking_dependencies.map((dep, idx) => (
                          <span key={idx} style={{ padding: "2px 8px", borderRadius: "4px", background: "#FFF7ED", color: "#9A3412", border: "1px solid #FED7AA", fontSize: "10px", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                            Prereq: {dep}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Independent criterion</span>
                    )}
                  </div>
                </div>

                {req.review_guidance && (
                  <div style={{ marginTop: "10px", fontSize: "12px", color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "8px 14px", borderRadius: "6px" }}>
                    <strong>Caseworker Guidance:</strong> {req.review_guidance}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: REGRESSION TESTING & IMPACT ANALYZER */}
      {/* ============================================================== */}
      {activeTab === "regression" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Regression Suite Runner */}
          <Card style={{ background: "#FFFFFF", padding: "22px", border: "1px solid #DCE5E1", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#172322", margin: 0 }}>
                Automated Rule Version Regression Test Suite
              </h3>
              {selectedVersion && (
                <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EAF6F0", color: "#063C3D", border: "1px solid #B9DED4" }}>
                  v{selectedVersion.version_number}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "0 0 16px 0", lineHeight: "1.5" }}>
              Validates structural integrity of the declarative rules: checks for circular blocking deadlocks,
              verifies operator AST safety, and validates linked official source snapshots.
            </p>

            <Button
              variant="primary"
              onClick={handleRunRegression}
              disabled={isLoading || !selectedVersion}
              style={{ width: "100%", marginBottom: "16px" }}
            >
              ▶ Run Automated Regression Suite
            </Button>

            {regressionResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "14px", borderTop: "1px solid #E2E8E4" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#172322" }}>Test Outcome:</span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: regressionResult.is_valid ? "#ECFDF5" : "#FEF2F2",
                      color: regressionResult.is_valid ? "#065F46" : "#991B1B",
                      border: regressionResult.is_valid ? "1px solid #A7F3D0" : "1px solid #FECACA",
                    }}
                  >
                    {regressionResult.is_valid ? "✓ ALL CHECKS PASSED" : "FAILED"}
                  </span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "8px", background: "#F8FAF9", border: "1px solid #E2E8E4", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {regressionResult.passed_checks.map((chk: string, i: number) => (
                    <div key={i} style={{ color: "#065F46", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>✓</span> <span>{chk}</span>
                    </div>
                  ))}
                  {regressionResult.warnings?.map((w: string, i: number) => (
                    <div key={i} style={{ color: "#92400E", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>⚠</span> <span>{w}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "#374151", fontWeight: 600, margin: 0 }}>
                  Recommendation: {regressionResult.recommendation}
                </p>
              </div>
            )}
          </Card>

          {/* Affected Cases Impact Analyzer */}
          <Card style={{ background: "#FFFFFF", padding: "22px", border: "1px solid #DCE5E1", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#172322", margin: 0 }}>
                Affected Cases Impact Analyzer
              </h3>
              <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "#EAF6F0", color: "#063C3D", border: "1px solid #B9DED4", fontWeight: 700 }}>
                Zero Silent Overwrites
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "0 0 16px 0", lineHeight: "1.5" }}>
              When a published rule changes, scans open cases in this jurisdiction & pathway and creates
              high-priority review tasks for caseworkers rather than silently rewriting prior legal evaluations.
            </p>

            <Button
              variant="outline"
              onClick={handleIdentifyAffectedCases}
              disabled={isLoading || !selectedVersion}
              style={{ width: "100%", marginBottom: "16px" }}
            >
              🔍 Identify Affected Open Cases & Queue Tasks
            </Button>

            {impactResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "14px", borderTop: "1px solid #E2E8E4" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "center" }}>
                  <div style={{ padding: "12px", borderRadius: "8px", background: "#F8FAF9", border: "1px solid #E2E8E4" }}>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", display: "block", fontWeight: 600 }}>Open Cases Inspected</span>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "#172322" }}>{impactResult.total_open_cases_inspected}</span>
                  </div>
                  <div style={{ padding: "12px", borderRadius: "8px", background: "#FFFBEB", border: "1px solid #FCD34D" }}>
                    <span style={{ fontSize: "11px", color: "#92400E", display: "block", fontWeight: 700 }}>Affected Cases Queued</span>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "#B45309" }}>{impactResult.affected_cases_count}</span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: "8px", background: "#F8FAF9", border: "1px solid #E2E8E4", fontSize: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6E7F7C", display: "block", marginBottom: "8px" }}>
                    Queued Caseworker Review Tasks
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {impactResult.affected_cases.map((ac, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: idx === impactResult.affected_cases.length - 1 ? "none" : "1px solid #E5EBE8" }}>
                        <div>
                          <span style={{ color: "#172322", fontWeight: 700 }}>{ac.case_number}</span>
                          <span style={{ color: "#6E7F7C", marginLeft: "8px" }}>Stage: {ac.current_processing_stage}</span>
                        </div>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                          Task Queued
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODALS */}
      {/* ============================================================== */}

      {/* Register Source Modal */}
      <Modal
        isOpen={isRegisterSourceModalOpen}
        onClose={() => setIsRegisterSourceModalOpen(false)}
        title="Register Official Government Source"
      >
        <form onSubmit={handleRegisterSource} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Jurisdiction Code</label>
              <select
                value={newSourceJurisdiction}
                onChange={e => setNewSourceJurisdiction(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              >
                <option value="US">US (United States)</option>
                <option value="CA">CA (Canada)</option>
                <option value="GB">GB (United Kingdom)</option>
                <option value="AU">AU (Australia)</option>
                <option value="NZ">NZ (New Zealand)</option>
                <option value="DE">DE (Germany / EU)</option>
                <option value="RU">RU (Russia)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Government Authority</label>
              <input
                type="text"
                value={newSourceAuthority}
                onChange={e => setNewSourceAuthority(e.target.value)}
                placeholder="e.g. USCIS, IRCC, UKVI"
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Source Title</label>
            <input
              type="text"
              value={newSourceTitle}
              onChange={e => setNewSourceTitle(e.target.value)}
              placeholder="e.g. USCIS Policy Manual - Volume 6 Part F"
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Government Official URL</label>
            <input
              type="url"
              value={newSourceUrl}
              onChange={e => setNewSourceUrl(e.target.value)}
              placeholder="https://www.uscis.gov/..."
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322", fontFamily: "ui-monospace, monospace" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Scope & Limitations</label>
            <textarea
              value={newSourceScope}
              onChange={e => setNewSourceScope(e.target.value)}
              placeholder="Specify pathway scope, exclusions, and statutory limits..."
              rows={3}
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
            <Button variant="outline" type="button" onClick={() => setIsRegisterSourceModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Source
            </Button>
          </div>
        </form>
      </Modal>

      {/* Capture Snapshot Modal */}
      <Modal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        title={`Capture Source Content Snapshot (${selectedSource?.authority})`}
      >
        <form onSubmit={handleCaptureSnapshot} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Publication Date</label>
              <input
                type="date"
                value={newSnapshotPubDate}
                onChange={e => setNewSnapshotPubDate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Effective Date</label>
              <input
                type="date"
                value={newSnapshotEffDate}
                onChange={e => setNewSnapshotEffDate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Raw Content Text / Markdown</label>
            <textarea
              value={newSnapshotContent}
              onChange={e => setNewSnapshotContent(e.target.value)}
              placeholder="Paste official policy text or regulatory extract..."
              rows={6}
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "12px", color: "#172322", fontFamily: "ui-monospace, monospace" }}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
            <Button variant="outline" type="button" onClick={() => setIsSnapshotModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Hash & Save Snapshot
            </Button>
          </div>
        </form>
      </Modal>

      {/* Visual Snapshot Diff Modal */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title="Visual Snapshot Diff & Revision Comparison"
      >
        {diffResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "12px 16px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE", fontSize: "12px", color: "#1E40AF" }}>
              <span style={{ fontWeight: 800 }}>Comparison Summary:</span> {diffResult.summary}
            </div>
            <div style={{ padding: "14px", background: "#F8FAF9", borderRadius: "8px", border: "1px solid #E2E8E4", fontFamily: "ui-monospace, monospace", fontSize: "12px", overflowX: "auto", maxHeight: "380px" }}>
              {diffResult.diff_lines.map((line, idx) => {
                let color = "#4B5563";
                let bg = "transparent";
                if (line.startsWith("+")) { color = "#065F46"; bg = "#ECFDF5"; }
                if (line.startsWith("-")) { color = "#991B1B"; bg = "#FEF2F2"; }
                if (line.startsWith("@@")) { color = "#1E40AF"; bg = "#EFF6FF"; }
                return (
                  <div key={idx} style={{ color, background: bg, padding: "2px 6px", borderRadius: "4px", whiteSpace: "pre-wrap", margin: "2px 0" }}>
                    {line}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setIsDiffModalOpen(false)}>
                Close Diff
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Draft Version Modal */}
      <Modal
        isOpen={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Draft New Version (${selectedRuleSet?.name})`}
      >
        <form onSubmit={handleCreateNewVersion} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Version Number</label>
            <input
              type="text"
              value={newVersionNumber}
              onChange={e => setNewVersionNumber(e.target.value)}
              placeholder="e.g. 1.1.0 or 2.0.0"
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322", fontFamily: "ui-monospace, monospace" }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Change Summary</label>
            <textarea
              value={newVersionSummary}
              onChange={e => setNewVersionSummary(e.target.value)}
              placeholder="Describe amendments, new statutory requirements, or guidance revisions..."
              rows={3}
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              required
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
            <Button variant="outline" type="button" onClick={() => setIsNewVersionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Draft Version
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Requirement Modal */}
      <Modal
        isOpen={isAddRequirementModalOpen}
        onClose={() => setIsAddRequirementModalOpen(false)}
        title="Add Declarative Requirement Definition"
      >
        <form onSubmit={handleAddRequirement} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Requirement Code</label>
              <input
                type="text"
                value={newReqCode}
                onChange={e => setNewReqCode(e.target.value)}
                placeholder="e.g. EB1A-EVID-AWARDS"
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322", fontFamily: "ui-monospace, monospace" }}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Category</label>
              <select
                value={newReqCategory}
                onChange={e => setNewReqCategory(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              >
                <option value="regulatory_criteria">Regulatory Criteria (Prongs)</option>
                <option value="mandatory_identity">Mandatory Identity</option>
                <option value="statutory_mandate">Statutory Mandate</option>
                <option value="health_police">Health & Police Clearance</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Requirement Title</label>
            <input
              type="text"
              value={newReqTitle}
              onChange={e => setNewReqTitle(e.target.value)}
              placeholder="e.g. Nationally or Internationally Recognized Prizes"
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Statutory Citation</label>
            <input
              type="text"
              value={newReqCitation}
              onChange={e => setNewReqCitation(e.target.value)}
              placeholder="e.g. 8 CFR § 204.5(h)(3)(i)"
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Description</label>
            <textarea
              value={newReqDesc}
              onChange={e => setNewReqDesc(e.target.value)}
              placeholder="Evidentiary standard description..."
              rows={2}
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Accepted Evidence Type</label>
              <select
                value={newReqEvidenceCategory}
                onChange={e => setNewReqEvidenceCategory(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322", fontFamily: "ui-monospace, monospace" }}
              >
                <option value="award_certificate">award_certificate</option>
                <option value="scholarly_article">scholarly_article</option>
                <option value="peer_review_invitation">peer_review_invitation</option>
                <option value="expert_recommendation_letter">expert_recommendation_letter</option>
                <option value="passport">passport</option>
                <option value="intent_statement">intent_statement</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingTop: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#172322", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newReqMandatory}
                  onChange={e => setNewReqMandatory(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#0D6866" }}
                />
                Mandatory
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#172322", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newReqHumanReview}
                  onChange={e => setNewReqHumanReview(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#0D6866" }}
                />
                Human Review Gate
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Caseworker Review Guidance</label>
            <input
              type="text"
              value={newReqGuidance}
              onChange={e => setNewReqGuidance(e.target.value)}
              placeholder="e.g. Verify criteria, competitor pool, and direct awardee."
              style={{ width: "100%", padding: "8px 12px", background: "#FAFAF8", border: "1.5px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", color: "#172322" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
            <Button variant="outline" type="button" onClick={() => setIsAddRequirementModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Requirement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
