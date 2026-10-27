import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VisaAppointmentDesk } from "../components/cases/VisaAppointmentDesk";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { ImmigrationCase, ClientProfile, VisaAppointment } from "../lib/types";
import * as apiModule from "../lib/api";

const mockCases: ImmigrationCase[] = [
  {
    id: "case-01",
    case_number: "CASE-US-8841",
    title: "EB-1A Alien of Extraordinary Ability",
    client_name: "Dr. Elena Rostova",
    client_id: "client-01",
    visa_category: "EB-1A",
    status: "intake",
    jurisdiction: "United States (USCIS / DOS)",
    assigned_manager: "Sarah Jenkins, Esq.",
    organization_id: "org-01",
    created_at: "2026-08-10T10:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
  },
  {
    id: "case-ca-01",
    case_number: "CASE-CA-1002",
    title: "Post-Secondary Study Permit (SDS Stream)",
    client_name: "Aarav Sharma",
    client_id: "client-ca-01",
    visa_category: "Canada Study Permit",
    status: "review",
    jurisdiction: "Canada (IRCC)",
    assigned_manager: "Sarah Jenkins, Esq.",
    organization_id: "org-01",
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-23T10:00:00Z",
  },
];

const mockClients: ClientProfile[] = [
  {
    id: "client-01",
    organization_id: "org-01",
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.rostova@example.com",
    nationality: "Russian",
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "client-ca-01",
    organization_id: "org-01",
    first_name: "Aarav",
    last_name: "Sharma",
    email: "aarav.sharma@example.com",
    nationality: "Indian",
    created_at: "2026-10-20T10:00:00Z",
  },
];

const mockAppointments: VisaAppointment[] = [
  {
    id: "appt-test-1",
    organization_id: "org-01",
    case_id: "case-01",
    client_id: "client-01",
    case_number: "CASE-US-8841",
    client_name: "Dr. Elena Rostova",
    visa_category: "EB-1A",
    vac_center: "Mumbai VAC (Bandra Kurla Complex)",
    consular_post: "U.S. Consulate General Mumbai",
    ofc_biometrics_slot: "2026-11-15T09:30:00Z",
    consular_interview_slot: "2026-11-17T10:15:00Z",
    dropbox_eligible: false,
    tracking_number_blue_dart: "BD-9988214IN",
    courier_status: "in_transit",
    status_221g: false,
    status_221g_color: null,
    appointment_status: "scheduled",
    notes: "OFC slot confirmed.",
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
  },
  {
    id: "appt-test-2",
    organization_id: "org-01",
    case_id: "case-01",
    client_id: "client-01",
    case_number: "CASE-US-8841",
    client_name: "Dr. Elena Rostova",
    visa_category: "EB-1A",
    vac_center: "Chennai VAC",
    consular_post: "U.S. Consulate General Chennai",
    ofc_biometrics_slot: null,
    consular_interview_slot: "2026-10-05T08:30:00Z",
    dropbox_eligible: false,
    tracking_number_blue_dart: "BD-7711204IN",
    courier_status: "delivered_to_consulate",
    status_221g: true,
    status_221g_color: "pink",
    appointment_status: "administrative_processing_221g",
    notes: "221(g) Pink Slip: Provide detailed employer research curriculum & itinerary.",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-06T10:00:00Z",
  },
];

