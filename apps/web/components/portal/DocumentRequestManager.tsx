import React, { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { DocumentRequestItem, DocumentRequestCommentItem } from "../../lib/types";
import {
  FALLBACK_DOCUMENT_REQUESTS,
  fetchDocumentRequests,
  respondToDocumentRequest,
  replaceDocumentRequestEvidence,
  reviewDocumentRequest,
  createDocumentRequest,
} from "../../lib/api";

interface DocumentRequestManagerProps {
  requests?: DocumentRequestItem[];
  caseId?: string;
  isStaffMode?: boolean;
  onRespond?: (requestId: string, documentId: string, notes?: string) => Promise<void>;
  onReplace?: (requestId: string, replacementDocId: string, explanation?: string) => Promise<void>;
  onReview?: (requestId: string, decision: "approved" | "rejected", reason?: string, notes?: string) => Promise<void>;
  onCreateRequest?: (payload: Partial<DocumentRequestItem>) => Promise<void>;
  onPostComment?: (requestId: string, content: string, isInternal?: boolean) => Promise<void>;
  onUploadEvidence?: (request: DocumentRequestItem) => void;
}

export function DocumentRequestManager({
  requests,
  caseId,
  isStaffMode = false,
  onRespond,
  onReplace,
  onReview,
  onCreateRequest,
  onPostComment,
  onUploadEvidence,
}: DocumentRequestManagerProps) {
  const [internalRequests, setInternalRequests] = useState<DocumentRequestItem[]>(
    requests || FALLBACK_DOCUMENT_REQUESTS
  );
  const [filter, setFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequestItem | null>(null);
  const [activeModal, setActiveModal] = useState<"upload" | "replace" | "review" | "comments" | "create" | null>(null);

  // Form states
  const [uploadFileName, setUploadFileName] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);

  // Staff creation form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("supporting_evidence");
  const [newRationale, setNewRationale] = useState("");
  const [newCitation, setNewCitation] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTranslationGuidance, setNewTranslationGuidance] = useState("");

  useEffect(() => {
    if (requests) {
      setInternalRequests(requests);
    } else {
      fetchDocumentRequests(caseId).then((data) => {
        if (data) setInternalRequests(data);
      }).catch(() => {
        setInternalRequests(FALLBACK_DOCUMENT_REQUESTS);
      });
    }
  }, [requests, caseId]);

  const filteredRequests = internalRequests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">✓ APPROVED</Badge>;
      case "rejected":
        return <Badge variant="critical">ACTION NEEDED (REJECTED)</Badge>;
      case "submitted":
        return <Badge variant="review">SUBMITTED (IN REVIEW)</Badge>;
      case "under_review":
        return <Badge variant="review">UNDER REVIEW</Badge>;
      default:
        return <Badge variant="action">AWAITING UPLOAD</Badge>;
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !uploadFileName.trim()) return;
    const dummyDocId = `doc-client-${Date.now()}`;
    if (activeModal === "replace") {
      if (onReplace) {
        await onReplace(selectedRequest.id, dummyDocId, responseNotes || "Replaced document");
      } else {
        const updated = await replaceDocumentRequestEvidence(selectedRequest.id, dummyDocId, responseNotes);
        setInternalRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    } else {
      if (onRespond) {
        await onRespond(selectedRequest.id, dummyDocId, responseNotes);
      } else {
        const updated = await respondToDocumentRequest(selectedRequest.id, dummyDocId, responseNotes);
        setInternalRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    }
    setActiveModal(null);
    setUploadFileName("");
    setResponseNotes("");
  };

  const handleReviewSubmit = async (decision: "approved" | "rejected") => {
    if (!selectedRequest) return;
    if (decision === "rejected" && !rejectionReason.trim()) {
      alert("Please provide a structured rejection reason to guide the client.");
      return;
    }
    if (onReview) {
      await onReview(selectedRequest.id, decision, rejectionReason, reviewNotes);
    } else {
      const updated = await reviewDocumentRequest(selectedRequest.id, decision, rejectionReason, reviewNotes);
      setInternalRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
    setActiveModal(null);
    setRejectionReason("");
    setReviewNotes("");
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !commentInput.trim()) return;
    await onPostComment?.(selectedRequest.id, commentInput, isInternalComment);
    setCommentInput("");
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newRationale.trim()) return;
    const payload = {
      title: newTitle,
      description: newDescription,
      category: newCategory,
      rationale: newRationale,
      statutory_requirement_code: newCitation,
      due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      translation_guidance: newTranslationGuidance,
    };
    if (onCreateRequest) {
      await onCreateRequest(payload);
    } else {
      const created = await createDocumentRequest(payload);
      setInternalRequests((prev) => [created, ...prev]);
    }
    setActiveModal(null);
    setNewTitle("");
    setNewDescription("");
    setNewRationale("");
    setNewCitation("");
    setNewDueDate("");
    setNewTranslationGuidance("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "var(--text, #0f172a)" }}>
            Document & Evidence Requests
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #64748b)" }}>
            Statutory evidence requests issued by your legal team with legal rationales and translation guidance.
          </p>
        </div>
      </div>

      {/* Top Controls: Filter Pills & Staff Action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {["all", "requested", "submitted", "approved", "rejected"].map((st) => (
            <Button
              key={st}
              variant={filter === st ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilter(st)}
              style={{ textTransform: "capitalize" }}
            >
              {st === "all" ? `All Requests (${internalRequests.length})` : st}
            </Button>
          ))}
        </div>

        {isStaffMode && (
          <Button
            variant="primary"
            size="sm"
            data-testid="create-request-btn"
            onClick={() => setActiveModal("create")}
          >
            + Issue Document Request
          </Button>
        )}
      </div>

      {/* Requests Feed */}
      {filteredRequests.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted, #64748b)" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📂</span>
            <strong style={{ fontSize: "15px", display: "block", color: "var(--text, #0f172a)" }}>
              No document requests match this filter
            </strong>
            <p style={{ fontSize: "13px", margin: "4px 0 0" }}>
              All evidence requests are up to date!
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              data-testid={`request-card-${req.id}`}
              style={{
                background: "var(--surface, #ffffff)",
                border: `1px solid ${req.status === "rejected" ? "#fca5a5" : "var(--border, #e2e8f0)"}`,
                borderRadius: "10px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", fontWeight: 600 }}>
                      {(req.category || "evidence").replace(/_/g, " ").toUpperCase()}
                    </span>
                    {req.statutory_requirement_code && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "#e0e7ff", color: "#3730a3", fontWeight: 600 }}>
                        {req.statutory_requirement_code}
                      </span>
                    )}
                    {getStatusBadge(req.status)}
                  </div>
                  <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    {req.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #64748b)" }}>
                    {req.description}
                  </p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {req.due_date && (
                    <div style={{ fontSize: "12px", color: "var(--quiet, #94a3b8)", marginBottom: "4px" }}>
                      📅 Due: <strong>{new Date(req.due_date).toLocaleDateString()}</strong>
                    </div>
                  )}
                  <span style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                    Issued: {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Statutory Rationale Box */}
              <div
                style={{
                  background: "var(--surface-subtle, #f8fafc)",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  borderLeft: "3px solid var(--accent, #3b82f6)",
                }}
              >
                <strong style={{ color: "var(--accent, #3b82f6)", display: "block", marginBottom: "2px" }}>
                  WHY THIS EVIDENCE IS REQUIRED:
                </strong>
                <span style={{ color: "var(--text, #0f172a)" }}>{req.rationale}</span>
              </div>

              {/* Translation Guidance or Alternatives if configured */}
              {(req.translation_guidance || req.acceptable_alternatives) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", fontSize: "12px" }}>
                  {req.translation_guidance && (
                    <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "6px", color: "#92400e" }}>
                      🌐 <strong>Translation Guidance:</strong> {req.translation_guidance}
                    </div>
                  )}
                  {req.acceptable_alternatives && (
                    <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: "6px", color: "#166534" }}>
                      💡 <strong>Acceptable Alternatives:</strong> {req.acceptable_alternatives}
                    </div>
                  )}
                </div>
              )}

              {/* Rejected Feedback Callout */}
              {req.status === "rejected" && req.rejection_reason && (
                <div
                  role="alert"
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "12px 14px",
                    fontSize: "13px",
                    color: "#991b1b",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "2px" }}>
                    ⚠️ Evidence Rejected — Action Required: Resubmission Feedback from Legal Reviewer:
                  </strong>
                  <span>{req.rejection_reason}</span>
                </div>
              )}

              {/* Bottom Actions Row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  paddingTop: "12px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(req);
                      setActiveModal("comments");
                    }}
                  >
                    💬 Ask Question / Notes ({req.comments_count || 0})
                  </Button>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {/* Client action buttons */}
                  {req.status === "rejected" && (
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid={`replace-btn-${req.id}`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setActiveModal("replace");
                      }}
                    >
                      🔄 Re-upload Evidence
                    </Button>
                  )}

                  {req.status === "requested" && (
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid={`upload-btn-${req.id}`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setActiveModal("upload");
                      }}
                    >
                      📤 Upload Requested Evidence
                    </Button>
                  )}

                  {/* Staff Review buttons */}
                  {isStaffMode && req.status === "submitted" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`review-btn-${req.id}`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setActiveModal("review");
                      }}
                    >
                      ⚖️ Review Submission
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Upload / Replace Modal */}
      {(activeModal === "upload" || activeModal === "replace") && selectedRequest && (
        <div
          data-testid="upload-replace-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>
              {activeModal === "replace" ? "Replace Rejected Document" : "Upload Evidence Document"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)" }}>
              Fulfilling request: <strong>{selectedRequest.title}</strong>
            </p>

            <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Select File or Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. ieee_senior_cert_highres.pdf"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Notes for Caseworker (Optional):
                </label>
                <textarea
                  placeholder="Provide context or explanation regarding this document version..."
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="ghost" type="button" onClick={() => setActiveModal(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" data-testid="submit-evidence-btn">
                  Submit Evidence →
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Staff Review Modal */}
      {activeModal === "review" && selectedRequest && (
        <div
          data-testid="staff-review-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>
              Review Client Evidence Submission
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)" }}>
              Petition Evidence: <strong>{selectedRequest.title}</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Staff Review Notes:
                </label>
                <textarea
                  placeholder="Internal review observations..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Rejection Reason (Mandatory if rejecting):
                </label>
                <textarea
                  placeholder="Explain why evidence is deficient and instruct how to fix (e.g. unreadable scan, missing signature)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                <Button variant="ghost" onClick={() => setActiveModal(null)}>
                  Cancel
                </Button>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    variant="danger"
                    data-testid="reject-evidence-btn"
                    onClick={() => handleReviewSubmit("rejected")}
                  >
                    Reject with Actionable Feedback
                  </Button>
                  <Button
                    variant="primary"
                    data-testid="approve-evidence-btn"
                    onClick={() => handleReviewSubmit("approved")}
                  >
                    Approve Evidence ✓
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Comments Drawer / Modal */}
      {activeModal === "comments" && selectedRequest && (
        <div
          data-testid="comments-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Q&A Thread: {selectedRequest.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)}>✕</Button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "10px", background: "var(--surface-subtle)", borderRadius: "6px", fontSize: "13px" }}>
                <strong style={{ fontSize: "12px", color: "var(--accent)" }}>Sarah Jenkins, Esq.</strong>
                <p style={{ margin: "2px 0 0" }}>Please let us know if you need help contacting the IEEE chapter secretary.</p>
              </div>
            </div>

            <form onSubmit={handleCommentSubmit} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <textarea
                placeholder="Ask question or provide update regarding this request..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
              {isStaffMode && (
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                  />
                  <span>Staff Internal Note (Hidden from client)</span>
                </label>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="primary" size="sm" type="submit">
                  Post Comment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Staff Create Request Modal */}
      {activeModal === "create" && (
        <div
          data-testid="create-request-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "18px" }}>Issue New Document Request</h3>
            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Document Title / Requested Evidence *:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peer Review Records from ACM"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Statutory Requirement Code / Citation:
                </label>
                <input
                  type="text"
                  placeholder="e.g. EB1A-CRIT-JUDGING (8 CFR § 204.5(h)(3)(iv))"
                  value={newCitation}
                  onChange={(e) => setNewCitation(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Legal Rationale & Justification *:
                </label>
                <textarea
                  placeholder="Explain why this document is required to prove extraordinary ability..."
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  required
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Category:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  >
                    <option value="supporting_evidence">Supporting Evidence</option>
                    <option value="identity_document">Identity Document</option>
                    <option value="educational_credential">Educational Credential</option>
                    <option value="tax_record">Tax Record</option>
                    <option value="recommendation_letter">Recommendation Letter</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Due Date:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Translation Guidance (if applicable):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Certified translation required if not in English."
                  value={newTranslationGuidance}
                  onChange={(e) => setNewTranslationGuidance(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="ghost" type="button" onClick={() => setActiveModal(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" data-testid="save-new-request-btn">
                  Issue Request →
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
