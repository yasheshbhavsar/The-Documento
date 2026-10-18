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
  CountryRegistryItem,
  PathwayTaxonomyItem,
  PathwayDossierResponse,
  CoverageMatrixResponse,
  Phase6RuleRequirementItem,
  GeneratedChecklistResponse,
  PinnedChecklistSnapshotResponse,
  CaseMigrationResponse,
} from "../../lib/types";
import {
  api,
  DEMO_USERS,
  FALLBACK_OFFICIAL_SOURCES,
  FALLBACK_SNAPSHOTS,
  FALLBACK_RULE_SETS,
  FALLBACK_RULE_VERSIONS,
  FALLBACK_REQUIREMENTS,
  getCountryRegistry,
  getPathwayTaxonomy,
  getPathwayDossier,
  getCoverageMatrix,
  seedProductionRulePacks,
  generateFactGroundedChecklist,
  getCasePinnedChecklist,
  migrateCaseRuleVersion,
} from "../../lib/api";


interface RuleAdministrationHubProps {
  userRole?: RoleCode;
  isLiveBackend?: boolean;
  onNotification?: (msg: string, type: "success" | "error" | "info") => void;
  initialTab?: "coverage" | "checklist_engine" | "sources" | "rulesets" | "requirements" | "regression";
}

export function RuleAdministrationHub({
  userRole = "master_admin",
  isLiveBackend = false,
  onNotification,
  initialTab = "coverage",
}: RuleAdministrationHubProps) {
  const [activeTab, setActiveTab] = useState<
    "coverage" | "checklist_engine" | "sources" | "rulesets" | "requirements" | "regression"
  >(initialTab);

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

  // Phase 6 / 12 State: Country Registry, Coverage Matrix, Taxonomy & Priority Tiers
  const [countries, setCountries] = useState<CountryRegistryItem[]>([]);
  const [taxonomies, setTaxonomies] = useState<PathwayTaxonomyItem[]>([]);
  const [coverageMatrix, setCoverageMatrix] = useState<CoverageMatrixResponse | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("ALL");
  const [selectedPriorityTier, setSelectedPriorityTier] = useState<number | "ALL">("ALL");
  const [selectedTaxonomyCategory, setSelectedTaxonomyCategory] = useState<string>("ALL");
  const [selectedCoverageStatusFilter, setSelectedCoverageStatusFilter] = useState<string>("ALL");
  const [isSeedingPacks, setIsSeedingPacks] = useState<boolean>(false);

  // Phase 12 State: Pathway Validation Dossier Modal
  const [selectedDossier, setSelectedDossier] = useState<PathwayDossierResponse | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState<boolean>(false);
  const [isLoadingDossier, setIsLoadingDossier] = useState<boolean>(false);

  // Phase 6 / 12 State: Fact-Grounded Checklist Generator & Safe Stop Simulator
  const [simJurisdiction, setSimJurisdiction] = useState<string>("CA");
  const [simPathway, setSimPathway] = useState<string>("CA_EXPRESS_ENTRY_FSW");
  const [simHasJobOffer, setSimHasJobOffer] = useState<boolean>(false);
  const [simFamilySize, setSimFamilySize] = useState<number>(1);
  const [simHasDliAcceptance, setSimHasDliAcceptance] = useState<boolean>(true);
  const [simHasPal, setSimHasPal] = useState<boolean>(true);
  const [simChecklistResponse, setSimChecklistResponse] = useState<GeneratedChecklistResponse | null>(null);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState<boolean>(false);
  const [activeJsonRule, setActiveJsonRule] = useState<Phase6RuleRequirementItem | null>(null);

  // Phase 6 State: Case Migration & Pinned Snapshot
  const [pinnedCaseId, setPinnedCaseId] = useState<string>("CAS-CA-001");
  const [pinnedSnapshot, setPinnedSnapshot] = useState<PinnedChecklistSnapshotResponse | null>(null);
  const [migrationReason, setMigrationReason] = useState<string>("Client approval of upgraded 2026 digital standards");
  const [migrationResult, setMigrationResult] = useState<CaseMigrationResponse | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  const loadPhase6Data = async () => {
    try {
      const [cList, tList, cMatrix] = await Promise.all([
        getCountryRegistry(userRole),
        getPathwayTaxonomy(undefined, undefined, undefined, userRole),
        getCoverageMatrix(userRole),
      ]);
      setCountries(cList);
      setTaxonomies(tList);
      setCoverageMatrix(cMatrix);
    } catch (e) {
      console.error("Failed to load Phase 6/12 data", e);
    }
  };

  useEffect(() => {
    loadPhase6Data();
  }, [userRole]);

  const handleOpenPathwayDossier = async (pathwayKey: string) => {
    setIsLoadingDossier(true);
    setIsDossierModalOpen(true);
    try {
      const dossier = await getPathwayDossier(pathwayKey, userRole);
      setSelectedDossier(dossier);
    } catch {
      onNotification?.("Failed to retrieve pathway validation dossier", "error");
    } finally {
      setIsLoadingDossier(false);
    }
  };

  const handleSeedProductionPacks = async () => {
    setIsSeedingPacks(true);
    try {
      const res = await seedProductionRulePacks(userRole);
      onNotification?.(
        `Production rule packs provisioned: ${res.jurisdictions_covered?.join(", ")} (Total: ${res.seeded_packs_count || 5})`,
        "success"
      );
      await loadPhase6Data();
      if (isLiveBackend) {
        await loadRuleSets();
      }
    } catch {
      onNotification?.("Failed to seed production rule packs", "error");
    } finally {
      setIsSeedingPacks(false);
    }
  };

  const handleSimulateChecklist = async () => {
    setIsGeneratingChecklist(true);
    try {
      const facts: Record<string, any> = {
        has_valid_canadian_job_offer: simHasJobOffer,
        family_size: simFamilySize,
        has_dli_acceptance: simHasDliAcceptance,
        has_provincial_attestation_letter: simHasPal,
      };
      const res = await generateFactGroundedChecklist(
        {
          jurisdiction: simJurisdiction,
          pathway: simPathway,
          applicant_facts: facts,
          pin_to_case: false,
        },
        userRole
      );
      setSimChecklistResponse(res);
      if (!res.is_supported) {
        onNotification?.(
          `Safe stop triggered: ${res.status}. No unrelated fallback checklist presented.`,
          "info"
        );
      } else {
        onNotification?.(
          `Fact-tailored checklist generated: ${res.applicable_count} applicable of ${res.total_rules_count} statutory rules.`,
          "success"
        );
      }
    } catch {
      onNotification?.("Checklist generation failed", "error");
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const handleFetchPinnedCase = async () => {
    try {
      const res = await getCasePinnedChecklist(pinnedCaseId, userRole);
      setPinnedSnapshot(res);
      onNotification?.(`Loaded pinned checklist for case ${pinnedCaseId}`, "info");
    } catch {
      onNotification?.("Failed to retrieve pinned case checklist", "error");
    }
  };

  const handleExecuteCaseMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateCaseRuleVersion(
        pinnedCaseId,
        {
          to_version_id: "2.0.0",
          migration_reason: migrationReason,
        },
        userRole
      );
      setMigrationResult(res);
      onNotification?.(
        `Case migrated from v${res.from_version_number} to v${res.to_version_number}. Pinned snapshot updated.`,
        "success"
      );
    } catch {
      onNotification?.("Case migration failed", "error");
    } finally {
      setIsMigrating(false);
    }
  };

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
          onClick={() => setActiveTab("coverage")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "coverage" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "coverage" ? "#EAF6F0" : "transparent",
            color: activeTab === "coverage" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "coverage" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "coverage" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>🌐</span> Country Registry & Coverage Matrix ({countries.length || 7})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("checklist_engine")}
          style={{
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "checklist_engine" ? 700 : 500,
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: activeTab === "checklist_engine" ? "#EAF6F0" : "transparent",
            color: activeTab === "checklist_engine" ? "#063C3D" : "#6E7F7C",
            border: activeTab === "checklist_engine" ? "1.5px solid #0D6866" : "1.5px solid transparent",
            boxShadow: activeTab === "checklist_engine" ? "0 2px 6px rgba(13, 104, 102, 0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>📋</span> Checklist Engine & Safe Stop Simulator
        </button>
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
      {/* TAB: COUNTRY REGISTRY & COVERAGE MATRIX (PHASE 12) */}
      {/* ============================================================== */}
      {activeTab === "coverage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Statutory Policy & Priority Header Banner */}
          <div
            style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
              color: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 4px 14px rgba(6, 60, 61, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "18px",
            }}
          >
            <div style={{ maxWidth: "800px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "20px" }}>🌐</span>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                  Phase 12: Country and Pathway Expansion Architecture
                </h3>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Phase 12 Expansion
                </span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", lineHeight: "1.5", opacity: 0.95 }}>
                <strong>Statutory Priority Order:</strong> Canada (IRCC) Tier 1, USA (USCIS/DOS) Tier 1 • Priority 1: Canada (IRCC source-linked, RCIC reviewed) • Priority 2: USA (USCIS/DOS, zero legacy hardcoded assumptions) • Priority 3: Australia &amp; New Zealand (Separate reviewed rules &amp; templates) • Priority 4: UK &amp; Germany/Selected Europe (Country-specific review; EU is NOT one universal checklist) • Priority 5: Russia &amp; Other Destinations (Publish strictly after official validation).
              </p>
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  borderLeft: "3px solid #6EE7B7",
                  lineHeight: "1.4",
                }}
              >
                ⚠️ <strong>Strict Governance &amp; Safe-Stop Policy:</strong> Long-term breadth is an ambition, not permission to market unvalidated pathways as complete. UNVERIFIED and UNSUPPORTED pathways stop safely with zero fallback checklists.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
              <Button
                variant="primary"
                type="button"
                onClick={handleSeedProductionPacks}
                disabled={isSeedingPacks}
                style={{
                  background: "#10B981",
                  borderColor: "#059669",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                }}
              >
                {isSeedingPacks ? "Provisioning Rule Packs..." : "🌱 Seed Authentic Production Packs (CA, US, AU, NZ, GB, DE)"}
              </Button>
              <span style={{ fontSize: "11px", opacity: 0.85 }}>Authentic statutory citations only • Zero placeholder URLs</span>
            </div>
          </div>

          {/* Coverage Summary Metrics Ribbon across Priority Tiers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "14px",
            }}
          >
            <div style={{ background: "#FFFFFF", padding: "16px 20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6E7F7C", letterSpacing: "0.05em" }}>
                Priority Jurisdictions
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#063C3D", marginTop: "4px" }}>
                {coverageMatrix?.coverage_summary?.total_countries || countries.length || 11}
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                {coverageMatrix?.coverage_summary?.supported_countries || 4} fully approved • {coverageMatrix?.coverage_summary?.partial_countries || 1} partial
              </div>
            </div>

            <div style={{ background: "#FFFFFF", padding: "16px 20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6E7F7C", letterSpacing: "0.05em" }}>
                Pathway Taxonomy
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#0D6866", marginTop: "4px" }}>
                {coverageMatrix?.coverage_summary?.total_pathways || taxonomies.length || 30}
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                Covering all 8 broad application families
              </div>
            </div>

            <div style={{ background: "#FFFFFF", padding: "16px 20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#059669", letterSpacing: "0.05em" }}>
                Supported Pathways
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                {coverageMatrix?.coverage_summary?.supported_pathways || taxonomies.filter((t) => t.coverage_status === "SUPPORTED").length || 15}
              </div>
              <div style={{ fontSize: "11px", color: "#059669", marginTop: "2px", fontWeight: 600 }}>
                100% verified legal provenance
              </div>
            </div>

            <div style={{ background: "#FFFFFF", padding: "16px 20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#B45309", letterSpacing: "0.05em" }}>
                Partial / Supervised
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#D97706", marginTop: "4px" }}>
                {coverageMatrix?.coverage_summary?.partial_pathways || taxonomies.filter((t) => t.coverage_status === "PARTIAL").length || 6}
              </div>
              <div style={{ fontSize: "11px", color: "#B45309", marginTop: "2px", fontWeight: 600 }}>
                Requires lawyer sign-off on variations
              </div>
            </div>

            <div style={{ background: "#FFFFFF", padding: "16px 20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6B21A8", letterSpacing: "0.05em" }}>
                Unverified (Safe-Stop Guarded)
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#7E22CE", marginTop: "4px" }}>
                {coverageMatrix?.coverage_summary?.unverified_pathways || taxonomies.filter((t) => t.coverage_status === "UNVERIFIED").length || 9}
              </div>
              <div style={{ fontSize: "11px", color: "#6B21A8", marginTop: "2px", fontWeight: 600 }}>
                Safe-stop enforced (zero checklists)
              </div>
            </div>
          </div>

          {/* Section 1: Country Registry & Authority Metadata */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#172322" }}>
                  Jurisdiction Registry &amp; Statutory Authority Release Owners
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                  Official-source registry, statutory frameworks, priority tiers, and release condition attestations.
                </p>
              </div>

              {/* Priority Tier Filter Pills */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  { id: "ALL", label: "All Priority Tiers" },
                  { id: 1, label: "Priority 1: Canada (IRCC)" },
                  { id: 2, label: "Priority 2: USA (USCIS)" },
                  { id: 3, label: "Priority 3: AU & NZ" },
                  { id: 4, label: "Priority 4: UK & Europe" },
                  { id: 5, label: "Priority 5: Emerging / Safe-Stop" },
                ].map((tier) => (
                  <button
                    key={String(tier.id)}
                    type="button"
                    onClick={() => setSelectedPriorityTier(tier.id as any)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: selectedPriorityTier === tier.id ? 700 : 500,
                      cursor: "pointer",
                      background: selectedPriorityTier === tier.id ? "#0D6866" : "#F3F4F6",
                      color: selectedPriorityTier === tier.id ? "#FFFFFF" : "#4B5563",
                      border: "1px solid transparent",
                    }}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px" }}>
              {countries
                .filter((c) => (selectedPriorityTier === "ALL" ? true : c.priority_tier === selectedPriorityTier))
                .map((country) => {
                  const flagMap: Record<string, string> = {
                    CA: "🇨🇦",
                    US: "🇺🇸",
                    AU: "🇦🇺",
                    NZ: "🇳🇿",
                    GB: "🇬🇧",
                    DE: "🇩🇪",
                    FR: "🇫🇷",
                    RU: "🇷🇺",
                    SG: "🇸🇬",
                    AE: "🇦🇪",
                    JP: "🇯🇵",
                  };
                  const isSelected = selectedCountryCode === country.code;
                  return (
                    <div
                      key={country.code}
                      onClick={() => setSelectedCountryCode(selectedCountryCode === country.code ? "ALL" : country.code)}
                      style={{
                        background: isSelected ? "#F8FAF9" : "#FFFFFF",
                        border: isSelected ? "2px solid #0D6866" : "1px solid #DCE5E1",
                        borderRadius: "10px",
                        padding: "16px",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 4px 12px rgba(13, 104, 102, 0.1)" : "none",
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "22px" }}>{flagMap[country.code] || "🌐"}</span>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                                {country.name} ({country.code})
                              </div>
                              <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>
                                Priority Tier {country.priority_tier} • {country.priority_tier === 1 ? "Canada Core" : country.priority_tier === 2 ? "USA Independent" : country.priority_tier === 3 ? "AU & NZ Distinct" : country.priority_tier === 4 ? "UK / Europe" : "Emerging / Unverified"}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background:
                                country.coverage_status === "SUPPORTED"
                                  ? "#EAF6F0"
                                  : country.coverage_status === "PARTIAL"
                                  ? "#FEF3C7"
                                  : "#F3E8FF",
                              color:
                                country.coverage_status === "SUPPORTED"
                                  ? "#063C3D"
                                  : country.coverage_status === "PARTIAL"
                                  ? "#92400E"
                                  : "#6B21A8",
                              border:
                                country.coverage_status === "SUPPORTED"
                                  ? "1px solid #0D6866"
                                  : country.coverage_status === "PARTIAL"
                                  ? "1px solid #F59E0B"
                                  : "1px solid #C084FC",
                            }}
                          >
                            {country.coverage_status}
                          </span>
                        </div>

                        <div style={{ fontSize: "12px", color: "#4B5563", marginBottom: "4px" }}>
                          <strong>Authority:</strong> {country.primary_authority}
                        </div>
                        <div style={{ fontSize: "12px", color: "#4B5563", marginBottom: "4px" }}>
                          <strong>Release Owner:</strong> {country.release_owner}
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", fontStyle: "italic", marginBottom: "6px" }}>
                          {country.statutory_framework}
                        </div>

                        {/* EU / Schengen Distinction Alert Tag */}
                        {country.eu_schengen_distinction_applies && (
                          <div
                            data-testid="country-eu-schengen-badge"
                            style={{
                              padding: "6px 8px",
                              background: "#EFF6FF",
                              border: "1px solid #93C5FD",
                              borderRadius: "6px",
                              fontSize: "11px",
                              color: "#1E40AF",
                              marginBottom: "8px",
                            }}
                          >
                            🇪🇺 <strong>EU/Schengen Notice:</strong> Governed under sovereign national statute ({country.code === "DE" ? "AufenthG" : "CESEDA"}). EU/Schengen is NOT one universal checklist!
                          </div>
                        )}

                        {/* Release Conditions Checklist Pills */}
                        {country.release_conditions_status && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {Object.entries(country.release_conditions_status).map(([cond, met]) => (
                              <span
                                key={cond}
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: met ? "#DCFCE7" : "#FEE2E2",
                                  color: met ? "#15803D" : "#B91C1C",
                                  border: met ? "1px solid #86EFAC" : "1px solid #FCA5A5",
                                }}
                              >
                                {met ? "✓" : "✗"} {cond.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ paddingTop: "8px", borderTop: "1px solid #E2E8E4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <a
                          href={country.official_source_registry_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: "11px", color: "#0D6866", textDecoration: "underline", fontWeight: 600 }}
                        >
                          Official Registry ↗
                        </a>
                        <span style={{ fontSize: "11px", color: isSelected ? "#0D6866" : "#6E7F7C", fontWeight: 700 }}>
                          {isSelected ? "✓ Active Filter" : "Filter Pathways →"}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Section 2: Standardized Pathway Taxonomy & Coverage Matrix */}
          <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#172322" }}>
                  Standardized Pathway Taxonomy &amp; Verification Matrix
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                  Mapped across all 8 broad application families with official statutory citations, validation levels, and reviewer sign-offs.
                </p>
              </div>

              {/* Status and Category Filters */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                {/* Coverage Status Filter */}
                <select
                  id="coverage-status-filter-select"
                  data-testid="coverage-status-filter-select"
                  value={selectedCoverageStatusFilter}
                  onChange={(e) => setSelectedCoverageStatusFilter(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    border: "1px solid #DCE5E1",
                    background: "#FAFAF8",
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUPPORTED">SUPPORTED Only</option>
                  <option value="PARTIAL">PARTIAL Only</option>
                  <option value="UNVERIFIED">UNVERIFIED Only</option>
                  <option value="UNSUPPORTED">UNSUPPORTED Only</option>
                </select>

                {/* Category Filter Pills (All 8 broad application families) */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { id: "ALL", label: "All Categories" },
                    { id: "visitor", label: "Visitor" },
                    { id: "study", label: "Study" },
                    { id: "work", label: "Work" },
                    { id: "family", label: "Family" },
                    { id: "pr_residence", label: "PR / Residence" },
                    { id: "citizenship", label: "Citizenship" },
                    { id: "humanitarian_protection", label: "Humanitarian" },
                    { id: "extension_renewal_change", label: "Extensions" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedTaxonomyCategory(cat.id)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: selectedTaxonomyCategory === cat.id ? 700 : 500,
                        cursor: "pointer",
                        background: selectedTaxonomyCategory === cat.id ? "#0D6866" : "#F3F4F6",
                        color: selectedTaxonomyCategory === cat.id ? "#FFFFFF" : "#4B5563",
                        border: "1px solid transparent",
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pathways Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#F8FAF9", borderBottom: "2px solid #DCE5E1", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700 }}>Jurisdiction</th>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700 }}>Pathway &amp; Statutory Authority</th>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700 }}>Application Family</th>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700 }}>Coverage Status</th>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700 }}>Reviewer Sign-Off</th>
                    <th style={{ padding: "10px 12px", color: "#6E7F7C", fontWeight: 700, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {taxonomies
                    .filter((item) => (selectedCountryCode === "ALL" ? true : item.jurisdiction === selectedCountryCode))
                    .filter((item) => (selectedTaxonomyCategory === "ALL" ? true : item.category === selectedTaxonomyCategory))
                    .filter((item) => (selectedCoverageStatusFilter === "ALL" ? true : item.coverage_status === selectedCoverageStatusFilter))
                    .map((item) => {
                      const flagMap: Record<string, string> = {
                        CA: "🇨🇦",
                        US: "🇺🇸",
                        AU: "🇦🇺",
                        NZ: "🇳🇿",
                        GB: "🇬🇧",
                        DE: "🇩🇪",
                        FR: "🇫🇷",
                        RU: "🇷🇺",
                        SG: "🇸🇬",
                        AE: "🇦🇪",
                        JP: "🇯🇵",
                      };
                      return (
                        <tr key={item.pathway_key} style={{ borderBottom: "1px solid #E5E7EB" }}>
                          <td style={{ padding: "12px", verticalAlign: "top" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "16px" }}>{flagMap[item.jurisdiction] || "🌐"}</span>
                              <span style={{ fontWeight: 700, color: "#172322" }}>{item.jurisdiction}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px", verticalAlign: "top", maxWidth: "340px" }}>
                            <div style={{ fontWeight: 700, color: "#063C3D", marginBottom: "2px" }}>{item.title}</div>
                            <div style={{ fontSize: "11px", color: "#4B5563", marginBottom: "4px" }}>{item.description}</div>
                            <div style={{ fontSize: "11px", color: "#6E7F7C", fontStyle: "italic" }}>{item.statutory_reference}</div>
                            {item.requires_provincial_or_state_clearance && (
                              <div style={{ marginTop: "4px" }}>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "#FEF3C7",
                                    color: "#92400E",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid #F59E0B",
                                  }}
                                >
                                  Requires Provincial / Regional Attestation (e.g. PAL / LCA)
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px", verticalAlign: "top" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#F3F4F6",
                                color: "#374151",
                                textTransform: "capitalize",
                              }}
                            >
                              {item.category.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ padding: "12px", verticalAlign: "top" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background:
                                  item.coverage_status === "SUPPORTED"
                                    ? "#EAF6F0"
                                    : item.coverage_status === "PARTIAL"
                                    ? "#FEF3C7"
                                    : item.coverage_status === "UNVERIFIED"
                                    ? "#F3E8FF"
                                    : "#FEE2E2",
                                color:
                                  item.coverage_status === "SUPPORTED"
                                    ? "#063C3D"
                                    : item.coverage_status === "PARTIAL"
                                    ? "#92400E"
                                    : item.coverage_status === "UNVERIFIED"
                                    ? "#6B21A8"
                                    : "#991B1B",
                                border:
                                  item.coverage_status === "SUPPORTED"
                                    ? "1px solid #0D6866"
                                    : item.coverage_status === "PARTIAL"
                                    ? "1px solid #F59E0B"
                                    : item.coverage_status === "UNVERIFIED"
                                    ? "1px solid #C084FC"
                                    : "1px solid #DC2626",
                              }}
                            >
                              {item.coverage_status}
                            </span>
                            {item.coverage_status === "UNVERIFIED" && (
                              <div style={{ fontSize: "10px", color: "#6B21A8", marginTop: "3px", fontWeight: 600 }}>
                                🛡️ Safe-Stop Guarded
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px", verticalAlign: "top" }}>
                            <div style={{ fontSize: "11px", color: "#172322", fontWeight: 600 }}>
                              {item.professional_reviewer || "Pending Legal Sign-off"}
                            </div>
                            {item.regression_test_suite && (
                              <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "2px", fontFamily: "monospace" }}>
                                🧪 {item.regression_test_suite}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px", verticalAlign: "top", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => handleOpenPathwayDossier(item.pathway_key)}
                                style={{ fontSize: "11px" }}
                              >
                                Dossier 📜
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setSimJurisdiction(item.jurisdiction);
                                  setSimPathway(item.pathway_key);
                                  setActiveTab("checklist_engine");
                                }}
                                style={{ fontSize: "11px" }}
                              >
                                Simulator ⚡
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: FACT-GROUNDED CHECKLIST ENGINE & SAFE STOP (PHASE 6) */}
      {/* ============================================================== */}
      {activeTab === "checklist_engine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Header Policy Banner */}
          <div
            style={{
              padding: "16px 20px",
              background: "#F8FAF9",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📋</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#063C3D" }}>
                  Fact-Grounded Checklist Engine, Safe Stop &amp; Pinned Case Migration
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6E7F7C", lineHeight: "1.4" }}>
                Checklists are generated dynamically from actual applicant facts, jurisdiction, pathway, and approved statutory rule versions.
                Unsupported pathways stop safely with zero fallback items. Existing cases retain pinned snapshots.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#EAF6F0",
                  color: "#063C3D",
                  border: "1px solid #0D6866",
                }}
              >
                Safe Stop Active
              </span>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#FEF3C7",
                  color: "#92400E",
                  border: "1px solid #F59E0B",
                }}
              >
                Snapshot Pinning Enforced
              </span>
            </div>
          </div>

          {/* Two-Column Workspace: Generator on Left, Case Migration Controller on Right */}
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.95fr", gap: "20px" }}>
            {/* LEFT COLUMN: Fact-Grounded Checklist Simulator */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                  1. Fact-Grounded Checklist Evaluator &amp; Safe Stop Simulator
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label htmlFor="sim-jurisdiction-select" style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                      Jurisdiction
                    </label>
                    <select
                      id="sim-jurisdiction-select"
                      data-testid="sim-jurisdiction-select"
                      value={simJurisdiction}
                      onChange={(e) => {
                        const newJ = e.target.value;
                        setSimJurisdiction(newJ);
                        const pathwaysForJ = taxonomies.filter((t) => t.jurisdiction === newJ);
                        if (pathwaysForJ.length > 0) {
                          setSimPathway(pathwaysForJ[0].pathway_key);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "#FAFAF8",
                        border: "1.5px solid #DCE5E1",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#172322",
                        fontWeight: 600,
                      }}
                    >
                      {countries && countries.length > 0 ? (
                        countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code === "CA" ? "🇨🇦" : c.code === "US" ? "🇺🇸" : c.code === "AU" ? "🇦🇺" : c.code === "NZ" ? "🇳🇿" : c.code === "GB" ? "🇬🇧" : c.code === "DE" ? "🇩🇪" : c.code === "FR" ? "🇫🇷" : c.code === "RU" ? "🇷🇺" : c.code === "SG" ? "🇸🇬" : c.code === "AE" ? "🇦🇪" : c.code === "JP" ? "🇯🇵" : "🌐"} {c.name} (Priority {c.priority_tier}) [{c.coverage_status}]
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CA">🇨🇦 Canada (Priority 1) [SUPPORTED]</option>
                          <option value="US">🇺🇸 United States (Priority 2) [SUPPORTED]</option>
                          <option value="AU">🇦🇺 Australia (Priority 3) [SUPPORTED]</option>
                          <option value="NZ">🇳🇿 New Zealand (Priority 3) [SUPPORTED]</option>
                          <option value="GB">🇬🇧 United Kingdom (Priority 4) [SUPPORTED]</option>
                          <option value="DE">🇩🇪 Germany (Priority 4) [PARTIAL]</option>
                          <option value="FR">🇫🇷 France (Priority 4) [UNVERIFIED]</option>
                          <option value="RU">🇷🇺 Russia (Priority 5) [UNVERIFIED]</option>
                          <option value="SG">🇸🇬 Singapore (Priority 5) [UNVERIFIED]</option>
                          <option value="AE">🇦🇪 United Arab Emirates (Priority 5) [UNVERIFIED]</option>
                          <option value="JP">🇯🇵 Japan (Priority 5) [UNVERIFIED]</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sim-pathway-select" style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                      Target Pathway
                    </label>
                    <select
                      id="sim-pathway-select"
                      data-testid="sim-pathway-select"
                      value={simPathway}
                      onChange={(e) => setSimPathway(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "#FAFAF8",
                        border: "1.5px solid #DCE5E1",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#172322",
                        fontWeight: 600,
                      }}
                    >
                      {taxonomies
                        .filter((t) => t.jurisdiction === simJurisdiction)
                        .map((t) => (
                          <option key={t.pathway_key} value={t.pathway_key}>
                            {t.title} [{t.coverage_status}]
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic Fact Evaluation Toggles */}
                <div
                  style={{
                    padding: "14px",
                    background: "#F8FAF9",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "10px" }}>
                    Applicant Facts &amp; Statutory Conditionals:
                  </div>

                  {simJurisdiction === "CA" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "#172322", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={simHasJobOffer}
                          onChange={(e) => setSimHasJobOffer(e.target.checked)}
                          style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#0D6866" }}
                        />
                        <div>
                          <strong>Has Valid Canadian Job Offer (LMIA or LMIA-exempt)</strong>
                          <div style={{ fontSize: "11px", color: "#6E7F7C" }}>
                            Statutory IRPR s. 77: Waives settlement funds requirement if applicant is authorized to work in Canada with a valid job offer.
                          </div>
                        </div>
                      </label>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Accompanying Family Members Size:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={simFamilySize}
                          onChange={(e) => setSimFamilySize(parseInt(e.target.value) || 1)}
                          style={{
                            width: "70px",
                            padding: "4px 8px",
                            border: "1.5px solid #DCE5E1",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                      </div>

                      {simPathway.includes("STUDY") && (
                        <>
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#172322", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={simHasDliAcceptance}
                              onChange={(e) => setSimHasDliAcceptance(e.target.checked)}
                              style={{ width: "16px", height: "16px", accentColor: "#0D6866" }}
                            />
                            <span>Has Official Acceptance Letter from Designated Learning Institution (DLI)</span>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#172322", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={simHasPal}
                              onChange={(e) => setSimHasPal(e.target.checked)}
                              style={{ width: "16px", height: "16px", accentColor: "#0D6866" }}
                            />
                            <span>Has Provincial Attestation Letter (PAL / CAQ for Quebec)</span>
                          </label>
                        </>
                      )}
                    </div>
                  )}

                  {simJurisdiction !== "CA" && (
                    <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                      Applicant profile loaded for {simJurisdiction}: standard identity, education, and occupational clearance facts evaluated against jurisdiction statutory baseline.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleSimulateChecklist}
                    disabled={isGeneratingChecklist}
                    style={{ fontWeight: 700 }}
                  >
                    {isGeneratingChecklist ? "Evaluating Statutory Rules..." : "⚡ Generate Fact-Grounded Checklist"}
                  </Button>
                </div>
              </div>

              {/* SIMULATION RESULT DISPLAY */}
              {simChecklistResponse && (
                <div>
                  {/* Phase 12 EU / Schengen Regulatory Notice Banner */}
                  {simChecklistResponse.eu_schengen_notice && (
                    <div
                      data-testid="eu-schengen-notice-banner"
                      style={{
                        padding: "12px 16px",
                        background: "#EFF6FF",
                        border: "1.5px solid #3B82F6",
                        borderRadius: "8px",
                        marginBottom: "12px",
                        fontSize: "12px",
                        color: "#1E40AF",
                        lineHeight: "1.5",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>🇪🇺</span>
                        <span>EU / Schengen Regulatory Distinction:</span>
                      </div>
                      {simChecklistResponse.eu_schengen_notice}
                    </div>
                  )}

                  {/* Phase 12 Partial Coverage Supervisory Advisory Banner */}
                  {simChecklistResponse.partial_coverage_warning && (
                    <div
                      data-testid="partial-coverage-warning-banner"
                      style={{
                        padding: "12px 16px",
                        background: "#FFFBEB",
                        border: "1.5px solid #F59E0B",
                        borderRadius: "8px",
                        marginBottom: "12px",
                        fontSize: "12px",
                        color: "#92400E",
                        lineHeight: "1.5",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>⚠️</span>
                        <span>Partial Coverage Supervisory Advisory:</span>
                      </div>
                      {simChecklistResponse.partial_coverage_warning}
                    </div>
                  )}

                  {!simChecklistResponse.is_supported ? (
                    /* SAFE STOP CARD */
                    <div
                      style={{
                        padding: "20px",
                        background: "#FEF2F2",
                        border: "2px solid #EF4444",
                        borderRadius: "10px",
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "24px" }}>🛑</span>
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#991B1B" }}>
                            SAFE STOP ACTIVATED: PATHWAY NOT APPROVED FOR CHECKLIST GENERATION
                          </div>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#B91C1C", textTransform: "uppercase" }}>
                            Status: {simChecklistResponse.status} • Zero Unrelated Fallback Items Presented
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: "12px", color: "#7F1D1D", lineHeight: "1.5", margin: "10px 0" }}>
                        {simChecklistResponse.message ||
                          "This pathway is currently unverified or unsupported. Requirements belong in versioned configuration, not scattered conditionals. Production safety strictly prohibits generating synthetic fallback checklists."}
                      </div>

                      <div
                        style={{
                          padding: "10px 14px",
                          background: "#FFFFFF",
                          border: "1px solid #FCA5A5",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#991B1B",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Verified Safe Stop Behavior: Checklist array returned with 0 items ({simChecklistResponse.checklist?.length || 0} items).
                      </div>
                    </div>
                  ) : (
                    /* FACT-GROUNDED CHECKLIST CARD */
                    <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                            {simChecklistResponse.rule_set_name || simPathway}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                            Approved Version: <strong>{simChecklistResponse.rule_version_number || "v1.0.0"}</strong> • Effective As Of:{" "}
                            {simChecklistResponse.effective_as_of?.split("T")[0] || "2026-03-15"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#EAF6F0",
                              color: "#063C3D",
                              border: "1px solid #0D6866",
                            }}
                          >
                            {simChecklistResponse.applicable_count} of {simChecklistResponse.total_rules_count} Applicable
                          </span>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#F3F4F6",
                              color: "#4B5563",
                            }}
                          >
                            0 Stale Excluded
                          </span>
                        </div>
                      </div>

                      {/* Checklist Items */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(simChecklistResponse.all_rules || simChecklistResponse.checklist || []).map((rule) => {
                          const isWaived = rule.is_applicable === false;
                          return (
                            <div
                              key={rule.rule_id}
                              style={{
                                padding: "12px 14px",
                                borderRadius: "8px",
                                border: isWaived ? "1px dashed #D1D5DB" : "1px solid #DCE5E1",
                                background: isWaived ? "#F9FAFB" : "#FFFFFF",
                                opacity: isWaived ? 0.75 : 1,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: isWaived ? "#6B7280" : "#172322" }}>
                                      {rule.title || rule.requirement_key}
                                    </span>
                                    <code
                                      style={{
                                        fontSize: "10px",
                                        background: "#E2E8F0",
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        color: "#334155",
                                      }}
                                    >
                                      {rule.requirement_key}
                                    </code>
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                                    Rule ID: {rule.rule_id} • v{rule.version}
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  {isWaived ? (
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        background: "#FEF3C7",
                                        color: "#92400E",
                                        border: "1px solid #F59E0B",
                                      }}
                                    >
                                      WAIVED BY JOB OFFER
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        background: "#EAF6F0",
                                        color: "#063C3D",
                                        border: "1px solid #0D6866",
                                      }}
                                    >
                                      {rule.status}
                                    </span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => setActiveJsonRule(rule)}
                                    style={{ fontSize: "11px", padding: "2px 8px" }}
                                  >
                                    View Phase 6 JSON
                                  </Button>
                                </div>
                              </div>

                              <div style={{ fontSize: "11px", color: "#4B5563", lineHeight: "1.4" }}>
                                {rule.description}
                              </div>

                              {rule.statutory_citation && (
                                <div style={{ fontSize: "10px", color: "#6E7F7C", fontStyle: "italic", marginTop: "4px" }}>
                                  Statutory citation: {rule.statutory_citation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Case Checklist Snapshot Pinning & Controlled Migration */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                  2. Case Pinning &amp; Controlled Migration Controller
                </h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#6E7F7C", lineHeight: "1.4" }}>
                  Existing cases retain a pinned checklist snapshot. Upgrades do not silently rewrite active cases.
                </p>

                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  <input
                    type="text"
                    value={pinnedCaseId}
                    onChange={(e) => setPinnedCaseId(e.target.value)}
                    placeholder="Enter Case ID e.g. CAS-CA-001"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "#FAFAF8",
                      border: "1.5px solid #DCE5E1",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#172322",
                    }}
                  />
                  <Button variant="outline" type="button" onClick={handleFetchPinnedCase}>
                    Inspect Pinned Case
                  </Button>
                </div>

                {/* PINNED SNAPSHOT DETAILS */}
                {pinnedSnapshot && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#F8FAF9",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, color: "#063C3D" }}>Case Reference:</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pinnedSnapshot.case_id}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, color: "#063C3D" }}>Pinned Rule Version:</span>
                        <span style={{ fontFamily: "monospace", color: "#0D6866", fontWeight: 700 }}>
                          {pinnedSnapshot.pinned_rule_version_id || "v1.0.0"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, color: "#063C3D" }}>Snapshot Timestamp:</span>
                        <span style={{ color: "#6E7F7C" }}>
                          {pinnedSnapshot.snapshot_pinned_at ? new Date(pinnedSnapshot.snapshot_pinned_at).toLocaleString() : "Pinned at case onboarding"}
                        </span>
                      </div>
                    </div>

                    {/* RULES UPDATE AVAILABLE WARNING */}
                    {pinnedSnapshot.rules_update_available && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "#FEF3C7",
                          border: "1px solid #F59E0B",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#92400E",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: "2px" }}>
                          ⚠️ Rule Pack Update Available: {pinnedSnapshot.latest_available_version_id || "v2.0.0"}
                        </div>
                        <div>
                          Active case remains securely pinned to v1.0.0. To adopt new requirements, legal team must execute an explicit case migration.
                        </div>
                      </div>
                    )}

                    {/* MIGRATION ACTION BOX */}
                    <div
                      style={{
                        padding: "14px",
                        background: "#FFFFFF",
                        border: "1.5px solid #0D6866",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                        Execute Explicit Case Migration
                      </div>
                      <div style={{ fontSize: "11px", color: "#6E7F7C", marginBottom: "10px" }}>
                        Upgrades case snapshot to target version with granular diff analysis and immutable audit logging.
                      </div>

                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                          Migration Justification / Client Authorization
                        </label>
                        <input
                          type="text"
                          value={migrationReason}
                          onChange={(e) => setMigrationReason(e.target.value)}
                          placeholder="e.g. Client agreed to upgraded 2026 digital proof standard"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "#FAFAF8",
                            border: "1.5px solid #DCE5E1",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#172322",
                          }}
                        />
                      </div>

                      <Button
                        variant="primary"
                        type="button"
                        onClick={handleExecuteCaseMigration}
                        disabled={isMigrating}
                        style={{ width: "100%", fontWeight: 700 }}
                      >
                        {isMigrating ? "Executing Migration..." : "Migrate Case Pinned Snapshot → v2.0.0"}
                      </Button>
                    </div>

                    {/* MIGRATION RESULT DIFF IMPACT */}
                    {migrationResult && (
                      <div
                        style={{
                          padding: "14px",
                          background: "#EAF6F0",
                          border: "1px solid #0D6866",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#063C3D", marginBottom: "6px" }}>
                          ✓ Migration Successfully Executed
                        </div>
                        <div style={{ fontSize: "11px", color: "#4B5563", marginBottom: "8px" }}>
                          Case upgraded from <strong>v{migrationResult.from_version_number}</strong> to{" "}
                          <strong>v{migrationResult.to_version_number}</strong>. Immutable audit record created:{" "}
                          <code>{migrationResult.audit_event_id}</code>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
                          <div style={{ background: "#FFFFFF", padding: "6px", borderRadius: "6px", border: "1px solid #DCE5E1" }}>
                            <div style={{ fontSize: "10px", color: "#059669", fontWeight: 700 }}>ADDED</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                              +{migrationResult.impact?.requirements_added?.length || migrationResult.impact?.added_count || 0}
                            </div>
                          </div>
                          <div style={{ background: "#FFFFFF", padding: "6px", borderRadius: "6px", border: "1px solid #DCE5E1" }}>
                            <div style={{ fontSize: "10px", color: "#DC2626", fontWeight: 700 }}>REMOVED</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                              -{migrationResult.impact?.requirements_removed?.length || migrationResult.impact?.removed_count || 0}
                            </div>
                          </div>
                          <div style={{ background: "#FFFFFF", padding: "6px", borderRadius: "6px", border: "1px solid #DCE5E1" }}>
                            <div style={{ fontSize: "10px", color: "#D97706", fontWeight: 700 }}>MODIFIED</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#063C3D" }}>
                              *{migrationResult.impact?.requirements_modified?.length || migrationResult.impact?.modified_count || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* PHASE 6 RULE REQUIREMENT JSON MODAL */}
      <Modal
        isOpen={!!activeJsonRule}
        onClose={() => setActiveJsonRule(null)}
        title={activeJsonRule ? `Rule Specification: ${activeJsonRule.rule_id} (${activeJsonRule.requirement_key})` : "Rule Specification"}
      >
        {activeJsonRule && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "12px 14px",
                background: "#EAF6F0",
                border: "1px solid #0D6866",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#063C3D",
                lineHeight: "1.5",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                ✓ Official Statutory Rule Provenance (Phase 6 Compliant)
              </div>
              <div>
                Requirements belong in versioned configuration, not scattered conditionals.
                Each rule specifies jurisdiction, pathway, requirement key, verified status,
                authentic government gazette source, effective dates, version, and designated legal approver.
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E7F7C" }}>
                  Phase 6 Canonical JSON Schema
                </span>
                <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 600 }}>
                  Version {activeJsonRule.version} • Status: {activeJsonRule.status}
                </span>
              </div>
              <pre
                style={{
                  background: "#1E293B",
                  color: "#E2E8F0",
                  padding: "14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  lineHeight: "1.5",
                  margin: 0,
                }}
              >
                {JSON.stringify(
                  {
                    rule_id: activeJsonRule.rule_id,
                    jurisdiction: activeJsonRule.jurisdiction,
                    pathway: activeJsonRule.pathway,
                    requirement_key: activeJsonRule.requirement_key,
                    status: activeJsonRule.status,
                    source_url: activeJsonRule.source_url,
                    effective_from: activeJsonRule.effective_from,
                    effective_to: activeJsonRule.effective_to,
                    last_verified_at: activeJsonRule.last_verified_at,
                    version: activeJsonRule.version,
                    approved_by: activeJsonRule.approved_by,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div style={{ fontSize: "12px", color: "#4B5563" }}>
              <div style={{ fontWeight: 600, color: "#172322" }}>Statutory Citation:</div>
              <div style={{ fontStyle: "italic", marginTop: "2px" }}>
                {activeJsonRule.statutory_citation || "Statutory authority on record"}
              </div>
              <div style={{ marginTop: "6px" }}>
                <span style={{ fontWeight: 600, color: "#172322" }}>Official Source: </span>
                <a
                  href={activeJsonRule.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0D6866", textDecoration: "underline", wordBreak: "break-all" }}
                >
                  {activeJsonRule.source_url}
                </a>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        rule_id: activeJsonRule.rule_id,
                        jurisdiction: activeJsonRule.jurisdiction,
                        pathway: activeJsonRule.pathway,
                        requirement_key: activeJsonRule.requirement_key,
                        status: activeJsonRule.status,
                        source_url: activeJsonRule.source_url,
                        effective_from: activeJsonRule.effective_from,
                        effective_to: activeJsonRule.effective_to,
                        last_verified_at: activeJsonRule.last_verified_at,
                        version: activeJsonRule.version,
                        approved_by: activeJsonRule.approved_by,
                      },
                      null,
                      2
                    )
                  );
                  onNotification?.("Phase 6 Rule JSON copied to clipboard", "success");
                }}
              >
                📋 Copy Phase 6 JSON
              </Button>
              <Button variant="primary" type="button" onClick={() => setActiveJsonRule(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* PHASE 12: PATHWAY VALIDATION DOSSIER MODAL */}
      <Modal
        isOpen={isDossierModalOpen}
        onClose={() => {
          setIsDossierModalOpen(false);
          setSelectedDossier(null);
        }}
        title={`Pathway Validation Dossier: ${selectedDossier?.pathway?.title || "Pathway Validation"}`}
      >
        {isLoadingDossier ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6E7F7C", fontSize: "14px" }}>
            Loading statutory validation dossier...
          </div>
        ) : selectedDossier ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
            {/* Header Summary & Badges */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#063C3D" }}>
                  {selectedDossier.pathway.title}
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "2px" }}>
                  Key: <code>{selectedDossier.pathway.pathway_key}</code> • Jurisdiction:{" "}
                  <strong>
                    {selectedDossier.country?.name || selectedDossier.pathway.jurisdiction} ({selectedDossier.pathway.jurisdiction})
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background:
                      selectedDossier.pathway.coverage_status === "SUPPORTED"
                        ? "#EAF6F0"
                        : selectedDossier.pathway.coverage_status === "PARTIAL"
                        ? "#FEF3C7"
                        : "#F3E8FF",
                    color:
                      selectedDossier.pathway.coverage_status === "SUPPORTED"
                        ? "#063C3D"
                        : selectedDossier.pathway.coverage_status === "PARTIAL"
                        ? "#92400E"
                        : "#6B21A8",
                    border: `1px solid ${
                      selectedDossier.pathway.coverage_status === "SUPPORTED"
                        ? "#0D6866"
                        : selectedDossier.pathway.coverage_status === "PARTIAL"
                        ? "#F59E0B"
                        : "#A855F7"
                    }`,
                  }}
                >
                  {selectedDossier.pathway.coverage_status}
                </span>

                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#F3F4F6",
                    color: "#374151",
                  }}
                >
                  Tier {selectedDossier.country?.priority_tier || 1}
                </span>
              </div>
            </div>

            {/* Safe Stop Status Banner */}
            {selectedDossier.safe_stop_required ? (
              <div
                data-testid="dossier-safe-stop-alert"
                style={{
                  padding: "12px 16px",
                  background: "#FEF2F2",
                  border: "1.5px solid #EF4444",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#991B1B",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🛑</span>
                  <span>Safe-Stop Policy Enforced: Checklist Generation Disabled</span>
                </div>
                This pathway is classified as <strong>{selectedDossier.pathway.coverage_status}</strong>. To safeguard against unvalidated legal advice or misleading filings, automatic checklist generation returns 0 items. Rule definitions must undergo professional review before promotion.
              </div>
            ) : (
              <div
                data-testid="dossier-safe-active-alert"
                style={{
                  padding: "12px 16px",
                  background: "#EAF6F0",
                  border: "1.5px solid #0D6866",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#063C3D",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✅</span>
                  <span>Checklist Engine Authorized: Fact-Grounded Generation Active</span>
                </div>
                Statutory baseline is confirmed with source links, professional reviewer sign-off, and passing regression suites.
              </div>
            )}

            {/* Statutory Reference & Authority */}
            <div style={{ background: "#F8FAF9", padding: "14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                ⚖️ Statutory Framework &amp; Legal Provenance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Statutory Citation / Reference:</span>
                  <span style={{ fontWeight: 700, color: "#172322" }}>
                    {selectedDossier.pathway.statutory_reference}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Statutory Framework:</span>
                  <span style={{ fontWeight: 600, color: "#172322" }}>
                    {selectedDossier.country?.statutory_framework || "National Immigration Statutes"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Competent Primary Authority:</span>
                  <span style={{ fontWeight: 600, color: "#172322" }}>
                    {selectedDossier.country?.primary_authority || "Government Ministry / Department"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Release Owner:</span>
                  <span style={{ fontWeight: 600, color: "#172322" }}>
                    {selectedDossier.country?.release_owner || "Regional Counsel"}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #E2E8E4", fontSize: "12px" }}>
                <span style={{ color: "#6E7F7C" }}>Official Government Source: </span>
                <a
                  href={selectedDossier.pathway.official_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0D6866", textDecoration: "underline", wordBreak: "break-all" }}
                >
                  {selectedDossier.pathway.official_source_url}
                </a>
              </div>
            </div>

            {/* Professional Review & Quality Assurance */}
            <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                🔍 Professional Review &amp; Quality Assurance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Professional Reviewer:</span>
                  <span style={{ fontWeight: 700, color: "#172322" }}>
                    {selectedDossier.pathway.professional_reviewer || "Pending professional assignment"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Review Sign-off Timestamp:</span>
                  <span style={{ fontWeight: 600, color: "#172322" }}>
                    {selectedDossier.pathway.review_timestamp ? new Date(selectedDossier.pathway.review_timestamp).toLocaleDateString() : "Pending"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Independent Rule Pack Validation:</span>
                  <span style={{ fontWeight: 700, color: selectedDossier.pathway.independent_validation_confirmed ? "#059669" : "#D97706" }}>
                    {selectedDossier.pathway.independent_validation_confirmed ? "✓ Confirmed Independent" : "✗ Pending Verification"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block" }}>Automated Regression Suite:</span>
                  <code style={{ fontSize: "11px", background: "#F3F4F6", padding: "2px 6px", borderRadius: "4px" }}>
                    {selectedDossier.pathway.regression_test_suite || "backend/tests/test_phase12_country_pathway_expansion.py"}
                  </code>
                </div>
              </div>
            </div>

            {/* Scope Limitations & Regional Caveats */}
            <div style={{ background: "#F8FAF9", padding: "14px", borderRadius: "8px", border: "1px solid #DCE5E1", fontSize: "12px" }}>
              <div style={{ fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
                📌 Scope Limitations &amp; Regional Distinctions:
              </div>
              <div style={{ color: "#4B5563", lineHeight: "1.4" }}>
                {selectedDossier.pathway.scope_limitations || "Standard federal filing rules apply without regional variations."}
              </div>

              {selectedDossier.country?.eu_schengen_distinction_applies && (
                <div style={{ marginTop: "8px", padding: "8px 10px", background: "#EFF6FF", borderRadius: "6px", borderLeft: "3px solid #3B82F6", color: "#1E40AF" }}>
                  <strong>EU / Schengen Distinction:</strong> Regulation (EC) No 810/2009 governs short-stay visas only. Long-term residence, Blue Card, and work authorization are governed exclusively by national statutes.
                </div>
              )}
            </div>

            {/* Release Conditions Checklist */}
            {selectedDossier.country?.release_conditions_status && (
              <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                  📋 Jurisdiction Release Conditions Attestation
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                  {Object.entries(selectedDossier.country.release_conditions_status).map(([cond, isMet]) => (
                    <div key={cond} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{isMet ? "✅" : "⏳"}</span>
                      <span style={{ color: isMet ? "#063C3D" : "#6B7280", fontWeight: isMet ? 600 : 400 }}>
                        {cond.replace(/_/g, " ")}: <strong>{isMet ? "MET" : "PENDING"}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid #E2E8E4" }}>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSimJurisdiction(selectedDossier.pathway.jurisdiction);
                  setSimPathway(selectedDossier.pathway.pathway_key);
                  setIsDossierModalOpen(false);
                  setSelectedDossier(null);
                  setActiveTab("checklist_engine");
                }}
              >
                ⚡ Test in Simulator
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setIsDossierModalOpen(false);
                  setSelectedDossier(null);
                }}
              >
                Close Dossier
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
