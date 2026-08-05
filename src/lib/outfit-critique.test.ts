import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({ responses: { parse: openAIMocks.parse } }),
}));

import { critiqueOutfit, OutfitCritiqueError } from "@/lib/outfit-critique";

const item = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "00000000-0000-4000-8000-000000000001",
  imageUrl: "/uploads/private-image.jpg",
  name: "navy shirt",
  category: "top" as const,
  colors: ["navy"],
  pattern: "solid",
  formality: 3,
  season: ["fall"],
  material: "cotton",
  fit: "regular",
  notes: "private notes",
  available: true,
  createdAt: new Date("2026-08-03T12:00:00Z"),
};
const validCritique = {
  verdict: "works" as const,
  summary: "The palette and formality feel cohesive.",
  strengths: ["Consistent formality"],
  suggestion: null,
};

describe("critiqueOutfit", () => {
  beforeEach(() => openAIMocks.parse.mockReset());

  it("sends compact attributes without images or private item fields", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: validCritique });

    await expect(critiqueOutfit([item])).resolves.toEqual(validCritique);
    const request = openAIMocks.parse.mock.calls[0][0];
    const serialized = JSON.stringify(request.input);
    expect(serialized).toContain("navy");
    expect(serialized).not.toContain("imageUrl");
    expect(serialized).not.toContain("private-image.jpg");
    expect(serialized).not.toContain("private notes");
  });

  it("retries once after a malformed structured response", async () => {
    openAIMocks.parse
      .mockResolvedValueOnce({ output_parsed: { verdict: "flawless" } })
      .mockResolvedValueOnce({ output_parsed: validCritique });

    await expect(critiqueOutfit([item])).resolves.toEqual(validCritique);
    expect(openAIMocks.parse).toHaveBeenCalledTimes(2);
  });

  it("fails after two malformed responses", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: null });

    await expect(critiqueOutfit([item])).rejects.toBeInstanceOf(
      OutfitCritiqueError,
    );
    expect(openAIMocks.parse).toHaveBeenCalledTimes(2);
  });
});
