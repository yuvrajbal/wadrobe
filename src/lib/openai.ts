import "server-only";

import OpenAI from "openai";

import { getOpenAIKey } from "@/lib/env";

let client: OpenAI | undefined;

/**
 * Lazily constructs the server-side client so static builds do not require a key.
 * This module must never be imported by a Client Component.
 */
export function getOpenAIClient(): OpenAI {
  client ??= new OpenAI({ apiKey: getOpenAIKey() });
  return client;
}
