import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, chatSessions } from "@/lib/db/schema/chat";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST create new message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, role, content, sources } = body;

    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert message
    const [newMessage] = await db
      .insert(messages)
      .values({
        sessionId,
        role,
        content,
        sources: sources ? JSON.stringify(sources) : null,
      })
      .returning();

    // Update session message count and timestamp
    await db
      .update(chatSessions)
      .set({
        messageCount: sql`${chatSessions.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

