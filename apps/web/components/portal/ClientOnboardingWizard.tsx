"use client";

import React, { useState, useEffect } from "react";
import {
  ClientProfileData,
  ClientQuestionnaireItem,
} from "../../lib/types";
import {
  fetchClientProfile,
  fetchQuestionnaires,
  saveQuestionnaire,
} from "../../lib/api";

interface ClientOnboardingWizardProps {
  onComplete?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function ClientOnboardingWizard({
  onComplete,
  onClose,
  isModal = false,
}: ClientOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Step 1: Consents
  const [consents, setConsents] = useState({
    representation_g28: true,
    data_processing_gdpr: true,
    communication_consent: true,
    electronic_signatures: true,
  });

  // Step 2: Applicant Biodata
  const [profile, setProfile] = useState<Partial<ClientProfileData>>({
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.rostova@stanford.edu",
    phone: "+1 (650) 723-2300",
    date_of_birth: "1988-04-12",
    nationality: "UKR",
    passport_verified: true,
  });
  const [passportNumber, setPassportNumber] = useState("FG891244");

  // Step 3: Dependants
  const [dependants, setDependants] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    relationship_type: string;
    email?: string;
    phone?: string;
    nationality: string;
    is_authorized_to_view_case: boolean;
  }>>([
    {
      id: "dep-01",
      first_name: "Oleksiy",
      last_name: "Rostov",
      relationship_type: "spouse",
      email: "oleksiy.rostov@techcorp.com",
      phone: "+1 (650) 555-0199",
      nationality: "UKR",
      is_authorized_to_view_case: true,
    },
  ]);

  const [newDepFirstName, setNewDepFirstName] = useState("");
  const [newDepLastName, setNewDepLastName] = useState("");
  const [newDepRel, setNewDepRel] = useState("child");
  const [newDepEmail, setNewDepEmail] = useState("");
  const [newDepNationality, setNewDepNationality] = useState("UKR");
  const [newDepAuth, setNewDepAuth] = useState(false);
  const [showAddDepForm, setShowAddDepForm] = useState(false);