describe("VisaAppointmentDesk Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the appointment hub with metrics bar and appointments table", async () => {
    vi.spyOn(apiModule.api, "getVisaAppointments").mockResolvedValue({
      data: mockAppointments,
      isLiveBackend: true,
    });

    render(
      <VisaAppointmentDesk
        cases={mockCases}
        clients={mockClients}
        userRole="case_manager"
      />
    );

    // Verify appointment rows appear
    await waitFor(() => {
      expect(screen.getByText("Mumbai VAC (Bandra Kurla Complex)")).toBeDefined();
      expect(screen.getByText("Chennai VAC")).toBeDefined();
    });

    // Check 221(g) slip badge
    expect(screen.getByText("⚠️ 221(g) Slip")).toBeDefined();
    expect(screen.getByText("pink")).toBeDefined();

    // Check Courier info
    expect(screen.getByText("BD-9988214IN")).toBeDefined();
  });

  it("filters appointments by status correctly", async () => {
    vi.spyOn(apiModule.api, "getVisaAppointments").mockResolvedValue({
      data: mockAppointments,
      isLiveBackend: true,
    });

    render(
      <VisaAppointmentDesk
        cases={mockCases}
        clients={mockClients}
        userRole="case_manager"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mumbai VAC (Bandra Kurla Complex)")).toBeDefined();
    });

    // Select status filter "221g"
    const statusSelect = screen.getByDisplayValue("All Statuses");
    fireEvent.change(statusSelect, { target: { value: "221g" } });

    // Mumbai is scheduled, Chennai is 221g
    await waitFor(() => {
      expect(screen.queryByText("Mumbai VAC (Bandra Kurla Complex)")).toBeNull();
      expect(screen.getByText("Chennai VAC")).toBeDefined();
    });
  });

  it("opens the Schedule Appointment modal and submits new appointment", async () => {
    vi.spyOn(apiModule.api, "getVisaAppointments").mockResolvedValue({
      data: mockAppointments,
      isLiveBackend: true,
    });
    const createSpy = vi.spyOn(apiModule.api, "createVisaAppointment").mockResolvedValue({
      data: {
        id: "appt-new",
        organization_id: "org-01",
        case_id: "case-01",
        client_id: "client-01",
        case_number: "CASE-US-8841",
        client_name: "Dr. Elena Rostova",
        visa_category: "EB-1A",
        vac_center: "New Delhi VAC",
        consular_post: "U.S. Embassy New Delhi",
        dropbox_eligible: false,
        courier_status: "pending_pickup",
        status_221g: false,
        appointment_status: "scheduled",
        created_at: "2026-10-23T10:00:00Z",
        updated_at: "2026-10-23T10:00:00Z",
      },
      isLiveBackend: true,
    });

    render(
      <VisaAppointmentDesk
        cases={mockCases}
        clients={mockClients}
        userRole="case_manager"
      />
    );

    // Click "Schedule Visa Appointment" button
    const scheduleBtn = screen.getByRole("button", { name: /Schedule Visa Appointment/i });
    fireEvent.click(scheduleBtn);

    // Modal title should appear
    expect(screen.getByText("Schedule Visa Appointment & Biometrics")).toBeDefined();

    // Fill courier AWB
    const awbInput = screen.getByPlaceholderText(/e\.g\. BD-8899112233IN/i);
    fireEvent.change(awbInput, { target: { value: "BD-11223344IN" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Save & Confirm Schedule/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });
  });

  it("opens 221(g) Administrative Processing Desk modal and updates slip details", async () => {
    vi.spyOn(apiModule.api, "getVisaAppointments").mockResolvedValue({
      data: mockAppointments,
      isLiveBackend: true,
    });
    const updateSpy = vi.spyOn(apiModule.api, "updateVisaAppointment").mockResolvedValue({
      data: {
        ...mockAppointments[0],
        status_221g: true,
        status_221g_color: "yellow",
        notes: "Submit updated I-129S and tax transcripts.",
      },
      isLiveBackend: true,
    });

    render(
      <VisaAppointmentDesk
        cases={mockCases}
        clients={mockClients}
        userRole="case_manager"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mumbai VAC (Bandra Kurla Complex)")).toBeDefined();
    });

    // Click "+ Flag 221(g)" button on Mumbai appointment
    const flagBtn = screen.getByRole("button", { name: /\+ Flag 221\(g\)/i });
    fireEvent.click(flagBtn);

    // Modal opens
    expect(screen.getByText("⚠️ 221(g) Administrative Processing Desk")).toBeDefined();

    // Fill evidence notes
    const evidenceInput = screen.getByPlaceholderText(/List the specific documents requested by the officer/i);
    fireEvent.change(evidenceInput, { target: { value: "Submit updated I-129S and tax transcripts." } });

    // Save
    const save221gBtn = screen.getByRole("button", { name: /Save 221\(g\) Hold/i });
    fireEvent.click(save221gBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        "appt-test-1",
        expect.objectContaining({
          status_221g: true,
        })
      );
    });
  });
});

describe("ClientPortal Visa Appointments Integration", () => {
  it("displays live scheduled visa appointment and 221(g) alert banner in ClientPortal", async () => {
    vi.spyOn(apiModule.api, "getVisaAppointments").mockResolvedValue({
      data: [
        {
          id: "appt-client-view",
          organization_id: "org-01",
          case_id: "case-01",
          client_id: "client-01",
          case_number: "CASE-US-8841",
          client_name: "Dr. Elena Rostova",
          visa_category: "EB-1A",
          vac_center: "Mumbai VAC (Bandra Kurla Complex)",
          consular_post: "U.S. Consulate General Mumbai",
          ofc_biometrics_slot: "2026-11-20T08:30:00Z",
          consular_interview_slot: "2026-11-22T09:15:00Z",
          appointment_status: "administrative_processing_221g",
          dropbox_eligible: false,
          courier_status: "in_transit",
          tracking_number_blue_dart: "BLD-773344",
          status_221g: true,
          status_221g_color: "pink",
          notes: "Provide certified translated publications dossier.",
          created_at: "2026-10-20T10:00:00Z",
          updated_at: "2026-10-20T10:00:00Z",
        },
      ],
      isLiveBackend: true,
    });

    render(
      <ClientPortal
        myCase={mockCases[0]}
        documents={[]}
        messages={[]}
        notifications={[]}
        invoices={[]}
        onOpenUploadModal={vi.fn()}
        onOpenQuestionnaireModal={vi.fn()}
        onSendMessage={vi.fn()}
        onMarkNotificationRead={vi.fn()}
      />
    );

    // Wait for appointment to render
    await waitFor(() => {
      expect(screen.getByText(/Mumbai VAC/)).toBeDefined();
    });

    // Check 221(g) slip badge
    expect(screen.getByText(/221\(g\) PINK SLIP/i)).toBeDefined();

    // Check 221(g) action notice
    expect(screen.getByText(/Provide certified translated publications dossier\./)).toBeDefined();

    // Check Courier info
    expect(screen.getByText(/BLD-773344/)).toBeDefined();
  });
});
