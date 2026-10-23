import {
  InvoiceDetailItem,
  InvoiceLineItemDetail,
  ServiceCatalogItem,
  ClientEngagementItem,
  FinancialReportsData,
} from "../types";
import { API_BASE_URL, getAuthHeaders, fallbackData } from "./client";

const API_BASE = API_BASE_URL;

export const FALLBACK_SERVICES: ServiceCatalogItem[] = [
  {
    id: "srv-01",
    code: "EB1A_PETITION",
    name: "EB-1A Extraordinary Ability Petition Brief & Form Assembly",
    jurisdiction: "US",
    pricing_model: "fixed",
    base_fee: 6500.0,
    currency: "USD",
    estimated_duration_days: 60,
    is_active: true,
  },
  {
    id: "srv-02",
    code: "STUDY_PERMIT_CA",
    name: "Canada Study Permit & Co-Op Work Visa Advisory",
    jurisdiction: "CA",
    pricing_model: "fixed",
    base_fee: 150000.0,
    currency: "INR",
    estimated_duration_days: 30,
    is_active: true,
  },
];

export const FALLBACK_ENGAGEMENTS: ClientEngagementItem[] = [
  {
    id: "eng-01",
    engagement_number: "ENG-2026-0001",
    client_id: "client-01",
    status: "active",
    retainer_amount: 3000.0,
    agreed_fee: 6500.0,
    billing_terms: "fixed_split",
    created_at: "2026-08-10T10:00:00Z",
  },
];

export const FALLBACK_INVOICES: InvoiceDetailItem[] = [
  {
    id: "inv-01",
    invoice_number: "INV-2026-0001",
    client_id: "client-01",
    issue_date: "2026-08-15T00:00:00Z",
    due_date: "2026-09-15T00:00:00Z",
    subtotal: 6500.0,
    tax_amount: 0.0,
    discount_amount: 0.0,
    total_amount: 6500.0,
    paid_amount: 3000.0,
    balance_due: 3500.0,
    currency: "USD",
    status: "partially_paid",
    payment_provider: "stripe_verified",
    line_items: [
      {
        id: "li-01",
        description: "Initial Retainer & Evidence Cataloging",
        quantity: 1,
        unit_price: 3000.0,
        total: 3000.0,
        line_type: "service_fee",
      },
      {
        id: "li-02",
        description: "Petition Drafting & Case Briefing",
        quantity: 1,
        unit_price: 3500.0,
        total: 3500.0,
        line_type: "service_fee",
      },
    ],
  },
];

export const FALLBACK_FINANCIAL_REPORTS: FinancialReportsData = {
  period: {
    start_date: "2026-08-01T00:00:00Z",
    end_date: "2026-10-11T23:59:59Z",
  },
  summary: {
    total_invoiced: 9215.0,
    total_collected: 4250.0,
    total_outstanding: 4965.0,
    total_refunded: 0.0,
    net_collections: 4250.0,
    currency: "USD",
  },
  accounts_receivable_aging: {
    current_not_due: 4965.0,
    overdue_1_to_30_days: 0.0,
    overdue_31_to_60_days: 0.0,
    overdue_61_to_90_days: 0.0,
    overdue_greater_90_days: 0.0,
    total_overdue: 0.0,
  },
  collections_by_pathway: {
    "EB-1A": 4250.0,
  },
  invoice_counts: {
    total: 2,
    paid: 1,
    issued: 1,
    partially_paid: 0,
    overdue: 0,
  },
};

