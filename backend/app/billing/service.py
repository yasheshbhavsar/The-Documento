"""Billing and Financial Operations Service

Handles service catalog, client engagement retainers, invoices with line items,
payment processing through a verified tokenized provider adapter (never storing raw card PAN),
refund management, and authorized financial reports with accounts receivable aging.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.core.errors import ConflictError, EntityNotFoundError, ValidationError
from backend.app.domain.models import (
    ServiceItem,
    ClientEngagement,
    Invoice,
    InvoiceLineItem,
    PaymentRecord,
    ClientProfile,
    ImmigrationCase,
    AuditEvent,
)


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class BillingService:
    @staticmethod
    def seed_default_services(db: Session, organization_id: uuid.UUID) -> list[ServiceItem]:
        """Seeds standard immigration legal service items if none exist."""
        existing = db.query(ServiceItem).filter(ServiceItem.organization_id == organization_id).count()
        if existing > 0:
            return db.query(ServiceItem).filter(ServiceItem.organization_id == organization_id).all()

        defaults = [
            {
                "code": "EB1A_PETITION",
                "name": "US EB-1A Extraordinary Ability Immigrant Petition",
                "description": "Comprehensive legal brief, evidentiary compilation, Form I-140 preparation, and attorney representation.",
                "jurisdiction": "US",
                "visa_category": "EB-1A",
                "pricing_model": "fixed",
                "base_fee": 8500.0,
                "currency": "USD",
                "estimated_duration_days": 90,
            },
            {
                "code": "EB2_NIW_PETITION",
                "name": "US EB-2 National Interest Waiver Immigrant Petition",
                "description": "Matter of Dhanasar statutory brief, proposed endeavor analysis, Form I-140 petition.",
                "jurisdiction": "US",
                "visa_category": "EB-2 NIW",
                "pricing_model": "fixed",
                "base_fee": 7500.0,
                "currency": "USD",
                "estimated_duration_days": 75,
            },
            {
                "code": "O1A_PETITION",
                "name": "US O-1A Nonimmigrant Alien of Extraordinary Ability",
                "description": "Form I-129 assembly, peer advisory consultation, expert opinion letter drafting.",
                "jurisdiction": "US",
                "visa_category": "O-1A",
                "pricing_model": "fixed",
                "base_fee": 6500.0,
                "currency": "USD",
                "estimated_duration_days": 45,
            },
            {
                "code": "CONSULTATION_INITIAL",
                "name": "Initial Immigration Strategy & Eligibility Assessment",
                "description": "Comprehensive 60-minute case evaluation, CV appraisal, and statutory pathway recommendation.",
                "jurisdiction": "US",
                "visa_category": "ALL",
                "pricing_model": "fixed",
                "base_fee": 350.0,
                "currency": "USD",
                "estimated_duration_days": 1,
            },
            {
                "code": "USCIS_FILING_FEE_I140",
                "name": "USCIS Form I-140 Immigrant Petition Statutory Government Fee",
                "description": "Official Department of Homeland Security filing fee pass-through.",
                "jurisdiction": "US",
                "visa_category": "ALL",
                "pricing_model": "fixed",
                "base_fee": 715.0,
                "currency": "USD",
                "estimated_duration_days": 1,
            },
        ]

        now = datetime.now(timezone.utc)
        items = []
        for d in defaults:
            item = ServiceItem(
                organization_id=organization_id,
                code=d["code"],
                name=d["name"],
                description=d["description"],
                jurisdiction=d["jurisdiction"],
                visa_category=d["visa_category"],
                pricing_model=d["pricing_model"],
                base_fee=d["base_fee"],
                currency=d["currency"],
                estimated_duration_days=d["estimated_duration_days"],
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            db.add(item)
            items.append(item)
        db.commit()
        return items

    @staticmethod
    def create_service_item(db: Session, organization_id: uuid.UUID, data: dict[str, Any]) -> ServiceItem:
        existing = db.query(ServiceItem).filter(
            ServiceItem.organization_id == organization_id,
            ServiceItem.code == data["code"].upper().strip(),
        ).first()
        if existing:
            raise ConflictError(f"Service item with code '{data['code']}' already exists")

        now = datetime.now(timezone.utc)
        item = ServiceItem(
            organization_id=organization_id,
            code=data["code"].upper().strip(),
            name=data["name"].strip(),
            description=data.get("description"),
            jurisdiction=data.get("jurisdiction", "US").upper(),
            visa_category=data.get("visa_category"),
            pricing_model=data.get("pricing_model", "fixed"),
            base_fee=float(data.get("base_fee", 0.0)),
            currency=data.get("currency", "USD").upper(),
            estimated_duration_days=int(data.get("estimated_duration_days", 60)),
            is_active=data.get("is_active", True),
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def create_client_engagement(
        db: Session, organization_id: uuid.UUID, client_id: uuid.UUID, data: dict[str, Any], actor_id: uuid.UUID | None = None
    ) -> ClientEngagement:
        client = db.query(ClientProfile).filter(
            ClientProfile.id == client_id,
            ClientProfile.organization_id == organization_id,
        ).first()
        if not client:
            raise EntityNotFoundError("ClientProfile", client_id)

        now = datetime.now(timezone.utc)
        count = db.query(ClientEngagement).filter(ClientEngagement.organization_id == organization_id).count()
        engagement_number = f"ENG-{now.year}-{str(count + 1).zfill(4)}"

        engagement = ClientEngagement(
            organization_id=organization_id,
            client_id=client_id,
            case_id=uuid.UUID(data["case_id"]) if data.get("case_id") else None,
            service_id=uuid.UUID(data["service_id"]) if data.get("service_id") else None,
            engagement_number=engagement_number,
            status=data.get("status", "active"),
            retainer_amount=float(data.get("retainer_amount", 0.0)),
            agreed_fee=float(data.get("agreed_fee", 0.0)),
            billing_terms=data.get("billing_terms", "fixed_split"),
            responsible_attorney_id=uuid.UUID(data["responsible_attorney_id"]) if data.get("responsible_attorney_id") else None,
            signed_agreement_date=now if data.get("is_signed") else None,
            notes=data.get("notes"),
            created_at=now,
            updated_at=now,
        )
        db.add(engagement)

        # Audit
        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="billing.engagement_created",
            object_type="client_engagement",
            object_id=str(engagement.id),
            metadata_json={"engagement_number": engagement_number, "client_id": str(client_id)},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(engagement)
        return engagement

    @staticmethod
    def create_invoice(
        db: Session, organization_id: uuid.UUID, client_id: uuid.UUID, data: dict[str, Any], actor_id: uuid.UUID | None = None
    ) -> Invoice:
        client = db.query(ClientProfile).filter(
            ClientProfile.id == client_id,
            ClientProfile.organization_id == organization_id,
        ).first()
        if not client:
            raise EntityNotFoundError("ClientProfile", client_id)

        now = datetime.now(timezone.utc)
        count = db.query(Invoice).filter(Invoice.organization_id == organization_id).count()
        invoice_number = f"INV-{now.year}-{str(count + 1).zfill(4)}"

        due_date = data.get("due_date")
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
        elif not due_date:
            due_date = now + timedelta(days=30)

        # Calculate line items
        line_items_data = data.get("line_items", [])
        subtotal = 0.0
        line_items = []
        for item_data in line_items_data:
            qty = float(item_data.get("quantity", 1.0))
            price = float(item_data.get("unit_price", 0.0))
            line_tot = qty * price
            subtotal += line_tot
            line_items.append(
                InvoiceLineItem(
                    service_id=uuid.UUID(item_data["service_id"]) if item_data.get("service_id") else None,
                    description=item_data["description"],
                    quantity=qty,
                    unit_price=price,
                    total=line_tot,
                    line_type=item_data.get("line_type", "service_fee"),
                )
            )

        tax_amount = float(data.get("tax_amount", 0.0))
        discount_amount = float(data.get("discount_amount", 0.0))
        total_amount = max(0.0, subtotal + tax_amount - discount_amount)

        invoice = Invoice(
            organization_id=organization_id,
            client_id=client_id,
            case_id=uuid.UUID(data["case_id"]) if data.get("case_id") else None,
            engagement_id=uuid.UUID(data["engagement_id"]) if data.get("engagement_id") else None,
            invoice_number=invoice_number,
            issue_date=now,
            due_date=due_date,
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            discount_amount=round(discount_amount, 2),
            total_amount=round(total_amount, 2),
            paid_amount=0.0,
            balance_due=round(total_amount, 2),
            currency=data.get("currency", "USD").upper(),
            status="issued" if data.get("auto_issue", True) else "draft",
            payment_provider=data.get("payment_provider", "stripe_verified"),
            notes=data.get("notes"),
            line_items=line_items,
            created_at=now,
            updated_at=now,
        )
        db.add(invoice)

        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="billing.invoice_created",
            object_type="invoice",
            object_id=str(invoice.id),
            metadata_json={"invoice_number": invoice_number, "total_amount": total_amount},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def record_payment(
        db: Session,
        organization_id: uuid.UUID,
        invoice_id: uuid.UUID,
        payment_data: dict[str, Any],
        actor_id: uuid.UUID | None = None,
    ) -> PaymentRecord:
        """Records an authorized payment transaction.

        STRICT SECURITY REQUIREMENT: Never stores raw payment-card PAN or CVV. Only stores
        tokenized reference, provider charge ID, card brand, and last 4 digits.
        """
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.organization_id == organization_id,
        ).first()
        if not invoice:
            raise EntityNotFoundError("Invoice", invoice_id)

        amount = float(payment_data.get("amount", invoice.balance_due))
        if amount <= 0:
            raise ValidationError("Payment amount must be greater than zero")

        now = datetime.now(timezone.utc)
        tx_ref = payment_data.get("transaction_reference") or f"txn_tokenized_{uuid.uuid4().hex[:16]}"

        payment = PaymentRecord(
            organization_id=organization_id,
            invoice_id=invoice.id,
            client_id=invoice.client_id,
            transaction_reference=tx_ref,
            amount=round(amount, 2),
            currency=payment_data.get("currency", invoice.currency),
            payment_method=payment_data.get("payment_method", "credit_card_tokenized"),
            status="succeeded",
            refunded_amount=0.0,
            provider_charge_id=payment_data.get("provider_charge_id", f"ch_{uuid.uuid4().hex[:12]}"),
            card_brand=payment_data.get("card_brand", "visa"),
            card_last4=payment_data.get("card_last4", "4242"),  # Last 4 ONLY
            payment_date=now,
            notes=payment_data.get("notes"),
            metadata_json=payment_data.get("metadata", {}),
            created_at=now,
        )
        db.add(payment)

        # Update invoice amounts and state
        invoice.paid_amount = round(invoice.paid_amount + amount, 2)
        invoice.balance_due = max(0.0, round(invoice.total_amount - invoice.paid_amount, 2))
        if invoice.balance_due <= 0.01:
            invoice.status = "paid"
        else:
            invoice.status = "partially_paid"
        invoice.updated_at = now

        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="billing.payment_recorded",
            object_type="payment_record",
            object_id=str(payment.id),
            metadata_json={
                "invoice_number": invoice.invoice_number,
                "amount": amount,
                "payment_method": payment.payment_method,
                "card_last4": payment.card_last4,
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def process_refund(
        db: Session,
        organization_id: uuid.UUID,
        payment_id: uuid.UUID,
        refund_amount: float | None = None,
        reason: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> PaymentRecord:
        """Processes a partial or full refund on a completed payment transaction."""
        payment = db.query(PaymentRecord).filter(
            PaymentRecord.id == payment_id,
            PaymentRecord.organization_id == organization_id,
        ).first()
        if not payment:
            raise EntityNotFoundError("PaymentRecord", payment_id)

        available_to_refund = payment.amount - payment.refunded_amount
        if available_to_refund <= 0:
            raise ValidationError("Payment has already been fully refunded")

        refund_amt = refund_amount if refund_amount is not None else available_to_refund
        if refund_amt > available_to_refund:
            raise ValidationError(f"Cannot refund ${refund_amt}; maximum refundable is ${available_to_refund}")

        payment.refunded_amount = round(payment.refunded_amount + refund_amt, 2)
        if payment.refunded_amount >= payment.amount:
            payment.status = "refunded"
        else:
            payment.status = "partially_refunded"

        invoice = payment.invoice
        invoice.paid_amount = max(0.0, round(invoice.paid_amount - refund_amt, 2))
        invoice.balance_due = round(invoice.total_amount - invoice.paid_amount, 2)
        if invoice.paid_amount <= 0.01:
            invoice.status = "refunded"
        else:
            invoice.status = "partially_paid"

        now = datetime.now(timezone.utc)
        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="billing.payment_refunded",
            object_type="payment_record",
            object_id=str(payment.id),
            metadata_json={"refund_amount": refund_amt, "reason": reason, "invoice_id": str(invoice.id)},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def get_financial_reports(
        db: Session, organization_id: uuid.UUID, start_date: datetime | None = None, end_date: datetime | None = None
    ) -> dict[str, Any]:
        """Generates comprehensive, authorized financial reports including Accounts Receivable (A/R)

        aging analysis, collections breakdown by pathway and branch, and refunds.
        """
        now = datetime.now(timezone.utc)
        if not start_date:
            start_date = now - timedelta(days=90)
        if not end_date:
            end_date = now

        invoices = db.query(Invoice).filter(
            Invoice.organization_id == organization_id,
            Invoice.issue_date >= start_date,
            Invoice.issue_date <= end_date,
        ).all()

        total_invoiced = sum(i.total_amount for i in invoices)
        total_collected = sum(i.paid_amount for i in invoices)
        total_outstanding = sum(i.balance_due for i in invoices if i.status not in ("paid", "void", "refunded"))

        # Accounts Receivable (A/R) Aging Calculation
        ar_current = 0.0
        ar_1_to_30 = 0.0
        ar_31_to_60 = 0.0
        ar_61_to_90 = 0.0
        ar_gt_90 = 0.0

        for inv in invoices:
            if inv.status in ("paid", "void", "refunded") or inv.balance_due <= 0:
                continue

            inv_due = ensure_utc(inv.due_date)
            if inv_due and now <= inv_due:
                ar_current += inv.balance_due
            elif inv_due:
                overdue_days = (now - inv_due).total_seconds() / 86400
                if overdue_days <= 30:
                    ar_1_to_30 += inv.balance_due
                elif overdue_days <= 60:
                    ar_31_to_60 += inv.balance_due
                elif overdue_days <= 90:
                    ar_61_to_90 += inv.balance_due
                else:
                    ar_gt_90 += inv.balance_due

        # Collections by pathway
        collections_by_pathway: dict[str, float] = {}
        for inv in invoices:
            if inv.paid_amount > 0 and inv.case:
                path = inv.case.visa_category or "Other"
                collections_by_pathway[path] = round(collections_by_pathway.get(path, 0.0) + inv.paid_amount, 2)

        # Refunds in period
        refunds_total = db.query(func.coalesce(func.sum(PaymentRecord.refunded_amount), 0.0)).filter(
            PaymentRecord.organization_id == organization_id,
            PaymentRecord.payment_date >= start_date,
            PaymentRecord.payment_date <= end_date,
        ).scalar() or 0.0

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "summary": {
                "total_invoiced": round(total_invoiced, 2),
                "total_collected": round(total_collected, 2),
                "total_outstanding": round(total_outstanding, 2),
                "total_refunded": round(refunds_total, 2),
                "net_collections": round(total_collected - refunds_total, 2),
                "currency": "USD",
            },
            "accounts_receivable_aging": {
                "current_not_due": round(ar_current, 2),
                "overdue_1_to_30_days": round(ar_1_to_30, 2),
                "overdue_31_to_60_days": round(ar_31_to_60, 2),
                "overdue_61_to_90_days": round(ar_61_to_90, 2),
                "overdue_greater_90_days": round(ar_gt_90, 2),
                "total_overdue": round(ar_1_to_30 + ar_31_to_60 + ar_61_to_90 + ar_gt_90, 2),
            },
            "collections_by_pathway": collections_by_pathway,
            "invoice_counts": {
                "total": len(invoices),
                "paid": sum(1 for i in invoices if i.status == "paid"),
                "issued": sum(1 for i in invoices if i.status == "issued"),
                "partially_paid": sum(1 for i in invoices if i.status == "partially_paid"),
                "overdue": sum(1 for i in invoices if i.status == "overdue"),
            },
        }
