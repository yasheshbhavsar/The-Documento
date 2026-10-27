import React, { useState } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export interface PriorityQueueItem {
  id?: string;
  case_id?: string | null;
  case_number?: string;
  client_name?: string;
  title?: string;
  description?: string;
  deadline?: string;
  days_remaining?: number;
  days_overdue?: number;
  days_pending?: number;
  due_in_days?: number;
  is_overdue?: boolean;
  is_authority_request?: boolean;
  authority_type?: string;
  severity?: string;
  type?: string;
  item_type?: string;
  review_state?: string;
  blocker_reasons?: string[];
  blocker_reason?: string;
  regulatory_citation?: string;
  structured_reason_code?: string;
  code?: string;
  explanation?: string;
  timestamp?: string;
  submitted_at?: string;
  due_date?: string | null;
  status?: string;
  caseworker?: string;
  escalated_by?: string;
  [key: string]: any;
}

export interface StaffAllocationItem {
  user_id: string;
  full_name?: string;
  name?: string;
  email?: string;
  assigned_cases_count?: number;
  active_cases_count?: number;
  pending_tasks_count?: number;
  capacity_limit?: number;
  max_capacity?: number;
  utilization_percent?: number;
  capacity_utilization_percent?: number;
  allocation_status?: "AVAILABLE" | "OPTIMAL" | "OVERLOADED" | string;
}

export interface PriorityRankData {
  rank: number;
  title: string;
  priority: string;
  count?: number;
  description: string;
  items?: PriorityQueueItem[];
  staff_allocation?: StaffAllocationItem[];
  unassigned_cases?: Array<{
    case_id: string;
    case_number: string;
    title: string;
    visa_category: string;
  }>;
  unassigned_cases_count?: number;
  paid_count?: number;
  pending_count?: number;
  partially_paid_count?: number;
  paid_amount?: number;
  pending_amount?: number;
  partially_paid_amount?: number;
  first_time_pass_rate_percent?: number;
  [key: string]: any;
}

export interface ManagerPriorityQueueData {
  generated_at?: string;
  organization_id?: string;
  summary?: {
    critical_overdue_deadlines_count?: number;
    unassigned_cases_count?: number;
    blocked_cases_count?: number;
    overdue_client_responses_count?: number;
    pending_reviews_count?: number;
    quality_issues_count?: number;
    payment_summary?: {
      paid_count?: number;
      pending_count?: number;
      partially_paid_count?: number;
      paid_amount?: number;
      pending_amount?: number;
      partially_paid_amount?: number;
    };
    first_time_pass_rate_percent?: number;
  };
  ranks?: PriorityRankData[];
}

export interface ManagerPriorityQueueViewProps {
  data?: ManagerPriorityQueueData | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAction?: (rank: number, actionType: string, item: any) => void;
  filterRank?: number | "all";
}

