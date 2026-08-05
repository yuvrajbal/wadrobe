import { describe, expect, it } from "vitest";

import {
  outfitCreateSchema,
  outfitCritiqueSchema,
  outfitUpdateSchema,
} from "@/lib/outfit-schema";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

describe("outfit payload schemas", () => {
  it("accepts a compact manual outfit and supplies empty context", () => {
    expect(outfitCreateSchema.parse({ itemIds: ids })).toEqual({
      itemIds: ids,
      context: {},
    });
  });

  it("rejects duplicate items and client-controlled persistence fields", () => {
    expect(
      outfitCreateSchema.safeParse({ itemIds: [ids[0], ids[1], ids[1]] })
        .success,
    ).toBe(false);
    expect(
      outfitCreateSchema.safeParse({
        itemIds: ids,
        source: "ai",
        status: "suggested",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(outfitUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("validates the bounded critique contract", () => {
    expect(
      outfitCritiqueSchema.safeParse({
        verdict: "works",
        summary: "The colors and formality align.",
        strengths: ["Balanced palette"],
        suggestion: null,
      }).success,
    ).toBe(true);
    expect(
      outfitCritiqueSchema.safeParse({
        verdict: "perfect",
        summary: "Fine",
        strengths: [],
        suggestion: null,
      }).success,
    ).toBe(false);
  });
});
