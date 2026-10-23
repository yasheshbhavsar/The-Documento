import React, { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DataTable, Column } from "../common/DataTable";
import { Modal } from "../common/Modal";
import { Drawer } from "../common/Drawer";
import {
  InvoiceDetailItem,
  ServiceCatalogItem,
  ClientEngagementItem,
  FinancialReportsData,
  InvoiceLineItemDetail,
} from "../../lib/types";
import {
  fetchInvoices,
  createInvoice,
  recordInvoicePayment,
  refundInvoicePayment,
  fetchServices,
  createServiceItem,
  fetchEngagements,
  createEngagement,
  fetchFinancialReports,
} from "../../lib/api";

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const symMap: Record<string, string> = {
    INR: "₹",
    USD: "$",
    CAD: "CA$",
    GBP: "£",
    EUR: "€",
    AUD: "A$",
  };
  const sym = symMap[currency?.toUpperCase()] || `${currency} `;
  const locale = currency?.toUpperCase() === "INR" ? "en-IN" : "en-US";
  return `${sym}${Number(amount || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface BillingManagerProps {
  userRole?: string;
  isLiveBackend: boolean;
}

export function BillingManager({
  userRole = "owner",
  isLiveBackend,
}: BillingManagerProps) {
  // RBAC verification: Only firm owners, admins, and finance staff can access billing
  const isAuthorized =
    userRole === "owner" ||
    userRole === "master_admin" ||
    userRole === "company_admin" ||
    userRole === "finance_staff";

  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "services" | "engagements" | "reports">("invoices");

  // State
  const [invoices, setInvoices] = useState<InvoiceDetailItem[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [engagements, setEngagements] = useState<ClientEngagementItem[]>([]);
  const [financialReports, setFinancialReports] = useState<FinancialReportsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Drawers
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState<boolean>(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState<boolean>(false);
  const [isRefundPaymentOpen, setIsRefundPaymentOpen] = useState<boolean>(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState<boolean>(false);
  const [isCreateEngagementOpen, setIsCreateEngagementOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetailItem | null>(null);

  // Form states
  const [newInvoiceData, setNewInvoiceData] = useState<{
    client_id: string;
    case_id: string;
    due_days: number;
    notes: string;
    currency: string;
    is_interstate: boolean;
    sac_code: string;
    gstin: string;
    place_of_supply: string;
    line_items: InvoiceLineItemDetail[];
  }>({
    client_id: "client-01",
    case_id: "case-01",
    due_days: 30,
    notes: "Filing and statutory petition services",
    currency: "USD",
    is_interstate: false,
    sac_code: "998311",
    gstin: "",
    place_of_supply: "",
    line_items: [
      { description: "Primary Petition Preparation & Statutory Strategy", quantity: 1, unit_price: 3500, line_type: "service_fee", total: 3500, sac_code: "998311", gst_rate: 0.18 },
      { description: "USCIS Government Statutory Filing Fee (I-129 / I-140)", quantity: 1, unit_price: 700, line_type: "filing_fee", total: 700, sac_code: "998311", gst_rate: 0.0 },
    ],
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    payment_method: "credit_card",
    card_brand: "visa",
    card_last4: "4242",
    provider_token: "tok_visa_verified_provider",
  });

  const [refundForm, setRefundForm] = useState({
    refund_amount: 500,
    reason: "Client overpayment adjustment",
  });

  const [serviceForm, setServiceForm] = useState({
    code: "SRV-EB2-NIW",
    name: "EB-2 National Interest Waiver Petition",
    jurisdiction: "US",
    pricing_model: "fixed" as const,
    base_fee: 4200,
    estimated_duration_days: 60,
  });

  const [engagementForm, setEngagementForm] = useState({
    client_id: "client-01",
    service_id: "srv-01",
    retainer_amount: 2500,
    agreed_fee: 5000,
    billing_terms: "50% retainer on signup, 50% prior to filing",
  });

  const [notification, setNotification] = useState<string | null>(null);

  const loadAllBillingData = async () => {
    setIsLoading(true);
    try {
      const [invs, srvs, engs, fin] = await Promise.all([
        fetchInvoices(),
        fetchServices(),
        fetchEngagements(),
        fetchFinancialReports(),
      ]);
      setInvoices(invs);
      setServices(srvs);
      setEngagements(engs);
      setFinancialReports(fin);
    } catch (err) {
      console.error("Failed to load billing data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadAllBillingData();
    }
  }, [isAuthorized]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  // RBAC Banner if Unauthorized
  if (!isAuthorized) {
    return (
      <div
        id="billing-unauthorized-banner"
        style={{
          background: "#fff1f2",
          border: "1px solid #fecdd3",
          borderRadius: "12px",
          padding: "32px",
          textAlign: "center",
          maxWidth: "600px",
          margin: "40px auto",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>🛡️</div>
        <h3 style={{ fontSize: "18px", color: "#9f1239", margin: "0 0 8px" }}>
          Access Restricted by Organization Governance
        </h3>
        <p style={{ fontSize: "14px", color: "#881337", lineHeight: 1.5, margin: 0 }}>
          Your active role (<code>{userRole}</code>) does not possess the <code>billing:read</code> or{" "}
          <code>billing:manage</code> statutory permissions. In accordance with legal firm confidentiality and multi-tenant security
          protocols, financial records and payment instruments are accessible only by firm owners and authorized finance staff.
        </p>
      </div>
    );
  }

  // Invoice Handlers
  const handleCreateInvoice = async () => {
    try {
      const sub = newInvoiceData.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      let tax = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      if (newInvoiceData.currency === "INR" || newInvoiceData.is_interstate) {
        if (newInvoiceData.is_interstate) {
          igst = Math.round(sub * 0.18 * 100) / 100;
          tax = igst;
        } else {
          cgst = Math.round(sub * 0.09 * 100) / 100;
          sgst = Math.round(sub * 0.09 * 100) / 100;
          tax = Math.round((cgst + sgst) * 100) / 100;
        }
      }
      const created = await createInvoice({
        client_id: newInvoiceData.client_id,
        case_id: newInvoiceData.case_id,
        due_date: new Date(Date.now() + newInvoiceData.due_days * 86400000).toISOString(),
        currency: newInvoiceData.currency,
        notes: newInvoiceData.notes,
        line_items: newInvoiceData.line_items,
        tax_amount: tax,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        gst_rate: 0.18,
        sac_code: newInvoiceData.sac_code || "998311",
        gstin: newInvoiceData.gstin || null,
        place_of_supply: newInvoiceData.place_of_supply || null,
        is_interstate: newInvoiceData.is_interstate,
      });
      setInvoices([created, ...invoices]);
      setIsCreateInvoiceOpen(false);
      showNotification(`✓ Invoice ${created.invoice_number} successfully issued for ${formatCurrency(created.total_amount, created.currency)}.`);
      loadAllBillingData();
    } catch (err) {
      alert("Failed to issue invoice");
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    try {
      const res = await recordInvoicePayment(selectedInvoice.id, {
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        card_brand: paymentForm.payment_method === "credit_card" ? paymentForm.card_brand : null,
        card_last4: paymentForm.payment_method === "credit_card" ? paymentForm.card_last4 : null,
        transaction_reference: paymentForm.provider_token,
      });
      setIsRecordPaymentOpen(false);
      showNotification(`✓ Confirmed payment of $${paymentForm.amount} for ${selectedInvoice.invoice_number}.`);
      loadAllBillingData();
    } catch (err) {
      alert("Failed to record payment");
    }
  };

  const handleRefundPayment = async () => {
    if (!selectedInvoice || !selectedInvoice.payments?.length) return;
    const payment = selectedInvoice.payments[0];
    try {
      await refundInvoicePayment(payment.id, {
        refund_amount: Number(refundForm.refund_amount),
        reason: refundForm.reason,
      });
      setIsRefundPaymentOpen(false);
      showNotification(`✓ Issued refund of $${refundForm.refund_amount} for payment ${payment.transaction_reference}.`);
      loadAllBillingData();
    } catch (err) {
      alert("Failed to process refund");
    }
  };

  const handleCreateService = async () => {
    try {
      const created = await createServiceItem(serviceForm);
      setServices([...services, created]);
      setIsCreateServiceOpen(false);
      showNotification(`✓ Service ${created.code} - ${created.name} added to catalog.`);
    } catch (err) {
      alert("Failed to create service item");
    }
  };

  const handleCreateEngagement = async () => {
    try {
      const created = await createEngagement(engagementForm);
      setEngagements([created, ...engagements]);
      setIsCreateEngagementOpen(false);
      showNotification(`✓ Engagement contract ${created.engagement_number} created.`);
    } catch (err) {
      alert("Failed to create engagement");
    }
  };

  // Columns for Invoices DataTable
  const invoiceColumns: Column<InvoiceDetailItem>[] = [
    {
      key: "invoice_number",
      header: "Invoice #",
      sortable: true,
      render: (inv) => <strong style={{ color: "var(--text)" }}>{inv.invoice_number}</strong>,
    },
    {
      key: "client_name",
      header: "Client / Case",
      render: (inv) => (
        <div>
          <strong style={{ display: "block" }}>{inv.client_name || inv.client_id}</strong>
          <small style={{ color: "var(--quiet)" }}>{inv.case_id || "Unlinked"}</small>
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Total Invoiced",
      sortable: true,
      render: (inv) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(inv.total_amount, inv.currency)}
        </span>
      ),
    },
    {
      key: "paid_amount",
      header: "Paid Amount",
      render: (inv) => (
        <span style={{ color: "var(--success, #16a34a)", fontWeight: 600 }}>
          {formatCurrency(inv.paid_amount, inv.currency)}
        </span>
      ),
    },
    {
      key: "balance_due",
      header: "Outstanding Balance",
      sortable: true,
      render: (inv) => (
        <strong style={{ color: inv.balance_due > 0 ? "var(--critical, #e11d48)" : "var(--muted)" }}>
          {formatCurrency(inv.balance_due, inv.currency)}
        </strong>
      ),
    },
    {
      key: "status",
      header: "Payment Status",
      render: (inv) => {
        const variantMap: Record<string, "success" | "warning" | "critical" | "neutral" | "info"> = {
          paid: "success",
          issued: "warning",
          partially_paid: "info",
          overdue: "critical",
          refunded: "neutral",
        };
        return <Badge variant={variantMap[inv.status] || "neutral"}>{inv.status.toUpperCase()}</Badge>;
      },
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (inv) => (
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          {new Date(inv.due_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (inv) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedInvoice(inv)}
          >
            Inspect
          </Button>
          {inv.balance_due > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedInvoice(inv);
                setPaymentForm((prev) => ({ ...prev, amount: inv.balance_due }));
                setIsRecordPaymentOpen(true);
              }}
            >
              Pay
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} id="billing-manager">
      {/* Top Header & Overview */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Firm Billing, Retainers & Accounts Receivable
            </h2>
            <Badge variant="success" size="sm">
              PCI-DSS Tokenized
            </Badge>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Statutory service fees, invoice line items, tokenized payment settlement, and aging reports.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            id="btn-add-service-catalog"
            variant="outline"
            size="sm"
            onClick={() => setIsCreateServiceOpen(true)}
          >
            + Add Service
          </Button>
          <Button
            id="btn-new-engagement"
            variant="outline"
            size="sm"
            onClick={() => setIsCreateEngagementOpen(true)}
          >
            + New Engagement
          </Button>
          <Button
            id="btn-issue-invoice"
            variant="primary"
            size="sm"
            onClick={() => setIsCreateInvoiceOpen(true)}
          >
            + Issue Invoice
          </Button>
        </div>
      </div>

      {notification && (
        <div
          id="billing-notification-toast"
          style={{
            padding: "12px 16px",
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: "8px",
            color: "#065f46",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {notification}
        </div>
      )}

      {/* Financial Health Metrics Row */}
      {financialReports && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>TOTAL INVOICED</span>
            <strong style={{ fontSize: "22px", display: "block", color: "var(--text)", margin: "4px 0" }}>
              ${financialReports.summary.total_invoiced.toLocaleString()}
            </strong>
            <small style={{ color: "var(--quiet)" }}>Issued across all cases</small>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>CONFIRMED PAYMENTS</span>
            <strong style={{ fontSize: "22px", display: "block", color: "var(--success, #16a34a)", margin: "4px 0" }}>
              ${financialReports.summary.total_collected.toLocaleString()}
            </strong>
            <small style={{ color: "var(--quiet)" }}>Settled via Stripe / Wire</small>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>OUTSTANDING BALANCES</span>
            <strong style={{ fontSize: "22px", display: "block", color: "var(--critical, #e11d48)", margin: "4px 0" }}>
              ${financialReports.summary.total_outstanding.toLocaleString()}
            </strong>
            <small style={{ color: "var(--quiet)" }}>Awaiting client settlement</small>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>TOTAL REFUNDED</span>
            <strong style={{ fontSize: "22px", display: "block", color: "#64748b", margin: "4px 0" }}>
              ${financialReports.summary.total_refunded.toLocaleString()}
            </strong>
            <small style={{ color: "var(--quiet)" }}>Processed adjustments</small>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>NET COLLECTIONS</span>
            <strong style={{ fontSize: "22px", display: "block", color: "var(--accent, #0284c7)", margin: "4px 0" }}>
              ${financialReports.summary.net_collections.toLocaleString()}
            </strong>
            <small style={{ color: "var(--quiet)" }}>Net realized legal revenue</small>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div role="tablist" aria-label="Billing navigation sections" style={{ display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border, #e2e8f0)", paddingBottom: "8px" }}>
        <Button
          id="tab-btn-invoices"
          variant={activeSubTab === "invoices" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveSubTab("invoices")}
        >
          📄 Invoices & Ledgers ({invoices.length})
        </Button>
        <Button
          id="tab-btn-services"
          variant={activeSubTab === "services" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveSubTab("services")}
        >
          🏷️ Service Catalog ({services.length})
        </Button>
        <Button
          id="tab-btn-engagements"
          variant={activeSubTab === "engagements" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveSubTab("engagements")}
        >
          🤝 Client Engagements ({engagements.length})
        </Button>
        <Button
          id="tab-btn-reports"
          variant={activeSubTab === "reports" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveSubTab("reports")}
        >
          📊 Accounts Receivable Aging
        </Button>
      </div>

      {/* SUB-TAB: INVOICES */}
      {activeSubTab === "invoices" && (
        <Card title="Issued Invoices & Settlement Status" subtitle="Itemized legal fees, filing costs, and payment reconciliations.">
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            keyExtractor={(i) => i.id}
            searchPlaceholder="Search invoice #, client, or case ref..."
            searchFields={["invoice_number", "client_name", "case_id"]}
          />
        </Card>
      )}

      {/* SUB-TAB: SERVICES CATALOG */}
      {activeSubTab === "services" && (
        <Card
          title="Firm Service Fee Catalog"
          subtitle="Standardized fee structures, jurisdiction rules, and duration estimates."
        >
          <DataTable
            columns={[
              { key: "code", header: "Code", sortable: true, render: (s) => <code>{s.code}</code> },
              { key: "name", header: "Service Name", sortable: true, render: (s) => <strong>{s.name}</strong> },
              { key: "jurisdiction", header: "Jurisdiction", render: (s) => <Badge variant="neutral">{s.jurisdiction}</Badge> },
              { key: "pricing_model", header: "Pricing Model", render: (s) => <span>{s.pricing_model.toUpperCase()}</span> },
              { key: "base_fee", header: "Base Fee", sortable: true, render: (s) => <strong>${s.base_fee.toLocaleString()} {s.currency}</strong> },
              { key: "estimated_duration_days", header: "Est. Duration", render: (s) => <span>{s.estimated_duration_days} days</span> },
              { key: "is_active", header: "Status", render: (s) => <Badge variant={s.is_active ? "success" : "neutral"}>{s.is_active ? "Active" : "Archived"}</Badge> },
            ]}
            data={services}
            keyExtractor={(s) => s.id}
          />
        </Card>
      )}

      {/* SUB-TAB: CLIENT ENGAGEMENTS */}
      {activeSubTab === "engagements" && (
        <Card
          title="Client Engagement Contracts & Retainer Agreements"
          subtitle="Contractual retainers and milestones agreed upon with retained applicants."
        >
          <DataTable
            columns={[
              { key: "engagement_number", header: "Engagement #", render: (e) => <strong>{e.engagement_number}</strong> },
              { key: "client_id", header: "Client ID", render: (e) => <span>{e.client_id}</span> },
              { key: "status", header: "Status", render: (e) => <Badge variant={e.status === "active" ? "success" : "neutral"}>{e.status.toUpperCase()}</Badge> },
              { key: "retainer_amount", header: "Retainer Amount", render: (e) => <strong>${e.retainer_amount.toLocaleString()}</strong> },
              { key: "agreed_fee", header: "Agreed Fee", render: (e) => <strong>${e.agreed_fee.toLocaleString()}</strong> },
              { key: "billing_terms", header: "Billing Terms", render: (e) => <span>{e.billing_terms}</span> },
              { key: "created_at", header: "Signed At", render: (e) => <span style={{ fontSize: "12px", color: "var(--muted)" }}>{new Date(e.created_at).toLocaleDateString()}</span> },
            ]}
            data={engagements}
            keyExtractor={(e) => e.id}
          />
        </Card>
      )}

      {/* SUB-TAB: A/R AGING REPORTS */}
      {activeSubTab === "reports" && financialReports && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Card
            title="Accounts Receivable (A/R) Aging Schedule"
            subtitle="Standard 30-day delinquency buckets for outstanding client invoices."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                marginTop: "10px",
              }}
            >
              <div style={{ padding: "16px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>CURRENT (NOT DUE)</span>
                <strong style={{ fontSize: "24px", display: "block", color: "#15803d", margin: "6px 0" }}>
                  ${financialReports.accounts_receivable_aging.current_not_due.toLocaleString()}
                </strong>
                <small style={{ color: "#166534" }}>Within payment window</small>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "#fefce8", border: "1px solid #fef08a" }}>
                <span style={{ fontSize: "12px", color: "#854d0e", fontWeight: 700 }}>1 – 30 DAYS OVERDUE</span>
                <strong style={{ fontSize: "24px", display: "block", color: "#a16207", margin: "6px 0" }}>
                  ${financialReports.accounts_receivable_aging.overdue_1_to_30_days.toLocaleString()}
                </strong>
                <small style={{ color: "#854d0e" }}>First reminder notice</small>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <span style={{ fontSize: "12px", color: "#9a3412", fontWeight: 700 }}>31 – 60 DAYS OVERDUE</span>
                <strong style={{ fontSize: "24px", display: "block", color: "#c2410c", margin: "6px 0" }}>
                  ${financialReports.accounts_receivable_aging.overdue_31_to_60_days.toLocaleString()}
                </strong>
                <small style={{ color: "#9a3412" }}>Escalated follow-up</small>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: 700 }}>61 – 90 DAYS OVERDUE</span>
                <strong style={{ fontSize: "24px", display: "block", color: "#dc2626", margin: "6px 0" }}>
                  ${financialReports.accounts_receivable_aging.overdue_61_to_90_days.toLocaleString()}
                </strong>
                <small style={{ color: "#991b1b" }}>Hold filing preparation</small>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "#450a0a", color: "#ffffff" }}>
                <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 700 }}>90+ DAYS OVERDUE</span>
                <strong style={{ fontSize: "24px", display: "block", color: "#ffffff", margin: "6px 0" }}>
                  ${financialReports.accounts_receivable_aging.overdue_greater_90_days.toLocaleString()}
                </strong>
                <small style={{ color: "#fca5a5" }}>Collections / Write-off review</small>
              </div>
            </div>
          </Card>

          {/* Collections by Pathway */}
          <Card
            title="Realized Collections by Immigration Pathway"
            subtitle="Revenue contribution across visa types and statutory petition categories."
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {Object.entries(financialReports.collections_by_pathway || {}).map(([pathway, amount]) => (
                <div
                  key={pathway}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong style={{ fontSize: "14px" }}>{pathway}</strong>
                  <span style={{ fontWeight: 700, color: "var(--success, #16a34a)" }}>
                    ${amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: ISSUE INVOICE */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title="Issue New Client Invoice"
        subtitle="Generate an itemized invoice with statutory filing fees and legal service line items."
        maxWidth="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Client ID
              </label>
              <input
                id="input-invoice-client-id"
                type="text"
                value={newInvoiceData.client_id}
                onChange={(e) => setNewInvoiceData({ ...newInvoiceData, client_id: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Case ID
              </label>
              <input
                id="input-invoice-case-id"
                type="text"
                value={newInvoiceData.case_id}
                onChange={(e) => setNewInvoiceData({ ...newInvoiceData, case_id: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          {/* Line items table */}
          <div>
            <span style={{ fontSize: "13px", fontWeight: 700, display: "block", marginBottom: "8px" }}>
              Invoice Line Items
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {newInvoiceData.line_items.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1fr 1fr auto",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => {
                      const updated = [...newInvoiceData.line_items];
                      updated[idx].description = e.target.value;
                      setNewInvoiceData({ ...newInvoiceData, line_items: updated });
                    }}
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => {
                      const updated = [...newInvoiceData.line_items];
                      updated[idx].quantity = Number(e.target.value);
                      setNewInvoiceData({ ...newInvoiceData, line_items: updated });
                    }}
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                  <input
                    type="number"
                    step="50"
                    value={line.unit_price}
                    onChange={(e) => {
                      const updated = [...newInvoiceData.line_items];
                      updated[idx].unit_price = Number(e.target.value);
                      setNewInvoiceData({ ...newInvoiceData, line_items: updated });
                    }}
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>
                    ${line.quantity * line.unit_price}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewInvoiceData({
                  ...newInvoiceData,
                  line_items: [
                    ...newInvoiceData.line_items,
                    { description: "Additional Translation / Courier Service", quantity: 1, unit_price: 250, line_type: "translation", total: 250 },
                  ],
                });
              }}
              style={{ marginTop: "10px" }}
            >
              + Add Line Item
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Currency
              </label>
              <select
                id="select-invoice-currency"
                value={newInvoiceData.currency}
                onChange={(e) => setNewInvoiceData({ ...newInvoiceData, currency: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              >
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="INR">INR (₹ - Indian Rupee with 18% GST)</option>
                <option value="CAD">CAD (CA$ - Canadian Dollar)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                SAC Classification Code
              </label>
              <input
                type="text"
                value={newInvoiceData.sac_code}
                onChange={(e) => setNewInvoiceData({ ...newInvoiceData, sac_code: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                placeholder="998311"
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Payment Terms (Days)
              </label>
              <input
                type="number"
                value={newInvoiceData.due_days}
                onChange={(e) => setNewInvoiceData({ ...newInvoiceData, due_days: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          {newInvoiceData.currency === "INR" && (
            <div style={{ padding: "12px", background: "rgba(22, 163, 74, 0.05)", border: "1px solid rgba(22, 163, 74, 0.2)", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "13px", color: "var(--text)" }}>Indian GST Compliance (SAC 998311 - 18%)</strong>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newInvoiceData.is_interstate}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, is_interstate: e.target.checked })}
                  />
                  <span>Inter-state Supply (IGST 18%)</span>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Client GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newInvoiceData.gstin}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, gstin: e.target.value })}
                    placeholder="27AABCU9603R1ZM"
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Place of Supply</label>
                  <input
                    type="text"
                    value={newInvoiceData.place_of_supply}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, place_of_supply: e.target.value })}
                    placeholder="Maharashtra (27)"
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "12px" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              padding: "12px",
              background: "var(--surface-subtle)",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>Total Computed Balance:</span>
              {newInvoiceData.currency === "INR" && (
                <small style={{ color: "var(--quiet)" }}>
                  {newInvoiceData.is_interstate
                    ? `Includes 18% IGST (${formatCurrency(newInvoiceData.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 0.18, "INR")})`
                    : `Includes 9% CGST + 9% SGST (${formatCurrency(newInvoiceData.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 0.18, "INR")})`}
                </small>
              )}
            </div>
            <strong style={{ fontSize: "18px", color: "var(--text)" }}>
              {formatCurrency(
                newInvoiceData.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) *
                  (newInvoiceData.currency === "INR" ? 1.18 : 1.0),
                newInvoiceData.currency
              )}
            </strong>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="ghost" onClick={() => setIsCreateInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-submit-issue-invoice" variant="primary" onClick={handleCreateInvoice}>
              Confirm & Issue Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: RECORD TOKENIZED PAYMENT */}
      <Modal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        title="Record Payment Settlement"
        subtitle={`Settle balance for ${selectedInvoice?.invoice_number || "Invoice"}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Strict Security Disclaimer */}
          <div
            style={{
              padding: "12px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#1e40af",
              lineHeight: 1.5,
            }}
          >
            <strong>🔒 PCI-DSS Tokenization Architecture:</strong>
            <p style={{ margin: "4px 0 0" }}>
              Raw Primary Account Numbers (PAN) and CVV codes are never handled or stored on application servers. Payments are processed
              via verified tokenized provider references. Only masked last-4 and card network brands are recorded for legal reconciliation.
            </p>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Settlement Amount ($ USD)
            </label>
            <input
              id="input-payment-amount"
              type="number"
              step="100"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Settlement Method
            </label>
            <select
              id="select-payment-method"
              value={paymentForm.payment_method}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            >
              <option value="credit_card">Credit Card (Stripe Tokenized Provider)</option>
              <option value="wire_transfer">Direct Bank Wire / ACH</option>
              <option value="escrow_trust">Attorney Trust / Escrow Drawdown</option>
            </select>
          </div>

          {paymentForm.payment_method === "credit_card" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Card Brand
                </label>
                <select
                  id="select-card-brand"
                  value={paymentForm.card_brand}
                  onChange={(e) => setPaymentForm({ ...paymentForm, card_brand: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Masked Last 4 Digits
                </label>
                <input
                  id="input-card-last4"
                  type="text"
                  maxLength={4}
                  value={paymentForm.card_last4}
                  onChange={(e) => setPaymentForm({ ...paymentForm, card_last4: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="ghost" onClick={() => setIsRecordPaymentOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-confirm-record-payment" variant="primary" onClick={handleRecordPayment}>
              Confirm Tokenized Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* DRAWER: INSPECT INVOICE DETAILS */}
      {selectedInvoice && (
        <Drawer
          isOpen={!!selectedInvoice && !isRecordPaymentOpen && !isRefundPaymentOpen}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice ${selectedInvoice.invoice_number}`}
          subtitle={`Issued on ${new Date(selectedInvoice.issue_date).toLocaleDateString()}`}
          badge={<Badge variant={selectedInvoice.status === "paid" ? "success" : "warning"}>{selectedInvoice.status.toUpperCase()}</Badge>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", background: "var(--surface-subtle)", borderRadius: "8px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>CLIENT</span>
                <strong style={{ display: "block", fontSize: "14px" }}>{selectedInvoice.client_name || selectedInvoice.client_id}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>CASE REF</span>
                <strong style={{ display: "block", fontSize: "14px" }}>{selectedInvoice.case_id || "Unlinked"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>TOTAL INVOICED</span>
                <strong style={{ display: "block", fontSize: "16px" }}>{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>REMAINING DUE</span>
                <strong style={{ display: "block", fontSize: "16px", color: selectedInvoice.balance_due > 0 ? "var(--critical)" : "var(--success)" }}>
                  {formatCurrency(selectedInvoice.balance_due, selectedInvoice.currency)}
                </strong>
              </div>
            </div>

            {/* Indian GST Breakdown */}
            {(selectedInvoice.tax_amount > 0 || selectedInvoice.currency === "INR" || selectedInvoice.sac_code) && (
              <div style={{ padding: "10px 12px", background: "var(--surface-subtle)", borderRadius: "6px", fontSize: "12px", border: "1px solid var(--border)" }}>
                <strong style={{ display: "block", marginBottom: "4px", color: "var(--text)" }}>
                  GST Breakdown (SAC {selectedInvoice.sac_code || "998311"} - Legal & Consulting Support)
                </strong>
                {selectedInvoice.igst_amount && selectedInvoice.igst_amount > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span>IGST (18% Inter-state):</span>
                    <strong>{formatCurrency(selectedInvoice.igst_amount, selectedInvoice.currency)}</strong>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>CGST (9% Central GST):</span>
                      <strong>{formatCurrency(selectedInvoice.cgst_amount || selectedInvoice.tax_amount / 2, selectedInvoice.currency)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>SGST (9% State GST):</span>
                      <strong>{formatCurrency(selectedInvoice.sgst_amount || selectedInvoice.tax_amount / 2, selectedInvoice.currency)}</strong>
                    </div>
                  </div>
                )}
                {selectedInvoice.gstin && (
                  <div style={{ marginTop: "4px", color: "var(--quiet)", fontSize: "11px" }}>
                    GSTIN: <code>{selectedInvoice.gstin}</code> | Place of Supply: {selectedInvoice.place_of_supply || "N/A"}
                  </div>
                )}
              </div>
            )}

            {/* Line items */}
            <div>
              <h4 style={{ fontSize: "14px", margin: "0 0 8px" }}>Itemized Line Items</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(selectedInvoice.line_items || []).map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                    }}
                  >
                    <div>
                      <strong>{line.description}</strong>
                      <small style={{ display: "block", color: "var(--quiet)" }}>
                        Qty: {line.quantity} × ${line.unit_price} ({line.line_type})
                      </small>
                    </div>
                    <strong style={{ color: "var(--text)" }}>${line.total || line.quantity * line.unit_price}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Payments History */}
            <div>
              <h4 style={{ fontSize: "14px", margin: "0 0 8px" }}>Settlement & Payment Ledger</h4>
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedInvoice.payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--surface-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", display: "block" }}>
                          ${p.amount} ({p.payment_method})
                        </strong>
                        <small style={{ color: "var(--quiet)", fontFamily: "monospace" }}>
                          Ref: {p.transaction_reference} {p.card_last4 ? `• Card: ${p.card_brand?.toUpperCase()} ****${p.card_last4}` : ""}
                        </small>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <Badge variant={p.status === "succeeded" ? "success" : "neutral"} size="sm">
                          {p.status}
                        </Badge>
                        {p.status === "succeeded" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRefundForm({ refund_amount: p.amount, reason: "Client requested refund" });
                              setIsRefundPaymentOpen(true);
                            }}
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>No payments recorded yet.</span>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {/* MODAL: REFUND PAYMENT */}
      <Modal
        isOpen={isRefundPaymentOpen}
        onClose={() => setIsRefundPaymentOpen(false)}
        title="Issue Client Payment Refund"
        subtitle="Reverse settled funds with mandatory audit logging and reason classification."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Refund Amount ($ USD)
            </label>
            <input
              id="input-refund-amount"
              type="number"
              value={refundForm.refund_amount}
              onChange={(e) => setRefundForm({ ...refundForm, refund_amount: Number(e.target.value) })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Statutory / Business Reason
            </label>
            <input
              id="input-refund-reason"
              type="text"
              value={refundForm.reason}
              onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="ghost" onClick={() => setIsRefundPaymentOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-confirm-refund" variant="primary" onClick={handleRefundPayment}>
              Process Authorized Refund
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: ADD SERVICE ITEM */}
      <Modal
        isOpen={isCreateServiceOpen}
        onClose={() => setIsCreateServiceOpen(false)}
        title="Add Catalog Service Item"
        subtitle="Define a standardized legal fee offering with jurisdiction guidelines."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Service Code
            </label>
            <input
              id="input-service-code"
              type="text"
              value={serviceForm.code}
              onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Service Name
            </label>
            <input
              id="input-service-name"
              type="text"
              value={serviceForm.name}
              onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Jurisdiction
              </label>
              <select
                id="select-service-jurisdiction"
                value={serviceForm.jurisdiction}
                onChange={(e) => setServiceForm({ ...serviceForm, jurisdiction: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              >
                <option value="US">US</option>
                <option value="UK">UK</option>
                <option value="CA">CA</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Base Fee ($ USD)
              </label>
              <input
                id="input-service-fee"
                type="number"
                step="100"
                value={serviceForm.base_fee}
                onChange={(e) => setServiceForm({ ...serviceForm, base_fee: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="ghost" onClick={() => setIsCreateServiceOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-submit-service-item" variant="primary" onClick={handleCreateService}>
              Save Service Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: NEW CLIENT ENGAGEMENT */}
      <Modal
        isOpen={isCreateEngagementOpen}
        onClose={() => setIsCreateEngagementOpen(false)}
        title="Record New Retainer Engagement"
        subtitle="Establish an attorney-client engagement agreement and escrow retainer."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Client ID
            </label>
            <input
              id="input-engagement-client-id"
              type="text"
              value={engagementForm.client_id}
              onChange={(e) => setEngagementForm({ ...engagementForm, client_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Initial Retainer ($)
              </label>
              <input
                id="input-engagement-retainer"
                type="number"
                step="250"
                value={engagementForm.retainer_amount}
                onChange={(e) => setEngagementForm({ ...engagementForm, retainer_amount: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Agreed Total Fee ($)
              </label>
              <input
                id="input-engagement-agreed-fee"
                type="number"
                step="250"
                value={engagementForm.agreed_fee}
                onChange={(e) => setEngagementForm({ ...engagementForm, agreed_fee: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Billing Terms & Milestone Schedule
            </label>
            <input
              id="input-engagement-terms"
              type="text"
              value={engagementForm.billing_terms}
              onChange={(e) => setEngagementForm({ ...engagementForm, billing_terms: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="ghost" onClick={() => setIsCreateEngagementOpen(false)}>
              Cancel
            </Button>
            <Button id="btn-submit-engagement" variant="primary" onClick={handleCreateEngagement}>
              Create Engagement Record
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
