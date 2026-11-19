import React, { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { TextInput, SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { ClientProfile, ImmigrationCase, RoleCode, TeamMemberCapacity, UserContext } from "../../lib/types";
import { api } from "../../lib/api";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientProfile[];
  teamCapacity?: TeamMemberCapacity[];
  currentUser?: UserContext | null;
  onCaseCreated: (newCase: ImmigrationCase) => void;
  activeRole?: RoleCode;
}

export const JURISDICTION_OPTIONS = [
  { label: "United States (USCIS)", value: "United States (USCIS)" },
  { label: "Canada (IRCC)", value: "Canada (IRCC)" },
  { label: "United Kingdom (Home Office)", value: "United Kingdom (Home Office)" },
  { label: "Australia (Department of Home Affairs)", value: "Australia (Home Affairs)" },
  { label: "Germany (Federal Foreign Office / BAMF)", value: "Germany (BAMF)" },
];

export const JURISDICTION_PATHWAYS: Record<string, { label: string; value: string }[]> = {
  "United States (USCIS)": [
    { label: "US F-1 Academic Student Visa (I-20 & SEVIS)", value: "US F-1 Academic Student" },
    { label: "US B-1/B-2 Visitor Visa (INA § 214(b) Consular Prep)", value: "US B-1/B-2 Visitor Visa" },
    { label: "H-1B Specialty Occupation & Consular Stamping", value: "H-1B Specialty Occupation" },
    { label: "US H-4 Dependent Visa & EAD", value: "US H-4 Dependent" },
    { label: "EB-1A Alien of Extraordinary Ability", value: "EB-1A Extraordinary Ability" },
  ],
  "Canada (IRCC)": [
    { label: "Canada Study Permit (SDS & PAL Stream)", value: "Canada Study Permit" },
    { label: "Canada Visitor Visa (TRV & Super Visa)", value: "Canada Visitor Visa (TRV)" },
    { label: "Canada Spousal Open Work Permit (SOWP)", value: "Canada Spousal Open Work Permit (SOWP)" },
    { label: "Canada Express Entry PNP", value: "Express Entry PNP" },
    { label: "Canada Super Visa (Parents & Grandparents)", value: "Canada Super Visa (Parents & Grandparents)" },
  ],
  "United Kingdom (Home Office)": [
    { label: "UK Standard Visitor Visa (Tourism & Family)", value: "UK Standard Visitor Visa" },
    { label: "UK Student Visa (CAS & Graduate Route)", value: "UK Student Visa" },
    { label: "UK Skilled Worker Visa", value: "UK Skilled Worker Visa" },
    { label: "UK Global Talent Visa", value: "Global Talent Tech Nation" },
    { label: "UK Standard Visitor (Family Sponsored)", value: "UK Standard Visitor (Family Sponsored)" },
  ],
  "Australia (Home Affairs)": [
    { label: "Australia Visitor Visa (Subclass 600)", value: "Australia Visitor Visa (Subclass 600)" },
    { label: "Australia Student Visa (Subclass 500)", value: "Australia Student Visa (Subclass 500)" },
    { label: "Australia Global Talent Independent", value: "Australia Global Talent" },
    { label: "Australia Visitor Visa (Subclass 600 Sponsored)", value: "Australia Visitor Visa (Subclass 600 Sponsored)" },
  ],
  "Germany (BAMF)": [
    { label: "Germany Opportunity Card (Chancenkarte)", value: "Germany Opportunity Card (Chancenkarte)" },
  ],
};

const EMPTY_CAPACITY: TeamMemberCapacity[] = [];

export function CreateCaseModal({
  isOpen,
  onClose,
  clients,
  teamCapacity,
  currentUser,
  onCaseCreated,
  activeRole = "master_admin",
}: CreateCaseModalProps) {
  const ws = useWorkspaceSafe();
  const effectiveTeam = teamCapacity ?? ws?.capacity ?? EMPTY_CAPACITY;
  const effectiveUser = currentUser ?? ws?.currentUser ?? null;

  const caseworkerRoster = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; role?: string }>();
    for (const tm of effectiveTeam) {
      if (tm.name) {
        map.set(tm.name.trim().toLowerCase(), { id: tm.id, name: tm.name.trim(), role: tm.role });
      }
    }
    if (effectiveUser?.full_name && !map.has(effectiveUser.full_name.trim().toLowerCase())) {
      map.set(effectiveUser.full_name.trim().toLowerCase(), {
        id: effectiveUser.id,
        name: effectiveUser.full_name.trim(),
        role: effectiveUser.role === "master_admin" ? "Managing Partner" : "Case Manager",
      });
    }
    return Array.from(map.values());
  }, [effectiveTeam, effectiveUser?.full_name, effectiveUser?.id, effectiveUser?.role]);

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("CASE-8850");
  const [jurisdiction, setJurisdiction] = useState("United States (USCIS)");
  const [visaCategory, setVisaCategory] = useState("EB-1A Extraordinary Ability");
  const [assignedCaseworker, setAssignedCaseworker] = useState(effectiveUser?.full_name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setCaseNumber(`CASE-${Math.floor(1000 + Math.random() * 9000)}`);
      const nextClient = clients[0] || null;
      setClientId((prev) =>
        clients.some((c) => c.id === prev) ? prev : nextClient?.id || ""
      );
      setAssignedCaseworker(
        nextClient?.assigned_caseworker || effectiveUser?.full_name || caseworkerRoster[0]?.name || ""
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (clients.length === 0) {
      setClientId("");
    } else if (!clients.some((c) => c.id === clientId)) {
      setClientId(clients[0].id);
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
      const matchedWorker = caseworkerRoster.find((m) => m.name === assignedCaseworker);
      const res = await api.createCase(
        {
          client_id: clientId,
          title,
          case_number: caseNumber,
          jurisdiction,
          visa_category: visaCategory,
          assigned_manager: assignedCaseworker || undefined,
          case_manager_id: matchedWorker?.id,
        },
        activeRole
      );
      onCaseCreated(res.data);
      onClose();
      // Reset form
      setTitle("");
      setCaseNumber(`CASE-${Date.now().toString().slice(-4)}`);
      setJurisdiction("United States (USCIS)");
      setVisaCategory("EB-1A Extraordinary Ability");
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

  const handleJurisdictionChange = (newJur: string) => {
    setJurisdiction(newJur);
    const pathways = JURISDICTION_PATHWAYS[newJur] || [];
    if (pathways.length > 0) {
      setVisaCategory(pathways[0].value);
    }
  };

  const pathwayOptions = JURISDICTION_PATHWAYS[jurisdiction] || [
    { label: "EB-1A Alien of Extraordinary Ability", value: "EB-1A Extraordinary Ability" },
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

        {clients.length === 0 && (
          <div
            style={{
              padding: "12px 14px",
              background: "#FEF3C7",
              color: "#92400E",
              borderRadius: "8px",
              fontSize: "13px",
              lineHeight: 1.4,
              border: "1px solid #FDE68A",
            }}
          >
            <strong>Initial Setup (Day 0):</strong> No retained clients are registered in the firm directory yet. Please click <strong>&quot;+ Retain Client&quot;</strong> first to create your client profile before opening a case record.
          </div>
        )}

        <SelectInput
          label="Retained Client"
          options={clientOptions.length > 0 ? clientOptions : [{ label: "No clients registered yet — Retain Client first", value: "" }]}
          value={clientId}
          onChange={(e) => {
            const nextId = e.target.value;
            setClientId(nextId);
            const selected = clients.find((c) => c.id === nextId);
            if (selected?.assigned_caseworker) {
              setAssignedCaseworker(selected.assigned_caseworker);
            }
          }}
          required
        />

        <TextInput
          label="Petition Case Title"
          placeholder="e.g. EB-1A Petition — Primary Applicant"
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "12px" }}>
          <SelectInput
            label="Immigration Jurisdiction"
            options={JURISDICTION_OPTIONS}
            value={jurisdiction}
            onChange={(e) => handleJurisdictionChange(e.target.value)}
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

        <SelectInput
          label="Assigned Caseworker"
          options={[
            { label: "Unassigned (Assign later)", value: "" },
            ...caseworkerRoster.map((m) => ({
              label: m.role ? `${m.name} (${m.role})` : m.name,
              value: m.name,
            })),
          ]}
          value={assignedCaseworker}
          onChange={(e) => setAssignedCaseworker(e.target.value)}
        />
      </form>
    </Modal>
  );
}
