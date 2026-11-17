"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  SPONSOR_UPDATED_EVENT,
  SponsorInviteRecord,
  getSponsorInviteByToken,
  recordSponsorContributionUpload,
  updateSponsorInvitePrivacyShield,
} from "../../lib/sponsorContributorStore";
import { SmartDropzone, SmartIntakeSummary } from "../../components/common/SmartDropzone";

type PortalLang = "en" | "gu" | "hi";

const PORTAL_STRINGS: Record<
  PortalLang,
  {
    badge: string;
    supportingFor: (firstName: string, pathway: string) => string;
    sponsorGreeting: (sponsorName: string, caseNumber: string) => string;
    privacyActiveNotice: string;
    privacyInactiveNotice: string;
    privacyToggleLabel: string;
    checklistTitle: string;
    verifiedTag: string;
    pendingTag: string;
    uploadSectionTitle: string;
    receiptsTitle: string;
    privateCounselBadge: string;
    invalidTokenTitle: string;
    invalidTokenBody: string;
  }
> = {
  en: {
    badge: "Passwordless Sponsor & Family Contributor Portal",
    supportingFor: (firstName, pathway) =>
      `Supporting Documents for ${firstName}'s ${pathway} Application`,
    sponsorGreeting: (sponsorName, caseNumber) =>
      `Requested from ${sponsorName} • Case Reference ${caseNumber}`,
    privacyActiveNotice:
      "🔒 Privacy Shield Active: Your raw CRA NOA, tax slips, and bank statements are encrypted for licensed legal counsel only. Family members see only '✓ Verified'.",
    privacyInactiveNotice:
      "🔓 Privacy Shield Off: Uploaded documents will be visible to both licensed legal counsel and the applicant family.",
    privacyToggleLabel: "Privacy Shield (Counsel-Only Encryption)",
    checklistTitle: "Requested Sponsor & Statutory Evidence",
    verifiedTag: "✓ Verified",
    pendingTag: "Pending",
    uploadSectionTitle: "Upload Single Files or Merged Sponsor Packet",
    receiptsTitle: "Cryptographic Submission Receipts",
    privateCounselBadge: "🔒 Counsel-Only Encrypted",
    invalidTokenTitle: "Sponsor Upload Link Not Found or Expired",
    invalidTokenBody:
      "Please verify the secure contributor link shared by your family member or licensed immigration counsel.",
  },
  gu: {
    badge: "પાસવર્ડ-વગર સ્પોન્સર અને ફેમિલી દસ્તાવેજ પોર્ટલ",
    supportingFor: (firstName, pathway) =>
      `${firstName} ની ${pathway} અરજી માટે આધારભૂત દસ્તાવેજો`,
    sponsorGreeting: (sponsorName, caseNumber) =>
      `સ્પોન્સર: ${sponsorName} • કેસ નંબર ${caseNumber}`,
    privacyActiveNotice:
      "🔒 પ્રાઇવસી શિલ્ડ સક્રિય: તમારા CRA NOA, ટેક્સ સ્લિપ અને બેંક સ્ટેટમેન્ટ માત્ર લાયસન્સ પ્રાપ્ત વકીલ માટે જ એન્ક્રિપ્ટેડ છે. પરિવારના સભ્યોને માત્ર '✓ ચકાસાયેલ' દેખાશે.",
    privacyInactiveNotice:
      "🔓 પ્રાઇવસી શિલ્ડ બંધ: અપલોડ કરેલા દસ્તાવેજો વકીલ અને અરજદાર પરિવાર બંને જોઈ શકશે.",
    privacyToggleLabel: "પ્રાઇવસી શિલ્ડ (માત્ર વકીલ માટે ગોપનીય)",
    checklistTitle: "જરૂરી સ્પોન્સર દસ્તાવેજોની યાદી",
    verifiedTag: "✓ ચકાસાયેલ",
    pendingTag: "બાકી",
    uploadSectionTitle: "દસ્તાવેજો અથવા PDF પેકેટ અપલોડ કરો",
    receiptsTitle: "અપલોડ કરેલા દસ્તાવેજોની રસીદ",
    privateCounselBadge: "🔒 માત્ર વકીલ માટે એન્ક્રિપ્ટેડ",
    invalidTokenTitle: "સ્પોન્સર અપલોડ લિંક મળી નથી",
    invalidTokenBody:
      "કૃપા કરીને તમારા પરિવારના સભ્ય અથવા ઇમિગ્રેશન વકીલ દ્વારા મોકલવામાં આવેલી સુરક્ષિત લિંક તપાસો.",
  },
  hi: {
    badge: "पासवर्ड-रहित स्पॉन्सर एवं परिवार दस्तावेज़ पोर्टल",
    supportingFor: (firstName, pathway) =>
      `${firstName} के ${pathway} आवेदन हेतु सहायक दस्तावेज़`,
    sponsorGreeting: (sponsorName, caseNumber) =>
      `स्पॉन्सर: ${sponsorName} • केस संदर्भ ${caseNumber}`,
    privacyActiveNotice:
      "🔒 प्राइवेसी शील्ड सक्रिय: आपके मूल CRA NOA, टैक्स स्लिप और बैंक स्टेटमेंट केवल लाइसेंस प्राप्त कानूनी वकील के लिए एन्क्रिप्टेड हैं। परिवार के सदस्यों को केवल '✓ सत्यापित' दिखाई देगा।",
    privacyInactiveNotice:
      "🔓 प्राइवेसी शील्ड बंद: अपलोड किए गए दस्तावेज़ वकील और आवेदक परिवार दोनों को दिखाई देंगे।",
    privacyToggleLabel: "प्राइवेसी शील्ड (केवल वकील हेतु गोपनीय)",
    checklistTitle: "अनुरोधित स्पॉन्सर और वैधानिक दस्तावेज़",
    verifiedTag: "✓ सत्यापित",
    pendingTag: "लंबित",
    uploadSectionTitle: "एकल फ़ाइलें या संयुक्त स्पॉन्सर पैकेट अपलोड करें",
    receiptsTitle: "क्रिप्टोग्राफ़िक सबमिशन रसीदें",
    privateCounselBadge: "🔒 केवल वकील हेतु एन्क्रिप्टेड",
    invalidTokenTitle: "स्पॉन्सर अपलोड लिंक नहीं मिला",
    invalidTokenBody:
      "कृपया अपने परिवार के सदस्य या इमिग्रेशन वकील द्वारा साझा किए गए सुरक्षित लिंक की जाँच करें।",
  },
};

