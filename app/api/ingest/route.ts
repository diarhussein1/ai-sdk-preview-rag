// app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";
import { embeddings } from "@/lib/db/schema/embeddings";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// --------- helpers ----------
async function fileToBuffer(file: any): Promise<Buffer> {
  if (file && typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }
  if (file && typeof file.stream === "function") {
    return Buffer.from(await new Response(file.stream()).arrayBuffer());
  }
  throw new Error("Unsupported file type (no arrayBuffer/stream)");
}

function chunk(t: string, size = 800, overlap = 100) {
  const out: string[] = [];
  for (let i = 0; i < t.length; i += Math.max(1, size - overlap)) {
    out.push(t.slice(i, i + size));
  }
  return out;
}

// Laad pdfjs uit verschillende paden (versie-afhankelijk)

async function extractPdfText(buf: Buffer) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.js"); // v3
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.js";
  }

  // 👇 belangrijk: Uint8Array i.p.v. Buffer
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;

  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => it.str ?? "").join(" ");
    if (p < doc.numPages) out += "\n\n";
  }
  return out.trim();
}

async function textFromFile(file: any) {
  const buf = await fileToBuffer(file);
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return await extractPdfText(buf);
  return buf.toString("utf-8").trim();
}

// --------- /helpers ----------

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use multipart/form-data with field name 'files'." },
        { status: 415 }
      );
    }

    const form = await req.formData();
    const files = form.getAll("files") as any[];
    if (!files?.length) return NextResponse.json({ error: "No files" }, { status: 400 });

    let inserted = 0;

    for (const f of files) {
      const raw = await textFromFile(f);
      if (!raw) continue;

      const chunks = chunk(raw);
      if (chunks.length === 0) continue;

      const { embeddings: vecs } = await embedMany({
        model: openai.embedding("text-embedding-3-small"), // 1536 dims
        values: chunks,
      });

      if (vecs.length !== chunks.length) {
        return NextResponse.json({ error: "Embedding count mismatch" }, { status: 500 });
      }

      for (let i = 0; i < chunks.length; i++) {
        const content = chunks[i];
        const vector = vecs[i];

        const [row] = await db
          .insert(resources)
          .values({ content })
          .returning({ id: resources.id });

        await db.insert(embeddings).values({
          resourceId: row.id,
          content,          // jouw embeddings-schema vereist content NOT NULL
          embedding: vector // pgvector kolom (1536)
        });

        inserted++;
      }
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "ingest failed" }, { status: 500 });
  }
}