export async function fetchServices(): Promise<ServiceCatalogItem[]> {
  try {
    const res = await fetch(`${API_BASE}/billing/services`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(FALLBACK_SERVICES, "fetchServices");
}

export async function createServiceItem(data: Partial<ServiceCatalogItem>): Promise<ServiceCatalogItem> {
  try {
    const res = await fetch(`${API_BASE}/billing/services`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData({
    id: `srv-${Date.now()}`,
    code: data.code || "CUSTOM_SERVICE",
    name: data.name || "Custom Immigration Service",
    jurisdiction: data.jurisdiction || "US",
    pricing_model: data.pricing_model || "fixed",
    base_fee: data.base_fee || 500.0,
    currency: data.currency || "USD",
    estimated_duration_days: data.estimated_duration_days || 30,
    is_active: true,
  }, "createServiceItem");
}

export async function fetchEngagements(clientId?: string): Promise<ClientEngagementItem[]> {
  try {
    const url = clientId ? `${API_BASE}/billing/engagements?client_id=${clientId}` : `${API_BASE}/billing/engagements`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(FALLBACK_ENGAGEMENTS, "fetchEngagements");
}

export async function createEngagement(data: Partial<ClientEngagementItem>): Promise<ClientEngagementItem> {
  try {
    const res = await fetch(`${API_BASE}/billing/engagements`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData({
    id: `eng-${Date.now()}`,
    engagement_number: `ENG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    client_id: data.client_id || "client-01",
    status: data.status || "active",
    retainer_amount: data.retainer_amount || 0,
    agreed_fee: data.agreed_fee || 0,
    billing_terms: data.billing_terms || "fixed_split",
    created_at: new Date().toISOString(),
  }, "createEngagement");
}

export async function fetchInvoices(filter: Record<string, any> = {}): Promise<InvoiceDetailItem[]> {
  try {
    const query = new URLSearchParams(filter).toString();
    const res = await fetch(`${API_BASE}/billing/invoices?${query}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(FALLBACK_INVOICES, "fetchInvoices");
}

export async function createInvoice(data: any): Promise<InvoiceDetailItem> {
  try {
    const res = await fetch(`${API_BASE}/billing/invoices`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  const total = (data.line_items || []).reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0);
  const tax = Number(data.tax_amount || 0);
  const discount = Number(data.discount_amount || 0);
  const finalTotal = Math.max(0, total + tax - discount);
  const mockInv: InvoiceDetailItem = {
    id: `inv-${Date.now()}`,
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    client_id: data.client_id || "client-01",
    issue_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    subtotal: total,
    tax_amount: tax,
    discount_amount: discount,
    total_amount: finalTotal,
    paid_amount: 0,
    balance_due: finalTotal,
    currency: data.currency || "USD",
    status: "issued",
    payment_provider: "stripe_verified",
    gst_rate: data.gst_rate ?? 0.18,
    cgst_amount: data.cgst_amount ?? 0,
    sgst_amount: data.sgst_amount ?? 0,
    igst_amount: data.igst_amount ?? 0,
    sac_code: data.sac_code || "998311",
    gstin: data.gstin || null,
    place_of_supply: data.place_of_supply || null,
    line_items: data.line_items,
  };
  return fallbackData(mockInv, "createInvoice");
}

export async function recordInvoicePayment(invoiceId: string, data: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/billing/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData({
    id: `pay-${Date.now()}`,
    transaction_reference: `txn_tok_${Date.now()}`,
    amount: data.amount,
    card_brand: data.card_brand || "visa",
    card_last4: data.card_last4 || "4242",
    status: "succeeded",
    invoice_status: "paid",
    balance_due: 0.0,
  }, "recordInvoicePayment");
}

export async function refundInvoicePayment(paymentId: string, data: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/billing/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData({
    id: paymentId,
    refunded_amount: data.refund_amount || 100,
    status: "partially_refunded",
    invoice_status: "partially_paid",
  }, "refundInvoicePayment");
}

export async function calculateGST(subtotal: number, isInterstate: boolean = false, gstRate: number = 0.18): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/billing/calculate-gst`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ subtotal, is_interstate: isInterstate, gst_rate: gstRate }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  const sub = Math.round(subtotal * 100) / 100;
  if (isInterstate) {
    const igst = Math.round(sub * gstRate * 100) / 100;
    return fallbackData({
      subtotal: sub,
      gst_rate: gstRate,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: igst,
      tax_amount: igst,
      total_with_tax: Math.round((sub + igst) * 100) / 100,
      is_interstate: true,
    }, "calculateGST");
  } else {
    const cgst = Math.round(sub * (gstRate / 2) * 100) / 100;
    const sgst = Math.round(sub * (gstRate / 2) * 100) / 100;
    const tax = Math.round((cgst + sgst) * 100) / 100;
    return fallbackData({
      subtotal: sub,
      gst_rate: gstRate,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: 0,
      tax_amount: tax,
      total_with_tax: Math.round((sub + tax) * 100) / 100,
      is_interstate: false,
    }, "calculateGST");
  }
}

export async function fetchFinancialReports(startDate?: string, endDate?: string): Promise<FinancialReportsData> {
  try {
    const query = new URLSearchParams({
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    }).toString();
    const res = await fetch(`${API_BASE}/billing/reports/financial?${query}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(FALLBACK_FINANCIAL_REPORTS, "fetchFinancialReports");
}
