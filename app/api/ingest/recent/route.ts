import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 50);

  const result = await db.execute(sql<
    {
      resourceId: string;
      filename: string | null;
      created_at: string;
      chunks: number;
    }[]
  >`
    SELECT
      r.id                              AS "resourceId",
      r.filename                        AS "filename",
      r.created_at                      AS "created_at",
      COALESCE(COUNT(e.resource_id), 0) AS "chunks"
    FROM resources r
    LEFT JOIN embeddings e ON e.resource_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `);

  const items = (result as any).rows ?? result;

  return NextResponse.json({ items });
}
