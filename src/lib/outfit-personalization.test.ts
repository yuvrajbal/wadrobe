import { describe, expect, it } from "vitest";

import type { Item, Outfit } from "@/lib/db/schema";
import { buildPersonalizationSummary } from "@/lib/outfit-personalization";

const userId = "00000000-0000-4000-8000-000000000001";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

function item(
  index: number,
  category: Item["category"],
  colors: string[],
  formality: number,
): Item {
  return {
    id: ids[index],
    userId,
    imageUrl: `/uploads/${index}.jpg`,
    name: `private item ${index}`,
    category,
    colors,
    pattern: "solid",
    formality,
    season: ["fall"],
    material: "cotton",
    fit: "regular",
    notes: "private notes",
    available: true,
    createdAt: new Date("2026-08-01T12:00:00Z"),
  };
}

const wardrobe = [
  item(0, "top", ["Navy"], 4),
  item(1, "bottom", ["Black"], 4),
  item(2, "shoes", ["Black"], 4),
  item(3, "bottom", ["Cream"], 2),
  item(4, "shoes", ["Cream"], 2),
];

function outfit(
  id: string,
  itemIds: string[],
  status: Outfit["status"],
  style: string,
  createdAt: string,
): Outfit {
  return {
    id,
    userId,
    itemIds,
    context: { style },
    status,
    source: "ai",
    createdAt: new Date(createdAt),
  };
}

describe("buildPersonalizationSummary", () => {
  it("derives compact preferences with stronger weight on recent feedback", () => {
    const olderSave = outfit(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      [ids[0], ids[3], ids[4]],
      "saved",
      "Minimal",
      "2026-08-01T12:00:00Z",
    );
    const recentRejection = outfit(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      [ids[0], ids[1], ids[2]],
      "rejected",
      "Bold",
      "2026-08-02T12:00:00Z",
    );

    const summary = buildPersonalizationSummary(wardrobe, [
      olderSave,
      recentRejection,
    ]);

    expect(summary).toEqual({
      feedbackCount: 2,
      savedCount: 1,
      rejectedCount: 1,
      mostUsedItemIds: [ids[0], ids[1], ids[2]],
      preferredItemIds: [ids[3], ids[4]],
      avoidedItemIds: [ids[1], ids[2], ids[0]],
      preferredColors: ["cream"],
      avoidedColors: ["black", "navy"],
      preferredPatterns: [],
      avoidedPatterns: ["solid"],
      preferredFormalityLevels: [2],
      avoidedFormalityLevels: [4],
      preferredStyles: ["minimal"],
      avoidedStyles: ["bold"],
    });
  });

  it("returns an empty summary without feedback", () => {
    expect(buildPersonalizationSummary(wardrobe, [])).toEqual({
      feedbackCount: 0,
      savedCount: 0,
      rejectedCount: 0,
      mostUsedItemIds: [],
      preferredItemIds: [],
      avoidedItemIds: [],
      preferredColors: [],
      avoidedColors: [],
      preferredPatterns: [],
      avoidedPatterns: [],
      preferredFormalityLevels: [],
      avoidedFormalityLevels: [],
      preferredStyles: [],
      avoidedStyles: [],
    });
  });

  it("ignores deleted item IDs while retaining the decision count", () => {
    const deletedItemFeedback = outfit(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ["66666666-6666-4666-8666-666666666666"],
      "saved",
      "Relaxed",
      "2026-08-03T12:00:00Z",
    );

    expect(
      buildPersonalizationSummary(wardrobe, [deletedItemFeedback]),
    ).toMatchObject({
      feedbackCount: 1,
      savedCount: 1,
      mostUsedItemIds: [],
      preferredItemIds: [],
      preferredColors: [],
      preferredStyles: ["relaxed"],
    });
  });

  it("keeps unavailable item attributes but omits unusable item IDs", () => {
    const unavailableWardrobe = wardrobe.map((wardrobeItem, index) =>
      index === 0 ? { ...wardrobeItem, available: false } : wardrobeItem,
    );
    const saved = outfit(
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      [ids[0], ids[3], ids[4]],
      "saved",
      "Classic",
      "2026-08-04T12:00:00Z",
    );

    const summary = buildPersonalizationSummary(unavailableWardrobe, [saved]);

    expect(summary.mostUsedItemIds).not.toContain(ids[0]);
    expect(summary.preferredItemIds).not.toContain(ids[0]);
    expect(summary.preferredColors).toContain("navy");
    expect(summary.preferredFormalityLevels).toContain(4);
  });

  it("gives more weight to feedback that matches the current request", () => {
    const olderMatchingSave = outfit(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      [ids[0], ids[3], ids[4]],
      "saved",
      "Relaxed tailoring",
      "2026-08-01T12:00:00Z",
    );
    const recentDifferentSave = outfit(
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      [ids[0], ids[1], ids[2]],
      "saved",
      "Bold",
      "2026-08-02T12:00:00Z",
    );

    const summary = buildPersonalizationSummary(
      wardrobe,
      [olderMatchingSave, recentDifferentSave],
      {
        occasion: "work dinner",
        temperature: 68,
        temperatureUnit: "fahrenheit",
        walkingLevel: "moderate",
        style: "relaxed tailoring",
      },
    );

    expect(summary.preferredColors[0]).toBe("cream");
    expect(summary.preferredStyles[0]).toBe("relaxed tailoring");
  });
});
