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
    onNotification?.(`Official government source '${res.data.title}' registered with scope boundaries.`, "success");
    setIsRegisterSourceModalOpen(false);
    loadSources();
  };

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !newSnapshotContent) return;
    await api.captureSourceSnapshot(selectedSource.id, {
      raw_content: newSnapshotContent,
      publication_date: newSnapshotPubDate || undefined,
      effective_date: newSnapshotEffDate || undefined,
    }, userRole);
    onNotification?.(`Snapshot captured for '${selectedSource.authority}' with SHA-256 integrity hash.`, "success");
    setIsSnapshotModalOpen(false);
    loadSnapshots(selectedSource.id);
  };

  const handleCompareSnapshots = async () => {
    if (!selectedSource || snapshots.length < 2) {
      onNotification?.("Need at least 2 snapshots to perform comparison.", "info");
      return;
    }
    const fromId = snapshots[snapshots.length - 1].id;
    const toId = snapshots[0].id;
    const res = await api.compareSourceSnapshots(selectedSource.id, fromId, toId, userRole);
    setDiffResult(res.data);
    setIsDiffModalOpen(true);
  };

  const handleTransitionVersion = async (targetStatus: string) => {
    if (!selectedVersion) return;
    try {
      const res = await api.transitionVersionStatus(
        selectedVersion.id,
        targetStatus,
        `Transitioned via specialist administration hub by ${DEMO_USERS[userRole]?.name || userRole}`,
        userRole
      );
      setSelectedVersion(res.data);
      if (selectedRuleSet) loadVersions(selectedRuleSet.id);
      onNotification?.(`Version ${res.data.version_number} successfully moved to status: ${targetStatus}`, "success");
    } catch (err: any) {
      onNotification?.(err?.message || "Failed to update version status (check separation of duty permissions)", "error");
    }
  };

  const handleCreateNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleSet || !newVersionNumber) return;
    const res = await api.createRuleSetVersion(selectedRuleSet.id, {
      version_number: newVersionNumber,
      change_summary: newVersionSummary,
    }, userRole);
    onNotification?.(`Draft version ${res.data.version_number} created for ${selectedRuleSet.name}.`, "success");
    setIsNewVersionModalOpen(false);
    loadVersions(selectedRuleSet.id);
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersion || !newReqCode || !newReqTitle) return;
    await api.createVersionRequirement(selectedVersion.id, {
      code: newReqCode,
      title: newReqTitle,
      description: newReqDesc,
      category: newReqCategory,
      statutory_citation: newReqCitation || undefined,
      is_mandatory: newReqMandatory,
      requires_human_review: newReqHumanReview,
      review_guidance: newReqGuidance || undefined,
      accepted_evidence_types: [{ category: newReqEvidenceCategory, min_count: 1 }],
      validation_rules: [{ check: "min_pages", min_pages: 1 }],
      blocking_dependencies: newReqCategory === "regulatory_criteria" ? ["EB1A-MAND-ID"] : [],
    }, userRole);
    onNotification?.(`Requirement ${newReqCode} added to version ${selectedVersion.version_number}.`, "success");
    setIsAddRequirementModalOpen(false);
    loadRequirements(selectedVersion.id);
  };

  const handleRunRegression = async () => {
    if (!selectedVersion) return;
    setIsLoading(true);
    try {
      const res = await api.testVersionRegression(selectedVersion.id, userRole);
      setRegressionResult(res.data);
      onNotification?.("Automated regression test suite executed cleanly.", "success");
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
    <div className="space-y-6">
      {/* Top Banner / Pilot Launcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold text-white tracking-tight">Immigration Rules & Requirement Engine</span>
            <Badge variant="info">Phase 6 Subsystem</Badge>
            <Badge variant="success">US EB-1A Pilot Active</Badge>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl">
            Configurable, versioned rules engine with official government provenance (USCIS, US DOS, IRCC, UKVI, DHA, BAMF).
            Evaluates statutory mandates with declarative logic without hardcoding frontend rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSeedEB1APilot}
            disabled={isLoading}
            className="border-indigo-400/40 text-indigo-300 hover:bg-indigo-950/60"
          >
            ✦ Re-seed US EB-1A Pilot
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsRegisterSourceModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          >
            + Register Official Source
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-700/60 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("sources")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sources"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🏛️</span> Official Sources & Snapshots ({sources.length})
        </button>
        <button
          onClick={() => setActiveTab("rulesets")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rulesets"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>📜</span> Rule Sets & Version Lifecycle ({ruleSets.length})
        </button>
        <button
          onClick={() => setActiveTab("requirements")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "requirements"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>⚙️</span> Declarative Requirements ({requirements.length})
        </button>
        <button
          onClick={() => setActiveTab("regression")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "regression"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🛡️</span> Regression Testing & Impact Analyzer
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: OFFICIAL SOURCES & SNAPSHOTS */}
      {/* ============================================================== */}
      {activeTab === "sources" && (
        <div className="space-y-6">
          {/* Jurisdiction Filters */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filter Authority Jurisdiction:
              {["ALL", "US", "CA", "GB", "AU", "DE"].map(j => (
                <button
                  key={j}
                  onClick={() => setSelectedJurisdiction(j)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedJurisdiction === j
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400">
              Showing {filteredSources.length} registered government authority URLs
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sources List */}
            <div className="lg:col-span-1 space-y-3">
              {filteredSources.map(s => {
                const isSelected = selectedSource?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSource(s);
                      loadSnapshots(s.id);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold bg-blue-900/50 text-blue-300 rounded border border-blue-700/40">
                          {s.jurisdiction}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">{s.authority}</span>
                      </div>
                      <Badge variant="neutral">{s.snapshots_count} Snapshots</Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-white line-clamp-2 mb-1.5">{s.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{s.scope_limitations}</p>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Last checked: {s.last_retrieved_at ? new Date(s.last_retrieved_at).toLocaleDateString() : "Never"}</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-blue-400 hover:underline flex items-center gap-1"
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
              <div className="lg:col-span-2 space-y-5">
                <Card className="bg-slate-900/80 border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-950 text-blue-300 border border-blue-800">
                          {selectedSource.jurisdiction} Authority
                        </span>
                        <span className="text-sm font-medium text-slate-300">{selectedSource.authority}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{selectedSource.title}</h3>
                    </div>
                    <div className="flex gap-2">
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

                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 mb-4">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                      Legal Scope & Limitations (Authoritative Boundaries)
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedSource.scope_limitations}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center gap-2">
                      <span>Government Canonical URL:</span>
                      <a href={selectedSource.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">
                        {selectedSource.url}
                      </a>
                    </div>
                  </div>
                </Card>

                {/* Snapshots History Table */}
                <Card className="bg-slate-900/80 border-slate-800 p-5">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                    <span>Cryptographic Source Snapshot Provenance</span>
                    <span className="text-xs text-slate-400 font-normal">{snapshots.length} Historical Snapshots</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-700/60">
                        <tr>
                          <th className="py-2 px-3">Retrieval Timestamp</th>
                          <th className="py-2 px-3">Publication Date</th>
                          <th className="py-2 px-3">Effective Date</th>
                          <th className="py-2 px-3">SHA-256 Hash</th>
                          <th className="py-2 px-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {snapshots.map((snap, idx) => (
                          <tr key={snap.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 text-slate-200">
                              {new Date(snap.retrieval_timestamp).toLocaleString()}
                              {idx === 0 && <span className="ml-2 text-[10px] bg-green-900/40 text-green-300 px-1.5 py-0.5 rounded border border-green-700/30">Latest</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {snap.publication_date ? new Date(snap.publication_date).toLocaleDateString() : "Undated"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {snap.effective_date ? new Date(snap.effective_date).toLocaleDateString() : "Immediate"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                              {snap.content_hash.slice(0, 16)}...
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => {
                                  alert(`Full Snapshot Content:\n\n${snap.raw_content}`);
                                }}
                                className="text-blue-400 hover:text-blue-300 font-medium"
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
              <div className="lg:col-span-2 flex items-center justify-center p-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rule Sets Selector */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-slate-400">Configured Immigration Pathways</span>
                <Badge variant="info">{ruleSets.length} Sets</Badge>
              </div>
              {ruleSets.map(rs => {
                const isSelected = selectedRuleSet?.id === rs.id;
                return (
                  <div
                    key={rs.id}
                    onClick={() => {
                      setSelectedRuleSet(rs);
                      loadVersions(rs.id);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-300 border border-indigo-800 rounded">
                        {rs.code}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{rs.jurisdiction} · {rs.program_pathway}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">{rs.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{rs.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Version Lifecycle Administration */}
            {selectedRuleSet && (
              <div className="lg:col-span-2 space-y-5">
                <Card className="bg-slate-900/80 border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="info">{selectedRuleSet.jurisdiction}</Badge>
                        <span className="text-xs text-slate-400">Pathway: {selectedRuleSet.program_pathway}</span>
                        <span className="text-xs text-slate-400 font-mono">({selectedRuleSet.code})</span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{selectedRuleSet.name}</h3>
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
                  <div className="space-y-3 mb-5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Version History & Administrative Lifecycle
                    </span>
                    {versions.map(v => {
                      const isSelectedVer = selectedVersion?.id === v.id;
                      const getStatusBadge = (st: string) => {
                        switch (st) {
                          case "published": return <Badge variant="success">Published (Active)</Badge>;
                          case "validated": return <Badge variant="info">Validated</Badge>;
                          case "under_review": return <Badge variant="warning">Under Review</Badge>;
                          case "draft": return <Badge variant="neutral">Draft</Badge>;
                          case "superseded": return <Badge variant="critical">Superseded</Badge>;
                          default: return <Badge variant="neutral">{st}</Badge>;
                        }
                      };

                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            setSelectedVersion(v);
                            loadRequirements(v.id);
                          }}
                          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                            isSelectedVer
                              ? "bg-slate-800 border-blue-500/80"
                              : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-bold text-white font-mono">v{v.version_number}</span>
                              {getStatusBadge(v.status)}
                              <span className="text-xs text-slate-400">({v.requirements_count} Requirements)</span>
                            </div>
                            <span className="text-xs text-slate-400">Created {new Date(v.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 mb-2">{v.change_summary || "Standard baseline revision"}</p>

                          {/* Lifecycle Controls */}
                          {isSelectedVer && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                              <span className="text-slate-400">
                                Administrative Actions (Separation of Duty Protected):
                              </span>
                              <div className="flex items-center gap-2">
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
                    <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                        Approval & Publication Traceability Log (v{selectedVersion.version_number})
                      </span>
                      <div className="space-y-1.5 text-xs">
                        {selectedVersion.approval_history.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-slate-400">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400 font-mono">[{h.action || h.stage}]</span>
                              <span className="text-slate-300">{h.comments || "Approved"}</span>
                            </div>
                            <span>{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: DECLARATIVE REQUIREMENTS */}
      {/* ============================================================== */}
      {activeTab === "requirements" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Declarative Requirements for {selectedRuleSet?.name || "Pathway"}</span>
                {selectedVersion && <Badge variant="info">v{selectedVersion.version_number}</Badge>}
              </h3>
              <p className="text-xs text-slate-400">
                Purely declarative rules evaluated by constrained AST engine. No arbitrary database code execution.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsAddRequirementModalOpen(true)}
              >
                + Add Declarative Requirement
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {requirements.map(req => (
              <Card key={req.id} className="bg-slate-900/80 border-slate-800 p-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800 font-bold">
                        {req.code}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                        {req.category}
                      </span>
                      {req.is_mandatory ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-800/40 font-semibold">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                          Discretionary Prongs
                        </span>
                      )}
                      {req.statutory_citation && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 font-serif">
                          § {req.statutory_citation}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white">{req.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Priority: {req.priority}</span>
                    {req.requires_human_review && (
                      <Badge variant="warning">Requires Human Sign-off</Badge>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3">{req.description}</p>

                {/* Evidence & Validation Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Accepted Evidence
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {req.accepted_evidence_types.map((ev: any, idx: number) => {
                        const name = typeof ev === "string" ? ev : ev.category;
                        return (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Declarative Validation Rules
                    </span>
                    {req.validation_rules.length > 0 ? (
                      <div className="space-y-0.5">
                        {req.validation_rules.map((vr: any, idx: number) => (
                          <span key={idx} className="block text-slate-300 font-mono text-[11px]">
                            • {vr.check}: {vr.field_name || vr.min_confidence || vr.min_pages || "active"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">None specified</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Prerequisite Dependencies
                    </span>
                    {req.blocking_dependencies.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {req.blocking_dependencies.map((dep, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-800/40 text-[10px] font-mono">
                            Prereq: {dep}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Independent criterion</span>
                    )}
                  </div>
                </div>

                {req.review_guidance && (
                  <div className="mt-2.5 text-xs text-amber-300/80 bg-amber-950/20 px-3 py-1.5 rounded border border-amber-800/20">
                    <span className="font-semibold text-amber-400">Caseworker Guidance:</span> {req.review_guidance}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Regression Suite Runner */}
            <Card className="bg-slate-900/80 border-slate-800 p-5">
              <h3 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>Automated Rule Version Regression Test Suite</span>
                {selectedVersion && <Badge variant="info">v{selectedVersion.version_number}</Badge>}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Validates structural integrity of the declarative rules: checks for circular blocking deadlocks,
                verifies operator AST safety, and validates linked official source snapshots.
              </p>

              <Button
                variant="primary"
                onClick={handleRunRegression}
                disabled={isLoading || !selectedVersion}
                className="w-full mb-4"
              >
                ▶ Run Automated Regression Suite
              </Button>

              {regressionResult && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Test Outcome:</span>
                    <Badge variant={regressionResult.is_valid ? "success" : "critical"}>
                      {regressionResult.is_valid ? "✓ ALL CHECKS PASSED" : "FAILED"}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 text-xs space-y-1.5 border border-slate-800">
                    {regressionResult.passed_checks.map((chk: string, i: number) => (
                      <div key={i} className="text-green-400 flex items-center gap-2">
                        <span>✓</span> <span>{chk}</span>
                      </div>
                    ))}
                    {regressionResult.warnings?.map((w: string, i: number) => (
                      <div key={i} className="text-amber-400 flex items-center gap-2">
                        <span>⚠</span> <span>{w}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Recommendation: {regressionResult.recommendation}
                  </p>
                </div>
              )}
            </Card>

            {/* Affected Cases Impact Analyzer */}
            <Card className="bg-slate-900/80 border-slate-800 p-5">
              <h3 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>Affected Cases Impact Analyzer</span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40 font-bold">
                  Zero Silent Overwrites
                </span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                When a published rule changes, scans open cases in this jurisdiction & pathway and creates
                high-priority review tasks for caseworkers rather than silently rewriting prior legal evaluations.
              </p>

              <Button
                variant="outline"
                onClick={handleIdentifyAffectedCases}
                disabled={isLoading || !selectedVersion}
                className="w-full mb-4 border-purple-500/40 text-purple-300 hover:bg-purple-950/60"
              >
                🔍 Identify Affected Open Cases & Queue Tasks
              </Button>

              {impactResult && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400 block">Open Cases Inspected</span>
                      <span className="text-lg font-bold text-white">{impactResult.total_open_cases_inspected}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
                      <span className="text-xs text-amber-300 block">Affected Cases Queued</span>
                      <span className="text-lg font-bold text-amber-400">{impactResult.affected_cases_count}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 text-xs border border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Queued Caseworker Review Tasks
                    </span>
                    {impactResult.affected_cases.map((ac, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-850 last:border-0">
                        <div>
                          <span className="text-white font-medium">{ac.case_number}</span>
                          <span className="text-slate-400 ml-2">Stage: {ac.current_processing_stage}</span>
                        </div>
                        <Badge variant="warning">Task Queued</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
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
        <form onSubmit={handleRegisterSource} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Jurisdiction Code</label>
              <select
                value={newSourceJurisdiction}
                onChange={e => setNewSourceJurisdiction(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Government Authority</label>
              <input
                type="text"
                value={newSourceAuthority}
                onChange={e => setNewSourceAuthority(e.target.value)}
                placeholder="e.g. USCIS, IRCC, UKVI"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Source Title</label>
            <input
              type="text"
              value={newSourceTitle}
              onChange={e => setNewSourceTitle(e.target.value)}
              placeholder="e.g. USCIS Policy Manual - Volume 6 Part F"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Government Official URL</label>
            <input
              type="url"
              value={newSourceUrl}
              onChange={e => setNewSourceUrl(e.target.value)}
              placeholder="https://www.uscis.gov/..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Scope & Limitations</label>
            <textarea
              value={newSourceScope}
              onChange={e => setNewSourceScope(e.target.value)}
              placeholder="Specify pathway scope, exclusions, and statutory limits..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
        <form onSubmit={handleCaptureSnapshot} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Publication Date</label>
              <input
                type="date"
                value={newSnapshotPubDate}
                onChange={e => setNewSnapshotPubDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Effective Date</label>
              <input
                type="date"
                value={newSnapshotEffDate}
                onChange={e => setNewSnapshotEffDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Raw Content Text / Markdown</label>
            <textarea
              value={newSnapshotContent}
              onChange={e => setNewSnapshotContent(e.target.value)}
              placeholder="Paste official policy text or regulatory extract..."
              rows={6}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
          <div className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-blue-400">Comparison Summary:</span> {diffResult.summary}
            </div>
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs overflow-x-auto max-h-96">
              {diffResult.diff_lines.map((line, idx) => {
                let color = "text-slate-400";
                if (line.startsWith("+")) color = "text-green-400 bg-green-950/20";
                if (line.startsWith("-")) color = "text-red-400 bg-red-950/20";
                if (line.startsWith("@@")) color = "text-blue-400";
                return (
                  <div key={idx} className={`${color} py-0.5 whitespace-pre`}>
                    {line}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
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
        <form onSubmit={handleCreateNewVersion} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Version Number</label>
            <input
              type="text"
              value={newVersionNumber}
              onChange={e => setNewVersionNumber(e.target.value)}
              placeholder="e.g. 1.1.0 or 2.0.0"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Change Summary</label>
            <textarea
              value={newVersionSummary}
              onChange={e => setNewVersionSummary(e.target.value)}
              placeholder="Describe amendments, new statutory requirements, or guidance revisions..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
        <form onSubmit={handleAddRequirement} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Requirement Code</label>
              <input
                type="text"
                value={newReqCode}
                onChange={e => setNewReqCode(e.target.value)}
                placeholder="e.g. EB1A-EVID-AWARDS"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={newReqCategory}
                onChange={e => setNewReqCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="regulatory_criteria">Regulatory Criteria (Prongs)</option>
                <option value="mandatory_identity">Mandatory Identity</option>
                <option value="statutory_mandate">Statutory Mandate</option>
                <option value="health_police">Health & Police Clearance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Requirement Title</label>
            <input
              type="text"
              value={newReqTitle}
              onChange={e => setNewReqTitle(e.target.value)}
              placeholder="e.g. Nationally or Internationally Recognized Prizes"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Statutory Citation</label>
            <input
              type="text"
              value={newReqCitation}
              onChange={e => setNewReqCitation(e.target.value)}
              placeholder="e.g. 8 CFR § 204.5(h)(3)(i)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-serif"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
            <textarea
              value={newReqDesc}
              onChange={e => setNewReqDesc(e.target.value)}
              placeholder="Evidentiary standard description..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Accepted Evidence Type</label>
              <select
                value={newReqEvidenceCategory}
                onChange={e => setNewReqEvidenceCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono"
              >
                <option value="award_certificate">award_certificate</option>
                <option value="scholarly_article">scholarly_article</option>
                <option value="peer_review_invitation">peer_review_invitation</option>
                <option value="expert_recommendation_letter">expert_recommendation_letter</option>
                <option value="passport">passport</option>
                <option value="intent_statement">intent_statement</option>
              </select>
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newReqMandatory}
                  onChange={e => setNewReqMandatory(e.target.checked)}
                  className="rounded text-blue-600 bg-slate-800 border-slate-700"
                />
                Mandatory
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newReqHumanReview}
                  onChange={e => setNewReqHumanReview(e.target.checked)}
                  className="rounded text-blue-600 bg-slate-800 border-slate-700"
                />
                Human Review Gate
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Caseworker Review Guidance</label>
            <input
              type="text"
              value={newReqGuidance}
              onChange={e => setNewReqGuidance(e.target.value)}
              placeholder="e.g. Verify criteria, competitor pool, and direct awardee."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
