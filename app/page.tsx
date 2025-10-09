"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useChat, Message } from "ai/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown, { Options } from "react-markdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  saveChatSession, 
  getChatSessions,
  getChatSession,
  deleteChatSession,
  generateSessionId,
  generateTitle,
  type ChatSession as StoredChatSession 
} from "@/lib/chat/storage";

function Logo() {
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
      <img 
        src="/logo.jpeg" 
        alt="Logo" 
        width="32" 
        height="32" 
        className="rounded-md object-contain"
        style={{
          backgroundColor: 'transparent',
          mixBlendMode: 'darken',
        }}
      />
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
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } =
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
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [homeHovered, setHomeHovered] = useState(false);
  const [sourcesHovered, setSourcesHovered] = useState(false);
  const [sourcesTabOpen, setSourcesTabOpen] = useState(false);
  
  // Chat history state
  const [chatSessions, setChatSessions] = useState<StoredChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Load chat sessions from database
  useEffect(() => {
    if (typeof window !== 'undefined') {
      getChatSessions().then(sessions => {
        setChatSessions(sessions);
        
        // Load last active session if exists
        const lastSessionId = localStorage.getItem('lastActiveSession');
        if (lastSessionId) {
          getChatSession(lastSessionId).then(lastSession => {
            if (lastSession) {
              setCurrentSessionId(lastSessionId);
              // Load messages from session
              const chatMessages = lastSession.messages.map(m => ({
                id: `${m.timestamp}`,
                role: m.role,
                content: m.content,
              }));
              setMessages(chatMessages as any);
            }
          });
        }
      });
    }
  }, [setMessages]);
  
  // Save messages to database whenever they change
  useEffect(() => {
    if (messages.length === 0 || typeof window === 'undefined') return;
    
    const sessionId = currentSessionId || generateSessionId();
    if (!currentSessionId) {
      setCurrentSessionId(sessionId);
    }
    
    const session: StoredChatSession = {
      id: sessionId,
      title: messages[0]?.role === 'user' 
        ? generateTitle(messages[0].content) 
        : 'Nieuwe chat',
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: Date.now()
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Save to database (async)
    saveChatSession(session).then(() => {
      // Refresh chat sessions list
      getChatSessions().then(setChatSessions);
    });
    
    // Save as last active session
    localStorage.setItem('lastActiveSession', sessionId);
  }, [messages, currentSessionId]);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--perplexity-bg)' }}>
      {/* Hover Zone LINKS voor Chat History - zoals Perplexity Spaces */}
      <div
        className="fixed left-0 top-0 bottom-0 w-2 z-50 hover:w-3 transition-all cursor-pointer"
        onMouseEnter={() => setChatHistoryOpen(true)}
        style={{ background: "transparent" }}
      />

      {/* Pages Sidebar - Perplexity style (extends from left sidebar) */}
      {(chatHistoryOpen || homeHovered) && (
        <div
          className="fixed left-16 top-0 bottom-0 w-48 shadow-2xl z-40 p-4 overflow-y-auto"
          onMouseEnter={() => setChatHistoryOpen(true)}
          onMouseLeave={() => {
            setTimeout(() => {
              setChatHistoryOpen(false);
              setHomeHovered(false);
            }, 300);
          }}
          style={{ background: "var(--perplexity-bg)", borderRight: "1px solid var(--perplexity-gray-200)" }}
        >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--perplexity-text-tertiary)" }}>
                Pages
              </h2>
              <button
                onClick={() => {
                  setCurrentSessionId(null);
                  setChatHistoryOpen(false);
                  setHomeHovered(false);
                  setMessages([]);
                  localStorage.removeItem('lastActiveSession');
                  toast.success("Nieuwe chat gestart!");
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ 
                  color: "var(--perplexity-text-secondary)",
                  background: "var(--perplexity-gray-200)"
                }}
                title="New Chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-1">
              {chatSessions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: "var(--perplexity-gray-200)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--perplexity-text-tertiary)" }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs" style={{ color: "var(--perplexity-text-tertiary)" }}>
                    No pages yet
                  </p>
                </div>
              ) : (
                chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group p-2.5 rounded-lg cursor-pointer transition-all relative hover:bg-opacity-80"
                    style={{ 
                      background: currentSessionId === session.id 
                        ? "var(--perplexity-gray-200)" 
                        : "transparent",
                    }}
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      setChatHistoryOpen(false);
                      setHomeHovered(false);
                      
                      // Load messages from this session
                      getChatSession(session.id).then(fullSession => {
                        if (fullSession) {
                          const chatMessages = fullSession.messages.map(m => ({
                            id: `${m.timestamp}`,
                            role: m.role,
                            content: m.content,
                          }));
                          setMessages(chatMessages as any);
                          localStorage.setItem('lastActiveSession', session.id);
                          toast.success("Chat geladen!");
                        }
                      });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5" style={{ background: "var(--perplexity-gray-200)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--perplexity-text-secondary)" }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="text-sm leading-tight mb-0.5 line-clamp-2" 
                          style={{ color: "var(--perplexity-text-primary)" }}
                        >
                          {session.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--perplexity-text-tertiary)" }}>
                          <span>{session.messageCount || session.messages?.length || 0} messages</span>
                          <span>•</span>
                          <span>{new Date(session.updatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChatSession(session.id).then(() => {
                            getChatSessions().then(setChatSessions);
                            if (currentSessionId === session.id) {
                              setCurrentSessionId(null);
                              setMessages([]);
                            }
                            toast.success("Chat verwijderd");
                          });
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 flex-shrink-0"
                        style={{ color: "var(--perplexity-text-tertiary)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
      )}

      {/* Library Sidebar - Voor Sources (extends from left sidebar) */}
      {(sourcesTabOpen || sourcesHovered) && (
        <div
          className="fixed left-16 top-0 bottom-0 w-48 shadow-2xl z-40 p-4 overflow-y-auto"
          onMouseEnter={() => setSourcesTabOpen(true)}
          onMouseLeave={() => {
            setTimeout(() => {
              setSourcesTabOpen(false);
              setSourcesHovered(false);
            }, 300);
          }}
          style={{ background: "var(--perplexity-bg)", borderRight: "1px solid var(--perplexity-gray-200)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--perplexity-text-secondary)" }}>
              Library
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md transition-colors hover:bg-gray-200"
              style={{ color: "var(--perplexity-text-secondary)" }}
              title="Upload Documents"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          
          <div className="space-y-1">
            {recentLoading ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--perplexity-text-tertiary)" }}>
                Loading...
              </p>
            ) : recent.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--perplexity-text-tertiary)" }}>
                No documents yet
              </p>
            ) : (
              recent.map((r) => (
                <div
                  key={r.resourceId}
                  className="group p-2 rounded-md cursor-pointer transition-all relative hover:bg-gray-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--perplexity-text-tertiary)' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm truncate" style={{ color: "var(--perplexity-text-primary)" }}>
                          {r.filename || 'Document'}
                        </h3>
                        <p className="text-xs" style={{ color: "var(--perplexity-text-tertiary)" }}>
                          {r.chunks} chunks
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteResource(r.resourceId);
                      }}
                      disabled={deletingIds.has(r.resourceId)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
                      style={{ color: "var(--perplexity-text-tertiary)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
      
      {/* Left Sidebar - FIXED position */}
      <div className="w-16 border-r flex flex-col fixed left-0 top-0 bottom-0 z-30" style={{ background: 'var(--perplexity-gray-50)', borderColor: 'var(--perplexity-gray-200)' }}>
        {/* Logo at the top */}
        <div className="flex justify-center pt-4 pb-2">
          <Logo />
        </div>
        
        {/* Upload Button - moved below logo with reduced spacing */}
        <div className="flex justify-center pt-14 pb-14">
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
        
        {/* Divider under upload button */}
        <div className="mx-auto w-6 h-px bg-gray-300 mb-3"></div>
        
        {/* Navigation buttons section */}
        <div className="flex flex-col items-center pb-4 space-y-3">
          {/* Home Tab - with hover to show Pages */}
          <button
            onClick={() => {setActiveTab('home'); setShowSourcesPanel(false);}}
            onMouseEnter={() => setHomeHovered(true)}
            onMouseLeave={() => setHomeHovered(false)}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all border-0 outline-none focus:outline-none ${
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

          {/* Sources Tab - with hover to show Library */}
          <button
            onClick={() => {setActiveTab('sources'); setShowSourcesPanel(true);}}
            onMouseEnter={() => setSourcesHovered(true)}
            onMouseLeave={() => setSourcesHovered(false)}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all border-0 outline-none focus:outline-none ${
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
        </div>

        {/* Theme Toggle Button - Pushed to absolute bottom */}
        <div className="mt-auto mb-4 flex justify-center">
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content - with left margin for fixed sidebar + fixed input bottom */}
      <div className="flex-1 ml-16 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto">
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
            <div className="max-w-3xl mx-auto pb-32">
              {messages.length === 0 && (
                <div className="text-center py-12 mb-8">
                  <h1 className="text-4xl font-medium mb-4" style={{ color: 'var(--perplexity-text-primary)' }}>
                    AI Chupapi Assistant
                  </h1>
                  <p className="text-lg mb-8" style={{ color: 'var(--perplexity-text-secondary)' }}>
                    Upload documents and ask questions
                  </p>
                </div>
              )}

              {/* Show ALL messages in conversation history */}
              {messages.length > 0 && (
                <div className="space-y-6 mb-8">
                  {messages.map((message, index) => (
                    <div key={message.id || index}>
                      {message.role === 'user' ? (
                        <div className="mb-6">
                          <div className="text-sm font-medium mb-2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                            Question
                          </div>
                          <div style={{ color: 'var(--perplexity-text-primary)' }}>
                            {message.content}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6">
                          <div className="text-sm font-medium mb-2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                            Answer
                          </div>
                          <AssistantMessage message={message} />
                          
                          {/* Separator line after each answer (except last one) */}
                          {index < messages.length - 1 && (
                            <div 
                              className="mt-8 mb-4 h-px w-full" 
                              style={{ background: 'var(--perplexity-gray-200)' }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Show loading state for new message */}
                  {(awaitingResponse || currentToolCall) && (
                    <div className="mb-6">
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--perplexity-text-secondary)' }}>
                        Answer
                      </div>
                      <Loading tool={currentToolCall} />
                    </div>
                  )}
                </div>
              )}

              {messages.length === 0 && recent.length > 0 && (
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
            </div>
          )}
        </div>

        {/* Fixed Input at Bottom - Perplexity Style */}
        {!showSourcesPanel && (
          <div className="border-t sticky bottom-0" style={{ 
            background: 'var(--perplexity-bg)',
            borderColor: 'var(--perplexity-gray-200)'
          }}>
            <div className="max-w-3xl mx-auto px-4 py-4">
              <form onSubmit={handleSubmit}>
                <div className="relative">
                  <textarea
                    className="w-full resize-none rounded-3xl px-5 py-3 pr-32 text-base border focus:outline-none focus:ring-2 transition-all"
                    style={{ 
                      background: 'var(--perplexity-gray-50)',
                      borderColor: 'var(--perplexity-gray-200)',
                      color: 'var(--perplexity-text-primary)',
                      minHeight: '52px',
                      maxHeight: '200px'
                    }}
                    rows={1}
                    value={input}
                    placeholder="Ask anything..."
                    onChange={(e) => {
                      handleInputChange(e);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                    disabled={isLoading}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-2">
                    {/* Focus Button */}
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      style={{ color: 'var(--perplexity-text-secondary)' }}
                      title="Focus"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>

                    {/* Attach Button */}
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      style={{ color: 'var(--perplexity-text-secondary)' }}
                      title="Attach file"
                      onClick={() => {setActiveTab('sources'); setShowSourcesPanel(true);}}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="p-2 rounded-lg transition-all"
                      style={{ 
                        background: input.trim() && !isLoading ? 'var(--perplexity-teal)' : 'transparent',
                        color: input.trim() && !isLoading ? 'white' : 'var(--perplexity-text-tertiary)'
                      }}
                      disabled={isLoading || !input.trim()}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
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
