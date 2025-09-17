// app/upload/page.tsx
"use client";
import { useState } from "react";

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget; // keep reference BEFORE await
    setBusy(true);
    setMsg(null);

    const form = new FormData(formEl);
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    const json = await res.json();

    setBusy(false);
    if (!res.ok) {
      setMsg(`❌ ${json.error || res.statusText}`);
      return;
    }
    setMsg(`✅ Ingested chunks: ${json.inserted}`);
    formEl.reset();
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Upload documents</h1>
      <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-3">
        <input type="file" name="files" multiple accept=".txt,.md,.pdf" className="block w-full" />
        <button disabled={busy} className="px-4 py-2 rounded-xl shadow border">
          {busy ? "Uploading…" : "Upload & Ingest"}
        </button>
      </form>
      {msg && <p className="text-sm opacity-80">{msg}</p>}
      <p className="text-xs opacity-60">Ondersteund: TXT/MD/PDF. Tekst wordt gechunkt, ge-embed en opgeslagen.</p>
    </main>
  );
}
