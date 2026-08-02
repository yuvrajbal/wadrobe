import "server-only";

import { z } from "zod";

const databaseUrlSchema = z.url().startsWith("postgres");
const openAIKeySchema = z.string().min(1);

function parseServerVariable<T>(
  name: string,
  value: string | undefined,
  schema: z.ZodType<T>,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new Error(`Invalid or missing server environment variable: ${name}`);
  }

  return result.data;
}

export function getDatabaseUrl(): string {
  return parseServerVariable(
    "DATABASE_URL",
    process.env.DATABASE_URL,
    databaseUrlSchema,
  );
}

export function getOpenAIKey(): string {
  return parseServerVariable(
    "OPENAI_API_KEY",
    process.env.OPENAI_API_KEY,
    openAIKeySchema,
  );
}
