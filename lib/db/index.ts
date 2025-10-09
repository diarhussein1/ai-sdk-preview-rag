import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env.mjs";
import * as chatSchema from "./schema/chat";
import * as embeddingsSchema from "./schema/embeddings";
import * as resourcesSchema from "./schema/resources";

const client = postgres(env.DATABASE_URL!);
export const db = drizzle(client, {
  schema: {
    ...chatSchema,
    ...embeddingsSchema,
    ...resourcesSchema,
  },
});

