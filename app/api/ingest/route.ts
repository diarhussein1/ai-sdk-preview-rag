// app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";
import { embeddings } from "@/lib/db/schema/embeddings"; // <-- ensure this matches your file
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// simple chunker with overlap
function chunk(t: string, size = 800, overlap = 100) {
  const out: string[] = [];
  for (let i = 0; i < t.length; i += Math.max(1, size - overlap)) {
    out.push(t.slice(i, i + size));
  }
  return out;
}

// robust: support both .arrayBuffer() and .stream()
async function fileToBuffer(file: any): Promise<Buffer> {
  if (file && typeof file.arrayBuffer === "function") {
    const ab = await file.arrayBuffer();
    return Buffer.from(ab);
  }
  if (file && typeof file.stream === "function") {
    const ab = await new Response(file.stream()).arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error("Unsupported file type (no arrayBuffer/stream)");
}

async function textFromFile(file: any) {
  const buf = await fileToBuffer(file);
  const name = (file?.name || "").toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buf);
    return (parsed.text || "").trim();
  }
  // default: treat as text (txt/md/csv/etc.)
  return buf.toString("utf-8").trim();
}

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

      // 1) generate embeddings for all chunks
      const { embeddings: vecs } = await embedMany({
        model: openai.embedding("text-embedding-3-small"), // 1536 dims
        values: chunks,
      });

      if (vecs.length !== chunks.length) {
        return NextResponse.json({ error: "Embedding count mismatch" }, { status: 500 });
      }

      // 2) store each chunk:
      //    - insert into resources (content)
      //    - insert into embeddings with FK + vector + content (your schema requires content NOT NULL)
      for (let i = 0; i < chunks.length; i++) {
        const content = chunks[i];
        const vector = vecs[i];

        const [row] = await db
          .insert(resources)
          .values({ content })
          .returning({ id: resources.id });

        await db.insert(embeddings).values({
          // ---- adjust these three keys if your columns differ ----
          resourceId: row.id,  // FK to resources
          content,             // your `embeddings` table requires NOT NULL content
          embedding: vector,   // pgvector column (1536)
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
