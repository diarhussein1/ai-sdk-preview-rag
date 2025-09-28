import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import "dotenv/config";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1),
  },
  client: {
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  experimental__runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});
