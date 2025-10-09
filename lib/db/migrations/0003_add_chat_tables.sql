-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Nieuwe chat' NOT NULL,
	"preview" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" 
	FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE;

-- Add check constraint for role
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_check" 
	CHECK ("role" IN ('user', 'assistant'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_messages_session_id" ON "messages" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_created_at" ON "chat_sessions" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_is_deleted" ON "chat_sessions" ("is_deleted");

