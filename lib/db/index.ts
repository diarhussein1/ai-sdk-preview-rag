import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env.mjs";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }
    const client = postgres(env.DATABASE_URL);
    dbInstance = drizzle(client);
  }
  return dbInstance;
}

// backward-compat export for existing imports
export const db = getDb();
