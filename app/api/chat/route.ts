import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { embed, streamText } from "ai";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const maxDuration = 30;

type Hit = {
  resourceId: string;
  filename: string | null;
  content: string;
  score: number;
};

async function retrieveTopK(query: string, k = 20): Promise<Hit[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  });

  const result = await db.execute(sql<
    { resourceId: string; filename: string | null; content: string; score: number }[]
  >`
    SELECT
      e.resource_id   AS "resourceId",
      r.filename      AS "filename",
      e.content       AS "content",
      (e.embedding <=> ${JSON.stringify(embedding)}::vector)::float AS "score"
    FROM embeddings e
    JOIN resources r ON r.id = e.resource_id
    ORDER BY e.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${k}
  `);  

  const rows = (result as any).rows ?? result;
  return rows as Hit[];
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
  const query = lastUser?.content?.toString() ?? "";

  const hits = query ? await retrieveTopK(query, 8) : [];

  if (!hits.length) {
    return NextResponse.json({ id: "noctx", object: "chat.completion",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Sorry, ik weet het niet." } }],
    });
  }

  const context = hits
    .map((h, i) => `# Chunk ${i + 1} [score=${h.score.toFixed(4)}] [file=${h.filename ?? "unknown"}]\n${h.content}`)
    .join("\n\n---\n\n");

  const system = `
  Beantwoord zoveel mogelijk op basis van onderstaande context.
  Als de context niet volledig genoeg is, combineer aanwijzingen of geef een
  waarschijnlijk antwoord. Alleen als er echt niets bruikbaars in staat, zeg: "Sorry, ik weet het niet."  
`;

  const result = streamText({
    model: openai("gpt-4o"),
    system,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Vraag: ${query}\n\nContext:\n${context}` },
    ],
  });

  return result.toDataStreamResponse();
}
