"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ImmigrationCase, ClientProfile, VisaAppointment } from "../../lib/types";
import { api, fetchAllAppointments } from "../../lib/api";

interface VisaAppointmentDeskProps {
  cases: ImmigrationCase[];
  clients: ClientProfile[];
  initialCaseId?: string;
  userRole?: string;
  onAppointmentUpdated?: (appt: VisaAppointment) => void;
  onClose?: () => void;
}

export function VisaAppointmentDesk({
  cases,
  clients,
  initialCaseId,
  userRole = "case_manager",
  onAppointmentUpdated,
  onClose,
}: VisaAppointmentDeskProps) {
  const [appointments, setAppointments] = useState<VisaAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<string>(initialCaseId || "all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(false);

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<VisaAppointment | null>(null);
  const [is221gModalOpen, setIs221gModalOpen] = useState(false);
  const [selectedApptFor221g, setSelectedApptFor221g] = useState<VisaAppointment | null>(null);

  // Form State for Scheduling
  const [formCaseId, setFormCaseId] = useState<string>(initialCaseId || cases[0]?.id || "case-01");
  const [formVacCenter, setFormVacCenter] = useState("Mumbai VAC (Bandra Kurla Complex)");
  const [formConsularPost, setFormConsularPost] = useState("U.S. Consulate General Mumbai");
  const [formOfcSlot, setFormOfcSlot] = useState("");
  const [formConsularSlot, setFormConsularSlot] = useState("");
  const [formDropboxEligible, setFormDropboxEligible] = useState(false);
  const [formBlueDartAwb, setFormBlueDartAwb] = useState("");
  const [formCourierStatus, setFormCourierStatus] = useState("pending_pickup");
  const [formStatus221g, setFormStatus221g] = useState(false);
  const [formStatus221gColor, setFormStatus221gColor] = useState("white");
  const [formStatus, setFormStatus] = useState("scheduled");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load Appointments on Mount
  useEffect(() => {
    loadAppointments();
  }, [selectedCaseFilter, statusFilter]);

  async function loadAppointments() {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (selectedCaseFilter !== "all") filters.case_id = selectedCaseFilter;
      if (statusFilter !== "all") filters.status = statusFilter;
      const res = await api.getVisaAppointments(filters);
      const appts = Array.isArray(res) ? res : res?.data || [];
      setAppointments(appts);
      setIsLive(!!(res as any)?.isLiveBackend);
    } catch {
      const fallback = await fetchAllAppointments({
        case_id: selectedCaseFilter !== "all" ? selectedCaseFilter : undefined,
        status: statusFilter,
      });
      setAppointments(fallback || []);
    } finally {
      setIsLoading(false);
    }
  }

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return (appointments || []).filter((appt) => {
      // Case filter
      if (selectedCaseFilter !== "all" && appt.case_id !== selectedCaseFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "221g" && !appt.status_221g) return false;
        if (statusFilter !== "221g" && appt.appointment_status !== statusFilter) return false;
      }
      // Provider filter
      if (providerFilter !== "all") {
        const text = `${appt.vac_center} ${appt.consular_post}`.toLowerCase();
        if (providerFilter === "us_consulate" && !text.includes("u.s.") && !text.includes("us ") && !text.includes("embassy")) return false;
        if (providerFilter === "vfs" && !text.includes("vfs")) return false;
        if (providerFilter === "bls" && !text.includes("bls")) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          appt.vac_center.toLowerCase().includes(q) ||
          appt.consular_post.toLowerCase().includes(q) ||
          (appt.case_number && appt.case_number.toLowerCase().includes(q)) ||
          (appt.client_name && appt.client_name.toLowerCase().includes(q)) ||
          (appt.tracking_number_blue_dart && appt.tracking_number_blue_dart.toLowerCase().includes(q)) ||
          (appt.notes && appt.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [appointments, selectedCaseFilter, statusFilter, providerFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = appointments.length;
    const scheduled = appointments.filter((a) => a.appointment_status === "scheduled").length;
    const hold221g = appointments.filter((a) => a.status_221g).length;
    const dropbox = appointments.filter((a) => a.dropbox_eligible).length;
    const inTransit = appointments.filter(
      (a) => a.courier_status === "in_transit" || a.courier_status === "delivered_to_consulate"
    ).length;

    // Upcoming in next 7 days
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingNext7Days = appointments.filter((a) => {
      if (a.appointment_status !== "scheduled") return false;
      const slot = a.ofc_biometrics_slot || a.consular_interview_slot;
      if (!slot) return false;
      const d = new Date(slot);
      return d >= now && d <= in7Days;
    }).length;

    return { total, scheduled, hold221g, dropbox, inTransit, upcomingNext7Days };
  }, [appointments]);

  // Handlers
  function openCreateModal() {
    setEditingAppointment(null);
    setFormCaseId(selectedCaseFilter !== "all" ? selectedCaseFilter : cases[0]?.id || "case-01");
    setFormVacCenter("Mumbai VAC (Bandra Kurla Complex)");
    setFormConsularPost("U.S. Consulate General Mumbai");
    setFormOfcSlot("");
    setFormConsularSlot("");
    setFormDropboxEligible(false);
    setFormBlueDartAwb("");
    setFormCourierStatus("pending_pickup");
    setFormStatus221g(false);
    setFormStatus221gColor("white");
    setFormStatus("scheduled");
    setFormNotes("");
    setIsScheduleModalOpen(true);
  }

  function openEditModal(appt: VisaAppointment) {
    setEditingAppointment(appt);
    setFormCaseId(appt.case_id);
    setFormVacCenter(appt.vac_center);
    setFormConsularPost(appt.consular_post);
    setFormOfcSlot(appt.ofc_biometrics_slot ? appt.ofc_biometrics_slot.slice(0, 16) : "");
    setFormConsularSlot(appt.consular_interview_slot ? appt.consular_interview_slot.slice(0, 16) : "");
    setFormDropboxEligible(appt.dropbox_eligible);
    setFormBlueDartAwb(appt.tracking_number_blue_dart || "");
    setFormCourierStatus(appt.courier_status || "pending_pickup");
    setFormStatus221g(appt.status_221g);
    setFormStatus221gColor(appt.status_221g_color || "white");
    setFormStatus(appt.appointment_status);
    setFormNotes(appt.notes || "");
    setIsScheduleModalOpen(true);
  }

  function open221gModal(appt: VisaAppointment) {
    setSelectedApptFor221g(appt);
    setFormStatus221g(true);
    setFormStatus221gColor(appt.status_221g_color || "pink");
    setFormNotes(appt.notes || "");
    setIs221gModalOpen(true);
  }

  async function handleSaveAppointment(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackNotice(null);

    const linkedCase = cases.find((c) => c.id === formCaseId);
    const linkedClient = clients.find((cl) => cl.id === linkedCase?.client_id);

    const payload: Partial<VisaAppointment> = {
      case_id: formCaseId,
      client_id: linkedCase?.client_id || "client-01",
      case_number: linkedCase?.case_number || "CASE-01",
      client_name: linkedClient
        ? `${linkedClient.first_name} ${linkedClient.last_name}`
        : linkedCase?.client_name || "Applicant",
      visa_category: linkedCase?.visa_category || "Visa Petition",
      vac_center: formVacCenter.trim(),
      consular_post: formConsularPost.trim(),
      ofc_biometrics_slot: formOfcSlot ? new Date(formOfcSlot).toISOString() : null,
      consular_interview_slot: formConsularSlot ? new Date(formConsularSlot).toISOString() : null,
      dropbox_eligible: formDropboxEligible,
      tracking_number_blue_dart: formBlueDartAwb.trim() || null,
      courier_status: formCourierStatus as any,
      status_221g: formStatus221g,
      status_221g_color: formStatus221g ? formStatus221gColor : null,
      appointment_status: formStatus as any,
      notes: formNotes.trim() || null,
    };

    try {
      if (editingAppointment) {
        const res = await api.updateVisaAppointment(editingAppointment.id, payload);
        setAppointments((prev) => prev.map((a) => (a.id === editingAppointment.id ? res.data : a)));
        onAppointmentUpdated?.(res.data);
        setFeedbackNotice({ text: "Appointment logistics updated successfully.", type: "success" });
      } else {
        const res = await api.createVisaAppointment(payload);
        setAppointments((prev) => [res.data, ...prev]);
        onAppointmentUpdated?.(res.data);
        setFeedbackNotice({ text: "Visa appointment scheduled successfully.", type: "success" });
      }
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      setFeedbackNotice({ text: err?.message || "Failed to save appointment.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickStatusUpdate(appt: VisaAppointment, newStatus: string) {
    try {
      const res = await api.updateVisaAppointment(appt.id, {
        appointment_status: newStatus as any,
      });
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? res.data : a)));
      onAppointmentUpdated?.(res.data);
    } catch (err) {
      console.error("Error updating appointment status:", err);
    }
  }

  async function handleSave221gHold(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApptFor221g) return;
    setIsSubmitting(true);
    try {
      const res = await api.updateVisaAppointment(selectedApptFor221g.id, {
        status_221g: formStatus221g,
        status_221g_color: formStatus221g ? formStatus221gColor : null,
        appointment_status: formStatus221g ? "administrative_processing_221g" : "scheduled",
        notes: formNotes.trim() || selectedApptFor221g.notes,
      });
      setAppointments((prev) => prev.map((a) => (a.id === selectedApptFor221g.id ? res.data : a)));
      onAppointmentUpdated?.(res.data);
      setIs221gModalOpen(false);
      setFeedbackNotice({ text: "221(g) Administrative Processing status updated.", type: "success" });
    } catch (err: any) {
      alert(`Error updating 221(g) status: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAppointment(appt: VisaAppointment) {
    const confirmMsg = `Cancel and remove appointment at "${appt.vac_center}" for Case #${appt.case_number || appt.case_id}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteVisaAppointment(appt.id, appt.case_id);
      setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      setFeedbackNotice({ text: "Appointment cancelled and removed.", type: "success" });
    } catch (err: any) {
      alert(`Failed to cancel appointment: ${err.message}`);
    }
  }

  function formatDateTime(dtStr?: string | null) {
    if (!dtStr) return "Not Required / Not Scheduled";
    const d = new Date(dtStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div
      data-testid="visa-appointment-desk"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: "inherit",
      }}
    >
      {/* Feedback Banner */}
      {feedbackNotice && (
        <div
          role="alert"
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            background: feedbackNotice.type === "success" ? "#EAF6F0" : "#FEF2F2",
            color: feedbackNotice.type === "success" ? "#0D6866" : "#991B1B",
            border: `1px solid ${feedbackNotice.type === "success" ? "#B9DED4" : "#FCA5A5"}`,
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{feedbackNotice.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "16px",
              color: "inherit",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Scheduled Appointments
          </div>
          <div style={{ fontSize: "24px", fontWeight: 750, color: "#063C3D", marginTop: "6px" }}>
            {stats.scheduled}
          </div>
          <div style={{ fontSize: "11px", color: "#0D6866", marginTop: "4px" }}>
            {stats.upcomingNext7Days} upcoming within 7 days
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dropbox / Interview Waivers
          </div>
          <div style={{ fontSize: "24px", fontWeight: 750, color: "#166534", marginTop: "6px" }}>
            {stats.dropbox}
          </div>
          <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
            Exempt from in-person consular interview
          </div>
        </div>

        <div
          style={{
            background: stats.hold221g > 0 ? "#FFF9FA" : "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "12px",
            border: `1px solid ${stats.hold221g > 0 ? "#FCA5A5" : "#DCE5E1"}`,
            boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: stats.hold221g > 0 ? "#991B1B" : "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            221(g) Administrative Processing
          </div>
          <div style={{ fontSize: "24px", fontWeight: 750, color: stats.hold221g > 0 ? "#DC2626" : "#172322", marginTop: "6px" }}>
            {stats.hold221g}
          </div>
          <div style={{ fontSize: "11px", color: stats.hold221g > 0 ? "#991B1B" : "#6E7F7C", marginTop: "4px" }}>
            Active consular slips under evidence response
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Passports in Transit (Blue Dart)
          </div>
          <div style={{ fontSize: "24px", fontWeight: 750, color: "#0369A1", marginTop: "6px" }}>
            {stats.inTransit}
          </div>
          <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
            Active AWB tracking with courier
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          border: "1px solid #DCE5E1",
          boxShadow: "0 4px 16px rgba(6, 60, 61, 0.04)",
          overflow: "hidden",
        }}
      >
        {/* Controls Bar */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #DCE5E1",
            background: "#FAFAF8",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", flex: 1 }}>
            {/* Search */}
            <div style={{ position: "relative", minWidth: "220px", flex: "1 1 240px" }}>
              <input
                type="text"
                placeholder="Search VAC, post, client, or tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ position: "absolute", left: "10px", top: "9px", fontSize: "13px", color: "#6E7F7C" }}>
                🔍
              </span>
            </div>

            {/* Case Filter */}
            <select
              value={selectedCaseFilter}
              onChange={(e) => setSelectedCaseFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "12px",
                fontWeight: 600,
                color: "#172322",
                background: "#FFFFFF",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Cases ({cases.length})</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number}: {c.client_name} ({c.visa_category})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "12px",
                fontWeight: 600,
                color: "#172322",
                background: "#FFFFFF",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed / Attended</option>
              <option value="221g">⚠️ 221(g) Hold</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "12px",
                fontWeight: 600,
                color: "#172322",
                background: "#FFFFFF",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All VAC Providers</option>
              <option value="us_consulate">U.S. Embassy / Consulates (CGI)</option>
              <option value="vfs">VFS Global (Canada / UK / Schengen)</option>
              <option value="bls">BLS International</option>
            </select>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
              color: "#FFFFFF",
              border: "none",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 6px rgba(6, 60, 61, 0.2)",
            }}
          >
            <span>+</span>
            <span>Schedule Visa Appointment</span>
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6E7F7C", fontSize: "13px" }}>
            Loading visa appointments & VAC logistics...
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🏛️</div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#172322" }}>
              No Visa Appointments Found
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C" }}>
              {selectedCaseFilter !== "all"
                ? "No appointments scheduled for this case yet."
                : "No visa interview or biometrics appointments currently match the filters."}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: "#0D6866",
                color: "#FFFFFF",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Log First Appointment
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#F8F7F2", borderBottom: "1px solid #DCE5E1", textAlign: "left" }}>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>Case & Applicant</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>VAC Center & Post</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>OFC Biometrics Slot</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>Consular Interview Slot</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>Status & 221(g)</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451" }}>Courier Tracking (Blue Dart)</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "#445451", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => {
                  const isScheduled = appt.appointment_status === "scheduled";
                  const is221g = appt.status_221g;
                  return (
                    <tr
                      key={appt.id}
                      style={{
                        borderBottom: "1px solid #EAEFEA",
                        background: is221g ? "#FFFDFD" : "#FFFFFF",
                      }}
                    >
                      {/* Case & Applicant */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, color: "#063C3D" }}>
                          {appt.case_number || "US-PETITION"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#172322", marginTop: "2px" }}>
                          {appt.client_name || "Applicant"}
                        </div>
                        <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "2px" }}>
                          {appt.visa_category || "Immigration Visa"}
                        </div>
                      </td>

                      {/* VAC & Post */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 650, color: "#172322" }}>
                          {appt.vac_center}
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                          🏛️ {appt.consular_post}
                        </div>
                        {appt.dropbox_eligible && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: "4px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#EAF6F0",
                              color: "#176B50",
                              border: "1px solid #B9DED4",
                            }}
                          >
                            ✓ Dropbox / Interview Waiver
                          </span>
                        )}
                      </td>

                      {/* OFC Biometrics */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        {appt.ofc_biometrics_slot ? (
                          <div>
                            <div style={{ fontWeight: 650, color: "#063C3D" }}>
                              {formatDateTime(appt.ofc_biometrics_slot)}
                            </div>
                            <span style={{ fontSize: "10px", color: "#0D6866" }}>
                              Biometrics Fingerprinting
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>— None / Waived —</span>
                        )}
                      </td>

                      {/* Consular Interview */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        {appt.consular_interview_slot ? (
                          <div>
                            <div style={{ fontWeight: 650, color: "#063C3D" }}>
                              {formatDateTime(appt.consular_interview_slot)}
                            </div>
                            <span style={{ fontSize: "10px", color: "#0D6866" }}>
                              Consular Officer Interview
                            </span>
                          </div>
                        ) : appt.dropbox_eligible ? (
                          <span style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>
                            Waiver: Drop-box Submission
                          </span>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>— Awaiting Slot —</span>
                        )}
                      </td>

                      {/* Status & 221(g) */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        {is221g ? (
                          <div>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#FEF2F2",
                                color: "#991B1B",
                                border: "1px solid #FCA5A5",
                              }}
                            >
                              <span>⚠️ 221(g) Slip</span>
                              {appt.status_221g_color && (
                                <span
                                  style={{
                                    textTransform: "uppercase",
                                    fontSize: "9px",
                                    padding: "1px 4px",
                                    borderRadius: "3px",
                                    background: "#991B1B",
                                    color: "#FFFFFF",
                                  }}
                                >
                                  {appt.status_221g_color}
                                </span>
                              )}
                            </span>
                            {appt.notes && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#7F1D1D",
                                  marginTop: "4px",
                                  maxWidth: "200px",
                                  lineHeight: 1.25,
                                }}
                              >
                                {appt.notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "capitalize",
                                background: isScheduled ? "#EAF6F0" : "#F3F4F6",
                                color: isScheduled ? "#0D6866" : "#374151",
                                border: `1px solid ${isScheduled ? "#B9DED4" : "#D1D5DB"}`,
                              }}
                            >
                              {appt.appointment_status.replace(/_/g, " ")}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Courier Tracking */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        {appt.tracking_number_blue_dart ? (
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#0369A1" }}>
                              {appt.tracking_number_blue_dart}
                            </div>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "10px",
                                color: "#475569",
                                textTransform: "capitalize",
                                marginTop: "2px",
                              }}
                            >
                              Status: {appt.courier_status.replace(/_/g, " ")}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>Pending AWB assignment</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(appt)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              borderRadius: "6px",
                              border: "1px solid #DCE5E1",
                              background: "#FFFFFF",
                              color: "#063C3D",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Reschedule / Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => open221gModal(appt)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              borderRadius: "6px",
                              border: is221g ? "1px solid #FCA5A5" : "1px solid #E2E8F0",
                              background: is221g ? "#FEF2F2" : "#FAFAFA",
                              color: is221g ? "#991B1B" : "#4B5563",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {is221g ? "Update 221(g)" : "+ Flag 221(g)"}
                          </button>

                          {isScheduled && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(appt, "completed")}
                              style={{
                                padding: "4px 10px",
                                fontSize: "11px",
                                borderRadius: "6px",
                                border: "1px solid #BBF7D0",
                                background: "#F0FDF4",
                                color: "#166534",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              ✓ Mark Attended
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteAppointment(appt)}
                            style={{
                              padding: "2px 6px",
                              fontSize: "10px",
                              background: "none",
                              border: "none",
                              color: "#DC2626",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: SCHEDULE / EDIT APPOINTMENT MODAL
          ========================================================================= */}
      {isScheduleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 60, 61, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
              border: "1px solid #DCE5E1",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #DCE5E1",
                background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  {editingAppointment ? "Reschedule / Edit Visa Appointment" : "Schedule Visa Appointment & Biometrics"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#B9DED4" }}>
                  Record OFC biometrics, Consular interview, Dropbox eligibility, and Blue Dart courier AWB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAppointment} style={{ padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Case Selection */}
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                    Associated Immigration Case *
                  </label>
                  <select
                    value={formCaseId}
                    onChange={(e) => setFormCaseId(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DCE5E1",
                      fontSize: "12px",
                      background: "#FFFFFF",
                      outline: "none",
                    }}
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_number}: {c.client_name} ({c.visa_category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* VAC Center & Quick Selector */}
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                    Visa Application Center (VAC) / Biometrics Center *
                  </label>
                  <input
                    type="text"
                    value={formVacCenter}
                    onChange={(e) => setFormVacCenter(e.target.value)}
                    required
                    placeholder="e.g. Mumbai VAC (BKC)"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DCE5E1",
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                      marginBottom: "6px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      "Mumbai VAC (BKC)",
                      "New Delhi VAC (Shivaji Stadium)",
                      "Chennai VAC",
                      "Hyderabad VAC",
                      "Kolkata VAC",
                      "VFS Global Bangalore",
                      "VFS Ahmedabad VAC",
                    ].map((center) => (
                      <button
                        key={center}
                        type="button"
                        onClick={() => setFormVacCenter(center)}
                        style={{
                          fontSize: "10px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: formVacCenter === center ? "#063C3D" : "#F3F4F6",
                          color: formVacCenter === center ? "#FFFFFF" : "#4B5563",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {center}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Consular Post */}
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                    Consular Post / Embassy Section *
                  </label>
                  <input
                    type="text"
                    value={formConsularPost}
                    onChange={(e) => setFormConsularPost(e.target.value)}
                    required
                    placeholder="e.g. U.S. Consulate General Mumbai"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DCE5E1",
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Slots: OFC & Consular */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      OFC Biometrics Slot Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formOfcSlot}
                      onChange={(e) => setFormOfcSlot(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      Consular Interview Slot Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formConsularSlot}
                      onChange={(e) => setFormConsularSlot(e.target.value)}
                      disabled={formDropboxEligible}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        outline: "none",
                        boxSizing: "border-box",
                        background: formDropboxEligible ? "#F3F4F6" : "#FFFFFF",
                      }}
                    />
                  </div>
                </div>

                {/* Dropbox / Interview Waiver Toggle */}
                <div style={{ padding: "10px 14px", background: "#F8F7F2", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", fontWeight: 600, color: "#172322", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formDropboxEligible}
                      onChange={(e) => {
                        setFormDropboxEligible(e.target.checked);
                        if (e.target.checked) setFormConsularSlot("");
                      }}
                    />
                    <span>Eligible for Interview Waiver / Drop-box (No in-person consular interview required)</span>
                  </label>
                </div>

                {/* Courier / Blue Dart Tracking */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      Blue Dart / Courier AWB Tracking #
                    </label>
                    <input
                      type="text"
                      value={formBlueDartAwb}
                      onChange={(e) => setFormBlueDartAwb(e.target.value)}
                      placeholder="e.g. BD-8899112233IN"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      Courier Dispatch Status
                    </label>
                    <select
                      value={formCourierStatus}
                      onChange={(e) => setFormCourierStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        background: "#FFFFFF",
                        outline: "none",
                      }}
                    >
                      <option value="pending_pickup">Pending Pickup</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered_to_consulate">Delivered to Consulate</option>
                      <option value="ready_for_pickup">Ready for Pickup (VAC)</option>
                      <option value="delivered_to_applicant">Delivered to Applicant</option>
                    </select>
                  </div>
                </div>

                {/* 221(g) Toggle */}
                <div style={{ padding: "12px 14px", background: formStatus221g ? "#FFFDFD" : "#FAFAF8", borderRadius: "8px", border: formStatus221g ? "1px solid #FCA5A5" : "1px solid #DCE5E1" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", fontWeight: 650, color: formStatus221g ? "#991B1B" : "#172322", cursor: "pointer", marginBottom: formStatus221g ? "10px" : 0 }}>
                    <input
                      type="checkbox"
                      checked={formStatus221g}
                      onChange={(e) => {
                        setFormStatus221g(e.target.checked);
                        if (e.target.checked) setFormStatus("administrative_processing_221g");
                      }}
                    />
                    <span>Flag 221(g) Administrative Processing Slip</span>
                  </label>

                  {formStatus221g && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#7F1D1D" }}>Slip Color:</span>
                      {["white", "pink", "blue", "yellow", "green"].map((color) => (
                        <label key={color} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", textTransform: "capitalize", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="slip_color"
                            value={color}
                            checked={formStatus221gColor === color}
                            onChange={(e) => setFormStatus221gColor(e.target.value)}
                          />
                          <span>{color}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status & Notes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      Appointment Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        background: "#FFFFFF",
                        outline: "none",
                      }}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed / Attended</option>
                      <option value="administrative_processing_221g">221(g) Hold</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                      Special Notes / Instructions for Applicant
                    </label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="e.g. Carry original degrees, I-20, SEVIS fee receipt, 2 photos"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        fontSize: "12px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #DCE5E1" }}>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "#F3F4F6",
                    color: "#374151",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    background: "#063C3D",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isSubmitting ? "Saving..." : editingAppointment ? "Update Appointment" : "Save & Confirm Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: 221(g) ADMINISTRATIVE PROCESSING SLIP MODAL
          ========================================================================= */}
      {is221gModalOpen && selectedApptFor221g && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 60, 61, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
              border: "1px solid #FCA5A5",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                background: "#FEF2F2",
                borderBottom: "1px solid #FCA5A5",
                color: "#991B1B",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                  ⚠️ 221(g) Administrative Processing Desk
                </h3>
                <span style={{ fontSize: "11px", color: "#7F1D1D" }}>
                  Case #{selectedApptFor221g.case_number} — {selectedApptFor221g.client_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIs221gModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "18px", color: "#991B1B", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave221gHold} style={{ padding: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "6px" }}>
                    221(g) Slip Color Issued by Consular Officer *
                  </label>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {[
                      { code: "white", label: "White (Complex checks / clearance)" },
                      { code: "pink", label: "Pink (Technology Alert List / STEM CV)" },
                      { code: "blue", label: "Blue (Missing primary documentation)" },
                      { code: "yellow", label: "Yellow (Prior immigration verification)" },
                    ].map((item) => (
                      <label
                        key={item.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: formStatus221gColor === item.code ? "1.5px solid #991B1B" : "1px solid #DCE5E1",
                          background: formStatus221gColor === item.code ? "#FFF5F5" : "#FAFAFA",
                          fontWeight: formStatus221gColor === item.code ? 700 : 500,
                        }}
                      >
                        <input
                          type="radio"
                          name="slip_color_modal"
                          value={item.code}
                          checked={formStatus221gColor === item.code}
                          onChange={(e) => setFormStatus221gColor(e.target.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#172322", marginBottom: "4px" }}>
                    Evidence Requested & Submission Notes *
                  </label>
                  <textarea
                    rows={4}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    required
                    placeholder="List the specific documents requested by the officer (e.g., Detailed 15-year CV, full publication list, complete Form DS-5535, employer support letter)..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DCE5E1",
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ padding: "10px 12px", background: "#FEF2F2", borderRadius: "8px", fontSize: "11px", color: "#991B1B", lineHeight: 1.35 }}>
                  <strong>INA § 221(g) Statutory Note:</strong> The applicant has 12 months from the date of refusal to submit the required evidentiary documents without having to pay a new MRV fee.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setIs221gModalOpen(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "#F3F4F6",
                    color: "#374151",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    background: "#991B1B",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isSubmitting ? "Updating..." : "Save 221(g) Hold"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
