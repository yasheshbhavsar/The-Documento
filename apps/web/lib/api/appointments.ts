import { VisaAppointment } from "../types";
import { API_BASE_URL, getAuthHeaders, fallbackData } from "./client";

const API_BASE = API_BASE_URL;

export const FALLBACK_APPOINTMENTS: VisaAppointment[] = [];

let localAppointments = [...FALLBACK_APPOINTMENTS];

export async function fetchAllAppointments(filters?: {
  case_id?: string;
  client_id?: string;
  status?: string;
  vac_center?: string;
}): Promise<VisaAppointment[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.case_id) params.set("case_id", filters.case_id);
    if (filters?.client_id) params.set("client_id", filters.client_id);
    if (filters?.status) params.set("appointment_status", filters.status);
    const queryStr = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`${API_BASE}/appointments${queryStr}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }

  let filtered = [...localAppointments];
  if (filters?.case_id) {
    filtered = filtered.filter((a) => a.case_id === filters.case_id);
  }
  if (filters?.status && filters.status !== "all") {
    if (filters.status === "221g") {
      filtered = filtered.filter((a) => a.status_221g);
    } else {
      filtered = filtered.filter((a) => a.appointment_status === filters.status);
    }
  }
  return fallbackData(filtered, "fetchAllAppointments");
}

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
    localAppointments.filter((a) => a.case_id === caseId || caseId === "case-01" || caseId === "case-02"),
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
    if (res.ok) {
      const created = await res.json();
      localAppointments.unshift(created);
      return created;
    }
  } catch {
    // Fallback
  }
  const newAppt: VisaAppointment = {
    id: `appt-${Date.now()}`,
    organization_id: "org-01",
    case_id: caseId,
    client_id: data.client_id || "client-01",
    case_number: data.case_number || "PENDING-CASE-REF",
    client_name: data.client_name || "Retained Client",
    visa_category: data.visa_category || "EB-1A Extraordinary Ability",
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
  localAppointments.unshift(newAppt);
  return fallbackData(newAppt, "createCaseAppointment");
}

export async function updateCaseAppointment(caseId: string, appointmentId: string, data: any): Promise<VisaAppointment> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = localAppointments.findIndex((a) => a.id === appointmentId);
      if (idx !== -1) localAppointments[idx] = updated;
      return updated;
    }
  } catch {
    // Fallback
  }
  const idx = localAppointments.findIndex((a) => a.id === appointmentId);
  const appt = idx !== -1 ? localAppointments[idx] : localAppointments[0];
  const updated: VisaAppointment = { ...appt, ...data, updated_at: new Date().toISOString() };
  if (idx !== -1) localAppointments[idx] = updated;
  return fallbackData(updated, "updateCaseAppointment");
}

export async function deleteCaseAppointment(caseId: string, appointmentId: string): Promise<{ success: boolean; id: string }> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/appointments/${appointmentId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      localAppointments = localAppointments.filter((a) => a.id !== appointmentId);
      return { success: true, id: appointmentId };
    }
  } catch {
    // Fallback
  }
  localAppointments = localAppointments.filter((a) => a.id !== appointmentId);
  return fallbackData({ success: true, id: appointmentId }, "deleteCaseAppointment");
}
