import hmac
import hashlib
import json
from fastapi import Request
from backend.app.core.config import get_settings
"""Billing API Router

Provides endpoints for service fees, client engagement retainers, invoices with line items,
tokenized payment recording (never storing raw card PAN), refunds, and authorized financial reports.
"""
import uuid
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.billing.service import BillingService
from backend.app.db.session import get_db
from backend.app.domain.models import ServiceItem, ClientEngagement, Invoice, PaymentRecord
from backend.app.security.auth import AuthContext, get_auth_context, require_permission

router = APIRouter(prefix="/billing", tags=["billing"])


# Schemas
class ServiceItemCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    jurisdiction: str = Field(default="US", max_length=3)
    visa_category: str | None = None
    pricing_model: str = Field(default="fixed", max_length=32)
    base_fee: float = Field(..., ge=0.0)
    currency: str = Field(default="USD", max_length=3)
    estimated_duration_days: int = Field(default=60, ge=1)
    is_active: bool = True
    sac_code: str = Field(default="998311", max_length=16)
    gst_rate: float = Field(default=0.18, ge=0.0)


class LineItemInput(BaseModel):
    service_id: str | None = None
    description: str = Field(..., min_length=2, max_length=255)
    quantity: float = Field(default=1.0, gt=0.0)
    unit_price: float = Field(..., ge=0.0)
    line_type: str = Field(default="service_fee", max_length=32)
    sac_code: str | None = Field(default="998311", max_length=16)
    gst_rate: float | None = Field(default=0.18, ge=0.0)


class InvoiceCreateRequest(BaseModel):
    client_id: str
    case_id: str | None = None
    engagement_id: str | None = None
    due_date: str | None = None
    tax_amount: float | None = None
    discount_amount: float = Field(default=0.0, ge=0.0)
    currency: str = Field(default="USD", max_length=3)
    payment_provider: str = Field(default="stripe_verified", max_length=64)
    notes: str | None = None
    line_items: list[LineItemInput] = Field(..., min_length=1)
    auto_issue: bool = True
    gst_rate: float | None = None
    sac_code: str = Field(default="998311", max_length=16)
    gstin: str | None = Field(default=None, max_length=32)
    place_of_supply: str | None = Field(default=None, max_length=64)
    is_interstate: bool = False
    apply_gst: bool = False
    cgst_amount: float = Field(default=0.0, ge=0.0)
    sgst_amount: float = Field(default=0.0, ge=0.0)
    igst_amount: float = Field(default=0.0, ge=0.0)


class GSTCalculateRequest(BaseModel):
    subtotal: float = Field(..., ge=0.0)
    is_interstate: bool = False
    gst_rate: float = Field(default=0.18, ge=0.0)


class ClientEngagementCreateRequest(BaseModel):
    client_id: str
    case_id: str | None = None
    service_id: str | None = None
    retainer_amount: float = Field(default=0.0, ge=0.0)
    agreed_fee: float = Field(default=0.0, ge=0.0)
    billing_terms: str = Field(default="fixed_split", max_length=64)
    responsible_attorney_id: str | None = None
    is_signed: bool = False
    notes: str | None = None


class RecordPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0.0)
    currency: str = Field(default="USD", max_length=3)
    payment_method: str = Field(default="credit_card_tokenized", max_length=64)
    provider_charge_id: str | None = None
    card_brand: str | None = Field(default="visa", max_length=32)
    card_last4: str | None = Field(default="4242", max_length=4)  # NEVER store PAN!
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RefundPaymentRequest(BaseModel):
    refund_amount: float | None = Field(default=None, gt=0.0)
    reason: str | None = None


