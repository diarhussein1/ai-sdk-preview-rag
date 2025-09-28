"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useChat, Message } from "ai/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown, { Options } from "react-markdown";

function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className="size-8 rounded-2xl bg-black dark:bg-white grid place-items-center font-bold text-white dark:text-black">
        i
      </div>
      <div className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        IntraBot
      </div>
    </div>
  );
}

type RecentItem = {
  resourceId: string;
  filename: string | null;
  created_at: string;
  chunks: number;
};

type IngestResponse = {
  ok: boolean;
  inserted: number;
  files: { filename: string; chunks: number }[];
};

export default function Home() {
  const [toolCall, setToolCall] = useState<string>();
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      maxSteps: 4,
      onToolCall({ toolCall }) {
        setToolCall(toolCall.toolName);
      },
      onError: () => {
        toast.error("Rate limited — probeer later opnieuw.");
      },
    });

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true);
  }, [messages]);

  const currentToolCall = useMemo(() => {
    const tools = messages?.slice(-1)[0]?.toolInvocations;
    if (tools && toolCall === tools[0].toolName) return tools[0].toolName;
    return undefined;
  }, [toolCall, messages]);

  const awaitingResponse = useMemo(() => {
    if (
      isLoading &&
      currentToolCall === undefined &&
      messages.slice(-1)[0]?.role === "user"
    ) {
      return true;
    }
    return false;
  }, [isLoading, currentToolCall, messages]);

  const userQuery: Message | undefined = messages
    .filter((m) => m.role === "user")
    .slice(-1)[0];

  const lastAssistantMessage: Message | undefined = messages
    .filter((m) => m.role !== "user")
    .slice(-1)[0];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const doUpload = async (): Promise<IngestResponse> => {
      setUploading(true);
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));

      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const json = (await res.json()) as IngestResponse;

      if (!res.ok) {
        throw new Error((json as any)?.error || res.statusText);
      }

      await loadRecent();
      return json;
    };

    await toast.promise(doUpload(), {
      loading: "Uploading & ingesting…",
      success: (json: IngestResponse) => {
        const lines =
          json.files?.length
            ? json.files
                .map((f) => `• ${f.filename} — ${f.chunks} chunks`)
                .join("\n")
            : "";
        return `✅ Total chunks: ${json.inserted}\n${lines}`;
      },
      error: (e) =>
        `❌ Upload failed: ${e instanceof Error ? e.message : String(e)}`,
    });

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);

  async function loadRecent() {
    try {
      setRecentLoading(true);
      const res = await fetch("/api/ingest/recent?limit=12");
      const json = (await res.json()) as { items: RecentItem[] };
      setRecent(json.items ?? []);
    } catch (e) {
      console.warn("Failed to load recent:", e);
    } finally {
      setRecentLoading(false);
    }
  }

  async function deleteResource(id: string) {
    const prev = recent;
    const next = prev.filter((r) => r.resourceId !== id);
    setRecent(next);
    setDeletingIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/resources/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || res.statusText);
      }
      toast.success("Resource deleted");
    } catch (e) {
      setRecent(prev);
      toast.error(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeletingIds((s) => {
        const copy = new Set(s);
        copy.delete(id);
        return copy;
      });
    }
  }

  async function clearAll() {
    if (!window.confirm("Are you sure you want to delete all resources?")) return;
    const prev = recent;
    setClearing(true);
    setRecent([]);
    try {
      const res = await fetch("/api/resources", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || res.statusText);
      }
      toast.success("All resources cleared");
    } catch (e) {
      setRecent(prev);
      toast.error(`Clear failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  const [activeTab, setActiveTab] = useState<'home' | 'sources'>('home');
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  return (
    <div className="min-h-screen bg-white flex">
      {/* Hidden file input - accessible from anywhere */}
      <input
        ref={fileInputRef}
        type="file"
        name="files"
        multiple
        accept=".txt,.md,.pdf"
        className="hidden"
        onChange={(e) => uploadFiles(e.currentTarget.files)}
      />
      
      {/* Left Sidebar */}
      <div className="w-16 bg-gray-50 border-r" style={{ borderColor: 'var(--perplexity-gray-200)' }}>
        <div className="flex flex-col items-center py-4 space-y-3">
          {/* Home Tab */}
          <button
            onClick={() => {setActiveTab('home'); setShowSourcesPanel(false);}}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${
              activeTab === 'home' 
                ? 'bg-[var(--perplexity-teal)] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
            title="Home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </button>

          {/* Sources Tab */}
          <button
            onClick={() => {setActiveTab('sources'); setShowSourcesPanel(true);}}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${
              activeTab === 'sources' 
                ? 'bg-[var(--perplexity-teal)] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
            title="Sources"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </button>

          {/* Divider */}
          <div className="w-6 h-px bg-gray-300 my-1"></div>

          {/* Upload Button */}
          <button
            onClick={() => {
              console.log('Upload button clicked');
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            disabled={uploading}
            className={`w-10 h-10 rounded-md border border-dashed flex items-center justify-center transition-all ${
              uploading 
                ? 'border-gray-300 bg-gray-100' 
                : 'border-gray-400 text-gray-600 hover:border-[var(--perplexity-teal)] hover:bg-gray-200 hover:text-[var(--perplexity-teal)]'
            }`}
            title="Upload documents"
          >
            {uploading ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" 
                   style={{ color: 'var(--perplexity-teal)' }}></div>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="perplexity-container py-8">
          {showSourcesPanel ? (
            /* Sources View */
            <div>
              <div className="text-center py-8 mb-8">
                <h1 className="text-4xl font-medium mb-4" style={{ color: 'var(--perplexity-text-primary)' }}>
                  Sources
                </h1>
                <p className="text-lg mb-8" style={{ color: 'var(--perplexity-text-secondary)' }}>
                  Manage your uploaded documents
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-medium" style={{ color: 'var(--perplexity-text-primary)' }}>
                    Documents ({recent.length})
                  </h2>
                  <div className="flex gap-3">
                    <button
                      onClick={loadRecent}
                      className="perplexity-button-secondary text-sm"
                      disabled={recentLoading || clearing}
                    >
                      {recentLoading ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      onClick={clearAll}
                      className="perplexity-button-tertiary text-sm"
                      style={{ color: 'var(--perplexity-text-tertiary)' }}
                      disabled={clearing || recentLoading || recent.length === 0}
                    >
                      {clearing ? "Clearing..." : "Clear All"}
                    </button>
                  </div>
                </div>
                
                {recent.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recent.map((r) => (
                      <div
                        key={r.resourceId}
                        className="p-4 rounded-lg border hover:shadow-sm transition-all"
                        style={{ borderColor: 'var(--perplexity-gray-200)' }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14,2 14,8 20,8"/>
                            </svg>
                          </div>
                          <button
                            className="text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            onClick={() => deleteResource(r.resourceId)}
                            disabled={deletingIds.has(r.resourceId) || clearing}
                            style={{ color: 'var(--perplexity-text-tertiary)' }}
                          >
                            {deletingIds.has(r.resourceId) ? "..." : "Remove"}
                          </button>
                        </div>
                        <div>
                          <div className="font-medium text-sm mb-2 line-clamp-2" style={{ color: 'var(--perplexity-text-primary)' }}>
                            {r.filename ?? "Untitled Document"}
                          </div>
                          <div className="text-xs mb-1" style={{ color: 'var(--perplexity-text-secondary)' }}>
                            {r.chunks} chunks
                          </div>
                          <div className="text-xs" style={{ color: 'var(--perplexity-text-tertiary)' }}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-lg bg-gray-100 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--perplexity-text-tertiary)' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--perplexity-text-primary)' }}>
                      No documents uploaded
                    </h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--perplexity-text-secondary)' }}>
                      Upload your first document to get started
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="perplexity-button-primary"
                    >
                      Upload Documents
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Home View */
            <div>
              <div className="text-center py-12 mb-8">
                <h1 className="text-4xl font-medium mb-4" style={{ color: 'var(--perplexity-text-primary)' }}>
                  AI Chupapi Assistant
                </h1>
                <p className="text-lg mb-8" style={{ color: 'var(--perplexity-text-secondary)' }}>
                  Upload documents and ask questions
                </p>
              </div>

              <div className="max-w-2xl mx-auto mb-12">
                <form onSubmit={handleSubmit} className="mb-8">
                  <div className="relative">
                    <input
                      className="perplexity-input pr-16"
                      minLength={3}
                      required
                      value={input}
                      placeholder="Ask anything..."
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <button
                        type="submit"
                        className="perplexity-button-primary text-sm"
                        disabled={isLoading}
                      >
                        {isLoading ? "..." : "Ask"}
                      </button>
                    </div>
                  </div>
                </form>

                <AnimatePresence>
                  {(awaitingResponse || currentToolCall || lastAssistantMessage) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="mb-8"
                    >
                      {userQuery?.content && (
                        <div className="mb-6">
                          <div className="text-sm font-medium mb-2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                            Question
                          </div>
                          <div style={{ color: 'var(--perplexity-text-primary)' }}>
                            {userQuery.content}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-sm font-medium mb-2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                          Answer
                        </div>
                        {awaitingResponse || currentToolCall ? (
                          <Loading tool={currentToolCall} />
                        ) : lastAssistantMessage ? (
                          <AssistantMessage message={lastAssistantMessage} />
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="max-w-2xl mx-auto">
                  {recent.length > 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm mb-4" style={{ color: 'var(--perplexity-text-secondary)' }}>
                        {recent.length} document{recent.length !== 1 ? 's' : ''} uploaded
                      </p>
                      <button
                        onClick={() => {setActiveTab('sources'); setShowSourcesPanel(true);}}
                        className="perplexity-button-secondary text-sm"
                      >
                        View Sources
                      </button>
                    </div>
                  )}
                  {recent.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: 'var(--perplexity-text-tertiary)' }}>
                        No documents uploaded yet. Use the + button in the sidebar to upload your first document.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Loading({ tool }: { tool?: string }) {
  const toolName =
    tool === "getInformation"
      ? "Searching documents"
      : tool === "addResource"
        ? "Processing information"
        : "Thinking";
        
  return (
    <div className="perplexity-loading">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" 
             style={{ color: 'var(--perplexity-teal)' }}></div>
        <span style={{ color: 'var(--perplexity-text-secondary)' }}>
          {toolName}...
        </span>
      </div>
    </div>
  );
}

const AssistantMessage = ({ message }: { message: Message | undefined }) => {
  if (message === undefined) return null;
  return (
    <div style={{ color: 'var(--perplexity-text-primary)' }}>
      <MemoizedReactMarkdown
        components={{
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return (
              <code className="perplexity-code" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <div className="perplexity-code">{children}</div>,
          a: ({ href, children }) => (
            <a href={href} className="perplexity-citation" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {message.content}
      </MemoizedReactMarkdown>
    </div>
  );
};

const MemoizedReactMarkdown: React.FC<Options> = React.memo(
  ReactMarkdown,
  (prev, next) =>
    prev.children === next.children && prev.className === next.className,
);