export const FALLBACK_PRIORITY_QUEUE: ManagerPriorityQueueData = {
  summary: {
    critical_overdue_deadlines_count: 2,
    unassigned_cases_count: 1,
    blocked_cases_count: 2,
    overdue_client_responses_count: 3,
    pending_reviews_count: 4,
    quality_issues_count: 2,
    payment_summary: {
      paid_count: 18,
      pending_count: 6,
      partially_paid_count: 3,
      paid_amount: 42500,
      pending_amount: 14000,
      partially_paid_amount: 5500,
    },
    first_time_pass_rate_percent: 94.6,
  },
  ranks: [
    {
      rank: 1,
      title: "Critical/Overdue Deadlines (Especially Authority Requests)",
      priority: "CRITICAL",
      count: 2,
      description: "USCIS RFE/NOID, IRCC PFL, court/biometrics, and statutory filing deadlines",
      items: [
        {
          id: "r1-item-1",
          case_id: "case-01",
          case_number: "US-EB1A-8841",
          client_name: "Dr. Aris Thorne",
          title: "USCIS RFE Response: Kazarian Extraordinary Criteria Evidence",
          description: "Formal Request for Evidence regarding original scientific contributions",
          deadline_type: "USCIS RFE",
          authority_type: "USCIS RFE/NOID",
          is_authority_request: true,
          is_overdue: true,
          due_in_days: -2,
          days_remaining: -2,
          severity: "CRITICAL",
        },
        {
          id: "r1-item-2",
          case_id: "case-02",
          case_number: "CA-OINP-4102",
          client_name: "Elena Rostova",
          title: "IRCC Procedural Fairness Letter (PFL): Proof of Funds Audit",
          description: "Procedural Fairness Letter concerning foreign liquid capital liquidity",
          deadline_type: "IRCC PFL",
          authority_type: "IRCC PFL",
          is_authority_request: true,
          is_overdue: false,
          due_in_days: 4,
          days_remaining: 4,
          severity: "CRITICAL",
        },
      ],
    },
    {
      rank: 2,
      title: "Workload & Allocation",
      priority: "HIGH",
      count: 3,
      unassigned_cases_count: 1,
      description: "Officer caseload distribution, capacity utilization %, and unassigned queue",
      staff_allocation: [
        {
          user_id: "usr-01",
          name: "Adv. Sarah Jenkins",
          full_name: "Adv. Sarah Jenkins",
          assigned_cases_count: 22,
          active_cases_count: 22,
          max_capacity: 25,
          capacity_utilization_percent: 88,
          utilization_percent: 88,
          allocation_status: "OPTIMAL",
        },
        {
          user_id: "usr-02",
          name: "Michael Chen, Esq.",
          full_name: "Michael Chen, Esq.",
          assigned_cases_count: 26,
          active_cases_count: 26,
          max_capacity: 25,
          capacity_utilization_percent: 104,
          utilization_percent: 104,
          allocation_status: "OVERLOADED",
        },
        {
          user_id: "usr-03",
          name: "Priya Sharma (Paralegal)",
          full_name: "Priya Sharma (Paralegal)",
          assigned_cases_count: 14,
          active_cases_count: 14,
          max_capacity: 25,
          capacity_utilization_percent: 56,
          utilization_percent: 56,
          allocation_status: "AVAILABLE",
        },
      ],
      unassigned_cases: [
        {
          case_id: "case-unassigned-1",
          case_number: "US-NIW-9921",
          title: "National Interest Waiver - Aerospace Engineer",
          visa_category: "EB-2 NIW",
        },
      ],
    },
    {
      rank: 3,
      title: "Blocked Cases",
      priority: "HIGH",
      count: 2,
      description: "Hard statutory blockers, critical discrepancies, and unresolved anomalies",
      items: [
        {
          id: "r3-item-1",
          case_id: "case-03",
          case_number: "US-EB2-2291",
          client_name: "Marcus Vance",
          blocker_reason: "Statutory Ineligibility: Unlawful Presence Exceeds 180 Days without 245(k) Relief",
          regulatory_citation: "INA § 212(a)(9)(B)(i)(I) & INA § 245(k)",
          blockers_count: 1,
          severity: "HIGH",
        },
        {
          id: "r3-item-2",
          case_id: "case-04",
          case_number: "US-O1A-3990",
          client_name: "Dr. Yuki Tanaka",
          blocker_reason: "Critical Discrepancy: Passport Birth Date Conflicts with Form DS-2019",
          regulatory_citation: "8 CFR § 204.5(h)(3)",
          blockers_count: 1,
          severity: "HIGH",
        },
      ],
    },
    {
      rank: 4,
      title: "Overdue Client Responses",
      priority: "MEDIUM",
      count: 2,
      description: "Overdue document requests and stalled evidentiary questionnaires",
      items: [
        {
          id: "r4-item-1",
          case_id: "case-05",
          case_number: "US-H1B-5510",
          client_name: "Rajesh Patel",
          item_description: "Missing Certified Degree Equivalency Evaluation & Transcripts",
          days_pending: 12,
          days_overdue: 12,
          severity: "MEDIUM",
        },
        {
          id: "r4-item-2",
          case_id: "case-06",
          case_number: "CA-LMIA-1104",
          client_name: "Claire Dubois",
          item_description: "Stalled Evidentiary Background Questionnaire (42% completed)",
          days_pending: 8,
          days_overdue: 8,
          severity: "MEDIUM",
        },
      ],
    },
    {
      rank: 5,
      title: "Pending Reviews",
      priority: "MEDIUM",
      count: 3,
      description: "Evidence awaiting verification, submitted application forms, and packages in review",
      items: [
        {
          id: "r5-item-1",
          type: "Form Submission",
          title: "Form I-140 Immigrant Petition for Alien Worker",
          case_number: "US-EB1A-8841",
          caseworker: "Priya Sharma",
          review_state: "pending_review",
        },
        {
          id: "r5-item-2",
          type: "Evidentiary Document",
          title: "Translated Police Clearance Certificate - France",
          case_number: "CA-PR-8812",
          caseworker: "Michael Chen",
          review_state: "under_review",
        },
        {
          id: "r5-item-3",
          type: "Filing Package",
          title: "Filing Dossier Package (v1.2) - Complete Petition",
          case_number: "US-O1A-3990",
          caseworker: "Sarah Jenkins",
          review_state: "ready_for_review",
        },
      ],
    },
    {
      rank: 6,
      title: "Quality Issues, Corrections & Escalations",
      priority: "MEDIUM",
      count: 2,
      description: "Rejected documents, manual field overrides, and partner escalations",
      items: [
        {
          id: "r6-item-1",
          code: "BLURRY_IMAGE",
          title: "Unreadable Passport Bio Page Scan",
          case_number: "US-EB1A-8841",
          escalated_by: "System Intake Validator",
          explanation: "Corners cropped and MRZ zone unreadable due to glare.",
        },
        {
          id: "r6-item-2",
          code: "MANUAL_FIELD_OVERRIDE",
          title: "Staff Manual Override: Alien Registration Number",
          case_number: "US-O1A-3990",
          escalated_by: "Michael Chen, Esq.",
          explanation: "OCR extracted trailing digit '8' as 'B'; corrected with physical audit note.",
        },
      ],
    },
    {
      rank: 7,
      title: "Payment Status",
      priority: "FINANCIAL",
      count: 3,
      paid_amount: 42500,
      paid_count: 18,
      pending_amount: 14000,
      pending_count: 6,
      partially_paid_amount: 5500,
      partially_paid_count: 3,
      description: "Accounts receivable aging and retainer fees: Paid, Pending, and Partially Paid",
      items: [
        {
          id: "inv-01",
          invoice_number: "INV-2026-088",
          client_name: "Dr. Aris Thorne",
          amount: 5000,
          paid_amount: 5000,
          balance_due: 0,
          status: "PAID",
        },
        {
          id: "inv-02",
          invoice_number: "INV-2026-092",
          client_name: "Elena Rostova",
          amount: 3500,
          paid_amount: 0,
          balance_due: 3500,
          status: "PENDING",
        },
        {
          id: "inv-03",
          invoice_number: "INV-2026-095",
          client_name: "Marcus Vance",
          amount: 4000,
          paid_amount: 2000,
          balance_due: 2000,
          status: "PARTIALLY_PAID",
        },
      ],
    },
    {
      rank: 8,
      title: "Performance View & Quality Improvement",
      priority: "PERFORMANCE",
      count: 1,
      first_time_pass_rate_percent: 94.6,
      description: "Continuous quality improvement, team coaching, first-time-right %, and learning analytics",
      items: [
        {
          id: "r8-item-1",
          title: "Quality Mentoring & Enablement Index",
          first_time_right_rate: 94.6,
          median_turnaround_hours: 18.5,
          coaching_focus: "Evidence citation standardization for O-1A advisory opinions",
        },
      ],
    },
  ],
};

