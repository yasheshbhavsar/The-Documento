import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { TextInput, TextareaInput, CheckboxInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { ImmigrationCase } from "../../lib/types";
import { INITIAL_INFO_SHEET_STORAGE_KEY } from "../portal/InitialInformationSheet";
import {
  persistAndBroadcastAutoFill,
  AutoFillFieldProvenance,
} from "../../lib/documentAutoFillEngine";
import { saveQuestionnaire } from "../../lib/api";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";

interface GuidedQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  caseId?: string;
  caseItem?: ImmigrationCase | null;
  jurisdiction?: string;
  visaCategory?: string;
  applicantName?: string;
  prefillData?: Partial<{
    fullName: string;
    currentField: string;
    highestDegree: string;
    criticalRoleDescription: string;
    publicationsCount?: string;
    citationCount?: string;
    peerReviewCount?: string;
  }>;
}

export function GuidedQuestionnaireModal({
  isOpen,
  onClose,
  onSaved,
  caseId,
  caseItem,
  jurisdiction,
  visaCategory,
  applicantName = "",
  prefillData,
}: GuidedQuestionnaireModalProps) {
  const ws = useWorkspaceSafe();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const effectiveCase =
    caseItem !== undefined
      ? caseItem
      : (caseId ? ws?.cases?.find((c) => c.id === caseId) : ws?.cases?.[0]) || null;
  const effectiveCaseId = caseId || effectiveCase?.id || "default_client";
  const resolvedJurisdiction = jurisdiction || effectiveCase?.jurisdiction || "";
  const resolvedVisaCategory = visaCategory || effectiveCase?.visa_category || "";

  const hasExplicitNonEb1aCase = Boolean(
    (resolvedJurisdiction || resolvedVisaCategory) &&
      !(
        resolvedVisaCategory.toLowerCase().includes("eb-1a") ||
        resolvedVisaCategory.toLowerCase().includes("extraordinary") ||
        resolvedVisaCategory.toLowerCase().includes("i-140") ||
        resolvedVisaCategory.toLowerCase().includes("o-1")
      )
  );
  const isUsEb1a = !hasExplicitNonEb1aCase;

  // Form State
  const [formData, setFormData] = useState(() => ({
    fullName: prefillData?.fullName || applicantName,
    currentField: prefillData?.currentField || "",
    highestDegree: prefillData?.highestDegree || "",
    publicationsCount: prefillData?.publicationsCount || "",
    citationCount: prefillData?.citationCount || "",
    peerReviewCount: prefillData?.peerReviewCount || "",
    criticalRoleDescription: prefillData?.criticalRoleDescription || "",
    confirmedOriginality: false,
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (prefillData) {
      setFormData((prev) => ({
        ...prev,
        fullName: prefillData.fullName || prev.fullName || applicantName,
        currentField: prefillData.currentField || prev.currentField,
        highestDegree: prefillData.highestDegree || prev.highestDegree,
        criticalRoleDescription: prefillData.criticalRoleDescription || prev.criticalRoleDescription,
        publicationsCount: prefillData.publicationsCount || prev.publicationsCount,
        citationCount: prefillData.citationCount || prev.citationCount,
        peerReviewCount: prefillData.peerReviewCount || prev.peerReviewCount,
      }));
      return;
    }

    if (typeof window !== "undefined") {
      try {
        // 1. Check saved questionnaire state keyed by caseId
        const rawSavedQ =
          window.localStorage.getItem(`documento_guided_questionnaire_${effectiveCaseId}`) ||
          window.localStorage.getItem("documento_guided_questionnaire_default_client");
        if (rawSavedQ) {
          const parsedQ = JSON.parse(rawSavedQ);
          const savedResp = parsedQ?.responses || parsedQ?.formData || parsedQ;
          if (savedResp && typeof savedResp === "object") {
            setFormData((prev) => ({
              ...prev,
              fullName: savedResp.fullName || prev.fullName || applicantName,
              currentField: savedResp.currentField || prev.currentField,
              highestDegree: savedResp.highestDegree || prev.highestDegree,
              publicationsCount: savedResp.publicationsCount || prev.publicationsCount,
              citationCount: savedResp.citationCount || prev.citationCount,
              peerReviewCount: savedResp.peerReviewCount || prev.peerReviewCount,
              criticalRoleDescription:
                savedResp.criticalRoleDescription || prev.criticalRoleDescription,
              confirmedOriginality: Boolean(
                savedResp.confirmedOriginality ?? prev.confirmedOriginality
              ),
            }));
          }
        }

        // 2. Also hydrate from INITIAL_INFO_SHEET_STORAGE_KEY
        const raw = window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY);
        if (raw) {
          const map = JSON.parse(raw);
          const sheet =
            map?.[effectiveCaseId] ||
            map?.["default_client"] ||
            (Object.values(map)[0] as any);
          const fd = sheet?.formData;
          if (fd) {
            const full =
              fd.fullName ||
              (fd.family_name || fd.given_names
                ? `${fd.given_names || ""} ${fd.family_name || ""}`.trim()
                : "");
            const highestEdu =
              fd.highestDegree ||
              (Array.isArray(fd.education) && fd.education.length > 0
                ? `${fd.education[0].field_of_study || ""}${fd.education[0].school_name ? `, ${fd.education[0].school_name}` : ""}`.trim()
                : "");
            const currentRole =
              Array.isArray(fd.employment) && fd.employment.length > 0
                ? `${fd.employment[0].job_title || ""}${fd.employment[0].company_name ? ` at ${fd.employment[0].company_name}` : ""}`.trim()
                : "";
            setFormData((prev) => ({
              ...prev,
              fullName: prev.fullName || full || applicantName,
              currentField:
                prev.currentField ||
                fd.currentField ||
                fd.current_field ||
                (currentRole ? "Computer Science & Artificial Intelligence" : prev.currentField),
              highestDegree: prev.highestDegree || highestEdu || prev.highestDegree,
              publicationsCount:
                prev.publicationsCount || fd.publicationsCount || prev.publicationsCount,
              citationCount: prev.citationCount || fd.citationCount || prev.citationCount,
              peerReviewCount: prev.peerReviewCount || fd.peerReviewCount || prev.peerReviewCount,
              criticalRoleDescription:
                prev.criticalRoleDescription ||
                fd.criticalRoleDescription ||
                fd.critical_role_description ||
                (currentRole
                  ? `Serving in a critical capacity as ${currentRole}, driving key technological breakthroughs.`
                  : prev.criticalRoleDescription),
            }));
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [isOpen, prefillData, applicantName, effectiveCaseId]);

  useEffect(() => {
    const handleUpdate = (e: CustomEvent<any>) => {
      const detail = e.detail;
      if (!detail?.formData) return;
      const fd = detail.formData;
      const full =
        fd.fullName ||
        (fd.family_name || fd.given_names
          ? `${fd.given_names || ""} ${fd.family_name || ""}`.trim()
          : "");
      const highestEdu =
        fd.highestDegree ||
        (Array.isArray(fd.education) && fd.education.length > 0
          ? `${fd.education[0].field_of_study}, ${fd.education[0].school_name}`
          : "");
      const currentRole =
        Array.isArray(fd.employment) && fd.employment.length > 0
          ? `${fd.employment[0].job_title} at ${fd.employment[0].company_name}`
          : "";

      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || full,
        currentField:
          prev.currentField ||
          fd.currentField ||
          "Computer Science & Artificial Intelligence",
        highestDegree: prev.highestDegree || highestEdu,
        criticalRoleDescription:
          prev.criticalRoleDescription ||
          fd.criticalRoleDescription ||
          (currentRole
            ? `Serving in a critical capacity as ${currentRole}, driving key technological breakthroughs.`
            : prev.criticalRoleDescription),
      }));
    };

    window.addEventListener("documento-autofill-updated", handleUpdate as EventListener);
    return () => {
      window.removeEventListener("documento-autofill-updated", handleUpdate as EventListener);
    };
  }, []);

  const persistQuestionnaireState = (status: "draft" | "submitted") => {
    if (typeof window === "undefined") return;
    const nowIso = new Date().toISOString();
    const cleanedName = (formData.fullName || applicantName || "").trim();
    const nameTokens = cleanedName.replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)\s+/i, "").split(/\s+/).filter(Boolean);
    const derivedGivenNames =
      nameTokens.length > 1 ? nameTokens.slice(0, -1).join(" ") : nameTokens[0] || "";
    const derivedFamilyName =
      nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : "";

    const degreeParts = (formData.highestDegree || "").split(",").map((s) => s.trim()).filter(Boolean);
    const fieldOfStudy = degreeParts[0] || formData.currentField || "";
    const schoolName = degreeParts.slice(1).join(", ") || "";

    const sheetFormDataPatch: Record<string, any> = {
      fullName: formData.fullName,
      currentField: formData.currentField,
      current_field: formData.currentField,
      highestDegree: formData.highestDegree,
      highest_degree: formData.highestDegree,
      publicationsCount: formData.publicationsCount,
      citationCount: formData.citationCount,
      peerReviewCount: formData.peerReviewCount,
      criticalRoleDescription: formData.criticalRoleDescription,
      critical_role_description: formData.criticalRoleDescription,
      confirmedOriginality: formData.confirmedOriginality,
      questionnaire_status: status,
      questionnaire_updated_at: nowIso,
    };

    if (derivedGivenNames) sheetFormDataPatch.given_names = derivedGivenNames;
    if (derivedFamilyName) sheetFormDataPatch.family_name = derivedFamilyName;
    if (fieldOfStudy || schoolName) {
      sheetFormDataPatch.education = [
        {
          from_date: "",
          to_date: "",
          field_of_study: fieldOfStudy,
          school_name: schoolName,
          city_country: "",
        },
      ];
    }
    if (formData.criticalRoleDescription || formData.currentField) {
      sheetFormDataPatch.employment = [
        {
          from_date: "",
          to_date: "Present",
          job_title: formData.currentField || "Specialist",
          company_name: "",
          duties: formData.criticalRoleDescription || "",
        },
      ];
    }
    if (status === "submitted" && formData.confirmedOriginality) {
      sheetFormDataPatch.declaration_signed = true;
      sheetFormDataPatch.signature = cleanedName || "Applicant";
    }

    const provenance: Record<string, AutoFillFieldProvenance> = {};
    const addProv = (key: string, label: string, val: any) => {
      if (val !== undefined && val !== "") {
        provenance[key] = {
          field_name: key,
          field_label: label,
          value: val,
          source_type: "user_provided",
          source_document_title: "Guided Intake Questionnaire",
          confidence: 1,
          extracted_at: nowIso,
          is_confirmed: status === "submitted",
        };
      }
    };
    addProv("fullName", "Legal Name", formData.fullName);
    addProv("given_names", "Given Names", derivedGivenNames);
    addProv("family_name", "Family Name", derivedFamilyName);
    addProv("currentField", "Field of Expertise", formData.currentField);
    addProv("highestDegree", "Highest Degree", formData.highestDegree);
    addProv("criticalRoleDescription", "Role Description", formData.criticalRoleDescription);

    try {
      const recordPayload = {
        caseId: effectiveCaseId,
        status,
        step,
        responses: { ...formData },
        updatedAt: nowIso,
        submittedAt: status === "submitted" ? nowIso : null,
      };
      window.localStorage.setItem(
        `documento_guided_questionnaire_${effectiveCaseId}`,
        JSON.stringify(recordPayload)
      );
      window.localStorage.setItem(
        "documento_guided_questionnaire_default_client",
        JSON.stringify(recordPayload)
      );

      // Update documento_questionnaires_v3_clean store
      const rawQMap = window.localStorage.getItem("documento_questionnaires_v3_clean");
      const qMap = rawQMap ? JSON.parse(rawQMap) : {};
      const existingQ = qMap[effectiveCaseId] || {};
      qMap[effectiveCaseId] = {
        ...existingQ,
        id: `q-${effectiveCaseId}`,
        title: isUsEb1a
          ? "Guided Extraordinary Ability Questionnaire"
          : `${resolvedVisaCategory || "Applicant"} Guided Intake Questionnaire`,
        status: status === "submitted" ? "submitted" : "in_progress",
        completion_percentage: status === "submitted" ? 100 : Math.round((step / totalSteps) * 100),
        responses: { ...(existingQ.responses || {}), ...formData },
        submitted_at: status === "submitted" ? nowIso : existingQ.submitted_at || null,
      };
      window.localStorage.setItem("documento_questionnaires_v3_clean", JSON.stringify(qMap));
    } catch {
      // ignore quota errors
    }

    // Merge into INITIAL_INFO_SHEET_STORAGE_KEY and broadcast via persistAndBroadcastAutoFill
    persistAndBroadcastAutoFill(effectiveCaseId, {
      formData: sheetFormDataPatch,
      provenance,
      sourceFilename: "Guided Intake Questionnaire",
    });
    if (effectiveCaseId !== "default_client") {
      persistAndBroadcastAutoFill("default_client", {
        formData: sheetFormDataPatch,
        provenance,
        sourceFilename: "Guided Intake Questionnaire",
      });
    }

    if (status === "submitted") {
      try {
        const rawSheet = window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY);
        if (rawSheet) {
          const parsedSheet = JSON.parse(rawSheet);
          if (parsedSheet[effectiveCaseId]) {
            parsedSheet[effectiveCaseId].isSubmitted = true;
          }
          if (parsedSheet["default_client"]) {
            parsedSheet["default_client"].isSubmitted = true;
          }
          window.localStorage.setItem(INITIAL_INFO_SHEET_STORAGE_KEY, JSON.stringify(parsedSheet));
        }
      } catch {
        // ignore
      }
    }

    void saveQuestionnaire(`q-${effectiveCaseId}`, formData, status === "submitted").catch(() => {});
  };

  const handleSaveAndExit = () => {
    persistQuestionnaireState("draft");
    onClose();
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
    } else {
      setIsSubmitting(true);
      persistQuestionnaireState("submitted");
      setIsSubmitting(false);
      onSaved();
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const modalTitle = isUsEb1a
    ? "Guided Extraordinary Ability Questionnaire"
    : resolvedVisaCategory
      ? `Guided Intake Questionnaire — ${resolvedVisaCategory}`
      : "Guided Applicant Background & Qualification Questionnaire";

  const modalSubtitle = isUsEb1a
    ? `Step ${step} of ${totalSteps} — Statutory Evidentiary Criteria Mapping`
    : `Step ${step} of ${totalSteps} — ${resolvedJurisdiction || "Immigration"} Background & Qualification Mapping`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Button variant="secondary" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            ← Back
          </Button>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" onClick={handleSaveAndExit}>
              Save & Exit
            </Button>
            <Button variant="primary" onClick={handleNext} isLoading={isSubmitting}>
              {step === totalSteps ? "Submit for Legal Review ✓" : "Next Step →"}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Step Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label="Questionnaire step progress"
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                backgroundColor: i + 1 <= step ? "var(--accent, #0D6866)" : "var(--border, #DCE5E1)",
                transition: "background-color 0.2s ease",
              }}
            />
          ))}
        </div>

        {/* Step 1: Bio & Field */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>
                {isUsEb1a ? "1. Field of Extraordinary Ability" : "1. Biographical & Professional Background"}
              </h4>
              {(formData.currentField || formData.highestDegree) && (
                <span
                  data-testid="questionnaire-step1-autofill-badge"
                  style={{
                    padding: "2px 8px",
                    background: "#EFF6FF",
                    color: "#1E40AF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  ⚡ Auto-filled from Profile &amp; Resume
                </span>
              )}
            </div>
            <TextInput
              label="Legal Name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
            <TextInput
              label={
                isUsEb1a
                  ? "Specific Endeavor or Field of Scientific Focus"
                  : "Primary Occupation, Field of Work, or Program of Study"
              }
              value={formData.currentField}
              onChange={(e) => setFormData({ ...formData, currentField: e.target.value })}
              helperText={
                isUsEb1a
                  ? "E.g. Computer Science, Molecular Oncology, or Clean Energy Systems"
                  : "E.g. Software Engineering, Healthcare, Finance, or Academic Program"
              }
              required
            />
            <TextInput
              label="Highest Earned Degree & Granting Institution"
              value={formData.highestDegree}
              onChange={(e) => setFormData({ ...formData, highestDegree: e.target.value })}
              required
            />
          </div>
        )}

        {/* Step 2: Scholarly Publications / Professional Qualifications */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>
              {isUsEb1a
                ? "2. Authorship of Scholarly Articles (8 CFR § 204.5(h)(3)(vi))"
                : "2. Professional Qualifications & Key Achievements"}
            </h4>
            <TextareaInput
              label={
                isUsEb1a
                  ? "Summary of Peer-Reviewed Articles"
                  : "Summary of Qualifications, Certifications, or Publications"
              }
              value={formData.publicationsCount}
              onChange={(e) => setFormData({ ...formData, publicationsCount: e.target.value })}
              helperText={
                isUsEb1a
                  ? "List major journals, conference proceedings, or book chapters."
                  : "Summarize relevant professional credentials, certifications, or publications."
              }
              required
            />
            <TextInput
              label={
                isUsEb1a
                  ? "Total Academic Citations"
                  : "Years of Relevant Experience or Key Career Metrics"
              }
              value={formData.citationCount}
              onChange={(e) => setFormData({ ...formData, citationCount: e.target.value })}
              helperText={
                isUsEb1a
                  ? "Provide Google Scholar, Web of Science, or Scopus citation metric."
                  : "Provide total years of experience or verifiable career milestones."
              }
              required
            />
          </div>
        )}

        {/* Step 3: Peer Review & Judging / Leadership & Contributions */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>
              {isUsEb1a
                ? "3. Participation as a Judge of Others' Work (8 CFR § 204.5(h)(3)(iv))"
                : "3. Leadership, Projects & Industry Contributions"}
            </h4>
            <TextareaInput
              label={
                isUsEb1a
                  ? "Peer Review & Program Committee Service"
                  : "Significant Projects, Leadership, or Recognition"
              }
              value={formData.peerReviewCount}
              onChange={(e) => setFormData({ ...formData, peerReviewCount: e.target.value })}
              helperText={
                isUsEb1a
                  ? "Specify journals, grant review panels, or editorial boards for which you reviewed."
                  : "Describe key projects, supervisory responsibilities, or industry recognition."
              }
              required
            />
          </div>
        )}

        {/* Step 4: Critical Role & Declaration */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>
                4. Critical Employment Role &amp; Legal Declaration
              </h4>
              {formData.criticalRoleDescription && (
                <span
                  data-testid="questionnaire-step4-autofill-badge"
                  style={{
                    padding: "2px 8px",
                    background: "#EFF6FF",
                    color: "#1E40AF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  ⚡ Auto-drafted from Employment History
                </span>
              )}
            </div>
            <TextareaInput
              label={
                isUsEb1a
                  ? "Leading or Critical Role Description (8 CFR § 204.5(h)(3)(viii))"
                  : "Current Role & Core Responsibilities"
              }
              value={formData.criticalRoleDescription}
              onChange={(e) => setFormData({ ...formData, criticalRoleDescription: e.target.value })}
              helperText="Explain how your contributions were vital to the enterprise's success."
              required
            />
            <CheckboxInput
              label="I certify under penalty of perjury that the factual claims provided are accurate."
              description={
                isUsEb1a
                  ? "These responses form the foundation of USCIS Form I-140 evidentiary brief preparation."
                  : `These responses will be used by your legal team to prepare your ${resolvedVisaCategory || "immigration"} application under ${resolvedJurisdiction || "applicable"} regulations.`
              }
              checked={formData.confirmedOriginality}
              onChange={(e) => setFormData({ ...formData, confirmedOriginality: e.target.checked })}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
