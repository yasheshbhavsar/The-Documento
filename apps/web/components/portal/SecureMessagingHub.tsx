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
                last_message_preview: replyText.trim(),
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
        return { label: "Case Update", bg: "bg-[#E8F1F5] text-[#1B526B] border-[#BED6E3]" };
      case "document_request":
        return { label: "Document Request", bg: "bg-[#F5EFE6] text-[#7A5318] border-[#E8D7C0]" };
      case "client_inquiry":
        return { label: "Client Inquiry", bg: "bg-[#EAF6F0] text-[#0D6866] border-[#B9DED4]" };
      default:
        return { label: "General", bg: "bg-[#F1F6F4] text-[#445451] border-[#DCE5E1]" };
    }
  };

  const getDeliveryIndicator = (msg: ThreadMessageItem) => {
    if (msg.delivery_status === "failed") {
      return (
        <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium" title="Failed to deliver. Provider retry queued.">
          <span>⚠️</span> Delivery failed
        </span>
      );
    }
    if (msg.read_at) {
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#0D6866]" title={`Read at ${new Date(msg.read_at).toLocaleTimeString()}`}>
          <span>✓✓</span> Read
        </span>
      );
    }
    if (msg.delivery_status === "delivered" || msg.delivered_at) {
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#176B50]" title="Delivered to recipient mailbox">
          <span>✓✓</span> Delivered
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] text-[#6E7F7C]" title="Sent by server">
        <span>✓</span> Sent
      </span>
    );
  };

  return (
    <div className="flex flex-col h-[740px] bg-white rounded-xl border border-[#DCE5E1] shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE5E1] bg-[#F8F7F2]">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#0D6866",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 6px rgba(13, 104, 102, 0.25)",
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
              Attorney Communications
              <span className="text-xs text-[#6E7F7C] font-normal">| Secure Communications Hub</span>
              {isStaffMode && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  Staff View (Internal Notes Enabled)
                </span>
              )}
            </h2>
            <p className="text-xs text-[#6E7F7C]">
              End-to-end encrypted legal messaging with cryptographic audit trail and internal notes separation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatingThread(true)}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "12px",
              borderRadius: "8px",
              padding: "8px 14px",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(13, 104, 102, 0.2)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Thread</span>
          </button>
        </div>
      </div>

      {/* Main Body: Threads List + Active Conversation */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Thread List */}
        <div className="w-80 sm:w-96 border-r border-[#DCE5E1] flex flex-col bg-[#FAFAF7]">
          {/* Thread Search & Filter Bar */}
          <div className="p-3 border-b border-[#DCE5E1] space-y-2 bg-white">
            <div className="relative">
              <input
                type="text"
                placeholder="Search subject or case..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#DCE5E1] bg-white text-[#172322] focus:outline-none focus:ring-1 focus:ring-[#0D6866] focus:border-[#0D6866]"
              />
              <svg className="w-4 h-4 text-[#6E7F7C] absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Filter threads by status"
                className="text-[11px] px-2 py-1 rounded border border-[#DCE5E1] bg-white text-[#445451] focus:outline-none focus:ring-1 focus:ring-[#0D6866]"
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
                className="text-[11px] px-2 py-1 rounded border border-[#DCE5E1] bg-white text-[#445451] focus:outline-none focus:ring-1 focus:ring-[#0D6866]"
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
          <div className="flex-1 overflow-y-auto divide-y divide-[#EAEFEA]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#6E7F7C]">Loading conversation threads...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6E7F7C]">No message threads found.</div>
            ) : (
              filteredThreads.map((thread) => {
                const badge = getThreadTypeBadge(thread.thread_type);
                const isSelected = thread.id === activeThreadId;

                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`w-full text-left p-3.5 transition-colors relative flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#EAF6F0] border-l-[3.5px] border-[#0D6866]"
                        : "hover:bg-[#F1F6F4]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-[#6E7F7C]">
                        {new Date(thread.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-[#063C3D] line-clamp-1">
                      {thread.subject}
                    </div>

                    <div className="text-[11px] text-[#445451] line-clamp-2">
                      {thread.last_message_preview || "No messages yet"}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#6E7F7C] pt-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#6E7F7C]">
                        {thread.case_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {thread.unread_count > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#0D6866] text-white font-bold text-[9px]">
                            {thread.unread_count} new
                          </span>
                        )}
                        <span>{thread.messages_count} msgs</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Thread Messages */}
        <div className="flex-1 flex flex-col bg-white">
          {activeThread ? (
            <>
              {/* Thread Info Bar */}
              <div className="px-6 py-3.5 border-b border-[#DCE5E1] flex items-center justify-between bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#063C3D]">
                      {activeThread.subject}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#EAF6F0] text-[#0D6866] border border-[#B9DED4] font-mono">
                      {activeThread.case_number}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E7F7C] mt-0.5">
                    Thread Status: <span className="capitalize font-medium text-[#172322]">{activeThread.status}</span> • Created {new Date(activeThread.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
                      className="px-2.5 py-1 text-xs rounded border border-[#DCE5E1] hover:bg-[#F1F6F4] text-[#445451] transition-colors"
                    >
                      {activeThread.status === "resolved" ? "Reopen Thread" : "Mark Resolved"}
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Flow Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8F7F2]">
                {messagesLoading ? (
                  <div className="p-8 text-center text-xs text-[#6E7F7C]">Loading conversation messages...</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6E7F7C]">No messages in this thread yet.</div>
                ) : (
                  messages.map((msg) => {
                    const isClientSender = msg.sender_role === "client";
                    const isInternal = msg.is_internal;

                    if (isInternal) {
                      // Dedicated Staff Internal Note Banner & Bubble
                      return (
                        <div
                          key={msg.id}
                          className="mx-auto max-w-2xl bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-amber-900 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-600">🔒</span>
                              <span>STAFF INTERNAL NOTE — HIDDEN FROM CLIENT</span>
                            </div>
                            <span className="text-[11px] text-amber-700 font-normal">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                          <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between text-[11px] text-amber-700">
                            <span>Author: {msg.sender_name}</span>
                            <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded font-mono">INTERNAL WORK PRODUCT</span>
                          </div>
                        </div>
                      );
                    }

                    const isOutgoing = isStaffMode ? msg.sender_role !== "client" : msg.sender_role === "client";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutgoing ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-[#6E7F7C] px-1">
                          <span className="font-semibold text-[#063C3D]">
                            {msg.sender_name}
                          </span>
                          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                            isOutgoing
                              ? "bg-[#EAF6F0] text-[#0D6866] border-[#B9DED4]"
                              : "bg-[#F1F6F4] text-[#445451] border-[#DCE5E1]"
                          }`}>
                            {msg.sender_role}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        <div
                          className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                            isOutgoing
                              ? "bg-[#0D6866] text-white rounded-tr-sm"
                              : "bg-white border border-[#DCE5E1] text-[#172322] rounded-tl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {/* Attachments Section */}
                          {msg.attachment_document_ids && msg.attachment_document_ids.length > 0 && (
                            <div className={`mt-3 pt-2.5 border-t space-y-1.5 ${
                              isOutgoing ? "border-white/20" : "border-[#DCE5E1]"
                            }`}>
                              <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-80">
                                Attached Documents ({msg.attachment_document_ids.length})
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.attachment_document_ids.map((docId) => (
                                  <button
                                    key={docId}
                                    type="button"
                                    onClick={() => onSelectDocument && onSelectDocument(docId)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                                      isOutgoing
                                        ? "bg-white/15 text-white hover:bg-white/25 border border-white/30"
                                        : "bg-[#F1F6F4] text-[#0D6866] hover:bg-[#EAF6F0] border border-[#B9DED4]"
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span>{docId}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delivery & Read state */}
                        <div className="mt-1 px-1">
                          {getDeliveryIndicator(msg)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer Footer */}
              <div className="p-4 border-t border-[#DCE5E1] bg-white">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {/* Staff Internal Note Toggle */}
                  {isStaffMode && (
                    <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="internalNoteToggle"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="h-3.5 w-3.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                        />
                        <label
                          htmlFor="internalNoteToggle"
                          className="text-xs font-semibold text-amber-900 flex items-center gap-1 cursor-pointer"
                        >
                          <span>🔒 Post as Staff-Only Internal Note</span>
                          <span className="text-[10px] text-amber-700 font-normal">
                            (Completely invisible to client in portal & API responses)
                          </span>
                        </label>
                      </div>
                      {isInternalNote && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded">
                          INTERNAL ONLY
                        </span>
                      )}
                    </div>
                  )}

                  {/* Textarea */}
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? "Write confidential internal case note (lawyer-eyes only)..."
                          : "Type question or update for your legal team..."
                      }
                      className={`w-full p-3 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0D6866] focus:border-[#0D6866] transition-all ${
                        isInternalNote
                          ? "border-amber-300 bg-amber-50/40 text-[#172322]"
                          : "border-[#DCE5E1] bg-[#FAFAF7] text-[#172322] focus:bg-white"
                      }`}
                    />
                  </div>

                  {/* Attachments pills */}
                  {attachmentIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-[#6E7F7C]">Attachments:</span>
                      {attachmentIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-mono bg-[#EAF6F0] text-[#0D6866] border border-[#B9DED4] px-2 py-0.5 rounded-full"
                        >
                          <span>{id}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(id)}
                            className="hover:text-red-500 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Doc ID (e.g. doc-01)"
                          value={newAttachmentInput}
                          onChange={(e) => setNewAttachmentInput(e.target.value)}
                          className="text-[11px] px-2.5 py-1 rounded border border-[#DCE5E1] bg-white text-[#172322] focus:outline-none focus:ring-1 focus:ring-[#0D6866] w-36"
                        />
                        <button
                          type="button"
                          onClick={handleAddAttachment}
                          className="text-[11px] px-2 py-1 rounded bg-[#F1F6F4] hover:bg-[#EAF6F0] text-[#0D6866] border border-[#DCE5E1] font-medium"
                        >
                          + Attach
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={!replyText.trim() || sending}
                        style={{
                          background: isInternalNote ? "#D97706" : "#0D6866",
                          color: "#FFFFFF",
                          fontWeight: 650,
                          borderRadius: "10px",
                          padding: "8px 18px",
                          border: "none",
                          cursor: !replyText.trim() || sending ? "not-allowed" : "pointer",
                          opacity: !replyText.trim() || sending ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
                        }}
                      >
                        {sending ? (
                          <span>Sending...</span>
                        ) : (
                          <>
                            <span>{isInternalNote ? "Post Internal Note" : "Send"}</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#6E7F7C]">
              <div className="w-16 h-16 rounded-full bg-[#EAF6F0] flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-[#0D6866]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="font-semibold text-[#063C3D] text-sm">No Thread Selected</h4>
              <p className="text-xs text-[#6E7F7C] max-w-xs mt-1">
                Choose a conversation from the sidebar or click "New Thread" to start a secure communication.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Thread Modal */}
      {isCreatingThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE5E1] pb-3">
              <h3 className="font-bold text-sm text-[#063C3D] flex items-center gap-2">
                <span>Start New Case Message Thread</span>
              </h3>
              <button
                onClick={() => setIsCreatingThread(false)}
                className="text-[#6E7F7C] hover:text-[#172322] text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#063C3D] mb-1">
                  Thread Topic / Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question regarding academic apostille certification"
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#DCE5E1] bg-[#FAFAF7] text-[#172322] focus:outline-none focus:ring-1 focus:ring-[#0D6866] focus:border-[#0D6866]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#063C3D] mb-1">
                  Thread Classification
                </label>
                <select
                  value={newThreadType}
                  onChange={(e) => setNewThreadType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#DCE5E1] bg-[#FAFAF7] text-[#172322] focus:outline-none focus:ring-1 focus:ring-[#0D6866] focus:border-[#0D6866]"
                >
                  <option value="client_inquiry">Client Inquiry / Question</option>
                  <option value="case_update">Case Filing Progress Update</option>
                  <option value="document_request">Evidence Clarification</option>
                  <option value="general">General Administrative</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#063C3D] mb-1">
                  Opening Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type your initial message to start the thread..."
                  value={newThreadInitialMessage}
                  onChange={(e) => setNewThreadInitialMessage(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#DCE5E1] bg-[#FAFAF7] text-[#172322] focus:outline-none focus:ring-1 focus:ring-[#0D6866] focus:border-[#0D6866]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingThread(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-[#6E7F7C] hover:bg-[#F1F6F4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "12px",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(13, 104, 102, 0.2)",
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