export function ManagerPriorityQueueView({
  data,
  isLoading = false,
  error = null,
  onRetry,
  onAction,
  filterRank = "all",
}: ManagerPriorityQueueViewProps) {
  const [selectedRankFilter, setSelectedRankFilter] = useState<number | "all">(filterRank);

  const activeData = data || FALLBACK_PRIORITY_QUEUE;
  const ranks = activeData.ranks || [];

  const filteredRanks =
    selectedRankFilter === "all"
      ? ranks
      : ranks.filter((r) => r.rank === selectedRankFilter);

  const handleActionClick = (rank: number, actionType: string, item: any) => {
    if (onAction) {
      onAction(rank, actionType, item);
    }
  };

  if (isLoading) {
    return (
      <div
        role="region"
        aria-label="Loading Manager Priority Queue"
        style={{
          padding: "40px",
          textAlign: "center",
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #DCE5E1",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
        <strong style={{ color: "#063C3D", fontSize: "15px" }}>Loading 8-Rank Priority Triage Queue...</strong>
        <p style={{ color: "#64748B", fontSize: "12px", margin: "4px 0 0" }}>
          Synchronizing authority deadlines, active bottlenecks, and caseworker allocations.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-label="Priority Queue Loading Error"
        style={{
          padding: "32px",
          textAlign: "center",
          background: "#FEF2F2",
          borderRadius: "12px",
          border: "1px solid #FECACA",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</div>
        <strong style={{ color: "#991B1B", fontSize: "15px" }}>Failed to Load Priority Queue</strong>
        <p style={{ color: "#7F1D1D", fontSize: "13px", margin: "4px 0 16px" }}>{error}</p>
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Retry Synchronization
          </Button>
        )}
      </div>
    );
  }

  const totalPriorityCount = ranks.reduce((acc, r) => acc + (r.count || 0), 0);

  return (
    <div
      id="manager-priority-queue-view"
      role="region"
      aria-label="Staff Work Queue Priority Triage - 8 Strict Ranks"
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {/* Header Bar */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "12px",
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "18px" }} aria-hidden="true">🚨</span>
            <h2 style={{ margin: 0, fontSize: "16px", color: "#063C3D", fontWeight: 750 }}>
              Strict 1–8 Rank Order Management Protocol
            </h2>
            <Badge variant="action">Rank 1 to 8 Triage</Badge>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B" }}>
            Priority triage is enforced strictly in Ranks 1 through 8. Resolving critical authority deadlines and structural blockers unlocks lower-tier processing.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <Badge variant="success">
            FTFR: {activeData.summary?.first_time_pass_rate_percent || 94.6}%
          </Badge>
          <Badge variant="review">
            {ranks.length} Priority Ranks Active
          </Badge>
          <Badge variant="neutral">
            {totalPriorityCount} Action Items Pending
          </Badge>
        </div>
      </div>

      {/* Rank Quick Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          paddingBottom: "4px",
        }}
        role="tablist"
        aria-label="Filter Priority Ranks"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedRankFilter === "all"}
          onClick={() => setSelectedRankFilter("all")}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: selectedRankFilter === "all" ? 750 : 550,
            background: selectedRankFilter === "all" ? "#0D6866" : "#FFFFFF",
            color: selectedRankFilter === "all" ? "#FFFFFF" : "#172322",
            border: selectedRankFilter === "all" ? "1px solid #0D6866" : "1px solid #DCE5E1",
            cursor: "pointer",
            minHeight: "44px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          All 8 Ranks ({totalPriorityCount})
        </button>
        {ranks.map((r) => {
          const isSelected = selectedRankFilter === r.rank;
          return (
            <button
              key={r.rank}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedRankFilter(r.rank)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: isSelected ? 750 : 550,
                background: isSelected ? "#0D6866" : "#FFFFFF",
                color: isSelected ? "#FFFFFF" : "#172322",
                border: isSelected ? "1px solid #0D6866" : "1px solid #DCE5E1",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>Rank {r.rank}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: isSelected ? "#063C3D" : "#E2E8F0",
                  color: isSelected ? "#FFFFFF" : "#475569",
                }}
              >
                {r.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sequential Cards for Ranks 1 through 8 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filteredRanks.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px dashed #CBD5E1",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }} aria-hidden="true">✅</div>
            <strong style={{ fontSize: "15px", color: "#063C3D" }}>
              Zero Priority Exceptions Pending • Day 0 Clean Slate
            </strong>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>
              All client filings, authority deadlines, and quality reviews are completely up to date.
            </p>
          </div>
        ) : (
          filteredRanks.map((rankItem) => {
            const r = rankItem.rank;
            const isCrit = rankItem.priority === "CRITICAL" || rankItem.priority === "P1_CRITICAL";
            const isHigh = rankItem.priority === "HIGH" || rankItem.priority === "P2_HIGH" || rankItem.priority === "P3_HIGH";
            const isMedium = rankItem.priority === "MEDIUM" || rankItem.priority.startsWith("P4_") || rankItem.priority.startsWith("P5_") || rankItem.priority.startsWith("P6_");
            const borderLeft = isCrit
              ? "5px solid #DC2626"
              : isHigh
              ? "5px solid #F59E0B"
              : isMedium
              ? "5px solid #0284C7"
              : "5px solid #0D6866";

            return (
              <div
                key={r}
                data-testid={`priority-rank-${r}`}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderLeft,
                  borderRadius: "10px",
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {/* Rank Card Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: isCrit ? "#DC2626" : isHigh ? "#F59E0B" : "#0D6866",
                        color: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 800,
                      }}
                      aria-hidden="true"
                    >
                      {r}
                    </span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "#063C3D", fontWeight: 750 }}>
                          Rank {r}: {rankItem.title}
                        </h3>
                        <Badge
                          variant={isCrit ? "action" : isHigh ? "warning" : isMedium ? "review" : "neutral"}
                          size="sm"
                        >
                          {rankItem.priority}
                        </Badge>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                        {rankItem.description}
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 750,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "#F8FAF9",
                      color: "#063C3D",
                      border: "1px solid #DCE5E1",
                    }}
                  >
                    {rankItem.count} {rankItem.count === 1 ? "Item" : "Items"}
                  </span>
                </div>

                {/* =========================================================================
                    Rank 1: Critical/Overdue Deadlines (Especially Authority Requests)
                    ========================================================================= */}
                {r === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {(!rankItem.items || rankItem.items.length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                        No overdue or critical authority deadlines in this period.
                      </p>
                    ) : (
                      rankItem.items.map((it) => {
                        const daysLeft = it.due_in_days !== undefined ? it.due_in_days : it.days_remaining;
                        const isOverdue = it.is_overdue || (daysLeft !== undefined && daysLeft < 0);

                        return (
                          <div
                            key={it.id || it.case_id}
                            style={{
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: "8px",
                              padding: "12px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <Badge variant="action" size="sm">
                                  {it.authority_type || "AUTHORITY REQUEST"}
                                </Badge>
                                <strong style={{ fontSize: "13px", color: "#991B1B" }}>
                                  {it.case_number} — {it.client_name}
                                </strong>
                              </div>
                              <span style={{ display: "block", fontSize: "12px", color: "#7F1D1D", marginTop: "3px" }}>
                                {it.title || it.description}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 750,
                                  color: isOverdue ? "#991B1B" : "#DC2626",
                                  background: "#FEE2E2",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                }}
                              >
                                {isOverdue
                                  ? `⚠️ Overdue by ${Math.abs(daysLeft || 1)} days`
                                  : `⚡ ${daysLeft} days remaining`}
                              </span>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleActionClick(1, "dispatch_action", it)}
                                aria-label={`Dispatch Action for ${it.case_number}`}
                              >
                                Dispatch Action →
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* =========================================================================
                    Rank 2: Workload & Officer Allocation Matrix
                    ========================================================================= */}
                {r === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {rankItem.staff_allocation?.map((st) => {
                        const name = st.full_name || st.name || "Caseworker";
                        const assigned = st.assigned_cases_count !== undefined ? st.assigned_cases_count : st.active_cases_count || 0;
                        const capacity = st.capacity_limit || st.max_capacity || 25;
                        const util = st.utilization_percent !== undefined ? st.utilization_percent : st.capacity_utilization_percent || 0;
                        const isOverloaded = util > 100;

                        return (
                          <div
                            key={st.user_id}
                            style={{
                              background: "#F8FAF9",
                              border: "1px solid #E2E8F0",
                              borderRadius: "8px",
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "6px" }}>
                              <strong style={{ fontSize: "12px", color: "#063C3D" }}>{name}</strong>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Badge
                                  variant={isOverloaded ? "action" : util >= 60 ? "review" : "neutral"}
                                  size="sm"
                                >
                                  {st.allocation_status || (isOverloaded ? "OVERLOADED" : util >= 60 ? "OPTIMAL" : "AVAILABLE")}
                                </Badge>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 750,
                                    color: isOverloaded ? "#DC2626" : "#0D6866",
                                  }}
                                >
                                  {util}% Utilized
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "6px" }}>
                              {assigned} / {capacity} Active Petitions
                            </span>
                            <div style={{ width: "100%", height: "6px", background: "#E2E8F0", borderRadius: "3px" }}>
                              <div
                                style={{
                                  width: `${Math.min(util, 100)}%`,
                                  height: "100%",
                                  background: isOverloaded ? "#DC2626" : "#0D6866",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Unassigned Intake Queue Notice */}
                    <div
                      style={{
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "12px",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <span style={{ color: "#92400E", fontWeight: 650 }}>
                        📋 Unassigned Intake Queue: {rankItem.unassigned_cases_count || rankItem.unassigned_cases?.length || 0} petitions waiting for primary lead assignment.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActionClick(2, "assign_caseworker", rankItem.unassigned_cases)}
                        aria-label="Assign Caseworker to unassigned queue"
                      >
                        Assign Caseworker →
                      </Button>
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    Rank 3: Blocked Cases
                    ========================================================================= */}
                {r === 3 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(!rankItem.items || rankItem.items.length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                        No blocked cases detected.
                      </p>
                    ) : (
                      rankItem.items.map((blk) => (
                        <div
                          key={blk.case_id || blk.id}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "12px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#063C3D", fontSize: "13px" }}>
                              {blk.case_number} — {blk.client_name}
                            </strong>
                            <p style={{ margin: "3px 0 0", color: "#DC2626", fontWeight: 650 }}>
                              ⛔ {blk.blocker_reason || blk.blocker_reasons?.join("; ") || "Statutory Blocker"}
                            </p>
                            {blk.regulatory_citation && (
                              <small style={{ color: "#64748B", display: "block", marginTop: "2px" }}>
                                Statutory Citation: {blk.regulatory_citation}
                              </small>
                            )}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleActionClick(3, "inspect_blocker", blk)}
                            aria-label={`Inspect Blocker for ${blk.case_number}`}
                          >
                            Inspect Blocker
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* =========================================================================
                    Rank 4: Overdue Client Responses
                    ========================================================================= */}
                {r === 4 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(!rankItem.items || rankItem.items.length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                        All client document requests and questionnaires are submitted on time.
                      </p>
                    ) : (
                      rankItem.items.map((od) => (
                        <div
                          key={od.id || od.case_id}
                          style={{
                            background: "#F8FAF9",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "12px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#063C3D" }}>
                              {od.client_name} ({od.case_number})
                            </strong>
                            <span style={{ display: "block", color: "#475569", marginTop: "2px" }}>
                              {od.title || od.item_description}
                            </span>
                            <small style={{ color: "#DC2626", fontWeight: 650, display: "block", marginTop: "2px" }}>
                              Stalled for {od.days_overdue || od.days_pending || 1} days past target date
                            </small>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActionClick(4, "dispatch_nudge", od)}
                            aria-label={`Dispatch Nudge via Chat for ${od.client_name}`}
                          >
                            Dispatch Nudge via Chat
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* =========================================================================
                    Rank 5: Pending Reviews
                    ========================================================================= */}
                {r === 5 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(!rankItem.items || rankItem.items.length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                        Zero items currently pending human legal sign-off.
                      </p>
                    ) : (
                      rankItem.items.map((rev) => (
                        <div
                          key={rev.id}
                          style={{
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "12px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#14532D" }}>
                              {rev.item_type || rev.type}: {rev.title}
                            </strong>
                            <span style={{ display: "block", color: "#166534", marginTop: "2px" }}>
                              Case: {rev.case_number} {rev.caseworker ? `• Prepared by: ${rev.caseworker}` : ""}
                            </span>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleActionClick(5, "review_signoff", rev)}
                            aria-label={`Review and Sign Off for ${rev.title}`}
                          >
                            Review &amp; Sign Off →
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* =========================================================================
                    Rank 6: Quality Issues, Corrections & Escalations
                    ========================================================================= */}
                {r === 6 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(!rankItem.items || rankItem.items.length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                        No rejected documents or supervisor escalations recorded.
                      </p>
                    ) : (
                      rankItem.items.map((qi) => (
                        <div
                          key={qi.id}
                          style={{
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "12px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#991B1B" }}>
                              [{qi.structured_reason_code || qi.code || "QUALITY_FLAG"}] {qi.title}
                            </strong>
                            <span style={{ display: "block", color: "#7F1D1D", marginTop: "2px" }}>
                              Case: {qi.case_number} {qi.escalated_by ? `• Escalated by: ${qi.escalated_by}` : ""}
                            </span>
                            {qi.explanation && (
                              <p style={{ margin: "3px 0 0", color: "#450A0A", fontSize: "11px" }}>
                                Note: {qi.explanation}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleActionClick(6, "adjudicate_quality", qi)}
                            aria-label={`Supervisor Adjudication for ${qi.title}`}
                          >
                            Supervisor Adjudication
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* =========================================================================
                    Rank 7: Payment Status
                    ========================================================================= */}
                {r === 7 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          background: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: "8px",
                          padding: "12px 14px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534" }}>PAID IN FULL</span>
                        <strong style={{ fontSize: "20px", display: "block", color: "#14532D", margin: "4px 0" }}>
                          ${(rankItem.paid_amount || 0).toLocaleString()}.00
                        </strong>
                        <span style={{ fontSize: "11px", color: "#166534" }}>
                          {rankItem.paid_count || 0} Retainer Invoices
                        </span>
                      </div>
                      <div
                        style={{
                          background: "#FEF3C7",
                          border: "1px solid #FDE68A",
                          borderRadius: "8px",
                          padding: "12px 14px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400E" }}>PENDING INVOICES</span>
                        <strong style={{ fontSize: "20px", display: "block", color: "#78350F", margin: "4px 0" }}>
                          ${(rankItem.pending_amount || 0).toLocaleString()}.00
                        </strong>
                        <span style={{ fontSize: "11px", color: "#92400E" }}>
                          {rankItem.pending_count || 0} Invoices Awaiting Payment
                        </span>
                      </div>
                      <div
                        style={{
                          background: "#F1F5F9",
                          border: "1px solid #CBD5E1",
                          borderRadius: "8px",
                          padding: "12px 14px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>PARTIALLY PAID</span>
                        <strong style={{ fontSize: "20px", display: "block", color: "#1E293B", margin: "4px 0" }}>
                          ${(rankItem.partially_paid_amount || 0).toLocaleString()}.00
                        </strong>
                        <span style={{ fontSize: "11px", color: "#475569" }}>
                          {rankItem.partially_paid_count || 0} Milestone Installments
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    Rank 8: Continuous Quality Improvement & Performance View
                    ========================================================================= */}
                {r === 8 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div
                      style={{
                        background: "#EAF6F0",
                        border: "1px solid #B9DED4",
                        borderRadius: "8px",
                        padding: "12px 14px",
                        fontSize: "12px",
                        color: "#0D6866",
                      }}
                    >
                      <strong>🌱 Continuous Quality Improvement Focus:</strong> Performance tracking is structured to support proactive team enablement, mentoring, and quality training, rather than blame-only evaluation.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>First-Time Pass Rate</span>
                        <strong style={{ fontSize: "18px", color: "#063C3D", display: "block", marginTop: "2px" }}>
                          {rankItem.first_time_pass_rate_percent || 94.6}%
                        </strong>
                        <span style={{ fontSize: "10px", color: "#166534" }}>+2.1% vs last quarter</span>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>Avg. Review Cycles</span>
                        <strong style={{ fontSize: "18px", color: "#063C3D", display: "block", marginTop: "2px" }}>
                          1.2
                        </strong>
                        <span style={{ fontSize: "10px", color: "#166534" }}>Goal: &lt; 1.5 cycles</span>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>Citation Grounding</span>
                        <strong style={{ fontSize: "18px", color: "#063C3D", display: "block", marginTop: "2px" }}>
                          99.2%
                        </strong>
                        <span style={{ fontSize: "10px", color: "#166534" }}>Statutory conformity</span>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>Peer Knowledge Sharing</span>
                        <strong style={{ fontSize: "18px", color: "#063C3D", display: "block", marginTop: "2px" }}>
                          88%
                        </strong>
                        <span style={{ fontSize: "10px", color: "#166534" }}>High collaboration</span>
                      </div>
                    </div>

                    <div>
                      <strong style={{ fontSize: "12px", color: "#063C3D", display: "block", marginBottom: "6px" }}>
                        Recommended Quality Coaching Areas:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#475569" }}>
                        {(rankItem.coaching_focus_areas || [
                          "Standardize Kazarian evidentiary citations across O-1A petitions",
                          "Ensure certified translation credentials accompany foreign civil documents",
                          "Cross-reference I-94 arrival record departure dates with biographical forms"
                        ]).map((fa: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: "3px" }}>{fa}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
