"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocumentoLogo } from "../common/DocumentoLogo";
import {
  AGENCY_PLAN_SPECS,
  AgencyKybApplication,
  AgencyPlanTier,
  KybTrack,
  KybUploadedDocument,
  REGULATORY_BODIES,
  SOVEREIGN_CORRIDORS,
  buildKybUploadedDocMeta,
  lookupAgencyDossier,
  normalizeAgencySlug,
  resubmitAgencyKybClarification,
  submitAgencyOnboarding,
} from "../../lib/agencyPlatformStore";
import { UserContext } from "../../lib/types";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export function AgencyOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedDossier, setSubmittedDossier] = useState<AgencyKybApplication | null>(null);

  // Returning Applicant Status Lookup & Clarification Drawer
  const [showLookupDrawer, setShowLookupDrawer] = useState<boolean>(false);
  const [lookupQuery, setLookupQuery] = useState<string>("");
  const [matchedDossier, setMatchedDossier] = useState<AgencyKybApplication | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState<boolean>(false);
  const [clarificationLicense, setClarificationLicense] = useState<string>("");
  const [clarificationNote, setClarificationNote] = useState<string>("");
  const [clarificationDoc, setClarificationDoc] = useState<KybUploadedDocument | null>(null);
  const [clarificationFeedback, setClarificationFeedback] = useState<string | null>(null);
  const [clarificationError, setClarificationError] = useState<string | null>(null);

  // Step 1: Owner Account & Agency Identity
  const [contactFullName, setContactFullName] = useState("");
  const [contactWorkEmail, setContactWorkEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [legalEntityName, setLegalEntityName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [hqCountry, setHqCountry] = useState("Canada");
  const [hqCity, setHqCity] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consultationBookingUrl, setConsultationBookingUrl] = useState("");

  // Step 2: Practice Type & Real KYB Verification Proof
  const [kybTrack, setKybTrack] = useState<KybTrack>("regulated_counsel");
  const [regulatoryBody, setRegulatoryBody] = useState("CICC");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [taxRegistrationId, setTaxRegistrationId] = useState("");
  const [coCounselDetails, setCoCounselDetails] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<KybUploadedDocument[]>([]);
  const [deferDocsToWorkspace, setDeferDocsToWorkspace] = useState<boolean>(false);

  // Step 3: Visa Corridors, Team Size & 14-Day Free Trial Launch
  const [targetCorridors, setTargetCorridors] = useState<string[]>(["CA", "UK"]);
  const [requestedSeats, setRequestedSeats] = useState<number>(6);
  const [estimatedMonthlyCases, setEstimatedMonthlyCases] = useState<number>(30);
  const [branchCount, setBranchCount] = useState<number>(1);
  const [selectedPlanTier, setSelectedPlanTier] = useState<AgencyPlanTier>("growth");
  const [partnerTermsAccepted, setPartnerTermsAccepted] = useState<boolean>(false);

  const effectiveSlug = useMemo(() => {
    const raw = slugEditedManually ? customSlug : tradingName || legalEntityName;
    return raw.trim() ? normalizeAgencySlug(raw) : "your-firm";
  }, [slugEditedManually, customSlug, tradingName, legalEntityName]);

  const emailDomain = useMemo(() => {
    if (!contactWorkEmail.includes("@")) return "";
    return contactWorkEmail.split("@")[1]?.trim().toLowerCase() || "";
  }, [contactWorkEmail]);

  const isFreeWebmail = emailDomain !== "" && FREE_EMAIL_DOMAINS.has(emailDomain);

  const activeRegBodyMeta = useMemo(
    () => REGULATORY_BODIES.find((r) => r.code === regulatoryBody) || REGULATORY_BODIES[0],
    [regulatoryBody]
  );

  const activePlanSpec = AGENCY_PLAN_SPECS[selectedPlanTier];

  const handleTrackSwitch = (track: KybTrack) => {
    setKybTrack(track);
    if (track === "overseas_consultancy") {
      setRegulatoryBody("MEA_IATA_CORP");
    } else if (regulatoryBody === "MEA_IATA_CORP") {
      setRegulatoryBody("CICC");
    }
  };

  const handleFileSelected = (
    docType: KybUploadedDocument["docType"],
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const meta = buildKybUploadedDocMeta(docType, file);
    setUploadedDocs((prev) => [...prev.filter((d) => d.docType !== docType), meta]);
    setDeferDocsToWorkspace(false);
  };

  const handleClarificationFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setClarificationDoc(buildKybUploadedDocMeta("co_counsel_retainer", file));
  };

  const toggleCorridor = (code: string) => {
    setTargetCorridors((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((c) => c !== code) : prev;
      }
      return [...prev, code];
    });
  };

  const validateStep1 = (): string | null => {
    if (contactFullName.trim().length < 2) {
      return "Enter your full name as Managing Partner or Agency Director.";
    }
    if (!contactWorkEmail.includes("@") || contactWorkEmail.trim().length < 5) {
      return "Enter a valid work email address — this will be your owner sign-in email.";
    }
    if (ownerPassword.trim().length < 8) {
      return "Create an account password of at least 8 characters so you can sign back in anytime.";
    }
    if (legalEntityName.trim().length < 3) {
      return "Enter your registered law firm or agency legal entity name.";
    }
    if (tradingName.trim().length < 2) {
      return "Enter the public brand name clients will see on your portal and calculator link.";
    }
    if (hqCity.trim().length < 2) {
      return "Enter your primary office city.";
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (licenseNumber.trim().length < 3) {
      return `Enter your ${activeRegBodyMeta.code} practitioner license or company registration number.`;
    }
    if (taxRegistrationId.trim().length < 3) {
      return "Enter your business registration or tax number (e.g. BN, ABN, GSTIN, Company No., or DED).";
    }
    if (uploadedDocs.length === 0 && !deferDocsToWorkspace) {
      return "Upload your practicing certificate / business registration PDF, or check 'I will upload my certificate inside my workspace later' to start your trial right away.";
    }
    return null;
  };

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setErrorMsg(null);
    if (nextStep > 1 && step === 1) {
      const err = validateStep1();
      if (err) {
        setErrorMsg(err);
        return;
      }
    }
    if (nextStep > 2 && step <= 2) {
      const err1 = validateStep1();
      if (err1) {
        setErrorMsg(err1);
        setStep(1);
        return;
      }
      const err2 = validateStep2();
      if (err2) {
        setErrorMsg(err2);
        setStep(2);
        return;
      }
    }
    setStep(nextStep);
  };

  const handleDossierLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setClarificationFeedback(null);
    setClarificationError(null);
    const found = lookupAgencyDossier(lookupQuery);
    setMatchedDossier(found);
    setLookupAttempted(true);
    if (found) {
      setClarificationLicense(found.licenseNumber || "");
      setClarificationNote(found.coCounselDetails || "");
    }
  };

  const handleSubmitClarification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedDossier) return;
    try {
      setClarificationError(null);
      const updated = resubmitAgencyKybClarification(matchedDossier.id, {
        licenseNumber: clarificationLicense,
        coCounselDetails: clarificationNote,
        uploadedDocument: clarificationDoc || undefined,
      });
      setMatchedDossier(updated);
      setClarificationFeedback(
        `Updated verification submitted for ${updated.dossierCode}. Status is now PENDING KYB review.`
      );
    } catch (err: any) {
      setClarificationError(err?.message || "Unable to submit clarification response.");
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const err1 = validateStep1();
    if (err1) {
      setErrorMsg(err1);
      setStep(1);
      return;
    }
    const err2 = validateStep2();
    if (err2) {
      setErrorMsg(err2);
      setStep(2);
      return;
    }
    if (!partnerTermsAccepted) {
      setErrorMsg(
        "Please accept the Partner Terms & Client Data Privacy Agreement before launching your workspace."
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitAgencyOnboarding({
        legalEntityName,
        tradingName,
        requestedSlug: effectiveSlug,
        hqCountry,
        hqCity,
        corporateDomain: emailDomain || `${effectiveSlug}.com`,
        taxRegistrationId,
        contactFullName,
        contactWorkEmail,
        contactPhone,
        ownerPassword,
        consultationBookingUrl,
        kybTrack,
        regulatoryBody,
        licenseNumber,
        coCounselDetails: kybTrack === "overseas_consultancy" ? coCounselDetails : undefined,
        uploadedDocuments: uploadedDocs,
        targetCorridors,
        estimatedMonthlyCases,
        requestedSeats,
        branchCount,
        selectedPlanTier,
        dpaAccepted: partnerTermsAccepted,
        zeroTrainingAccepted: partnerTermsAccepted,
      });
      setSubmittedDossier(created);
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to create your agency workspace. Please review your details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAgencyWorkspace = () => {
    if (!submittedDossier) return;
    const ownerUser: UserContext = {
      id: `usr-sandbox-${submittedDossier.requestedSlug}`,
      email: submittedDossier.contactWorkEmail,
      full_name: submittedDossier.contactFullName,
      role: "master_admin",
      organization_id: `sandbox-${submittedDossier.requestedSlug}`,
      organization_name: submittedDossier.legalEntityName,
      experience: "master_admin",
      permissions: ["*"],
      agency_slug: submittedDossier.requestedSlug,
      is_sandbox_agency: true,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("documento_user", JSON.stringify(ownerUser));
    }
    router.push("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #BDCDC7",
    background: "#FFFFFF",
    color: "#172322",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 650,
    color: "#223431",
    marginBottom: "5px",
  };

  const licenseDoc = uploadedDocs.find((d) => d.docType === "practitioner_license");
  const regDoc = uploadedDocs.find((d) => d.docType === "business_registration");
  const idDoc = uploadedDocs.find((d) => d.docType === "principal_id");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F7F2",
        color: "#172322",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Top Navigation */}
      <header
        style={{
          borderBottom: "1px solid #DCE5E1",
          background: "#FFFFFF",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <DocumentoLogo size="sm" showWordmark />
            </Link>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 650,
                color: "#063C3D",
                background: "#EEF4F1",
                border: "1px solid #CFDCD6",
                padding: "3px 9px",
                borderRadius: "4px",
              }}
            >
              For Immigration Law Firms &amp; Visa Agencies
            </span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowLookupDrawer((prev) => !prev)}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#063C3D",
                background: "#F4F8F6",
                border: "1px solid #DCE5E1",
                padding: "7px 12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {showLookupDrawer ? "Hide Status Lookup" : "Check Application Status"}
            </button>
            <Link
              href="/calculators"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#384A46",
                textDecoration: "none",
              }}
            >
              PR Calculators
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: "13px",
                fontWeight: 650,
                color: "#FFFFFF",
                background: "#063C3D",
                padding: "7px 14px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Agency Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 72px 24px" }}>
        {/* Returning Agency Status Lookup & Clarification Uploader */}
        <section
          aria-label="Track Existing KYB Dossier"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
            padding: "14px 18px",
            marginBottom: "24px",
          }}
        >
          <form
            onSubmit={handleDossierLookup}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                Already applied? Check your license verification status or upload a requested document
              </div>
              <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
                Enter your reference code (e.g. <code>KYB-71B04E88</code>) or owner work email.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                aria-label="KYB Dossier Code or Work Email"
                placeholder="e.g. KYB-71B04E88 or work email"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  fontSize: "13px",
                  minWidth: "240px",
                  background: "#FFFFFF",
                }}
              />
              <button
                type="submit"
                data-testid="kyb-dossier-lookup-btn"
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #063C3D",
                  background: "#063C3D",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Check Status
              </button>
            </div>
          </form>

          {lookupAttempted && !matchedDossier && (
            <div
              role="status"
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #E5ECE9",
                background: "#F8FAF9",
                fontSize: "12.5px",
                color: "#445451",
              }}
            >
              No application matched <strong>{lookupQuery.trim() || "your query"}</strong>. Check your{" "}
              <code>KYB-XXXXXXXX</code> code or create your agency account below.
            </div>
          )}

          {matchedDossier && (
            <div
              data-testid="kyb-lookup-result-card"
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid #E5ECE9",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#172322" }}>
                    {matchedDossier.tradingName} ({matchedDossier.legalEntityName})
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#5C6E6A", marginTop: "2px" }}>
                    Ref: <strong>{matchedDossier.dossierCode}</strong> · License:{" "}
                    <strong>
                      {matchedDossier.regulatoryBody} ({matchedDossier.licenseNumber})
                    </strong>{" "}
                    · Owner: {matchedDossier.contactWorkEmail}
                  </div>
                </div>
                <span
                  data-testid="kyb-lookup-status-badge"
                  style={{
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    border:
                      matchedDossier.kybStatus === "approved"
                        ? "1px solid #B9DED4"
                        : matchedDossier.kybStatus === "clarification_requested"
                          ? "1px solid #E5C899"
                          : matchedDossier.kybStatus === "rejected"
                            ? "1px solid #FECACA"
                            : "1px solid #DCE5E1",
                    background:
                      matchedDossier.kybStatus === "approved"
                        ? "#EAF6F0"
                        : matchedDossier.kybStatus === "clarification_requested"
                          ? "#FEF7EA"
                          : matchedDossier.kybStatus === "rejected"
                            ? "#FEF2F2"
                            : "#F4F7F6",
                    color:
                      matchedDossier.kybStatus === "approved"
                        ? "#176B50"
                        : matchedDossier.kybStatus === "clarification_requested"
                          ? "#8A5A10"
                          : matchedDossier.kybStatus === "rejected"
                            ? "#991B1B"
                            : "#063C3D",
                  }}
                >
                  {matchedDossier.kybStatus.toUpperCase().replace(/_/g, " ")}
                </span>
              </div>

              {matchedDossier.reviewerNotes && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #E5C899",
                    background: "#FFFBF4",
                    fontSize: "12.5px",
                    color: "#6B450B",
                  }}
                >
                  <strong>Note from Documento Verification Team:</strong> {matchedDossier.reviewerNotes}
                </div>
              )}

              {clarificationFeedback && (
                <div
                  role="status"
                  data-testid="kyb-clarification-success"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #B9DED4",
                    background: "#EAF6F0",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "#176B50",
                  }}
                >
                  {clarificationFeedback}
                </div>
              )}

              {matchedDossier.kybStatus === "clarification_requested" && (
                <form
                  onSubmit={handleSubmitClarification}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "10px",
                    alignItems: "end",
                    background: "#F8FAF9",
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    padding: "12px",
                  }}
                >
                  <div>
                    <label
                      htmlFor="clarification-license-input"
                      style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#384A46", marginBottom: "4px" }}
                    >
                      Updated License / Registration #
                    </label>
                    <input
                      id="clarification-license-input"
                      type="text"
                      value={clarificationLicense}
                      onChange={(e) => setClarificationLicense(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        fontSize: "12.5px",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="clarification-details-input"
                      style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#384A46", marginBottom: "4px" }}
                    >
                      Co-Counsel Retainer / Registry Clarification Details
                    </label>
                    <input
                      id="clarification-details-input"
                      type="text"
                      placeholder="Enter co-counsel RCIC/MARA/SRA number or registry link..."
                      value={clarificationNote}
                      onChange={(e) => setClarificationNote(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        fontSize: "12.5px",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="clarification-file-input"
                      style={{ display: "block", fontSize: "11.5px", fontWeight: 650, color: "#384A46", marginBottom: "4px" }}
                    >
                      Attach Supporting PDF (Optional)
                    </label>
                    <input
                      id="clarification-file-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleClarificationFileSelected}
                      style={{ fontSize: "12px", width: "100%" }}
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="kyb-submit-clarification-btn"
                    style={{
                      padding: "9px 14px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontSize: "12.5px",
                      fontWeight: 650,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Submit Update
                  </button>
                  {clarificationError && (
                    <div
                      role="alert"
                      style={{
                        gridColumn: "1 / -1",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#991B1B",
                      }}
                    >
                      {clarificationError}
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </section>

        {/* Practical Editorial Header */}
        <div style={{ maxWidth: "780px", marginBottom: "26px" }}>
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#0D6866",
              marginBottom: "8px",
            }}
          >
            14-Day Free Agency Trial • $0 Due Today • No Credit Card Required
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 3vw, 35px)",
              fontWeight: 750,
              color: "#063C3D",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              margin: "0 0 10px 0",
            }}
          >
            Set up your immigration firm or visa agency in 2 minutes.
          </h1>
          <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
            Create your owner login, customize your co-branded 5-country PR calculator link, and pre-load
            country checklists for your paralegals and counsellors. Once we verify your practitioner
            license or company registration, live client document collection unlocks automatically.
          </p>
        </div>

        {submittedDossier ? (
          /* Real-World Post-Signup Workspace Ready Card (Zero Leaked Admin Links) */
          <section
            data-testid="kyb-submission-confirmation"
            style={{
              background: "#FFFFFF",
              border: "1px solid #BDCDC7",
              borderRadius: "10px",
              padding: "32px",
              maxWidth: "880px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "16px",
                paddingBottom: "20px",
                borderBottom: "1px solid #E5ECE9",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#176B50",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    padding: "3px 10px",
                    borderRadius: "4px",
                    marginBottom: "10px",
                  }}
                >
                  ACCOUNT CREATED • 14-DAY FREE TRIAL READY
                </span>
                <h2 style={{ fontSize: "22px", fontWeight: 750, color: "#063C3D", margin: "0 0 4px 0" }}>
                  Welcome to Documento, {submittedDossier.tradingName}
                </h2>
                <div style={{ fontSize: "13.5px", color: "#445451" }}>
                  Owner Sign-In: <strong>{submittedDossier.contactWorkEmail}</strong> · Verification Ref:{" "}
                  <strong>{submittedDossier.dossierCode}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#5C6E6A" }}>Your Co-Branded Calculator Link</div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                  /calculators?agency={submittedDossier.requestedSlug}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
                gap: "12px",
                margin: "22px 0",
              }}
            >
              {[
                {
                  stepLabel: "1. Owner Login & Workspace",
                  state: "Ready Now",
                  active: true,
                },
                {
                  stepLabel: "2. Visa Checklists & Branding",
                  state: `${submittedDossier.targetCorridors.join(", ")} Pre-Loaded`,
                  active: true,
                },
                {
                  stepLabel: `3. ${submittedDossier.regulatoryBody} Verification`,
                  state:
                    (submittedDossier.uploadedDocuments?.length || 0) > 0
                      ? `${submittedDossier.uploadedDocuments?.length} File(s) In Review (<4h)`
                      : "Upload Certificate in Workspace",
                  active: (submittedDossier.uploadedDocuments?.length || 0) > 0,
                },
                {
                  stepLabel: "4. Live Client Portal & Leads",
                  state: "Activates on KYB Approval",
                  active: false,
                },
              ].map((s) => (
                <div
                  key={s.stepLabel}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: s.active ? "1px solid #0D6866" : "1px solid #DCE5E1",
                    background: s.active ? "#F3FAF7" : "#F9FBFA",
                  }}
                >
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#063C3D" }}>
                    {s.stepLabel}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: s.active ? "#0D6866" : "#647571",
                      marginTop: "3px",
                    }}
                  >
                    {s.state}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "13.5px", color: "#445451", lineHeight: 1.55, margin: "0 0 22px 0" }}>
              Your dedicated workspace for <strong>{submittedDossier.legalEntityName}</strong> is ready.
              Inside, you can customize your branding and consultation booking link, invite your
              paralegals or counsellors, and test AI document review while our team confirms{" "}
              <strong>
                {submittedDossier.regulatoryBody} ({submittedDossier.licenseNumber})
              </strong>
              .
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="open-agency-workspace-btn"
                onClick={handleOpenAgencyWorkspace}
                style={{
                  padding: "11px 22px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#063C3D",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Open My Agency Workspace →
              </button>
              <Link
                href="/calculators"
                style={{
                  padding: "11px 18px",
                  borderRadius: "6px",
                  border: "1px solid #BDCDC7",
                  background: "#FFFFFF",
                  color: "#063C3D",
                  fontSize: "13.5px",
                  fontWeight: 650,
                  textDecoration: "none",
                }}
              >
                Preview 5-Country PR Calculators
              </Link>
            </div>
          </section>
        ) : (
          /* Two-Column Real-World Signup & Live Workspace Preview */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 7fr) minmax(320px, 5fr)",
              gap: "28px",
              alignItems: "start",
            }}
            className="agency-onb-grid"
          >
            <style>{`
              @media (max-width: 960px) {
                .agency-onb-grid {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>

            {/* Left 3-Step Form */}
            <form
              onSubmit={handleFinalSubmit}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "28px",
              }}
            >
              {/* 3-Step Practical Rail */}
              <div
                role="tablist"
                aria-label="Agency Signup Steps"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  paddingBottom: "20px",
                  marginBottom: "22px",
                  borderBottom: "1px solid #E5ECE9",
                }}
              >
                {[
                  { num: 1 as const, label: "1. Account & Agency" },
                  { num: 2 as const, label: "2. License & Proof" },
                  { num: 3 as const, label: "3. Visa Programs & Trial" },
                ].map((s) => {
                  const isCurrent = step === s.num;
                  const isDone = step > s.num;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      onClick={() => goToStep(s.num)}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "6px",
                        border: isCurrent
                          ? "1px solid #063C3D"
                          : isDone
                            ? "1px solid #9FC7BA"
                            : "1px solid #DCE5E1",
                        background: isCurrent ? "#063C3D" : isDone ? "#F2F9F6" : "#FFFFFF",
                        color: isCurrent ? "#FFFFFF" : "#172322",
                        fontSize: "12.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {isDone ? `✓ ${s.label}` : s.label}
                    </button>
                  );
                })}
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  style={{
                    padding: "11px 14px",
                    borderRadius: "6px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "18px",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* STEP 1: Owner Login & Agency Profile */}
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
                      1. Create your owner login &amp; firm profile
                    </h2>
                    <p style={{ fontSize: "13px", color: "#526663", margin: 0 }}>
                      Set your sign-in credentials and reserve your agency&apos;s custom PR calculator link.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-contact-name" style={labelStyle}>
                        Your Full Name &amp; Title *
                      </label>
                      <input
                        id="onb-contact-name"
                        type="text"
                        placeholder="e.g. Priya Grewal, RCIC"
                        value={contactFullName}
                        onChange={(e) => setContactFullName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-contact-email" style={labelStyle}>
                        Work Email (Your Login ID) *
                      </label>
                      <input
                        id="onb-contact-email"
                        type="email"
                        placeholder="priya@northstarrcic.ca"
                        value={contactWorkEmail}
                        onChange={(e) => setContactWorkEmail(e.target.value)}
                        style={inputStyle}
                      />
                      {isFreeWebmail && (
                        <div style={{ fontSize: "11.5px", color: "#8A5A10", marginTop: "4px" }}>
                          Personal email ({emailDomain}) is fine for trial signup — we&apos;ll verify your license certificate in Step 2.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-owner-password" style={labelStyle}>
                        Create Account Password *
                      </label>
                      <input
                        id="onb-owner-password"
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-contact-phone" style={labelStyle}>
                        Phone / WhatsApp Intake Number (Optional)
                      </label>
                      <input
                        id="onb-contact-phone"
                        type="tel"
                        placeholder="+1 (416) 555-0190"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-legal-name" style={labelStyle}>
                        Registered Legal Entity Name *
                      </label>
                      <input
                        id="onb-legal-name"
                        type="text"
                        placeholder="e.g. NorthStar Immigration Counsel Inc."
                        value={legalEntityName}
                        onChange={(e) => setLegalEntityName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-trading-name" style={labelStyle}>
                        Public Brand / Trading Name *
                      </label>
                      <input
                        id="onb-trading-name"
                        type="text"
                        placeholder="e.g. NorthStar RCIC"
                        value={tradingName}
                        onChange={(e) => setTradingName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="onb-slug" style={labelStyle}>
                      Your Co-Branded PR Calculator Link *
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "10px 12px",
                          background: "#F4F8F6",
                          border: "1px solid #DCE5E1",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#526663",
                          whiteSpace: "nowrap",
                        }}
                      >
                        thedocumento.com/calculators?agency=
                      </span>
                      <input
                        id="onb-slug"
                        type="text"
                        value={slugEditedManually ? customSlug : effectiveSlug === "your-firm" ? "" : effectiveSlug}
                        placeholder="northstar-rcic"
                        onChange={(e) => {
                          setSlugEditedManually(true);
                          setCustomSlug(e.target.value);
                        }}
                        style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-country" style={labelStyle}>
                        Headquarters Country *
                      </label>
                      <select
                        id="onb-country"
                        value={hqCountry}
                        onChange={(e) => setHqCountry(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="New Zealand">New Zealand</option>
                        <option value="Germany">Germany</option>
                        <option value="India">India</option>
                        <option value="United Arab Emirates">United Arab Emirates</option>
                        <option value="United States">United States</option>
                        <option value="Singapore">Singapore</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="onb-city" style={labelStyle}>
                        Primary Office City *
                      </label>
                      <input
                        id="onb-city"
                        type="text"
                        placeholder="e.g. Vancouver / Melbourne / Chandigarh"
                        value={hqCity}
                        onChange={(e) => setHqCity(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-booking-url" style={labelStyle}>
                        Consultation Booking URL (Optional)
                      </label>
                      <input
                        id="onb-booking-url"
                        type="url"
                        placeholder="https://calendly.com/your-firm"
                        value={consultationBookingUrl}
                        onChange={(e) => setConsultationBookingUrl(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "13.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Continue to License &amp; Proof →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Real-Life Practice Licensing & Document Upload */}
              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
                      2. Practice licensing &amp; verification proof
                    </h2>
                    <p style={{ fontSize: "13px", color: "#526663", margin: 0 }}>
                      We verify every partner firm so applicants know their PR scorecards and documents go to a legitimate practice.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                      {
                        id: "regulated_counsel" as KybTrack,
                        title: "Licensed Lawyer or Regulated Consultant",
                        desc: "CICC (RCIC), OMARA (MARN), UK IAA/SRA Solicitor, NZ IAA Adviser, or Bar Attorney.",
                      },
                      {
                        id: "overseas_consultancy" as KybTrack,
                        title: "Visa, Study Abroad & Mobility Agency",
                        desc: "Registered consultancy (CIN/GSTIN, UAE DED, Companies House, ICEF) handling study/work visas or working with co-counsel.",
                      },
                    ].map((tr) => {
                      const active = kybTrack === tr.id;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => handleTrackSwitch(tr.id)}
                          style={{
                            padding: "14px",
                            borderRadius: "8px",
                            border: active ? "1.5px solid #063C3D" : "1px solid #DCE5E1",
                            background: active ? "#F3FAF7" : "#FFFFFF",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                            {tr.title}
                          </div>
                          <div style={{ fontSize: "12px", color: "#526663", marginTop: "4px", lineHeight: 1.45 }}>
                            {tr.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor="onb-reg-body" style={labelStyle}>
                      Licensing Body or Corporate Register *
                    </label>
                    <select
                      id="onb-reg-body"
                      value={regulatoryBody}
                      onChange={(e) => setRegulatoryBody(e.target.value)}
                      style={inputStyle}
                    >
                      {REGULATORY_BODIES.map((rb) => (
                        <option key={rb.code} value={rb.code}>
                          {rb.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-license-num" style={labelStyle}>
                        Practitioner License / Registration Number *
                      </label>
                      <input
                        id="onb-license-num"
                        type="text"
                        placeholder={activeRegBodyMeta.placeholder}
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-tax" style={labelStyle}>
                        Business Registration / Tax ID *
                      </label>
                      <input
                        id="onb-tax"
                        type="text"
                        placeholder="BN / ABN / GSTIN / Company No. / DED"
                        value={taxRegistrationId}
                        onChange={(e) => setTaxRegistrationId(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {kybTrack === "overseas_consultancy" && (
                    <div>
                      <label htmlFor="onb-cocounsel" style={labelStyle}>
                        Partnered Regulated Co-Counsel (Optional — for direct PR representation)
                      </label>
                      <input
                        id="onb-cocounsel"
                        type="text"
                        placeholder="e.g. Retained co-counsel: RCIC #R531904 / MARN 2117483"
                        value={coCounselDetails}
                        onChange={(e) => setCoCounselDetails(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Real KYB Document Upload Slots */}
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: "1px solid #DCE5E1",
                      background: "#F8FAF9",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                        Upload Verification Proof (Fast-Tracks Approval in &lt; 4 Hours)
                      </div>
                      <div style={{ fontSize: "12px", color: "#526663", marginTop: "2px" }}>
                        Attach PDF, JPG, or PNG copies so our compliance desk can verify ownership of{" "}
                        <strong>{licenseNumber.trim() || "your registration"}</strong>.
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#FFFFFF",
                          border: licenseDoc ? "1px solid #0D6866" : "1px solid #DCE5E1",
                          borderRadius: "6px",
                        }}
                      >
                        <label
                          htmlFor="kyb-file-license"
                          style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}
                        >
                          1. Practicing License / Trade Certificate
                        </label>
                        <input
                          id="kyb-file-license"
                          data-testid="kyb-upload-license-input"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelected("practitioner_license", e)}
                          style={{ fontSize: "11.5px", width: "100%" }}
                        />
                        {licenseDoc && (
                          <div style={{ fontSize: "11.5px", color: "#176B50", fontWeight: 600, marginTop: "6px" }}>
                            ✓ {licenseDoc.fileName} ({licenseDoc.fileSizeKb} KB)
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#FFFFFF",
                          border: regDoc ? "1px solid #0D6866" : "1px solid #DCE5E1",
                          borderRadius: "6px",
                        }}
                      >
                        <label
                          htmlFor="kyb-file-incorporation"
                          style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}
                        >
                          2. Business Registration / GST / BN
                        </label>
                        <input
                          id="kyb-file-incorporation"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelected("business_registration", e)}
                          style={{ fontSize: "11.5px", width: "100%" }}
                        />
                        {regDoc && (
                          <div style={{ fontSize: "11.5px", color: "#176B50", fontWeight: 600, marginTop: "6px" }}>
                            ✓ {regDoc.fileName} ({regDoc.fileSizeKb} KB)
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#FFFFFF",
                          border: idDoc ? "1px solid #0D6866" : "1px solid #DCE5E1",
                          borderRadius: "6px",
                        }}
                      >
                        <label
                          htmlFor="kyb-file-id"
                          style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}
                        >
                          3. Principal Bar Card / Photo ID
                        </label>
                        <input
                          id="kyb-file-id"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelected("principal_id", e)}
                          style={{ fontSize: "11.5px", width: "100%" }}
                        />
                        {idDoc && (
                          <div style={{ fontSize: "11.5px", color: "#176B50", fontWeight: 600, marginTop: "6px" }}>
                            ✓ {idDoc.fileName} ({idDoc.fileSizeKb} KB)
                          </div>
                        )}
                      </div>
                    </div>

                    {uploadedDocs.length === 0 && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12.5px",
                          color: "#384A46",
                          cursor: "pointer",
                          marginTop: "2px",
                        }}
                      >
                        <input
                          type="checkbox"
                          data-testid="defer-kyb-docs-checkbox"
                          checked={deferDocsToWorkspace}
                          onChange={(e) => setDeferDocsToWorkspace(e.target.checked)}
                        />
                        <span>
                          I don&apos;t have my certificate PDF on this device — let me start my 14-day trial now and upload it inside my workspace before inviting live clients.
                        </span>
                      </label>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        background: "#FFFFFF",
                        color: "#172322",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "13.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Continue to Visa Programs &amp; Trial →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Visa Corridors, Unlocked Checklists & 14-Day Free Trial */}
              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 4px 0" }}>
                      3. Choose your visa corridors &amp; start your 14-day free trial
                    </h2>
                    <p style={{ fontSize: "13px", color: "#526663", margin: 0 }}>
                      Select the destinations your agency serves — we&apos;ll pre-load their document checklists and points calculators into your workspace.
                    </p>
                  </div>

                  <div>
                    <span style={labelStyle}>Destination Countries Your Firm Serves *</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {SOVEREIGN_CORRIDORS.map((c) => {
                        const checked = targetCorridors.includes(c.code);
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => toggleCorridor(c.code)}
                            style={{
                              padding: "11px 13px",
                              borderRadius: "6px",
                              border: checked ? "1.5px solid #063C3D" : "1px solid #DCE5E1",
                              background: checked ? "#F3FAF7" : "#FFFFFF",
                              color: "#172322",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                              {checked ? "✓ " : "+ "}
                              {c.label}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "4px", lineHeight: 1.35 }}>
                              Unlocks: {c.unlockedChecklists[0]}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label htmlFor="onb-seats" style={labelStyle}>
                        Team Seats Needed
                      </label>
                      <input
                        id="onb-seats"
                        type="number"
                        min={1}
                        max={500}
                        value={requestedSeats}
                        onChange={(e) => setRequestedSeats(Math.max(1, Number(e.target.value) || 1))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-cases" style={labelStyle}>
                        Monthly Client Files (Est.)
                      </label>
                      <input
                        id="onb-cases"
                        type="number"
                        min={1}
                        max={5000}
                        value={estimatedMonthlyCases}
                        onChange={(e) => setEstimatedMonthlyCases(Math.max(1, Number(e.target.value) || 1))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="onb-branches" style={labelStyle}>
                        Office Locations
                      </label>
                      <input
                        id="onb-branches"
                        type="number"
                        min={1}
                        max={100}
                        value={branchCount}
                        onChange={(e) => setBranchCount(Math.max(1, Number(e.target.value) || 1))}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                      <span style={labelStyle}>Preferred Plan After Your Free 14-Day Trial ($0 Due Today)</span>
                      <span style={{ fontSize: "11.5px", color: "#0D6866", fontWeight: 650 }}>
                        Change or cancel anytime
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {(["boutique", "growth", "enterprise", "pilot_14d"] as AgencyPlanTier[]).map((tierKey) => {
                        const sp = AGENCY_PLAN_SPECS[tierKey];
                        const active = selectedPlanTier === tierKey;
                        return (
                          <button
                            key={tierKey}
                            type="button"
                            onClick={() => setSelectedPlanTier(tierKey)}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "8px",
                              border: active ? "1.5px solid #063C3D" : "1px solid #DCE5E1",
                              background: active ? "#F3FAF7" : "#FFFFFF",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                                {sp.label}
                              </span>
                              <span style={{ fontSize: "13px", fontWeight: 750, color: "#0D6866" }}>
                                {sp.priceLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#445451", marginTop: "5px" }}>
                              Up to <strong>{sp.seatLimit} staff seats</strong> ·{" "}
                              <strong>{sp.monthlyCaseQuota} active cases</strong> ·{" "}
                              <strong>{sp.monthlyAiExtractions.toLocaleString()} AI checks/mo</strong>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "13px 15px",
                      borderRadius: "8px",
                      background: "#F8FAF9",
                      border: "1px solid #DCE5E1",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        fontSize: "13px",
                        color: "#172322",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={partnerTermsAccepted}
                        onChange={(e) => setPartnerTermsAccepted(e.target.checked)}
                        style={{ marginTop: "3px" }}
                      />
                      <span>
                        <strong>Partner Terms &amp; Client Data Privacy Agreement:</strong> I confirm I am authorized to register{" "}
                        <strong>{tradingName.trim() || "our practice"}</strong>, and I understand that all client passports, bank statements, and case files remain strictly private to our firm and are never used to train external AI models.
                      </span>
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "1px solid #BDCDC7",
                        background: "#FFFFFF",
                        color: "#172322",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      data-testid="submit-agency-kyb-btn"
                      style={{
                        padding: "11px 22px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#063C3D",
                        color: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: submitting ? "wait" : "pointer",
                        opacity: submitting ? 0.75 : 1,
                      }}
                    >
                      {submitting
                        ? "Creating Your Workspace..."
                        : "Create Agency Workspace & Start 14-Day Trial →"}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Right Sticky Practical Summary: What Your Firm Unlocks */}
            <aside
              style={{
                position: "sticky",
                top: "84px",
                background: "#FFFFFF",
                border: "1px solid #BDCDC7",
                borderRadius: "10px",
                padding: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #E5ECE9",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                  Your Agency Workspace Summary
                </span>
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 650,
                    color: "#0D6866",
                    background: "#EAF6F0",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  $0 Due Today
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "11px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ color: "#5C6E6A" }}>Brand Name</span>
                  <strong style={{ color: "#172322", textAlign: "right" }}>
                    {tradingName.trim() || "—"}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ color: "#5C6E6A" }}>Owner Sign-In</span>
                  <strong style={{ color: "#172322", textAlign: "right" }}>
                    {contactWorkEmail.trim() || "—"}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ color: "#5C6E6A" }}>License / Registration</span>
                  <strong style={{ color: "#172322", textAlign: "right" }}>
                    {regulatoryBody} {licenseNumber.trim() ? `· ${licenseNumber.trim()}` : "· Pending"}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ color: "#5C6E6A" }}>Verification Proof</span>
                  <strong style={{ color: uploadedDocs.length > 0 ? "#176B50" : "#5C6E6A" }}>
                    {uploadedDocs.length > 0
                      ? `${uploadedDocs.length} file(s) attached`
                      : deferDocsToWorkspace
                        ? "Upload in workspace"
                        : "Not uploaded yet"}
                  </strong>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    marginTop: "4px",
                  }}
                >
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0D6866", marginBottom: "4px" }}>
                    CO-BRANDED LEAD INTAKE LINK
                  </div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 650,
                      color: "#063C3D",
                      wordBreak: "break-all",
                    }}
                  >
                    thedocumento.com/calculators?agency={effectiveSlug}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "4px" }}>
                    Share on your website, Instagram, or WhatsApp — prospects calculate their PR points and send their full breakdown straight to your team.
                  </div>
                </div>

                {/* Tangible Checklists Unlocked for Selected Countries */}
                <div
                  style={{
                    paddingTop: "12px",
                    borderTop: "1px solid #E5ECE9",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "8px" }}>
                    Included Visa Checklists ({targetCorridors.join(", ")})
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "16px",
                      fontSize: "12px",
                      color: "#445451",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    {SOVEREIGN_CORRIDORS.filter((c) => targetCorridors.includes(c.code))
                      .flatMap((c) => c.unlockedChecklists.slice(0, 2))
                      .slice(0, 6)
                      .map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                  </ul>
                </div>

                <div
                  style={{
                    paddingTop: "12px",
                    borderTop: "1px solid #E5ECE9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", color: "#5C6E6A" }}>Due Today (14-Day Trial)</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                      Then {activePlanSpec.label} ({activePlanSpec.priceLabel})
                    </div>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 750, color: "#0D6866" }}>
                    $0.00
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
