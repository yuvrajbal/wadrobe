import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({ responses: { parse: openAIMocks.parse } }),
}));

import {
  InsufficientWardrobeError,
  OutfitRecommendationError,
  recommendOutfits,
} from "@/lib/outfit-recommendations";

const userId = "00000000-0000-4000-8000-000000000001";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];
const categories = ["top", "bottom", "shoes", "outerwear"] as const;
const items = categories.map((category, index) => ({
  id: ids[index],
  userId,
  imageUrl: `/uploads/${category}.jpg`,
  name: `${category} private name`,
  category,
  colors: [index === 0 ? "navy" : "cream"],
  pattern: "solid",
  formality: 3,
  season: ["fall"],
  material: "cotton",
  fit: "regular",
  notes: "private notes",
  available: true,
  createdAt: new Date("2026-08-03T12:00:00Z"),
}));
const context = {
  occasion: "work dinner",
  temperature: 68,
  temperatureUnit: "fahrenheit" as const,
  walkingLevel: "moderate" as const,
  style: "relaxed tailoring",
};
const feedback = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId,
    itemIds: ids.slice(0, 3),
    context,
    status: "saved" as const,
    source: "ai" as const,
    createdAt: new Date("2026-08-04T12:00:00Z"),
  },
];
const validResult = {
  suggestions: [
    {
      itemIds: ids,
      rationale: "The balanced layers suit a cool, polished dinner.",
    },
  ],
};
const personalization = {
  feedbackCount: 1,
  savedCount: 1,
  rejectedCount: 0,
  mostUsedItemIds: ids.slice(0, 3),
  preferredItemIds: ids.slice(0, 3),
  avoidedItemIds: [],
  preferredColors: ["navy"],
  avoidedColors: [],
  preferredPatterns: ["solid"],
  avoidedPatterns: [],
  preferredFormalityLevels: [3],
  avoidedFormalityLevels: [],
  preferredStyles: ["relaxed tailoring"],
  avoidedStyles: [],
};

describe("recommendOutfits", () => {
  beforeEach(() => openAIMocks.parse.mockReset());

  it("uses compact available attributes and recent feedback", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: validResult });

    await expect(
      recommendOutfits({ items, context, feedback, personalization }),
    ).resolves.toEqual(validResult);
    const request = openAIMocks.parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      store: false,
    });
    const payload = JSON.stringify(request.input);
    expect(payload).toContain("recentFeedback");
    expect(payload).toContain("personalization");
    expect(payload).toContain("preferredColors");
    expect(payload).toContain("saved");
    expect(payload).not.toContain("imageUrl");
    expect(payload).not.toContain("private name");
    expect(payload).not.toContain("private notes");
    expect(payload).not.toContain("material");
    expect(payload).not.toContain(userId);
  });

  it("retries a malformed or invalid combination once", async () => {
    openAIMocks.parse
      .mockResolvedValueOnce({
        output_parsed: {
          suggestions: [
            {
              itemIds: [ids[0], ids[1], ids[3]],
              rationale: "Missing shoes.",
            },
          ],
        },
      })
      .mockResolvedValueOnce({ output_parsed: validResult });

    await expect(
      recommendOutfits({ items, context, feedback, personalization }),
    ).resolves.toEqual(validResult);
    expect(openAIMocks.parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(openAIMocks.parse.mock.calls[1][0].input)).toContain(
      "previous response was invalid",
    );
  });

  it("rejects an exact disliked outfit when alternatives are available", async () => {
    const alternativeTop = {
      ...items[0],
      id: "55555555-5555-4555-8555-555555555555",
      colors: ["sage"],
    };
    const rejected = {
      ...feedback[0],
      status: "rejected" as const,
      itemIds: ids,
    };
    const alternativeResult = {
      suggestions: [
        {
          itemIds: [alternativeTop.id, ids[1], ids[2], ids[3]],
          rationale: "A practical alternative that avoids the disliked look.",
        },
      ],
    };
    openAIMocks.parse
      .mockResolvedValueOnce({ output_parsed: validResult })
      .mockResolvedValueOnce({ output_parsed: alternativeResult });

    await expect(
      recommendOutfits({
        items: [...items, alternativeTop],
        context,
        feedback: [rejected],
        personalization,
      }),
    ).resolves.toEqual(alternativeResult);
    expect(openAIMocks.parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(openAIMocks.parse.mock.calls[1][0].input)).toContain(
      "exactly repeated a rejected outfit",
    );
  });

  it("fails after two malformed outputs", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: null });

    await expect(
      recommendOutfits({ items, context, feedback, personalization }),
    ).rejects.toBeInstanceOf(OutfitRecommendationError);
    expect(openAIMocks.parse).toHaveBeenCalledTimes(2);
  });

  it("does not call the model without the core wardrobe categories", async () => {
    await expect(
      recommendOutfits({
        items: items.slice(0, 2),
        context,
        feedback,
        personalization,
      }),
    ).rejects.toBeInstanceOf(InsufficientWardrobeError);
    expect(openAIMocks.parse).not.toHaveBeenCalled();
  });
});
