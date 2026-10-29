import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.models import (
    ImmigrationCase,
    ClientProfile,
    VisaAppointment,
)
from backend.app.core.errors import EntityNotFoundError
from backend.app.security.auth import AuthContext, get_auth_context, require_permission

router = APIRouter(prefix="/appointments", tags=["appointments"])


# --- Schemas ---

class VisaAppointmentCreateRequest(BaseModel):
    case_id: uuid.UUID
    vac_center: str = Field(..., min_length=2, max_length=120)
    consular_post: str = Field(..., min_length=2, max_length=120)
    ofc_biometrics_slot: Optional[datetime] = None
    consular_interview_slot: Optional[datetime] = None
    dropbox_eligible: bool = False
    tracking_number_blue_dart: Optional[str] = None
    courier_status: str = Field(default="pending_pickup", max_length=64)
    status_221g: bool = False
    status_221g_color: Optional[str] = Field(default=None, max_length=32)
    appointment_status: str = Field(default="scheduled", max_length=32)
    notes: Optional[str] = None


class VisaAppointmentUpdateRequest(BaseModel):
    vac_center: Optional[str] = None
    consular_post: Optional[str] = None
    ofc_biometrics_slot: Optional[datetime] = None
    consular_interview_slot: Optional[datetime] = None
    dropbox_eligible: Optional[bool] = None
    tracking_number_blue_dart: Optional[str] = None
    courier_status: Optional[str] = None
    status_221g: Optional[bool] = None
    status_221g_color: Optional[str] = None
    appointment_status: Optional[str] = None
    notes: Optional[str] = None


class VisaAppointmentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    case_id: uuid.UUID
    client_id: uuid.UUID
    case_number: Optional[str] = None
    client_name: Optional[str] = None
    visa_category: Optional[str] = None
    vac_center: str
    consular_post: str
    ofc_biometrics_slot: Optional[datetime] = None
    consular_interview_slot: Optional[datetime] = None
    dropbox_eligible: bool
    tracking_number_blue_dart: Optional[str] = None
    courier_status: str
    status_221g: bool
    status_221g_color: Optional[str] = None
    appointment_status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def _to_response(a: VisaAppointment) -> VisaAppointmentResponse:
    case_number = a.case.case_number if a.case else None
    visa_cat = a.case.visa_category if a.case else None
    client_name = f"{a.client.first_name} {a.client.last_name}" if a.client else None

    return VisaAppointmentResponse(
        id=a.id,
        organization_id=a.organization_id,
        case_id=a.case_id,
        client_id=a.client_id,
        case_number=case_number,
        client_name=client_name,
        visa_category=visa_cat,
        vac_center=a.vac_center,
        consular_post=a.consular_post,
        ofc_biometrics_slot=a.ofc_biometrics_slot,
        consular_interview_slot=a.consular_interview_slot,
        dropbox_eligible=a.dropbox_eligible,
        tracking_number_blue_dart=a.tracking_number_blue_dart,
        courier_status=a.courier_status,
        status_221g=a.status_221g,
        status_221g_color=a.status_221g_color,
        appointment_status=a.appointment_status,
        notes=a.notes,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


# --- Endpoints ---

@router.get("", response_model=list[VisaAppointmentResponse])
def list_organization_appointments(
    case_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
    appointment_status: Optional[str] = None,
    status_221g: Optional[bool] = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Lists all visa biometrics and consular interview appointments across cases
    for the authenticated organization.
    """
    query = (
        db.query(VisaAppointment)
        .filter(VisaAppointment.organization_id == ctx.organization_id)
    )

    if case_id:
        query = query.filter(VisaAppointment.case_id == case_id)
    if client_id:
        query = query.filter(VisaAppointment.client_id == client_id)
    if appointment_status:
        query = query.filter(VisaAppointment.appointment_status == appointment_status)
    if status_221g is not None:
        query = query.filter(VisaAppointment.status_221g == status_221g)

    appointments = query.order_by(VisaAppointment.created_at.desc()).all()
    return [_to_response(a) for a in appointments]


@router.post("", response_model=VisaAppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: VisaAppointmentCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Schedules or logs a new VAC biometrics or Consular interview appointment.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == payload.case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", payload.case_id)
    ctx.assert_organization_access(case.organization_id)

    now = datetime.now(timezone.utc)
    appt = VisaAppointment(
        organization_id=case.organization_id,
        case_id=case.id,
        client_id=case.client_id,
        vac_center=payload.vac_center.strip(),
        consular_post=payload.consular_post.strip(),
        ofc_biometrics_slot=payload.ofc_biometrics_slot,
        consular_interview_slot=payload.consular_interview_slot,
        dropbox_eligible=payload.dropbox_eligible,
        tracking_number_blue_dart=payload.tracking_number_blue_dart.strip() if payload.tracking_number_blue_dart else None,
        courier_status=payload.courier_status,
        status_221g=payload.status_221g,
        status_221g_color=payload.status_221g_color,
        appointment_status=payload.appointment_status,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _to_response(appt)


@router.get("/{appointment_id}", response_model=VisaAppointmentResponse)
def get_appointment(
    appointment_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Retrieves details of a specific visa appointment.
    """
    appt = db.query(VisaAppointment).filter(
        VisaAppointment.id == appointment_id,
        VisaAppointment.organization_id == ctx.organization_id,
    ).first()
    if not appt:
        raise EntityNotFoundError("VisaAppointment", appointment_id)

    return _to_response(appt)


@router.patch("/{appointment_id}", response_model=VisaAppointmentResponse)
def update_appointment(
    appointment_id: uuid.UUID,
    payload: VisaAppointmentUpdateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Updates appointment logistics (VAC, interview slot, Blue Dart courier tracking, or 221(g) slip).
    """
    appt = db.query(VisaAppointment).filter(
        VisaAppointment.id == appointment_id,
        VisaAppointment.organization_id == ctx.organization_id,
    ).first()
    if not appt:
        raise EntityNotFoundError("VisaAppointment", appointment_id)

    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(appt, field, val)

    appt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appt)
    return _to_response(appt)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Deletes or cancels a visa appointment.
    """
    appt = db.query(VisaAppointment).filter(
        VisaAppointment.id == appointment_id,
        VisaAppointment.organization_id == ctx.organization_id,
    ).first()
    if not appt:
        raise EntityNotFoundError("VisaAppointment", appointment_id)

    db.delete(appt)
    db.commit()
    return None


def generate_ics_calendar(appt: VisaAppointment) -> str:
    """Generates standard RFC 5545 iCalendar string for universal calendar integration."""
    now_str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    slot = appt.consular_interview_slot or appt.ofc_biometrics_slot or datetime.now(timezone.utc)
    start_str = slot.strftime("%Y%m%dT%H%M%SZ")
    end_str = (slot + timedelta(hours=1)).strftime("%Y%m%dT%H%M%SZ")

    summary = f"Visa Appointment: {appt.vac_center} - {appt.consular_post}"
    if appt.case and appt.case.case_number:
        summary += f" ({appt.case.case_number})"

    location = f"{appt.vac_center}, {appt.consular_post}"
    desc = f"Visa Appointment Details:\nVAC Center: {appt.vac_center}\nConsular Post: {appt.consular_post}\nStatus: {appt.appointment_status}"
    if appt.notes:
        desc += f"\nInstructions: {appt.notes}"

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Documento Immigration SaaS//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{appt.id}@documento.immigration",
        f"DTSTAMP:{now_str}",
        f"DTSTART:{start_str}",
        f"DTEND:{end_str}",
        f"SUMMARY:{summary}",
        f"LOCATION:{location}",
        f"DESCRIPTION:{desc}",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-PT24H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Visa Appointment Reminder (24h)",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(ics_lines)


@router.get("/{appointment_id}/calendar-invite")
def get_appointment_calendar_invite(
    appointment_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Generates standard RFC 5545 iCalendar (.ics) file.
    Enables one-click import into Google Calendar, Microsoft Outlook, and Apple Calendar.
    """
    appt = db.query(VisaAppointment).filter(
        VisaAppointment.id == appointment_id,
        VisaAppointment.organization_id == ctx.organization_id,
    ).first()
    if not appt:
        raise EntityNotFoundError("VisaAppointment", appointment_id)

    ics_text = generate_ics_calendar(appt)
    return Response(
        content=ics_text,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=visa_appointment_{appt.id}.ics",
        },
    )