function SponsorContributeInner() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<PortalLang>("en");
  const [invite, setInvite] = useState<SponsorInviteRecord | null>(null);
  const [privacyShield, setPrivacyShield] = useState<boolean>(true);
  const [resolvedToken, setResolvedToken] = useState<string>("");

  useEffect(() => {
    const fromHook = searchParams?.get("token") || "";
    const fromWindow =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("token") || ""
        : "";
    const token = fromHook || fromWindow;
    setResolvedToken(token);

    if (token) {
      const record = getSponsorInviteByToken(token);
      if (record) {
        setInvite(record);
        setPrivacyShield(record.privacyShield);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!resolvedToken) return;
    const syncHandler = () => {
      const latest = getSponsorInviteByToken(resolvedToken);
      if (latest) {
        setInvite(latest);
        setPrivacyShield(latest.privacyShield);
      }
    };
    window.addEventListener(SPONSOR_UPDATED_EVENT, syncHandler);
    return () => window.removeEventListener(SPONSOR_UPDATED_EVENT, syncHandler);
  }, [resolvedToken]);

  const copy = PORTAL_STRINGS[lang];

  const handleTogglePrivacy = () => {
    const next = !privacyShield;
    setPrivacyShield(next);
    if (invite) {
      const updated = updateSponsorInvitePrivacyShield(invite.token, next);
      if (updated) setInvite(updated);
    }
  };

  const handleIntakeComplete = (summary: SmartIntakeSummary) => {
    if (!invite) return;
    let latestRecord: SponsorInviteRecord | null = invite;
    for (const doc of summary.documents) {
      latestRecord = recordSponsorContributionUpload(invite.token, {
        subtypeLabel: doc.subtypeLabel,
        category: doc.category,
        verified: true,
        sha256: doc.sha256,
        filename: doc.filename,
        statutoryBadge: doc.statutoryBadges[0],
        extractedSummary: doc.extractedFields,
        isPrivateToFirm: privacyShield,
      });
    }
    if (latestRecord) {
      setInvite(latestRecord);
    }
  };

  const applicantFirstName = invite?.applicantName?.trim().split(/\s+/)[0] || "Applicant";
  const satisfiedCount = invite?.requestedItems.filter((i) => i.satisfied).length || 0;
  const totalCount = invite?.requestedItems.length || 0;

  return (
    <main
      data-testid="sponsor-contribute-page"
      style={{
        minHeight: "100vh",
        backgroundColor: "#F8F7F2",
        color: "#063C3D",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        fontVariantNumeric: "tabular-nums",
        padding: "28px 16px 64px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Top Brand & Trilingual Switcher Bar */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "14px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "7px",
                backgroundColor: "#063C3D",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "15px",
              }}
            >
              D
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                Documento Legal Counsel Vault
              </div>
              <div style={{ fontSize: "11.5px", color: "#526663" }}>{copy.badge}</div>
            </div>
          </div>

          <div
            role="group"
            aria-label="Language selector"
            style={{
              display: "inline-flex",
              gap: "4px",
              padding: "3px",
              backgroundColor: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
            }}
          >
            {(
              [
                { code: "en", label: "English" },
                { code: "gu", label: "ગુજરાતી" },
                { code: "hi", label: "हिन्दी" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.code}
                type="button"
                data-testid={`contribute-lang-${opt.code}`}
                onClick={() => setLang(opt.code)}
                style={{
                  backgroundColor: lang === opt.code ? "#063C3D" : "transparent",
                  color: lang === opt.code ? "#FFFFFF" : "#063C3D",
                  border: "none",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        {!invite ? (
          <section
            data-testid="sponsor-invalid-token-card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "28px 24px",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#063C3D" }}>
              {copy.invalidTokenTitle}
            </h1>
            <p style={{ marginTop: "8px", marginBottom: 0, fontSize: "13.5px", color: "#4B5E5B", lineHeight: 1.5 }}>
              {copy.invalidTokenBody}
            </p>
          </section>
        ) : (
          <>
            {/* Case & Pathway Header Card */}
            <section
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "22px 24px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  backgroundColor: "#EAF6F0",
                  border: "1px solid #C6E7D8",
                  color: "#176B50",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                {invite.jurisdiction === "CA"
                  ? "🇨🇦 Canada IRCC Statutory Verification"
                  : invite.jurisdiction === "UK"
                    ? "🇬🇧 UK Home Office Appendix V Verification"
                    : "🇦🇺 Australia Home Affairs Subclass 600"}
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "21px",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: "#063C3D",
                }}
              >
                {copy.supportingFor(applicantFirstName, invite.pathway)}
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "#4B5E5B" }}>
                {copy.sponsorGreeting(invite.sponsorName, invite.caseNumber)}
              </p>

              {/* Privacy Shield Control Box */}
              <div
                data-testid="privacy-shield-banner"
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  backgroundColor: privacyShield ? "#EAF6F0" : "#F8F7F2",
                  border: privacyShield ? "1px solid #C6E7D8" : "1px solid #DCE5E1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                    {copy.privacyToggleLabel}
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={privacyShield}
                    data-testid="privacy-shield-toggle"
                    onClick={handleTogglePrivacy}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: privacyShield ? "#063C3D" : "#FFFFFF",
                      color: privacyShield ? "#FFFFFF" : "#063C3D",
                      border: "1px solid #063C3D",
                      borderRadius: "999px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <span>{privacyShield ? "ON" : "OFF"}</span>
                  </button>
                </div>

                <div
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.45,
                    color: privacyShield ? "#176B50" : "#4B5E5B",
                    fontWeight: 500,
                  }}
                >
                  {privacyShield ? copy.privacyActiveNotice : copy.privacyInactiveNotice}
                </div>
              </div>
            </section>

            {/* Tailored Sponsor / Sibling Checklist */}
            <section
              data-testid="sponsor-checklist-section"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "20px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "15.5px", fontWeight: 700, color: "#063C3D" }}>
                  {copy.checklistTitle}
                </h2>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: "999px",
                    backgroundColor: satisfiedCount === totalCount && totalCount > 0 ? "#EAF6F0" : "#F8F7F2",
                    color: satisfiedCount === totalCount && totalCount > 0 ? "#176B50" : "#063C3D",
                    border: "1px solid #DCE5E1",
                  }}
                >
                  {satisfiedCount} / {totalCount}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invite.requestedItems.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`sponsor-checklist-item-${item.id}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      backgroundColor: item.satisfied ? "#EAF6F0" : "#F8F7F2",
                      border: item.satisfied ? "1px solid #C6E7D8" : "1px solid #DCE5E1",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#063C3D" }}>
                        {item.satisfied ? "✓ " : "○ "}
                        {item.label}
                      </div>
                      <div style={{ marginTop: "3px", fontSize: "12px", color: "#4B5E5B", lineHeight: 1.4 }}>
                        {item.hint}
                      </div>
                    </div>

                    <span
                      style={{
                        flexShrink: 0,
                        padding: "3px 9px",
                        borderRadius: "999px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        backgroundColor: item.satisfied ? "#FFFFFF" : "transparent",
                        color: item.satisfied ? "#176B50" : "#526663",
                        border: item.satisfied ? "1px solid #C6E7D8" : "1px solid #DCE5E1",
                      }}
                    >
                      {item.satisfied ? copy.verifiedTag : copy.pendingTag}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Embedded Unified SmartDropzone */}
            <section
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "20px 24px",
              }}
            >
              <h2 style={{ margin: "0 0 12px", fontSize: "15.5px", fontWeight: 700, color: "#063C3D" }}>
                {copy.uploadSectionTitle}
              </h2>
              <SmartDropzone
                caseId={invite.caseId}
                clientName={invite.sponsorName}
                pathway={invite.pathway}
                contributorRole="sponsor"
                uploadMode="raw_only"
                sponsorInviteToken={invite.token}
                language={lang}
                privacyShield={privacyShield}
                onIntakeComplete={handleIntakeComplete}
              />
            </section>

            {/* Uploaded Cryptographic Receipts */}
            {invite.uploadedItems.length > 0 && (
              <section
                data-testid="sponsor-uploaded-receipts"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "10px",
                  padding: "20px 24px",
                }}
              >
                <h2 style={{ margin: "0 0 12px", fontSize: "15.5px", fontWeight: 700, color: "#063C3D" }}>
                  {copy.receiptsTitle} ({invite.uploadedItems.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {invite.uploadedItems.map((up) => (
                    <div
                      key={up.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        backgroundColor: "#F8F7F2",
                        border: "1px solid #DCE5E1",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#063C3D" }}>
                          ✓ {up.subtypeLabel}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "2px" }}>
                          {up.filename || "Sponsor_Evidence.pdf"} • SHA-256: {up.sha256.slice(0, 14)}…
                        </div>
                        {up.statutoryBadge && (
                          <div
                            style={{
                              marginTop: "5px",
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              backgroundColor: "#EAF6F0",
                              color: "#176B50",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            {up.statutoryBadge}
                          </div>
                        )}
                      </div>

                      {up.isPrivateToFirm && (
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: "999px",
                            backgroundColor: "#EAF6F0",
                            border: "1px solid #C6E7D8",
                            color: "#176B50",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {copy.privateCounselBadge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function SponsorContributePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            backgroundColor: "#F8F7F2",
            color: "#063C3D",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Loading encrypted sponsor contributor portal…
        </main>
      }
    >
      <SponsorContributeInner />
    </Suspense>
  );
}
