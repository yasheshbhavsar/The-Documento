import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { TextInput, SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { ClientProfile, ImmigrationCase, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientProfile[];
  onCaseCreated: (newCase: ImmigrationCase) => void;
  activeRole?: RoleCode;
}

export function CreateCaseModal({
  isOpen,
  onClose,
  clients,
  onCaseCreated,
  activeRole = "master_admin",
}: CreateCaseModalProps) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("CASE-8850");
  const [jurisdiction, setJurisdiction] = useState("United States (USCIS)");
  const [visaCategory, setVisaCategory] = useState("EB-1A Extraordinary Ability");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setCaseNumber(`CASE-${Math.floor(1000 + Math.random() * 9000)}`);
      if (!clientId && clients.length > 0) {
        setClientId(clients[0].id);
      }
    }
  }, [isOpen, clients, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a petition case title.");
      return;
    }
    if (!clientId) {
      setError("Please select a retained client.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.createCase(
        {
          client_id: clientId,
          title,
          case_number: caseNumber,
          jurisdiction,
          visa_category: visaCategory,
        },
        activeRole
      );
      onCaseCreated(res.data);
      onClose();
      // Reset form
      setTitle("");
      setCaseNumber(`CASE-${Date.now().toString().slice(-4)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create case.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientOptions = clients.map((c) => ({
    label: `${c.first_name} ${c.last_name} (${c.email})`,
    value: c.id,
  }));

  const jurisdictionOptions = [
    { label: "United States (USCIS)", value: "United States (USCIS)" },
    { label: "Canada (IRCC)", value: "Canada (IRCC)" },
    { label: "United Kingdom (Home Office)", value: "United Kingdom (Home Office)" },
    { label: "Australia (Department of Home Affairs)", value: "Australia (Home Affairs)" },
  ];

  const pathwayOptions = [
    { label: "EB-1A Alien of Extraordinary Ability", value: "EB-1A Extraordinary Ability" },
    { label: "O-1A Nonimmigrant Alien of Extraordinary Ability", value: "O-1A Extraordinary Ability" },
    { label: "EB-2 National Interest Waiver (NIW)", value: "EB-2 NIW" },
    { label: "L-1A Intracompany Transferee Executive", value: "L-1A Intracompany Transferee" },
    { label: "H-1B Specialty Occupation", value: "H-1B Specialty Occupation" },
    { label: "UK Global Talent Visa", value: "Global Talent Tech Nation" },
    { label: "Canada Express Entry PNP", value: "Express Entry PNP" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Immigration Case"
      subtitle="Establish a new case record with client linkage, jurisdiction, and pathway rules."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Create Case Record
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

        <SelectInput
          label="Retained Client"
          options={clientOptions.length > 0 ? clientOptions : [{ label: "No clients registered yet", value: "" }]}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
        />

        <TextInput
          label="Petition Case Title"
          placeholder="e.g. EB-1A Petition: Dr. Elena Rostova"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <TextInput
          label="Unique Case Reference Number"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          helperText="Unique identifier scoped to this firm tenant"
          required
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <SelectInput
            label="Immigration Jurisdiction"
            options={jurisdictionOptions}
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            required
          />

          <SelectInput
            label="Pathway / Visa Category"
            options={pathwayOptions}
            value={visaCategory}
            onChange={(e) => setVisaCategory(e.target.value)}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
