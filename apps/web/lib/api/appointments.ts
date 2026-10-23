import { VisaAppointment } from "../types";
import { API_BASE_URL, getAuthHeaders, fallbackData } from "./client";

const API_BASE = API_BASE_URL;

export const FALLBACK_APPOINTMENTS: VisaAppointment[] = [
  {
    id: "appt-01",
    organization_id: "org-01",
    case_id: "case-01",
    client_id: "client-01",
    vac_center: "Mumbai VAC (Bandra Kurla Complex)",
    consular_post: "U.S. Consulate General Mumbai",
    ofc_biometrics_slot: "2026-11-12T09:30:00Z",
    consular_interview_slot: "2026-11-14T10:15:00Z",
    dropbox_eligible: false,
    tracking_number_blue_dart: "BD-884920194IN",
    courier_status: "in_transit",
    status_221g: false,
    status_221g_color: null,
    appointment_status: "scheduled",
    notes: "OFC biometrics appointment confirmed. Biometrics confirmation letter printed.",
    created_at: "2026-10-15T12:00:00Z",
    updated_at: "2026-10-15T12:00:00Z",
  },
  {
    id: "appt-02",
    organization_id: "org-01",
    case_id: "case-02",
    client_id: "client-02",
    vac_center: "New Delhi VAC (Shivaji Stadium)",
    consular_post: "U.S. Embassy New Delhi",
    ofc_biometrics_slot: "2026-11-20T11:00:00Z",
    consular_interview_slot: null,
    dropbox_eligible: true,
    tracking_number_blue_dart: "BD-993810231IN",
    courier_status: "ready_for_pickup",
    status_221g: false,
    status_221g_color: null,
    appointment_status: "scheduled",
    notes: "Interview Waiver / Dropbox eligible for F-1 renewal under 48-month statutory rule.",
    created_at: "2026-10-16T14:00:00Z",
    updated_at: "2026-10-16T14:00:00Z",
  },
];

export async function fetchCaseAppointments(caseId: string): Promise<VisaAppointment[]> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/appointments`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(
    FALLBACK_APPOINTMENTS.filter((a) => a.case_id === caseId || caseId === "case-01" || caseId === "case-02"),
    "fetchCaseAppointments"
  );
}

export async function createCaseAppointment(caseId: string, data: any): Promise<VisaAppointment> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/appointments`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  const newAppt: VisaAppointment = {
    id: `appt-${Date.now()}`,
    organization_id: "org-01",
    case_id: caseId,
    client_id: data.client_id || "client-01",
    vac_center: data.vac_center || "Mumbai VAC",
    consular_post: data.consular_post || "U.S. Consulate Mumbai",
    ofc_biometrics_slot: data.ofc_biometrics_slot || null,
    consular_interview_slot: data.consular_interview_slot || null,
    dropbox_eligible: !!data.dropbox_eligible,
    tracking_number_blue_dart: data.tracking_number_blue_dart || null,
    courier_status: data.courier_status || "pending_pickup",
    status_221g: !!data.status_221g,
    status_221g_color: data.status_221g_color || null,
    appointment_status: data.appointment_status || "scheduled",
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return fallbackData(newAppt, "createCaseAppointment");
}

export async function updateCaseAppointment(caseId: string, appointmentId: string, data: any): Promise<VisaAppointment> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  const appt = FALLBACK_APPOINTMENTS.find((a) => a.id === appointmentId) || FALLBACK_APPOINTMENTS[0];
  const updated = { ...appt, ...data, updated_at: new Date().toISOString() };
  return fallbackData(updated, "updateCaseAppointment");
}
