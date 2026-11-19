export type PaymentClearanceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  case_number: string;
  case_id?: string;
  client_name: string;
  amount: number;
  status: "paid" | "outstanding" | "in_trust";
  due_date: string;
}

export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  jurisdiction: string;
  visa_category?: string | null;
  pricing_model: "fixed" | "hourly" | "milestone";
  base_fee: number;
  currency: string;
  estimated_duration_days: number;
  is_active: boolean;
}

export interface ClientEngagementItem {
  id: string;
  engagement_number: string;
  client_id: string;
  case_id?: string | null;
  service_id?: string | null;
  status: "draft" | "active" | "completed" | "terminated";
  retainer_amount: number;
  agreed_fee: number;
  billing_terms: string;
  responsible_attorney_id?: string | null;
  signed_agreement_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InvoiceLineItemDetail {
  id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  line_type: "service_fee" | "filing_fee" | "translation" | "courier" | "discount";
  sac_code?: string;
  gst_rate?: number;
}

export interface PaymentRecordItem {
  id: string;
  transaction_reference: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded";
  refunded_amount?: number;
  card_brand?: string | null;
  card_last4?: string | null;
  payment_date: string;
}

export interface InvoiceDetailItem {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name?: string;
  case_id?: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  currency: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void" | "refunded";
  payment_provider?: string | null;
  notes?: string | null;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  sac_code?: string;
  gstin?: string | null;
  place_of_supply?: string | null;
  line_items?: InvoiceLineItemDetail[];
  line_items_count?: number;
  payments?: PaymentRecordItem[];
}

export interface FinancialSponsor {
  id: string;
  organization_id: string;
  case_id?: string | null;
  client_id: string;
  name: string;
  relationship: string;
  sponsor_type: "individual" | "corporate" | "institutional";
  pan?: string | null;
  itr_gross_income: number;
  liquid_funds: number;
  currency: string;
  bank_name?: string | null;
  loan_sanction_amount: number;
  affidavit_doc_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountsReceivableAging {
  current_not_due: number;
  overdue_1_to_30_days: number;
  overdue_31_to_60_days: number;
  overdue_61_to_90_days: number;
  overdue_greater_90_days: number;
  total_overdue: number;
}

export interface FinancialReportsData {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    total_refunded: number;
    net_collections: number;
    currency: string;
  };
  accounts_receivable_aging: AccountsReceivableAging;
  collections_by_pathway: Record<string, number>;
  invoice_counts: {
    total: number;
    paid: number;
    issued: number;
    partially_paid: number;
    overdue: number;
  };
}