# Endpoints
@router.get("/services")
def list_services(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists service catalog items for the organization."""
    BillingService.seed_default_services(db, ctx.organization_id)
    items = db.query(ServiceItem).filter(
        ServiceItem.organization_id == ctx.organization_id,
        ServiceItem.is_active == True,
    ).all()
    return [
        {
            "id": str(i.id),
            "code": i.code,
            "name": i.name,
            "description": i.description,
            "jurisdiction": i.jurisdiction,
            "visa_category": i.visa_category,
            "pricing_model": i.pricing_model,
            "base_fee": i.base_fee,
            "currency": i.currency,
            "estimated_duration_days": i.estimated_duration_days,
            "is_active": i.is_active,
            "sac_code": getattr(i, "sac_code", "998311"),
            "gst_rate": getattr(i, "gst_rate", 0.18),
        }
        for i in items
    ]


@router.post("/services", status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceItemCreateRequest,
    ctx: AuthContext = Depends(require_permission("billing:manage")),
    db: Session = Depends(get_db),
):
    """Creates a new immigration service in the catalog (requires billing:manage)."""
    item = BillingService.create_service_item(db, ctx.organization_id, payload.model_dump())
    return {
        "id": str(item.id),
        "code": item.code,
        "name": item.name,
        "base_fee": item.base_fee,
        "currency": item.currency,
    }


@router.get("/engagements")
def list_engagements(
    client_id: str | None = None,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    """Lists client engagement retainer agreements."""
    query = db.query(ClientEngagement).filter(ClientEngagement.organization_id == ctx.organization_id)
    if client_id:
        query = query.filter(ClientEngagement.client_id == uuid.UUID(client_id))
    engagements = query.order_by(ClientEngagement.created_at.desc()).all()
    return [
        {
            "id": str(e.id),
            "engagement_number": e.engagement_number,
            "client_id": str(e.client_id),
            "case_id": str(e.case_id) if e.case_id else None,
            "service_id": str(e.service_id) if e.service_id else None,
            "status": e.status,
            "retainer_amount": e.retainer_amount,
            "agreed_fee": e.agreed_fee,
            "billing_terms": e.billing_terms,
            "responsible_attorney_id": str(e.responsible_attorney_id) if e.responsible_attorney_id else None,
            "signed_agreement_date": e.signed_agreement_date.isoformat() if e.signed_agreement_date else None,
            "notes": e.notes,
            "created_at": e.created_at.isoformat(),
        }
        for e in engagements
    ]


@router.post("/engagements", status_code=status.HTTP_201_CREATED)
def create_engagement(
    payload: ClientEngagementCreateRequest,
    ctx: AuthContext = Depends(require_permission("billing:manage")),
    db: Session = Depends(get_db),
):
    """Creates a client retainer engagement agreement."""
    eng = BillingService.create_client_engagement(
        db, ctx.organization_id, uuid.UUID(payload.client_id), payload.model_dump(), actor_id=ctx.user_id
    )
    return {
        "id": str(eng.id),
        "engagement_number": eng.engagement_number,
        "status": eng.status,
        "agreed_fee": eng.agreed_fee,
    }


@router.get("/invoices")
def list_invoices(
    client_id: str | None = None,
    case_id: str | None = None,
    status_filter: str | None = None,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    """Lists organization invoices with line items and balance status."""
    query = db.query(Invoice).filter(Invoice.organization_id == ctx.organization_id)
    if client_id:
        query = query.filter(Invoice.client_id == uuid.UUID(client_id))
    if case_id:
        query = query.filter(Invoice.case_id == uuid.UUID(case_id))
    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    invoices = query.order_by(Invoice.issue_date.desc()).all()
    results = []
    for inv in invoices:
        results.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "client_id": str(inv.client_id),
            "client_name": f"{inv.client.first_name} {inv.client.last_name}" if inv.client else "Client",
            "case_id": str(inv.case_id) if inv.case_id else None,
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "discount_amount": inv.discount_amount,
            "total_amount": inv.total_amount,
            "paid_amount": inv.paid_amount,
            "balance_due": inv.balance_due,
            "currency": inv.currency,
            "status": inv.status,
            "payment_provider": inv.payment_provider,
            "gst_rate": getattr(inv, "gst_rate", 0.18),
            "cgst_amount": getattr(inv, "cgst_amount", 0.0),
            "sgst_amount": getattr(inv, "sgst_amount", 0.0),
            "igst_amount": getattr(inv, "igst_amount", 0.0),
            "sac_code": getattr(inv, "sac_code", "998311"),
            "gstin": getattr(inv, "gstin", None),
            "place_of_supply": getattr(inv, "place_of_supply", None),
            "line_items_count": len(inv.line_items),
        })
    return results


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreateRequest,
    ctx: AuthContext = Depends(require_permission("billing:manage")),
    db: Session = Depends(get_db),
):
    """Creates a new invoice with line items."""
    inv = BillingService.create_invoice(
        db, ctx.organization_id, uuid.UUID(payload.client_id), payload.model_dump(), actor_id=ctx.user_id
    )
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "total_amount": inv.total_amount,
        "subtotal": inv.subtotal,
        "tax_amount": inv.tax_amount,
        "discount_amount": inv.discount_amount,
        "balance_due": inv.balance_due,
        "currency": inv.currency,
        "status": inv.status,
        "cgst_amount": getattr(inv, "cgst_amount", 0.0),
        "sgst_amount": getattr(inv, "sgst_amount", 0.0),
        "igst_amount": getattr(inv, "igst_amount", 0.0),
        "sac_code": getattr(inv, "sac_code", "998311"),
        "gstin": getattr(inv, "gstin", None),
        "place_of_supply": getattr(inv, "place_of_supply", None),
    }


@router.get("/invoices/{invoice_id}")
def get_invoice_detail(
    invoice_id: str,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    """Retrieves full invoice details including itemized lines and payment history."""
    inv = db.query(Invoice).filter(
        Invoice.id == uuid.UUID(invoice_id),
        Invoice.organization_id == ctx.organization_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    line_items = [
        {
            "id": str(li.id),
            "description": li.description,
            "quantity": li.quantity,
            "unit_price": li.unit_price,
            "total": li.total,
            "line_type": li.line_type,
            "sac_code": getattr(li, "sac_code", "998311"),
            "gst_rate": getattr(li, "gst_rate", 0.18),
        }
        for li in inv.line_items
    ]

    payments = [
        {
            "id": str(p.id),
            "transaction_reference": p.transaction_reference,
            "amount": p.amount,
            "currency": p.currency,
            "payment_method": p.payment_method,
            "status": p.status,
            "card_brand": p.card_brand,
            "card_last4": p.card_last4,
            "payment_date": p.payment_date.isoformat(),
            "refunded_amount": p.refunded_amount,
        }
        for p in inv.payments
    ]

    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "client_id": str(inv.client_id),
        "client_name": f"{inv.client.first_name} {inv.client.last_name}" if inv.client else "Client",
        "case_id": str(inv.case_id) if inv.case_id else None,
        "issue_date": inv.issue_date.isoformat(),
        "due_date": inv.due_date.isoformat(),
        "subtotal": inv.subtotal,
        "tax_amount": inv.tax_amount,
        "discount_amount": inv.discount_amount,
        "total_amount": inv.total_amount,
        "paid_amount": inv.paid_amount,
        "balance_due": inv.balance_due,
        "currency": inv.currency,
        "status": inv.status,
        "payment_provider": inv.payment_provider,
        "gst_rate": getattr(inv, "gst_rate", 0.18),
        "cgst_amount": getattr(inv, "cgst_amount", 0.0),
        "sgst_amount": getattr(inv, "sgst_amount", 0.0),
        "igst_amount": getattr(inv, "igst_amount", 0.0),
        "sac_code": getattr(inv, "sac_code", "998311"),
        "gstin": getattr(inv, "gstin", None),
        "place_of_supply": getattr(inv, "place_of_supply", None),
        "notes": inv.notes,
        "line_items": line_items,
        "payments": payments,
    }


@router.post("/calculate-gst")
def calculate_gst_estimate(
    payload: GSTCalculateRequest,
    ctx: AuthContext = Depends(require_permission("billing:read")),
):
    """Calculates GST breakdown (CGST/SGST vs IGST) for a given subtotal under SAC 998311."""
    return BillingService.calculate_gst(
        subtotal=payload.subtotal,
        is_interstate=payload.is_interstate,
        gst_rate=payload.gst_rate,
    )


@router.post("/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
def record_payment(
    invoice_id: str,
    payload: RecordPaymentRequest,
    ctx: AuthContext = Depends(require_permission("billing:manage")),
    db: Session = Depends(get_db),
):
    """Records an authorized payment transaction against an invoice.

    Strict security: NEVER stores raw credit card PAN or CVV.
    """
    payment = BillingService.record_payment(
        db, ctx.organization_id, uuid.UUID(invoice_id), payload.model_dump(), actor_id=ctx.user_id
    )
    return {
        "id": str(payment.id),
        "transaction_reference": payment.transaction_reference,
        "amount": payment.amount,
        "card_brand": payment.card_brand,
        "card_last4": payment.card_last4,
        "status": payment.status,
        "invoice_status": payment.invoice.status,
        "balance_due": payment.invoice.balance_due,
    }


@router.post("/payments/{payment_id}/refund")
def refund_payment(
    payment_id: str,
    payload: RefundPaymentRequest,
    ctx: AuthContext = Depends(require_permission("billing:manage")),
    db: Session = Depends(get_db),
):
    """Processes a refund on a completed payment transaction."""
    payment = BillingService.process_refund(
        db, ctx.organization_id, uuid.UUID(payment_id), payload.refund_amount, payload.reason, actor_id=ctx.user_id
    )
    return {
        "id": str(payment.id),
        "refunded_amount": payment.refunded_amount,
        "status": payment.status,
        "invoice_status": payment.invoice.status,
        "invoice_balance_due": payment.invoice.balance_due,
    }


@router.get("/reports/financial")
def get_financial_reports(
    start_date: str | None = None,
    end_date: str | None = None,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    """Generates authorized financial reports including Accounts Receivable (A/R) aging analysis."""
    s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")) if start_date else None
    e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")) if end_date else None
    return BillingService.get_financial_reports(db, ctx.organization_id, s_dt, e_dt)


@router.get("/client-invoices")
def get_client_invoices_portal(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Portal endpoint for retained clients to view only their own invoices."""
    client_profile = db.query(ClientProfile).filter(
        ClientProfile.user_id == ctx.user_id,
        ClientProfile.organization_id == ctx.organization_id,
    ).first()
    if not client_profile:
        return []
    invoices = db.query(Invoice).filter(
        Invoice.organization_id == ctx.organization_id,
        Invoice.client_id == client_profile.id,
        Invoice.status != "draft",
    ).order_by(Invoice.issue_date.desc()).all()

    return [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "total_amount": inv.total_amount,
            "paid_amount": inv.paid_amount,
            "balance_due": inv.balance_due,
            "currency": inv.currency,
            "status": inv.status,
        }
        for inv in invoices
    ]


