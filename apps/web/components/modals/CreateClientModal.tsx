import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { TextInput, SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { ClientProfile, DuplicateCandidate, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (newClient: ClientProfile) => void;
  activeRole?: RoleCode;
}

export function CreateClientModal({
  isOpen,
  onClose,
  onClientCreated,
  activeRole = "master_admin",
}: CreateClientModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  
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

  // Portal credentials state (Owner / Lead Paralegal provisioned)
  const [grantPortalAccess, setGrantPortalAccess] = useState(true);
  const [portalPassword, setPortalPassword] = useState("ClientPass2026!");
  const [showPassword, setShowPassword] = useState(false);

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

  // Debounced duplicate detection
  useEffect(() => {
    if (!email.trim() && !phone.trim() && !passportNumber.trim()) {
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
  }, [email, phone, passportNumber, firstName, lastName, nationality]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !nationality.trim()) {
      setError("Please fill in all required fields (First Name, Last Name, Email, Nationality).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.createClient(
        {
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || undefined,
          nationality,
          portal_credentials_provided: grantPortalAccess,
          portal_access_enabled: grantPortalAccess,
          temporary_password: grantPortalAccess ? portalPassword : undefined,
        },
        activeRole
      );

      const createdClient = res.data;

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
      onClose();

      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setNationality("");
      setPassportNumber("");
      setIncludeDependant(false);
      setDepFn("");
      setDepLn("");
      setDuplicateMatches([]);
    } catch (err: any) {
      setError(err?.message || "Failed to create client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Retain New Client / Applicant"
      subtitle="Register an organization-specific client profile with duplicate-record detection suggestions."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save Client Record
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <strong style={{ color: "var(--warning, #b45309)" }}>
                Duplicate Record Suggestion ({duplicateMatches.length} match{duplicateMatches.length > 1 ? "es" : ""})
              </strong>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "12px" }}>
          <TextInput
            label="First Name"
            placeholder="e.g. Marcus"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <TextInput
            label="Last Name"
            placeholder="e.g. Thorne"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <TextInput
          label="Email Address"
          type="email"
          placeholder="e.g. marcus@example.com"
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

        {/* Retained Client Portal Credentials Provisioning */}
        <div
          style={{
            padding: "12px 14px",
            background: "#F4FAF7",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D" }}>
              🔑 Client Portal Login Credentials (Owner / Lead Paralegal Provisioned):
            </span>
            <Badge variant={grantPortalAccess ? "success" : "neutral"} size="sm">
              {grantPortalAccess ? "Credentials Active" : "No Access"}
            </Badge>
          </div>

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
                ℹ️ Credentials for the retained client must be provided by the Owner or Lead Paralegal only. Until credentials are set, this client cannot log in or access the portal.
              </span>
            </div>
          )}
        </div>

        {/* Legal Consent Checkboxes */}
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
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>Consent & Representation Records:</span>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hasG28Consent}
              onChange={(e) => setHasG28Consent(e.target.checked)}
            />
            <span>Record Form G-28 Legal Representation Agreement for applicant</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hasPrivacyConsent}
              onChange={(e) => setHasPrivacyConsent(e.target.checked)}
            />
            <span>Record GDPR & Immigration Data Processing Consent</span>
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
      </form>
    </Modal>
  );
}
