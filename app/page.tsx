// app/page.tsx
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

// ✨ Updated: sluit aan op /api/ingest/recent en ingest-response
type RecentItem = {
  resourceId: string;
  filename: string | null;
  created_at: string; // ISO
  chunks: number;
};

type IngestResponse = {
  ok: boolean;
  inserted: number;
  files: { filename: string; chunks: number }[];
};

export default function Home() {
  // --- Chat wiring
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

  // --- Upload wiring
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

      // Refresh “recent”
      await loadRecent();
      return json;
    };

    await toast.promise(doUpload(), {
      loading: "Uploading & ingesting…",
      success: (json: IngestResponse) => {
        // Mooie samenvatting per bestand
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

  // --- Recent sources
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

  // --- Deletion helpers
  async function deleteResource(id: string) {
    // optimistic remove
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
      // rollback
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
    // optimistic clear
    setRecent([]);
    try {
      const res = await fetch("/api/resources", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || res.statusText);
      }
      toast.success("All resources cleared");
    } catch (e) {
      // rollback
      setRecent(prev);
      toast.error(`Clear failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 md:px-8 py-6 sm:py-10">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl shadow border border-neutral-200 dark:border-neutral-700 bg-neutral-900 text-white dark:bg-white dark:text-black hover:opacity-90 transition"
            title="Upload & ingest documents"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            name="files"
            multiple
            accept=".txt,.md,.pdf"
            className="hidden"
            onChange={(e) => uploadFiles(e.currentTarget.files)}
          />
        </div>
      </div>

      {/* Content grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Chat card */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/70 shadow-sm p-4 sm:p-5">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 sticky top-4 z-10"
            >
              <input
                className="bg-white dark:bg-neutral-700 dark:placeholder:text-neutral-400 dark:text-neutral-100 text-base w-full rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-2"
                minLength={3}
                required
                value={input}
                placeholder="Ask me anything about your docs…"
                onChange={handleInputChange}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl shadow border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 hover:opacity-90 transition"
              >
                Send
              </button>
            </form>

            <motion.div
              animate={{ paddingTop: isExpanded ? 12 : 0 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="mt-4"
            >
              <AnimatePresence>
                {awaitingResponse || currentToolCall ? (
                  <div className="px-1 min-h-12">
                    {userQuery?.content && (
                      <div className="dark:text-neutral-400 text-neutral-500 text-sm w-fit mb-1">
                        {userQuery.content}
                      </div>
                    )}
                    <Loading tool={currentToolCall} />
                  </div>
                ) : lastAssistantMessage ? (
                  <div className="px-1 min-h-12">
                    {userQuery?.content && (
                      <div className="dark:text-neutral-400 text-neutral-500 text-sm w-fit mb-1">
                        {userQuery.content}
                      </div>
                    )}
                    <AssistantMessage message={lastAssistantMessage} />
                  </div>
                ) : (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    Upload eerst één of meer documenten en stel daarna vragen
                    over de inhoud. Ondersteund: TXT / MD / PDF.
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* Sources / recent list */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/70 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
              Recent sources
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={loadRecent}
                className="text-xs px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                disabled={recentLoading || clearing}
                title="Refresh list"
              >
                {recentLoading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={clearAll}
                className="text-xs px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                disabled={clearing || recentLoading || recent.length === 0}
                title="Delete all resources"
              >
                {clearing ? "Clearing…" : "Clear all"}
              </button>
            </div>
          </div>
          <ul className="space-y-3">
            {recent.length === 0 ? (
              <li className="text-sm text-neutral-500 dark:text-neutral-400">
                Nog geen bronnen gevonden.
              </li>
            ) : (
              recent.map((r) => (
                <li
                  key={r.resourceId}
                  className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {r.filename ?? "(unknown file)"}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                        {r.chunks} chunks
                      </span>
                      <button
                        className="text-xs px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        onClick={() => deleteResource(r.resourceId)}
                        disabled={deletingIds.has(r.resourceId) || clearing}
                        title="Delete this resource"
                      >
                        {deletingIds.has(r.resourceId) ? "…" : "❌"}
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Loading({ tool }: { tool?: string }) {
  const toolName =
    tool === "getInformation"
      ? "Getting information"
      : tool === "addResource"
        ? "Adding information"
        : "Thinking";
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring" }}
        className="overflow-hidden flex justify-start items-center"
      >
        <div className="flex flex-row gap-2 items-center">
          <div className="animate-spin text-neutral-500 dark:text-neutral-400">
            <svg className="size-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-neutral-500 dark:text-neutral-400 text-sm">
            {toolName}...
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const AssistantMessage = ({ message }: { message: Message | undefined }) => {
  if (message === undefined) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="whitespace-pre-wrap font-mono text-sm text-neutral-800 dark:text-neutral-200 overflow-hidden"
        id="markdown"
      >
        <MemoizedReactMarkdown className="max-h-72 overflow-y-auto">
          {message.content}
        </MemoizedReactMarkdown>
      </motion.div>
    </AnimatePresence>
  );
};

const MemoizedReactMarkdown: React.FC<Options> = React.memo(
  ReactMarkdown,
  (prev, next) =>
    prev.children === next.children && prev.className === next.className,
);