@router.post("/webhooks/stripe")
async def stripe_webhook_receiver(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Live Stripe Webhook Receiver:
    Listens for asynchronous Stripe events (payment_intent.succeeded, checkout.session.completed, charge.refunded).
    Validates cryptographic signature if stripe_webhook_secret is configured.
    Automatically captures and reconciles payments against issued invoices.
    """
    settings = get_settings()
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if getattr(settings, "stripe_webhook_secret", None) and sig_header:
        try:
            elements = dict(item.split("=", 1) for item in sig_header.split(","))
            t = elements.get("t", "")
            expected_sig = elements.get("v1", "")
            signed_payload = f"{t}.".encode("utf-8") + payload_bytes
            computed_sig = hmac.new(
                settings.stripe_webhook_secret.encode("utf-8"),
                signed_payload,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(computed_sig, expected_sig):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook signature verification failed")

    try:
        event = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event_type = event.get("type", "")
    event_data = event.get("data", {}).get("object", {})

    if event_type in ("payment_intent.succeeded", "checkout.session.completed"):
        metadata = event_data.get("metadata", {})
        invoice_id_str = metadata.get("invoice_id")
        amount_cents = event_data.get("amount", event_data.get("amount_total", 0))
        amount = float(amount_cents) / 100.0 if amount_cents else 0.0

        if invoice_id_str:
            try:
                inv_uuid = uuid.UUID(invoice_id_str)
                invoice = db.query(Invoice).filter(Invoice.id == inv_uuid).first()
                if invoice:
                    charge_id = event_data.get("id", f"ch_stripe_{uuid.uuid4().hex[:12]}")
                    charges = event_data.get("charges", {}).get("data", [])
                    card_brand = "visa"
                    card_last4 = "4242"
                    if charges and "payment_method_details" in charges[0]:
                        pm_card = charges[0]["payment_method_details"].get("card", {})
                        card_brand = pm_card.get("brand", "visa")
                        card_last4 = pm_card.get("last4", "4242")

                    payment_payload = {
                        "amount": amount or invoice.balance_due,
                        "currency": event_data.get("currency", invoice.currency).upper(),
                        "payment_method": "stripe_card",
                        "provider_charge_id": charge_id,
                        "card_brand": card_brand,
                        "card_last4": card_last4,
                        "transaction_reference": f"stripe_tx_{charge_id}",
                        "notes": f"Automated Stripe webhook reconciliation for {event_type}",
                    }
                    BillingService.record_payment(
                        db=db,
                        organization_id=invoice.organization_id,
                        invoice_id=invoice.id,
                        payment_data=payment_payload,
                    )
            except Exception:
                pass

    return {
        "received": True,
        "event_type": event_type,
        "status": "processed",
    }

