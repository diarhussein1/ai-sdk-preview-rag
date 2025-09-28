import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing resource id" }, { status: 400 });
    }

    const deleted = await db
      .delete(resources)
      .where(eq(resources.id, id))
      .returning({ id: resources.id });

    if (!deleted.length) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (e: any) {
    console.error("DELETE /api/resources/[id] error:", e);
    return NextResponse.json(
      { error: e?.message ?? "delete failed" },
      { status: 500 },
    );
  }
}