  // Step 4: Questionnaire
  const [questionnaire, setQuestionnaire] = useState<ClientQuestionnaireItem | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({
    current_employer: "Stanford University School of Medicine",
    job_title: "Senior Research Scientist in Computational Genomics",
    field_of_expertise: "Machine Learning applied to Cancer Genomics",
    total_articles_count: 14,
    google_scholar_link: "https://scholar.google.com/citations?user=sample_rostova",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const prof = await fetchClientProfile();
      if (prof) {
        setProfile(prof);
        if (prof.dependants && prof.dependants.length > 0) {
          setDependants(prof.dependants);
        }
      }
      const qList = await fetchQuestionnaires();
      if (qList && qList.length > 0) {
        setQuestionnaire(qList[0]);
        if (qList[0].responses) {
          setResponses(qList[0].responses);
        }
      }
    } catch (err) {
      console.error("Failed to load onboarding data:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleAddDependant(e: React.FormEvent) {
    e.preventDefault();
    if (!newDepFirstName.trim() || !newDepLastName.trim()) return;

    const newDep = {
      id: `dep-${Date.now()}`,
      first_name: newDepFirstName.trim(),
      last_name: newDepLastName.trim(),
      relationship_type: newDepRel,
      email: newDepEmail.trim() || undefined,
      nationality: newDepNationality.trim() || "USA",
      is_authorized_to_view_case: newDepAuth,
    };

    setDependants([...dependants, newDep]);
    setNewDepFirstName("");
    setNewDepLastName("");
    setNewDepEmail("");
    setNewDepAuth(false);
    setShowAddDepForm(false);
  }

  function handleRemoveDependant(id: string) {
    setDependants(dependants.filter((d) => d.id !== id));
  }

  function handleToggleDependantAuth(id: string) {
    setDependants(
      dependants.map((d) =>
        d.id === id ? { ...d, is_authorized_to_view_case: !d.is_authorized_to_view_case } : d
      )
    );
  }

  async function handleFinalSubmit() {
    setSaving(true);
    try {
      if (questionnaire) {
        await saveQuestionnaire(questionnaire.id, responses, true);
      }
      setSubmitted(true);
      if (onComplete) {
        setTimeout(onComplete, 2000);
      }
    } catch (err) {
      console.error("Failed to submit onboarding:", err);
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { number: 1, label: "Consents & Privacy" },
    { number: 2, label: "Applicant Biodata" },
    { number: 3, label: "Family & Dependants" },
    { number: 4, label: "Intake Questionnaire" },
    { number: 5, label: "Review & Submit" },
  ];

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto mb-4 text-emerald-600">
          <svg width="32" height="32" className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Onboarding Completed Successfully!
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Your profile, statutory consents, family authorizations, and evidentiary intake responses have been securely transmitted to your legal team. Your case dashboard is now active.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              if (onClose) onClose();
              if (onComplete) onComplete();
            }}
            className="px-6 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            Go to Transparency Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden ${
        isModal ? "w-full max-w-3xl max-h-[90vh]" : "w-full"
      }`}
    >
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Client Portal Onboarding & Intake
          </h2>
          <p className="text-xs text-slate-500">
            Secure client account activation, legal consents, family authorization, and statutory questionnaire
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close onboarding modal"
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
          >
            ×
          </button>
        )}
      </div>

      {/* Stepper Navigation */}
      <div
        role="tablist"
        aria-label="Onboarding intake steps"
        className="px-6 py-3 border-b border-slate-200 bg-slate-100/40 overflow-x-auto"
      >
        <div className="flex items-center justify-between min-w-[550px]">
          {steps.map((step) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;

            return (
              <button
                key={step.number}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCurrentStep(step.number)}
                className="flex items-center gap-2 group focus:outline-none"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-300"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isCompleted ? "✓" : step.number}
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isActive
                      ? "text-indigo-600"
                      : isCompleted
                      ? "text-slate-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {step.number < steps.length && (
                  <div className="w-8 h-0.5 bg-slate-200 mx-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizard Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* STEP 1: Consents & Privacy */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
              <h4 className="font-bold text-xs text-blue-900 mb-1">
                Legal Notice & Representation Disclosures
              </h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                Before commencing casework, professional ethics and federal immigration regulations require informed consent regarding legal representation, data storage, and electronic communication.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={consents.representation_g28}
                  onChange={(e) => setConsents({ ...consents, representation_g28: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Form G-28 Notice of Entry of Appearance & Legal Representation
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    I authorize Sarah Jenkins, Esq. and the retaining law firm to represent my petition before the United States Citizenship and Immigration Services (USCIS) and Department of Homeland Security (DHS).
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={consents.data_processing_gdpr}
                  onChange={(e) => setConsents({ ...consents, data_processing_gdpr: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Data Processing, Privacy & Cryptographic Verification Consent
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    I consent to the secure storage of my biometric, identity, and evidentiary records under 256-bit AES encryption with immutable SHA-256 integrity verification.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={consents.communication_consent}
                  onChange={(e) => setConsents({ ...consents, communication_consent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Electronic Notice & Portal Communication Agreement
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    I agree to receive case status updates, document requests, and filings through this authenticated client portal. Sensitive PII is automatically redacted in push notification previews.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={consents.electronic_signatures}
                  onChange={(e) => setConsents({ ...consents, electronic_signatures: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    US E-SIGN Act & Uniform Electronic Transactions Agreement
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    I agree that electronic signatures applied to questionnaire submissions and petition intake exhibits have the same legal validity as handwritten wet signatures.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: Applicant Biodata */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal First Name (Given Name)
                </label>
                <input
                  type="text"
                  value={profile.first_name || ""}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Last Name (Surname)
                </label>
                <input
                  type="text"
                  value={profile.last_name || ""}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Email Address
                </label>
                <input
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Telephone (SMS Notifications)
                </label>
                <input
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={profile.date_of_birth ? profile.date_of_birth.substring(0, 10) : ""}
                  onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nationality / Country of Citizenship (ISO-3)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={profile.nationality || "USA"}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value.toUpperCase() })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 uppercase font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Passport Number (Cryptographically Hashed & Salted)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono"
                  />
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold">
                    <span>🔒</span> Verified
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Matches biometric passport scan (doc-01). Passport numbers are stored as one-way salted hashes to prevent data leaks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Family & Dependants */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex items-start justify-between">
              <div>
                <h4 className="font-bold text-xs text-purple-900 mb-1">
                  Authorized Family Dependants (I-140 / I-485 Derivative Applicants)
                </h4>
                <p className="text-xs text-purple-800 leading-relaxed max-w-xl">
                  Add spouses and children who will accompany your petition. Explicitly toggle whether each family member is authorized to access case records and receive independent portal credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDepForm(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm whitespace-nowrap ml-3"
              >
                + Add Dependant
              </button>
            </div>

            {/* Dependant List */}
            <div className="space-y-2">
              {dependants.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {dep.first_name} {dep.last_name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {dep.relationship_type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({dep.nationality})
                      </span>
                    </div>
                    {dep.email && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{dep.email}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dep.is_authorized_to_view_case}
                        onChange={() => handleToggleDependantAuth(dep.id)}
                        className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span
                        className={
                          dep.is_authorized_to_view_case
                            ? "text-indigo-600"
                            : "text-slate-400"
                        }
                      >
                        Authorized to View Case
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveDependant(dep.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold p-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Dependant Form */}
            {showAddDepForm && (
              <form
                onSubmit={handleAddDependant}
                className="p-4 rounded-xl border border-dashed border-purple-300 bg-purple-50/40 space-y-3"
              >
                <div className="font-semibold text-xs text-purple-900">
                  New Family Member Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="First Name"
                    value={newDepFirstName}
                    onChange={(e) => setNewDepFirstName(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Last Name"
                    value={newDepLastName}
                    onChange={(e) => setNewDepLastName(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                  <select
                    value={newDepRel}
                    onChange={(e) => setNewDepRel(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                    <option value="dependant">Other Dependant</option>
                  </select>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newDepEmail}
                    onChange={(e) => setNewDepEmail(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDepAuth}
                      onChange={(e) => setNewDepAuth(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Grant independent case portal viewing access</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddDepForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                    >
                      Save Dependant
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP 4: Guided Questionnaire */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <h4 className="font-bold text-xs text-amber-900 mb-1">
                Statutory Criteria & Extraordinary Ability Intake
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Provide accurate career achievements. Responses are directly referenced by legal counsel during Form I-140 petition drafting and Kazarian evidentiary synthesis.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Employer or Institutional Affiliation *
                </label>
                <input
                  type="text"
                  value={responses.current_employer || ""}
                  onChange={(e) => setResponses({ ...responses, current_employer: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Professional Title *
                </label>
                <input
                  type="text"
                  value={responses.job_title || ""}
                  onChange={(e) => setResponses({ ...responses, job_title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Field of Extraordinary Ability *
                </label>
                <input
                  type="text"
                  value={responses.field_of_expertise || ""}
                  onChange={(e) => setResponses({ ...responses, field_of_expertise: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Peer-Reviewed Articles Published
                  </label>
                  <input
                    type="number"
                    value={responses.total_articles_count || 0}
                    onChange={(e) => setResponses({ ...responses, total_articles_count: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Scholar / Scopus Profile URL
                  </label>
                  <input
                    type="url"
                    value={responses.google_scholar_link || ""}
                    onChange={(e) => setResponses({ ...responses, google_scholar_link: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Submit */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs text-slate-900">
                Onboarding Summary Verification
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Principal Applicant</span>
                  <span className="font-semibold text-slate-800">
                    {profile.first_name} {profile.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Nationality</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {profile.nationality} (Passport Verified)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Authorized Dependants</span>
                  <span className="font-semibold text-slate-800">
                    {dependants.length} family member(s)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Statutory Consents</span>
                  <span className="font-semibold text-emerald-600">
                    4 of 4 Signed Electronically
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900">
                  Profile & Intake Completeness Score
                </span>
                <span className="text-xs font-bold text-indigo-600">
                  92% Ready
                </span>
              </div>
              <div className="w-full bg-indigo-200/50 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: "92%" }}
                />
              </div>
              <p className="text-[11px] text-indigo-700 mt-2">
                Once submitted, your case manager will review your biographical answers and initiate the formal EB-1A evidence gathering phase.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <button
          type="button"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep(currentStep - 1)}
          className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200/60:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center gap-3">
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                fontWeight: 650,
                fontSize: "12px",
                padding: "8px 18px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
              }}
            >
              Continue to Step {currentStep + 1} →
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinalSubmit}
              style={{
                background: "#176B50",
                color: "#FFFFFF",
                fontWeight: 650,
                fontSize: "12px",
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(23, 107, 80, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {saving ? (
                <span>Submitting Onboarding...</span>
              ) : (
                <>
                  <span>Complete Onboarding &amp; Activate Portal</span>
                  <svg width="16" height="16" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
