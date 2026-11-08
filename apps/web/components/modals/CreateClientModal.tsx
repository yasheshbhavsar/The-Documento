import React, { useState, useEffect, useMemo, useRef } from "react";
import { Modal } from "../common/Modal";
import { TextInput, SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { ClientProfile, DuplicateCandidate, ImmigrationCase, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";
import { JURISDICTION_OPTIONS, JURISDICTION_PATHWAYS } from "./CreateCaseModal";
import { getJurisdictionRepresentationInfo } from "../../lib/jurisdictionForms";
import { extractProfileFromDocument, persistAndBroadcastAutoFill } from "../../lib/documentAutoFillEngine";

export interface ClientModalPrefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  passportNumber?: string;
  jurisdiction?: string;
  visaCategory?: string;
  leadScoreNote?: string;
}

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (newClient: ClientProfile) => void;
  onCaseCreated?: (
    newCase: ImmigrationCase,
    linkedClient?: ClientProfile,
    isNewClientOnboarding?: boolean
  ) => void;
  clients?: ClientProfile[];
  activeRole?: RoleCode;
  initialPrefill?: ClientModalPrefill | null;
}

const EMPTY_CLIENTS: ClientProfile[] = [];

export function CreateClientModal({
  isOpen,
  onClose,
  onClientCreated,
  onCaseCreated,
  clients = EMPTY_CLIENTS,
  activeRole = "master_admin",
  initialPrefill = null,
}: CreateClientModalProps) {
  const isUnifiedFlow = Boolean(onCaseCreated);

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [intakeMode, setIntakeMode] = useState<"new_client" | "existing_client">("new_client");
  const [selectedExistingClientId, setSelectedExistingClientId] = useState(clients[0]?.id || "");
  const [recentlyCreatedClient, setRecentlyCreatedClient] = useState<ClientProfile | null>(null);

  const effectiveClients = useMemo(() => {
    if (recentlyCreatedClient && !clients.some((c) => c.id === recentlyCreatedClient.id)) {
      return [recentlyCreatedClient, ...clients];
    }
    return clients;
  }, [clients, recentlyCreatedClient]);

  // Step 1: Client profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [passportNumber, setPassportNumber] = useState("");

  // Initial Case Scope (Unified Client + Case Intake)
  const [openInitialCase, setOpenInitialCase] = useState<boolean>(isUnifiedFlow);
  const [jurisdiction, setJurisdiction] = useState("United States (USCIS)");
  const [visaCategory, setVisaCategory] = useState("EB-1A Extraordinary Ability");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("CASE-8850");

  // Dependants & Consents
  const [includeDependant, setIncludeDependant] = useState(false);
  const [depRel, setDepRel] = useState("spouse");
  const [depFn, setDepFn] = useState("");
  const [depLn, setDepLn] = useState("");
  const [depAuthView, setDepAuthView] = useState(true);

  const [hasG28Consent, setHasG28Consent] = useState(true);
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(true);

  // Duplicates state
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateCandidate[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Step 2: Automated Portal Access & Magic Link
  const [grantPortalAccess, setGrantPortalAccess] = useState(true);
  const [portalPassword, setPortalPassword] = useState("ClientPass2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteToken, setInviteToken] = useState("inv_init");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [showFallbackAccordion, setShowFallbackAccordion] = useState(false);

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 6; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPortalPassword(`Doc2026!${gen}`);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [isExtractingDocument, setIsExtractingDocument] = useState(false);
  const [extractedDocBanner, setExtractedDocBanner] = useState<{
    filename: string;
    confidence: number;
    fieldsCount: number;
  } | null>(null);

  const handleDocumentAutoFill = async (file: File) => {
    setIsExtractingDocument(true);
    setError(null);
    try {
      const profile = await extractProfileFromDocument(file);
      if (profile.firstName) setFirstName(profile.firstName);
      if (profile.lastName) setLastName(profile.lastName);
      if (profile.email) setEmail(profile.email);
      if (profile.phone) setPhone(profile.phone);
      if (profile.nationality) setNationality(profile.nationality);
      if (profile.passportNumber) setPassportNumber(profile.passportNumber);
      if (profile.suggestedJurisdiction && JURISDICTION_PATHWAYS[profile.suggestedJurisdiction]) {
        setJurisdiction(profile.suggestedJurisdiction);
        const pathways = JURISDICTION_PATHWAYS[profile.suggestedJurisdiction];
        const matchedPathway = profile.suggestedVisaCategory
          ? pathways.find((p) => p.value === profile.suggestedVisaCategory)
          : undefined;
        setVisaCategory(matchedPathway ? matchedPathway.value : pathways[0]?.value || visaCategory);
      }

      setExtractedDocBanner({
        filename: file.name,
        confidence: Math.round(profile.confidence * 100),
        fieldsCount: [
          profile.firstName,
          profile.lastName,
          profile.email,
          profile.phone,
          profile.nationality,
          profile.passportNumber,
        ].filter(Boolean).length,
      });

      // Broadcast extraction to forms and sheets
      persistAndBroadcastAutoFill("default_client", {
        formData: {
          family_name: profile.lastName,
          given_names: profile.firstName,
          email: profile.email,
          phone_number: profile.phone,
          passport_number: profile.passportNumber,
        },
        sourceFilename: file.name,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to auto-extract client data from document.");
    } finally {
      setIsExtractingDocument(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      setInviteToken(`inv_${Math.random().toString(36).slice(2, 10)}`);
      setCopiedInvite(false);
      setInviteEmailSent(false);
      setShowFallbackAccordion(false);
      setPortalPassword("ClientPass2026!");
      setGrantPortalAccess(true);
      setCaseNumber(`CASE-${Math.floor(1000 + Math.random() * 9000)}`);
      setOpenInitialCase(isUnifiedFlow);
      setRecentlyCreatedClient(null);
      if (initialPrefill) {
        setIntakeMode("new_client");
        setFirstName(initialPrefill.firstName || "");
        setLastName(initialPrefill.lastName || "");
        setEmail(initialPrefill.email || "");
        setPhone(initialPrefill.phone || "");
        setNationality(initialPrefill.nationality || "");
        if (initialPrefill.passportNumber) {
          setPassportNumber(initialPrefill.passportNumber);
        }
        if (initialPrefill.jurisdiction && JURISDICTION_PATHWAYS[initialPrefill.jurisdiction]) {
          setJurisdiction(initialPrefill.jurisdiction);
          const pathways = JURISDICTION_PATHWAYS[initialPrefill.jurisdiction];
          const matchedPathway = initialPrefill.visaCategory
            ? pathways.find((p) => p.value === initialPrefill.visaCategory)
            : undefined;
          setVisaCategory(matchedPathway ? matchedPathway.value : pathways[0]?.value || visaCategory);
        }
      }
      setError(null);
    }
  }, [isOpen, initialPrefill, isUnifiedFlow]);

  useEffect(() => {
    if (!isOpen) return;
    if (effectiveClients.length === 0 && intakeMode === "existing_client") {
      setIntakeMode("new_client");
    } else if (
      effectiveClients.length > 0 &&
      !effectiveClients.some((c) => c.id === selectedExistingClientId)
    ) {
      setSelectedExistingClientId(effectiveClients[0].id);
    }
  }, [isOpen, effectiveClients, intakeMode, selectedExistingClientId]);

  const handleJurisdictionChange = (nextJur: string) => {
    setJurisdiction(nextJur);
    const pathways = JURISDICTION_PATHWAYS[nextJur] || [];
    if (pathways.length > 0) {
      setVisaCategory(pathways[0].value);
    }
  };

  // Debounced duplicate detection (New Client mode only)
  useEffect(() => {
    if (intakeMode !== "new_client" || (!email.trim() && !phone.trim() && !passportNumber.trim())) {
      setDuplicateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const res = await api.checkDuplicateClients({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          passport_number: passportNumber.trim() || undefined,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          nationality: nationality.trim() || undefined,
        });
        if (res.data?.matches) {
          setDuplicateMatches(res.data.matches);
        }
      } catch {
        // Fallback
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [intakeMode, email, phone, passportNumber, firstName, lastName, nationality]);

  const resetFormState = () => {
    setActiveStep(1);
    setIntakeMode("new_client");
    setRecentlyCreatedClient(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setNationality("");
    setPassportNumber("");
    setCaseTitle("");
    setJurisdiction("United States (USCIS)");
    setVisaCategory("EB-1A Extraordinary Ability");
    setIncludeDependant(false);
    setDepFn("");
    setDepLn("");
    setDuplicateMatches([]);
    setCopiedInvite(false);
    setInviteEmailSent(false);
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `https://app.documento.legal/login?invite=${inviteToken}&email=${encodeURIComponent(
      email.trim() || "applicant@portal.legal"
    )}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const handleSimulateSendEmail = () => {
    setInviteEmailSent(true);
    setTimeout(() => setInviteEmailSent(false), 4000);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Branch A: Open a new case for an already-retained client
    if (isUnifiedFlow && intakeMode === "existing_client") {
      if (!selectedExistingClientId) {
        setError("Please select an existing client.");
        return;
      }
      const existingClient = effectiveClients.find((c) => c.id === selectedExistingClientId);
      const fallbackTitle = existingClient
        ? `${visaCategory}: ${existingClient.first_name} ${existingClient.last_name}`
        : visaCategory;
      const effectiveTitle = caseTitle.trim() || fallbackTitle;

      setIsSubmitting(true);
      setError(null);
      try {
        const caseRes = await api.createCase(
          {
            client_id: selectedExistingClientId,
            title: effectiveTitle,
            case_number: caseNumber,
            jurisdiction,
            visa_category: visaCategory,
          },
          activeRole
        );
        onCaseCreated?.(caseRes.data, existingClient, false);
        onClose();
        resetFormState();
      } catch (err: any) {
        setError(err?.message || "Failed to open case record.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Branch B: Onboard new client (+ optional/default initial case)
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !nationality.trim()) {
      setError("Please fill in all required fields (First Name, Last Name, Email, Nationality).");
      setActiveStep(1);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.createClient(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone || undefined,
          nationality: nationality.trim(),
          passport_number: passportNumber || undefined,
          portal_credentials_provided: grantPortalAccess,
          portal_access_enabled: grantPortalAccess,
          temporary_password: grantPortalAccess ? portalPassword : undefined,
        },
        activeRole
      );

      const createdClient = res.data;
      setRecentlyCreatedClient(createdClient);

      // Add dependant if configured
      if (includeDependant && depFn.trim() && depLn.trim()) {
        try {
          await api.addDependant(createdClient.id, {
            relationship_type: depRel,
            first_name: depFn.trim(),
            last_name: depLn.trim(),
            nationality: nationality || "USA",
            is_authorized_to_view_case: depAuthView,
          });
        } catch {
          // Non-blocking
        }
      }

      onClientCreated(createdClient);

      if (isUnifiedFlow && openInitialCase && onCaseCreated) {
        const effectiveCaseTitle =
          caseTitle.trim() || `${visaCategory}: ${firstName.trim()} ${lastName.trim()}`;
        try {
          const caseRes = await api.createCase(
            {
              client_id: createdClient.id,
              title: effectiveCaseTitle,
              case_number: caseNumber,
              jurisdiction,
              visa_category: visaCategory,
            },
            activeRole
          );
          onCaseCreated(caseRes.data, createdClient, true);
        } catch (caseErr: any) {
          setIntakeMode("existing_client");
          setSelectedExistingClientId(createdClient.id);
          setError(
            `Client profile saved, but opening their case failed: ${caseErr?.message || "Unexpected error"}. Click "Open Case Record" to retry without duplicating the client.`
          );
          return;
        }
      }

      onClose();
      resetFormState();
    } catch (err: any) {
      setError(err?.message || "Failed to onboard client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pathwayOptions = JURISDICTION_PATHWAYS[jurisdiction] || [];
  const existingClientOptions = effectiveClients.map((c) => ({
    label: `${c.first_name} ${c.last_name} (${c.email})`,
    value: c.id,
  }));

  const repInfo = getJurisdictionRepresentationInfo(jurisdiction);

  const submitLabel =
    isUnifiedFlow && intakeMode === "existing_client"
      ? "Open Case Record"
      : isUnifiedFlow && openInitialCase
        ? "Onboard Client & Open Case"
        : "Save Client Record";

  const inviteUrl = `https://app.documento.legal/login?invite=${inviteToken}&email=${encodeURIComponent(
    email.trim() || "applicant@portal.legal"
  )}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUnifiedFlow ? "Onboard Client & Open Visa Case" : "Retain New Client / Applicant"}
      subtitle={
        isUnifiedFlow
          ? "Register a new applicant, issue automated portal access, and open their petition in one streamlined step — or add a new case for an existing client."
          : "Register an organization-specific client profile with duplicate-record detection suggestions."
      }
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {activeStep === 2 && (
              <Button
                variant="secondary"
                type="button"
                onClick={() => setActiveStep(1)}
                disabled={isSubmitting}
              >
                ← Back to Client Details
              </Button>
            )}
            {activeStep === 1 && (
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {activeStep === 1 && intakeMode === "new_client" && (
              <Button
                variant="outline"
                type="button"
                onClick={() => setActiveStep(2)}
                disabled={isSubmitting}
              >
                Configure Portal Invite →
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => handleSubmit()}
              isLoading={isSubmitting}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Wizard Step Indicator Bar (New Client Mode) */}
        {intakeMode === "new_client" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              padding: "4px",
              background: "#F1F6F4",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: activeStep === 1 ? "1px solid #B9DED4" : "1px solid transparent",
                background: activeStep === 1 ? "#FFFFFF" : "transparent",
                color: activeStep === 1 ? "#063C3D" : "#6E7F7C",
                fontSize: "12px",
                fontWeight: activeStep === 1 ? 700 : 550,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>1.</span>
              <span>Client Profile &amp; Petition Scope</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: activeStep === 2 ? "1px solid #B9DED4" : "1px solid transparent",
                background: activeStep === 2 ? "#FFFFFF" : "transparent",
                color: activeStep === 2 ? "#063C3D" : "#6E7F7C",
                fontSize: "12px",
                fontWeight: activeStep === 2 ? 700 : 550,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>2.</span>
              <span>Portal Access &amp; Magic Link</span>
            </button>
          </div>
        )}

        {/* Segmented Intake Switcher when Existing Clients exist */}
        {isUnifiedFlow && effectiveClients.length > 0 && (intakeMode === "existing_client" || !initialPrefill) && (
          <div
            role="tablist"
            aria-label="Client and case intake mode"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              padding: "4px",
              background: "#F1F6F4",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={intakeMode === "new_client"}
              onClick={() => {
                setIntakeMode("new_client");
                setError(null);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: intakeMode === "new_client" ? "1px solid #B9DED4" : "1px solid transparent",
                background: intakeMode === "new_client" ? "#FFFFFF" : "transparent",
                color: intakeMode === "new_client" ? "#063C3D" : "#445451",
                fontSize: "12.5px",
                fontWeight: intakeMode === "new_client" ? 700 : 550,
                cursor: "pointer",
              }}
            >
              👤 New Client &amp; Case
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={intakeMode === "existing_client"}
              onClick={() => {
                setIntakeMode("existing_client");
                setError(null);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: intakeMode === "existing_client" ? "1px solid #B9DED4" : "1px solid transparent",
                background: intakeMode === "existing_client" ? "#FFFFFF" : "transparent",
                color: intakeMode === "existing_client" ? "#063C3D" : "#445451",
                fontSize: "12.5px",
                fontWeight: intakeMode === "existing_client" ? 700 : 550,
                cursor: "pointer",
              }}
            >
              📋 Existing Client ({effectiveClients.length})
            </button>
          </div>
        )}

        {initialPrefill?.leadScoreNote && (
          <div
            data-testid="lead-prefill-banner"
            style={{
              padding: "10px 14px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              color: "#063C3D",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            Imported from Co-Branded PR Scorecard: {initialPrefill.leadScoreNote}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              background: "var(--critical-soft, #fef2f2)",
              color: "var(--critical, #b91c1c)",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* MODE 1: EXISTING CLIENT -> OPEN ADDITIONAL CASE */}
        {isUnifiedFlow && intakeMode === "existing_client" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <SelectInput
              label="Retained Client"
              value={selectedExistingClientId}
              onChange={(e) => setSelectedExistingClientId(e.target.value)}
              options={existingClientOptions}
              required
            />

            <SelectInput
              label="Immigration Jurisdiction"
              value={jurisdiction}
              onChange={(e) => handleJurisdictionChange(e.target.value)}
              options={JURISDICTION_OPTIONS}
              required
            />

            <SelectInput
              label="Pathway / Visa Category"
              value={visaCategory}
              onChange={(e) => setVisaCategory(e.target.value)}
              options={pathwayOptions}
              required
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "12px" }}>
              <TextInput
                label="Petition Case Title"
                placeholder={`e.g. ${visaCategory}`}
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                helperText="Leave blank to auto-title from pathway and client name."
              />

              <TextInput
                label="Case Reference Number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                required
              />
            </div>
          </div>
        ) : activeStep === 1 ? (
          /* STEP 1: CLIENT DETAILS & PETITION SCOPE */
          <>
            {/* Duplicate Record Suggestions Alert */}
            {duplicateMatches.length > 0 && (
              <div
                role="alert"
                style={{
                  padding: "12px 14px",
                  background: "var(--warning-soft, #fffbeb)",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚠️</span>
                    <strong style={{ color: "var(--warning, #b45309)" }}>
                      Duplicate Record Suggestion ({duplicateMatches.length} match{duplicateMatches.length > 1 ? "es" : ""})
                    </strong>
                  </div>
                  {isUnifiedFlow && clients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIntakeMode("existing_client")}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #F59E0B",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#B45309",
                        cursor: "pointer",
                      }}
                    >
                      Use Existing Client →
                    </button>
                  )}
                </div>
                {duplicateMatches.map((m, idx) => (
                  <div key={idx} style={{ marginTop: "4px", color: "var(--text)" }}>
                    • <strong>{m.client_name}</strong> ({m.client_email}) — {m.details} (
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{m.confidence} confidence</span>)
                  </div>
                ))}
                <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--muted)" }}>
                  Ensure you are not registering a redundant file for an already retained applicant.
                </div>
              </div>
            )}

            {isCheckingDuplicates && (
              <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Checking directory for existing client records...</div>
            )}

            {/* Auto-fill Dropzone: Drop Passport / Resume / Packet */}
            <div
              data-testid="client-autofill-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingDoc(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingDoc(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingDoc(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleDocumentAutoFill(file);
              }}
              style={{
                border: isDraggingDoc ? "2px dashed #0D6866" : "2px dashed #93C5FD",
                background: isDraggingDoc ? "#EAF6F0" : "#EFF6FF",
                borderRadius: "10px",
                padding: "14px 18px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => docInputRef.current?.click()}
            >
              <input
                ref={docInputRef}
                type="file"
                data-testid="client-autofill-file-input"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocumentAutoFill(file);
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>⚡</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E40AF" }}>
                    Drop Passport / Resume / Packet to Auto-Fill Client
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#3B82F6" }}>
                    {isExtractingDocument
                      ? "Analyzing document with deterministic OCR & credential intelligence..."
                      : "Drag & drop PDF, JPG, or PNG to instantly extract name, passport, contacts & pathway"}
                  </div>
                </div>
              </div>
            </div>

            {extractedDocBanner && (
              <div
                data-testid="autofill-success-banner"
                style={{
                  padding: "8px 14px",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  borderRadius: "6px",
                  color: "#065F46",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  ✓ Auto-extracted {extractedDocBanner.fieldsCount} onboarding fields from <strong>{extractedDocBanner.filename}</strong> ({extractedDocBanner.confidence}% Match)
                </span>
                <button
                  type="button"
                  onClick={() => setExtractedDocBanner(null)}
                  style={{ background: "none", border: "none", color: "#065F46", cursor: "pointer", fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "12px" }}>
              <TextInput
                label="First Name"
                placeholder="e.g. First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />

              <TextInput
                label="Last Name"
                placeholder="e.g. Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <TextInput
              label="Email Address"
              type="email"
              placeholder="e.g. applicant@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "12px" }}>
              <TextInput
                label="Phone Number"
                type="tel"
                placeholder="e.g. +1 (555) 234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <TextInput
                label="Primary Nationality (ISO)"
                placeholder="e.g. GBR, USA, IND"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                required
              />
            </div>

            <TextInput
              label="Passport Number (Cryptographically Hashed)"
              placeholder="e.g. GBR-998811"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
            />

            {/* Unified Initial Visa Case Scope */}
            {isUnifiedFlow && (
              <div
                data-testid="unified-case-scope-section"
                style={{
                  padding: "12px 14px",
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#063C3D",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={openInitialCase}
                      onChange={(e) => setOpenInitialCase(e.target.checked)}
                    />
                    <span>📋 Open Initial Visa Case Record Now</span>
                  </label>
                  <Badge variant={openInitialCase ? "success" : "neutral"} size="sm">
                    {openInitialCase ? "1-Step Intake" : "Profile Only"}
                  </Badge>
                </div>

                {openInitialCase && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "2px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "10px" }}>
                      <SelectInput
                        label="Immigration Jurisdiction"
                        value={jurisdiction}
                        onChange={(e) => handleJurisdictionChange(e.target.value)}
                        options={JURISDICTION_OPTIONS}
                        required
                      />

                      <SelectInput
                        label="Pathway / Visa Category"
                        value={visaCategory}
                        onChange={(e) => setVisaCategory(e.target.value)}
                        options={pathwayOptions}
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "10px" }}>
                      <TextInput
                        label="Petition Case Title (Optional)"
                        placeholder={
                          firstName.trim() || lastName.trim()
                            ? `${visaCategory}: ${firstName.trim()} ${lastName.trim()}`.trim()
                            : `Auto-generated from pathway & applicant name`
                        }
                        value={caseTitle}
                        onChange={(e) => setCaseTitle(e.target.value)}
                      />

                      <TextInput
                        label="Case Reference Number"
                        value={caseNumber}
                        onChange={(e) => setCaseNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Statutory Consent Checkboxes */}
            <div
              style={{
                padding: "10px 12px",
                background: "var(--surface-subtle, #F1F6F4)",
                border: "1px solid var(--border, #DCE5E1)",
                borderRadius: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>Consent &amp; Representation Records:</span>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={hasG28Consent}
                  onChange={(e) => setHasG28Consent(e.target.checked)}
                />
                <span>{repInfo.checkboxLabel}</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={hasPrivacyConsent}
                  onChange={(e) => setHasPrivacyConsent(e.target.checked)}
                />
                <span>Record GDPR &amp; Immigration Data Processing Consent</span>
              </label>
            </div>

            {/* Add Initial Dependant Toggle */}
            <div style={{ marginTop: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={includeDependant}
                  onChange={(e) => setIncludeDependant(e.target.checked)}
                />
                <span>Add Principal Dependant / Family Member</span>
              </label>

              {includeDependant && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "12px",
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px dashed var(--border, #cbd5e1)",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <SelectInput
                    label="Relationship Type"
                    value={depRel}
                    onChange={(e) => setDepRel(e.target.value)}
                    options={[
                      { label: "Spouse", value: "spouse" },
                      { label: "Child", value: "child" },
                      { label: "Parent", value: "parent" },
                      { label: "Dependent", value: "dependent" },
                    ]}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "10px" }}>
                    <TextInput label="Dependant First Name" value={depFn} onChange={(e) => setDepFn(e.target.value)} />
                    <TextInput label="Dependant Last Name" value={depLn} onChange={(e) => setDepLn(e.target.value)} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={depAuthView}
                      onChange={(e) => setDepAuthView(e.target.checked)}
                    />
                    <span>Grant authorized portal access to view case petition</span>
                  </label>
                </div>
              )}
            </div>
          </>
        ) : (
          /* STEP 2: AUTOMATED PORTAL ACCESS & MAGIC INVITE LINK */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Automated Magic Link Card */}
            <div
              style={{
                padding: "14px 16px",
                background: "#F4FAF7",
                border: "1px solid #B9DED4",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🛡️</span>
                  <span>Automated Secure Portal Access Link</span>
                </span>
                <Badge variant={grantPortalAccess ? "success" : "neutral"} size="sm">
                  {grantPortalAccess ? "Single-Use Invite Ready" : "Access Disabled"}
                </Badge>
              </div>

              <p style={{ margin: 0, fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                An encrypted, tamper-evident portal invite link is automatically generated for <strong>{firstName || "Applicant"} {lastName || ""}</strong> ({email || "applicant"}). The client sets their own permanent password upon first access.
              </p>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    color: "#063C3D",
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteLink}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {copiedInvite ? "✓ Copied!" : "📋 Copy Invite Link"}
                </Button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSimulateSendEmail}
                >
                  ✉️ Send Portal Invite Email
                </Button>
                {inviteEmailSent && (
                  <span style={{ fontSize: "12px", color: "#047857", fontWeight: 600 }}>
                    ✓ Invitation email dispatched to {email || "client email"}
                  </span>
                )}
              </div>
            </div>

            {/* Advanced / Fallback Accordion */}
            <div
              style={{
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                background: "#FAF9F5",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setShowFallbackAccordion(!showFallbackAccordion)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 650,
                  color: "#063C3D",
                }}
              >
                <span>⚙️ Advanced: Fallback Temporary Password &amp; Access Controls</span>
                <span>{showFallbackAccordion ? "▲" : "▼"}</span>
              </button>

              {showFallbackAccordion && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderTop: "1px solid #E5EBE8",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 600, color: "#0D6866" }}>
                    <input
                      type="checkbox"
                      id="provision-portal-credentials-toggle"
                      checked={grantPortalAccess}
                      onChange={(e) => setGrantPortalAccess(e.target.checked)}
                    />
                    <span>Provide portal login credentials now (enables client to sign in)</span>
                  </label>

                  {grantPortalAccess && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <TextInput
                            label="Assigned Client Portal Password"
                            type={showPassword ? "text" : "password"}
                            value={portalPassword}
                            onChange={(e) => setPortalPassword(e.target.value)}
                            required={grantPortalAccess}
                            placeholder="Set temporary password"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            padding: "8px 12px",
                            background: "#FFFFFF",
                            border: "1px solid #B9DED4",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            color: "#0D6866",
                            height: "36px",
                          }}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          style={{
                            padding: "8px 12px",
                            background: "#EAF6F0",
                            border: "1px solid #B9DED4",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 650,
                            cursor: "pointer",
                            color: "#063C3D",
                            height: "36px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          🎲 Generate
                        </button>
                      </div>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                        ℹ️ Standard credentials for the retained client must be provided by counsel or lead paralegal.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
