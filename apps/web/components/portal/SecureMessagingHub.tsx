"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageThreadItem,
  ThreadMessageItem,
} from "../../lib/types";
import {
  fetchMessageThreads,
  fetchThreadMessages,
  postThreadMessage,
  FALLBACK_MESSAGE_THREADS,
  FALLBACK_THREAD_MESSAGES,
} from "../../lib/api";

interface SecureMessagingHubProps {
  caseId?: string;
  isStaffMode?: boolean;
  onSelectDocument?: (documentId: string) => void;
  onSendMessage?: (content: string, threadId?: string) => void;
}

export function SecureMessagingHub({
  caseId,
  isStaffMode = false,
  onSelectDocument,
  onSendMessage,
}: SecureMessagingHubProps) {
  const [threads, setThreads] = useState<MessageThreadItem[]>(FALLBACK_MESSAGE_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    FALLBACK_MESSAGE_THREADS.length > 0 ? FALLBACK_MESSAGE_THREADS[0].id : null
  );
  const [messages, setMessages] = useState<ThreadMessageItem[]>(
    isStaffMode
      ? FALLBACK_THREAD_MESSAGES
      : FALLBACK_THREAD_MESSAGES.filter((m) => !m.is_internal)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "archived">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // New message input
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [newAttachmentInput, setNewAttachmentInput] = useState("");

  // New thread modal state
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadType, setNewThreadType] = useState<"client_inquiry" | "case_update" | "document_request" | "general">("client_inquiry");
  const [newThreadInitialMessage, setNewThreadInitialMessage] = useState("");

  useEffect(() => {
    loadThreads();
  }, [caseId]);

  async function loadThreads() {
    setLoading(true);
    try {
      const data = await fetchMessageThreads(caseId);
      setThreads(data);
      if (data.length > 0 && !activeThreadId) {
        setActiveThreadId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load message threads:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  async function loadMessages(threadId: string) {
    setMessagesLoading(true);
    try {
      const data = await fetchThreadMessages(threadId);
      // Filter out internal messages if viewing as client
      const visible = isStaffMode ? data : data.filter((m) => !m.is_internal);
      setMessages(visible);
    } catch (err) {
      console.error("Failed to load thread messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  }

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const matchesSearch =
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.last_message_preview || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesType = typeFilter === "all" || t.thread_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [threads, searchQuery, statusFilter, typeFilter]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThreadId || !replyText.trim() || sending) return;

    const sentContent = replyText.trim();
    setSending(true);
    try {
      onSendMessage?.(sentContent, activeThreadId);
      const newMsg = await postThreadMessage(
        activeThreadId,
        sentContent,
        isStaffMode ? isInternalNote : false,
        attachmentIds
      );
      setMessages((prev) => [...prev, newMsg]);
      setReplyText("");
      setIsInternalNote(false);
      setAttachmentIds([]);
      setNewAttachmentInput("");

      // Update thread last message preview
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? {
                ...t,
                messages_count: t.messages_count + 1,
                last_message_preview: sentContent,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  function handleAddAttachment() {
    if (newAttachmentInput.trim() && !attachmentIds.includes(newAttachmentInput.trim())) {
      setAttachmentIds([...attachmentIds, newAttachmentInput.trim()]);
      setNewAttachmentInput("");
    }
  }

  function handleRemoveAttachment(id: string) {
    setAttachmentIds(attachmentIds.filter((item) => item !== id));
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newThreadSubject.trim() || !newThreadInitialMessage.trim()) return;

    const mockId = `thread-${Date.now()}`;
    const newThread: MessageThreadItem = {
      id: mockId,
      case_id: caseId || "case-01",
      case_number: "CASE-US-8841",
      subject: newThreadSubject.trim(),
      thread_type: newThreadType,
      status: "open",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages_count: 1,
      unread_count: 0,
      last_message_preview: newThreadInitialMessage.trim(),
    };

    setThreads([newThread, ...threads]);
    setActiveThreadId(mockId);

    // Initial message
    const initialMsg: ThreadMessageItem = {
      id: `msg-${Date.now()}`,
      thread_id: mockId,
      sender_id: isStaffMode ? "staff-lawyer" : "client-user",
      sender_name: isStaffMode ? "Sarah Jenkins, Esq." : "Dr. Elena Rostova",
      sender_role: isStaffMode ? "lawyer" : "client",
      content: newThreadInitialMessage.trim(),
      is_internal: false,
      attachment_document_ids: [],
      delivery_status: "delivered",
      created_at: new Date().toISOString(),
    };
    setMessages([initialMsg]);

    setIsCreatingThread(false);
    setNewThreadSubject("");
    setNewThreadInitialMessage("");
  }

  const getThreadTypeBadge = (type: string) => {
    switch (type) {
      case "case_update":
        return { label: "Case Update", bg: "#E8F1F5", color: "#1B526B", border: "#BED6E3" };
      case "document_request":
        return { label: "Document Request", bg: "#F5EFE6", color: "#7A5318", border: "#E8D7C0" };
      case "client_inquiry":
        return { label: "Client Inquiry", bg: "#EAF6F0", color: "#0D6866", border: "#B9DED4" };
      default:
        return { label: "General", bg: "#F1F6F4", color: "#445451", border: "#DCE5E1" };
    }
  };

  const getDeliveryIndicator = (msg: ThreadMessageItem) => {
    if (msg.delivery_status === "failed") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: "#DC2626",
            fontWeight: 600,
          }}
          title="Failed to deliver. Provider retry queued."
        >
          <span>⚠️</span> Delivery failed
        </span>
      );
    }
    if (msg.read_at) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: "#0D6866",
            fontWeight: 600,
          }}
          title={`Read at ${new Date(msg.read_at).toLocaleTimeString()}`}
        >
          <span>✓✓</span> Read
        </span>
      );
    }
    if (msg.delivery_status === "delivered" || msg.delivered_at) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: "#166534",
            fontWeight: 600,
          }}
          title="Delivered to recipient mailbox"
        >
          <span>✓✓</span> Delivered
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          color: "#6E7F7C",
          fontWeight: 500,
        }}
        title="Sent by server"
      >
        <span>✓</span> Sent
      </span>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "760px",
        background: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        boxShadow: "0 4px 20px rgba(6, 60, 61, 0.05)",
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid #DCE5E1",
          background: "#F8F7F2",
          flexShrink: 0,
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#0D6866",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 6px rgba(13, 104, 102, 0.25)",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#063C3D",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Attorney Communications
                <span style={{ fontSize: "13px", color: "#6E7F7C", fontWeight: 400 }}>
                  | Secure Communications Hub
                </span>
              </h2>
              {isStaffMode && (
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontWeight: 650,
                    background: "#FEF3C7",
                    color: "#92400E",
                    border: "1px solid #FCD34D",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>🛡️</span> Staff View (Internal Notes Enabled)
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
              End-to-end encrypted legal messaging with cryptographic audit trail and internal notes separation
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setIsCreatingThread(true)}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "13px",
              borderRadius: "8px",
              padding: "8px 16px",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(13, 104, 102, 0.25)",
              transition: "background 0.15s ease",
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ New Thread</span>
          </button>
        </div>
      </div>

      {/* Main Body: Two-Pane Split View */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Column: Thread List */}
        <div
          style={{
            width: "360px",
            minWidth: "320px",
            maxWidth: "380px",
            borderRight: "1px solid #DCE5E1",
            display: "flex",
            flexDirection: "column",
            background: "#FAFAF7",
            flexShrink: 0,
          }}
        >
          {/* Thread Search & Filter Bar */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #DCE5E1",
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search subject or case..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: "12px",
                  paddingTop: "7px",
                  paddingBottom: "7px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#F8F7F2",
                  color: "#172322",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <svg
                width="16"
                height="16"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "9px",
                  color: "#6E7F7C",
                  pointerEvents: "none",
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Filter threads by status"
                style={{
                  flex: 1,
                  fontSize: "11px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  color: "#445451",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter threads by type"
                style={{
                  flex: 1,
                  fontSize: "11px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  color: "#445451",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="all">All Types</option>
                <option value="client_inquiry">Inquiries</option>
                <option value="case_update">Updates</option>
                <option value="document_request">Requests</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Threads Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
                Loading conversation threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
                No message threads found.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const badge = getThreadTypeBadge(thread.thread_type);
                const isSelected = thread.id === activeThreadId;

                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 16px",
                      background: isSelected ? "#EAF6F0" : "#FFFFFF",
                      borderLeft: isSelected ? "4px solid #0D6866" : "4px solid transparent",
                      borderBottom: "1px solid #EAEFEA",
                      borderTop: "none",
                      borderRight: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 650,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {badge.label}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                        {new Date(thread.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "13px",
                        color: "#063C3D",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {thread.subject}
                    </div>

                    <div
                      style={{
                        fontSize: "11px",
                        color: "#445451",
                        lineHeight: "1.4",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {thread.last_message_preview || "No messages yet"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "10px",
                        color: "#6E7F7C",
                        paddingTop: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "#6E7F7C",
                          fontWeight: 600,
                        }}
                      >
                        {thread.case_number}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {thread.unread_count > 0 && (
                          <span
                            style={{
                              padding: "1px 6px",
                              borderRadius: "10px",
                              background: "#0D6866",
                              color: "#FFFFFF",
                              fontWeight: 700,
                              fontSize: "9px",
                            }}
                          >
                            {thread.unread_count} new
                          </span>
                        )}
                        <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                          {thread.messages_count} msgs
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Thread Messages */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#FFFFFF",
            minWidth: 0,
            height: "100%",
          }}
        >
          {activeThread ? (
            <>
              {/* Thread Info Bar */}
              <div
                style={{
                  padding: "14px 24px",
                  borderBottom: "1px solid #DCE5E1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#FFFFFF",
                  flexShrink: 0,
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#063C3D" }}>
                      {activeThread.subject}
                    </h3>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: "#EAF6F0",
                        color: "#0D6866",
                        border: "1px solid #B9DED4",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {activeThread.case_number}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    Thread Status:{" "}
                    <span
                      style={{
                        textTransform: "capitalize",
                        fontWeight: 600,
                        color: activeThread.status === "resolved" ? "#166534" : "#0D6866",
                      }}
                    >
                      {activeThread.status}
                    </span>{" "}
                    • Created {new Date(activeThread.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isStaffMode && (
                    <button
                      onClick={() => {
                        setThreads((prev) =>
                          prev.map((t) =>
                            t.id === activeThread.id
                              ? { ...t, status: t.status === "resolved" ? "open" : "resolved" }
                              : t
                          )
                        );
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: "1px solid #DCE5E1",
                        background: activeThread.status === "resolved" ? "#F1F6F4" : "#FFFFFF",
                        color: "#445451",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {activeThread.status === "resolved" ? "Reopen Thread" : "Mark Resolved"}
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Flow Area */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  background: "#F8F7F2",
                }}
              >
                {messagesLoading ? (
                  <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
                    Loading conversation messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
                    No messages in this thread yet.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isInternal = msg.is_internal;

                    if (isInternal) {
                      // Dedicated Staff Internal Note Banner & Card
                      return (
                        <div
                          key={msg.id}
                          style={{
                            margin: "0 auto",
                            width: "100%",
                            maxWidth: "680px",
                            background: "#FFFBEB",
                            border: "1.5px solid #FCD34D",
                            borderRadius: "12px",
                            padding: "16px 18px",
                            boxShadow: "0 2px 8px rgba(180, 83, 9, 0.08)",
                            boxSizing: "border-box",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#92400E",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>🔒</span>
                              <span>STAFF INTERNAL NOTE — HIDDEN FROM CLIENT</span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#B45309", fontWeight: 500 }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: "#78350F",
                              whiteSpace: "pre-wrap",
                              lineHeight: "1.55",
                            }}
                          >
                            {msg.content}
                          </p>
                          <div
                            style={{
                              marginTop: "12px",
                              paddingTop: "10px",
                              borderTop: "1px solid #FDE68A",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "11px",
                              color: "#92400E",
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>Author: {msg.sender_name}</span>
                            <span
                              style={{
                                fontSize: "10px",
                                background: "#FDE68A",
                                color: "#78350F",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontFamily: "monospace",
                                fontWeight: 700,
                              }}
                            >
                              INTERNAL WORK PRODUCT
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const isOutgoing = isStaffMode ? msg.sender_role !== "client" : msg.sender_role === "client";

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isOutgoing ? "flex-end" : "flex-start",
                          width: "100%",
                        }}
                      >
                        {/* Message Metadata Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                            fontSize: "11px",
                            color: "#6E7F7C",
                            padding: "0 4px",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#063C3D" }}>
                            {msg.sender_name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              textTransform: "uppercase",
                              fontFamily: "monospace",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              border: isOutgoing ? "1px solid #B9DED4" : "1px solid #DCE5E1",
                              background: isOutgoing ? "#EAF6F0" : "#F1F6F4",
                              color: isOutgoing ? "#0D6866" : "#445451",
                              fontWeight: 600,
                            }}
                          >
                            {msg.sender_role}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Message Bubble */}
                        <div
                          style={{
                            maxWidth: "580px",
                            borderRadius: isOutgoing ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            padding: "14px 18px",
                            fontSize: "13px",
                            lineHeight: "1.55",
                            boxShadow: isOutgoing
                              ? "0 2px 8px rgba(13, 104, 102, 0.15)"
                              : "0 2px 6px rgba(6, 60, 61, 0.04)",
                            background: isOutgoing ? "#0D6866" : "#FFFFFF",
                            color: isOutgoing ? "#FFFFFF" : "#172322",
                            border: isOutgoing ? "none" : "1px solid #DCE5E1",
                            boxSizing: "border-box",
                          }}
                        >
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {msg.content}
                          </p>

                          {/* Attachments Section */}
                          {msg.attachment_document_ids && msg.attachment_document_ids.length > 0 && (
                            <div
                              style={{
                                marginTop: "12px",
                                paddingTop: "10px",
                                borderTop: isOutgoing
                                  ? "1px solid rgba(255, 255, 255, 0.25)"
                                  : "1px solid #EAEFEA",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  opacity: 0.85,
                                }}
                              >
                                Attached Documents ({msg.attachment_document_ids.length})
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {msg.attachment_document_ids.map((docId) => (
                                  <button
                                    key={docId}
                                    type="button"
                                    onClick={() => onSelectDocument && onSelectDocument(docId)}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "4px 10px",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontFamily: "monospace",
                                      background: isOutgoing ? "rgba(255, 255, 255, 0.15)" : "#F1F6F4",
                                      color: isOutgoing ? "#FFFFFF" : "#0D6866",
                                      border: isOutgoing ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid #B9DED4",
                                      cursor: "pointer",
                                      transition: "background 0.15s ease",
                                    }}
                                  >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span>{docId}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delivery & Read state indicator */}
                        <div style={{ marginTop: "4px", padding: "0 4px" }}>
                          {getDeliveryIndicator(msg)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  flexShrink: 0,
                }}
              >
                <form onSubmit={handleSendMessage} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Staff Internal Note Toggle */}
                  {isStaffMode && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: isInternalNote ? "#FEF3C7" : "#FFFBEB",
                        border: isInternalNote ? "1px solid #F59E0B" : "1px solid #FCD34D",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          id="internalNoteToggle"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          style={{
                            width: "16px",
                            height: "16px",
                            accentColor: "#D97706",
                            cursor: "pointer",
                          }}
                        />
                        <label
                          htmlFor="internalNoteToggle"
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#92400E",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <span>🔒 Post as Staff-Only Internal Note</span>
                          <span style={{ fontSize: "11px", color: "#B45309", fontWeight: 400 }}>
                            (Completely invisible to client in portal & API responses)
                          </span>
                        </label>
                      </div>
                      {isInternalNote && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: "#78350F",
                            background: "#FDE68A",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                          }}
                        >
                          INTERNAL ONLY
                        </span>
                      )}
                    </div>
                  )}

                  {/* Textarea */}
                  <div style={{ position: "relative" }}>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? "Write confidential internal case note (lawyer-eyes only)..."
                          : "Type question or update for your legal team..."
                      }
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        fontSize: "13px",
                        lineHeight: "1.5",
                        borderRadius: "10px",
                        border: isInternalNote ? "1.5px solid #F59E0B" : "1px solid #DCE5E1",
                        background: isInternalNote ? "#FFFBEB" : "#FAFAF7",
                        color: "#172322",
                        boxSizing: "border-box",
                        outline: "none",
                        fontFamily: "inherit",
                        resize: "vertical",
                        minHeight: "72px",
                      }}
                    />
                  </div>

                  {/* Attachments pills */}
                  {attachmentIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 650, color: "#6E7F7C" }}>Attachments:</span>
                      {attachmentIds.map((id) => (
                        <span
                          key={id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            background: "#EAF6F0",
                            color: "#0D6866",
                            border: "1px solid #B9DED4",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          <span>{id}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#6E7F7C",
                              cursor: "pointer",
                              fontWeight: 700,
                              padding: "0 2px",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      paddingTop: "2px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="text"
                        placeholder="Doc ID (e.g. doc-01)"
                        value={newAttachmentInput}
                        onChange={(e) => setNewAttachmentInput(e.target.value)}
                        style={{
                          fontSize: "12px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#172322",
                          width: "150px",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddAttachment}
                        style={{
                          fontSize: "12px",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          background: "#F1F6F4",
                          color: "#0D6866",
                          border: "1px solid #DCE5E1",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        + Attach
                      </button>
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={!replyText.trim() || sending}
                        style={{
                          background: isInternalNote ? "#D97706" : "#0D6866",
                          color: "#FFFFFF",
                          fontWeight: 650,
                          borderRadius: "8px",
                          padding: "9px 20px",
                          border: "none",
                          cursor: !replyText.trim() || sending ? "not-allowed" : "pointer",
                          opacity: !replyText.trim() || sending ? 0.5 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13px",
                          boxShadow: isInternalNote
                            ? "0 2px 6px rgba(217, 119, 6, 0.25)"
                            : "0 2px 6px rgba(13, 104, 102, 0.25)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {sending ? (
                          <span>Sending...</span>
                        ) : (
                          <>
                            <span>{isInternalNote ? "Post Internal Note" : "Send"}</span>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px",
                textAlign: "center",
                color: "#6E7F7C",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "#EAF6F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                  color: "#0D6866",
                }}
              >
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 style={{ margin: "0 0 6px", fontWeight: 700, color: "#063C3D", fontSize: "15px" }}>
                No Thread Selected
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C", maxWidth: "300px" }}>
                Choose a conversation from the sidebar or click "New Thread" to start a secure communication.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Thread Modal */}
      {isCreatingThread && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "rgba(6, 60, 61, 0.5)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 40px rgba(6, 60, 61, 0.2)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #DCE5E1",
                paddingBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: "16px", color: "#063C3D" }}>
                Start New Case Message Thread
              </h3>
              <button
                onClick={() => setIsCreatingThread(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6E7F7C",
                  fontSize: "22px",
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateThread} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                  Thread Topic / Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question regarding academic apostille certification"
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FAFAF7",
                    color: "#172322",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                  Thread Classification
                </label>
                <select
                  value={newThreadType}
                  onChange={(e) => setNewThreadType(e.target.value as any)}
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FAFAF7",
                    color: "#172322",
                    boxSizing: "border-box",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="client_inquiry">Client Inquiry / Question</option>
                  <option value="case_update">Case Filing Progress Update</option>
                  <option value="document_request">Evidence Clarification</option>
                  <option value="general">General Administrative</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                  Opening Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type your initial message to start the thread..."
                  value={newThreadInitialMessage}
                  onChange={(e) => setNewThreadInitialMessage(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FAFAF7",
                    color: "#172322",
                    boxSizing: "border-box",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingThread(false)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    background: "transparent",
                    color: "#6E7F7C",
                    border: "1px solid #DCE5E1",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    fontWeight: 650,
                    fontSize: "13px",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
                  }}
                >
                  Create Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
