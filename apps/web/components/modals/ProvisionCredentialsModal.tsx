import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { TextInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { ClientProfile, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";

interface ProvisionCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile | null;
  onCredentialsUpdated: (updatedClient: ClientProfile) => void;
  activeRole?: RoleCode;
}

export function ProvisionCredentialsModal({
  isOpen,
  onClose,
  client,
  onCredentialsUpdated,
  activeRole = "master_admin",
}: ProvisionCredentialsModalProps) {
  const [password, setPassword] = useState("ClientPass2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [allowLogin, setAllowLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setPassword(client.portal_temporary_password || "DocAccess2026!");
      setAllowLogin(client.portal_access_enabled !== false);
      setCopiedNotice(false);
      setError(null);
    }
  }, [client]);

  if (!client) return null;

  const issuerTitle = activeRole === "master_admin" ? "Owner (Managing Partner)" : "Lead Paralegal";

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 6; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(`Client2026!${gen}`);
  };

  const handleCopyCredentials = () => {
    const textToCopy = `Documento Portal Credentials\nClient: ${client.first_name} ${client.last_name}\nEmail: ${client.email}\nPortal Password: ${password}\nPortal URL: http://localhost:3000/login\nIssued by: ${issuerTitle}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopiedNotice(true);
          setTimeout(() => setCopiedNotice(false), 3000);
        })
        .catch(() => {
          setCopiedNotice(true);
          setTimeout(() => setCopiedNotice(false), 3000);
        });
    } else {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError("Portal password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.provisionClientCredentials(client.id, password, allowLogin, activeRole);
      onCredentialsUpdated(res.data);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to provision portal credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Provision Client Portal Credentials"
      subtitle={`Manage secure portal login credentials for retained applicant ${client.first_name} ${client.last_name}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save & Issue Credentials
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              background: "#FDF2F2",
              border: "1px solid #F87171",
              borderRadius: "6px",
              color: "#991B1B",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Client Identity Summary */}
        <div
          style={{
            background: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
            padding: "14px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", textTransform: "uppercase", fontWeight: 700 }}>
              Retained Applicant
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
              {client.first_name} {client.last_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", textTransform: "uppercase", fontWeight: 700 }}>
              Authorized Portal Email
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0D6866" }}>
              {client.email}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", textTransform: "uppercase", fontWeight: 700 }}>
              Nationality & Tenancy
            </div>
            <div style={{ fontSize: "12px", color: "#445451" }}>
              {client.nationality} • Org: {client.organization_id}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", textTransform: "uppercase", fontWeight: 700 }}>
              Credentials Status
            </div>
            <Badge variant={client.portal_credentials_provided ? "success" : "warning"} size="sm">
              {client.portal_credentials_provided ? "Credentials Issued" : "Login Blocked"}
            </Badge>
          </div>
        </div>

        {/* Access Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            background: "#F4FAF7",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
              Client Portal Sign-In Authorization
            </div>
            <div style={{ fontSize: "11px", color: "#6E7F7C" }}>
              When enabled, the client can authenticate at the client portal using these credentials.
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 650, color: "#0D6866" }}>
            <input
              type="checkbox"
              checked={allowLogin}
              onChange={(e) => setAllowLogin(e.target.checked)}
            />
            <span>{allowLogin ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        {/* Password Setup */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <TextInput
                label="Client Portal Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password for retained client"
                required
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
                fontSize: "12px",
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
                fontSize: "12px",
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
              Provisioned by: <strong>{issuerTitle}</strong>
            </span>
            <button
              type="button"
              onClick={handleCopyCredentials}
              style={{
                background: "transparent",
                border: "none",
                color: "#0D6866",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textDecoration: "underline",
              }}
            >
              📋 {copiedNotice ? "Copied to Clipboard! ✓" : "Copy Credentials"}
            </button>
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "12px",
            color: "#92400E",
            lineHeight: 1.4,
          }}
        >
          <strong>Security Guarantee:</strong> Retained client credentials can only be granted by the Owner or Lead Paralegal. Until you click &quot;Save &amp; Issue Credentials&quot;, the retained client is blocked from logging in.
        </div>
      </form>
    </Modal>
  );
}
