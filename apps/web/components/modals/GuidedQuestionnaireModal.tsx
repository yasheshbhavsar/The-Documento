import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { TextInput, TextareaInput, CheckboxInput } from "../common/FormControls";
import { Button } from "../common/Button";

interface GuidedQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function GuidedQuestionnaireModal({
  isOpen,
  onClose,
  onSaved,
}: GuidedQuestionnaireModalProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form State
  const [formData, setFormData] = useState({
    fullName: "Dr. Elena Rostova",
    currentField: "Biomedical Artificial Intelligence & Oncology",
    highestDegree: "Ph.D. in Computational Biology, Stanford University (2018)",
    publicationsCount: "14 first-author peer-reviewed papers in Nature Biotech, Lancet",
    citationCount: "842 verified Google Scholar citations",
    peerReviewCount: "28 formal manuscript reviews for 4 journals",
    criticalRoleDescription: "Principal Investigator leading the Oncology Vision Team at DeepHealth Labs",
    confirmedOriginality: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
    } else {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        onSaved();
        onClose();
      }, 500);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guided Extraordinary Ability Questionnaire"
      subtitle={`Step ${step} of ${totalSteps} — Statutory Evidentiary Criteria Mapping`}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Button variant="secondary" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            ← Back
          </Button>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" onClick={onClose}>
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
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>1. Field of Extraordinary Ability</h4>
            <TextInput
              label="Legal Name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
            <TextInput
              label="Specific Endeavor or Field of Scientific Focus"
              value={formData.currentField}
              onChange={(e) => setFormData({ ...formData, currentField: e.target.value })}
              helperText="E.g. Computer Science, Molecular Oncology, or Clean Energy Systems"
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

        {/* Step 2: Scholarly Publications & Citations */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>2. Authorship of Scholarly Articles (8 CFR § 204.5(h)(3)(vi))</h4>
            <TextareaInput
              label="Summary of Peer-Reviewed Articles"
              value={formData.publicationsCount}
              onChange={(e) => setFormData({ ...formData, publicationsCount: e.target.value })}
              helperText="List major journals, conference proceedings, or book chapters."
              required
            />
            <TextInput
              label="Total Academic Citations"
              value={formData.citationCount}
              onChange={(e) => setFormData({ ...formData, citationCount: e.target.value })}
              helperText="Provide Google Scholar, Web of Science, or Scopus citation metric."
              required
            />
          </div>
        )}

        {/* Step 3: Peer Review & Judging */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>3. Participation as a Judge of Others' Work (8 CFR § 204.5(h)(3)(iv))</h4>
            <TextareaInput
              label="Peer Review & Program Committee Service"
              value={formData.peerReviewCount}
              onChange={(e) => setFormData({ ...formData, peerReviewCount: e.target.value })}
              helperText="Specify journals, grant review panels, or editorial boards for which you reviewed."
              required
            />
          </div>
        )}

        {/* Step 4: Critical Role & Declaration */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>4. Critical Employment Role & Legal Declaration</h4>
            <TextareaInput
              label="Leading or Critical Role Description (8 CFR § 204.5(h)(3)(viii))"
              value={formData.criticalRoleDescription}
              onChange={(e) => setFormData({ ...formData, criticalRoleDescription: e.target.value })}
              helperText="Explain how your contributions were vital to the enterprise's success."
              required
            />
            <CheckboxInput
              label="I certify under penalty of perjury that the factual claims provided are accurate."
              description="These responses form the foundation of USCIS Form I-140 evidentiary brief preparation."
              checked={formData.confirmedOriginality}
              onChange={(e) => setFormData({ ...formData, confirmedOriginality: e.target.checked })}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
