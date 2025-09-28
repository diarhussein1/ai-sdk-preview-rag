// app/api/resources/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const deleted = await db.delete(resources).returning({ id: resources.id });
    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (e: any) {
    console.error("DELETE /api/resources error:", e);
    return NextResponse.json(
      { error: e?.message ?? "delete failed" },
      { status: 500 },
    );
  }
}


