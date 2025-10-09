import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, messages } from "@/lib/db/schema/chat";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET all chat sessions
export async function GET() {
  try {
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.isDeleted, false))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(50);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST create new chat session
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, preview } = body;

    const [newSession] = await db
      .insert(chatSessions)
      .values({
        title: title || "Nieuwe chat",
        preview: preview || null,
        messageCount: 0,
      })
      .returning();

    return NextResponse.json(newSession);
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

