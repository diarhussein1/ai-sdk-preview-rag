// app/page.tsx
"use client";

import { useState, useRef, FormEvent } from "react";
import { useChat } from "ai/react";

export default function Home() {
  // --- Chat state (vercel AI SDK) ---
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat", // jouw bestaande chat route
  });

  // --- Upload state ---
  const [busy, setBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setUploadMsg(null);

    const form = new FormData(formRef.current!);
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    const json = await res.json();

    setBusy(false);
    if (!res.ok) {
      setUploadMsg(`❌ ${json.error || res.statusText}`);
      return;
    }
    setUploadMsg(`✅ Ingested chunks: ${json.inserted}`);
    formRef.current?.reset();
  }

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <header className="border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">IntraBot — RAG Console</h1>
          <span className="text-xs opacity-70">Chat + Upload</span>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Chat panel */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur p-4 flex flex-col h-[78dvh]">
          <div className="overflow-y-auto pr-1 space-y-3 flex-1">
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-sm opacity-60">
                <p>Stel een vraag over je documenten…</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-neutral-800/70 border border-neutral-700"
                      : "bg-neutral-900/70 border border-neutral-800"
                  }`}
                >
                  <div className="mb-1 text-[10px] uppercase tracking-wide opacity-60">
                    {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))
            )}
            {error && (
              <div className="text-red-400 text-xs">⚠ {error.message}</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Typ je vraag…"
              className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
            />
            <button
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-white/10 hover:bg-white/20 transition px-3 py-2 text-sm"
            >
              {isLoading ? "Bezig…" : "Verstuur"}
            </button>
          </form>
        </section>

        {/* Upload panel (rechts) */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur p-4 h-[78dvh] flex flex-col">
          <h2 className="text-sm font-medium mb-3">Upload & Ingest</h2>

          <form ref={formRef} onSubmit={onUpload} encType="multipart/form-data" className="space-y-3">
            <input
              type="file"
              name="files"
              multiple
              accept=".txt,.md,.pdf"
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-neutral-100"
            />
            <button
              disabled={busy}
              className="w-full rounded-xl bg-white/10 hover:bg-white/20 transition px-3 py-2 text-sm"
            >
              {busy ? "Uploading…" : "Upload & Ingest"}
            </button>
          </form>

          {uploadMsg && (
            <p className="mt-3 text-xs opacity-80">{uploadMsg}</p>
          )}

          <div className="mt-auto pt-4 text-[11px] opacity-60">
            Ondersteund: <code>TXT</code>, <code>MD</code>, <code>PDF</code>.  
            Tekst wordt gechunkt, ge-embed en opgeslagen; stel daarna je vraag links.
          </div>
        </aside>
      </div>
    </main>
  );
}
