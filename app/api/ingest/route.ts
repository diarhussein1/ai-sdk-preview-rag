// app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embeddings as embeddingsTable } from "@/lib/db/schema/embeddings";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { sql } from "drizzle-orm";
import { nanoid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ---------- helpers ---------- */
async function fileToBuffer(file: File): Promise<Buffer> {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }
  // @ts-ignore - fallback
  if (typeof file.stream === "function") {
    // @ts-ignore
    return Buffer.from(await new Response(file.stream()).arrayBuffer());
  }
  throw new Error("Unsupported file object (no arrayBuffer/stream).");
}

function chunk(text: string, size = 800, overlap = 100): string[] {
  const out: string[] = [];
  const step = Math.max(1, size - overlap);
  for (let i = 0; i < text.length; i += step) out.push(text.slice(i, i + size));
  return out;
}

// pdf.js v3 legacy (gebruik next.config.mjs -> canvas: false fallback)
async function extractPdfText(buf: Buffer) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.js");
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      "pdfjs-dist/legacy/build/pdf.worker.js";
  }
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

async function textFromFile(file: File) {
  const buf = await fileToBuffer(file);
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return await extractPdfText(buf);
  return buf.toString("utf-8").trim();
}
/* ---------- /helpers ---------- */

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use multipart/form-data with field name 'files'." },
        { status: 415 },
      );
    }

    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files?.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const perFileSummary: Array<{ filename: string; chunks: number }> = [];
    let totalInsertedChunks = 0;

    for (const f of files) {
      const filename = f.name || "unknown";
      const raw = await textFromFile(f);
      if (!raw) {
        perFileSummary.push({ filename, chunks: 0 });
        continue;
      }

      const chunks = chunk(raw);
      if (chunks.length === 0) {
        perFileSummary.push({ filename, chunks: 0 });
        continue;
      }

      // Embed alle chunks
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"), // 1536 dims
        values: chunks,
      });
      if (embeddings.length !== chunks.length) {
        return NextResponse.json(
          { error: "Embedding count mismatch." },
          { status: 500 },
        );
      }

      // ⬇️ Raw SQL INSERT om filename 100% te persistieren
      const newId = nanoid();
      await db.execute(sql`
        INSERT INTO resources (id, content, filename)
        VALUES (${newId}, ${raw}, ${filename})
      `);
      const resRow = { id: newId };

      // Embeddings per chunk gelinkt aan resourceId
      const rows = chunks.map((content, i) => ({
        resourceId: resRow.id,
        content,                 // NOT NULL in jouw schema
        embedding: embeddings[i] // pgvector kolom (↔ pas naar 'vector' als jouw kolom zo heet)
      }));
      await db.insert(embeddingsTable).values(rows);

      totalInsertedChunks += chunks.length;
      perFileSummary.push({ filename, chunks: chunks.length });
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInsertedChunks,
      files: perFileSummary,
    });
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "ingest failed" },
      { status: 500 },
    );
  }
}
