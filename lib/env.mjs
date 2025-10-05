import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isBuild = process.env.SKIP_DB === "1";

export const env = createEnv({
  server: {
    DATABASE_URL: isBuild
      ? z.string().optional()
      : z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  emptyStringAsUndefined: true,
});
