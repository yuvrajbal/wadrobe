import { describe, expect, it } from "vitest";

import {
  estimateOutfits,
  purchaseCheckModelSchema,
  purchasePriceSchema,
  summarizePurchaseCheck,
  type PurchaseCheckModelResult,
} from "@/lib/purchase-check-schema";

const candidate = {
  name: "olive field jacket",
  category: "outerwear" as const,
  colors: ["olive"],
  pattern: "solid",
  formality: 2,
  season: ["fall" as const],
  material: "cotton",
  fit: "regular",
};

const owned = [
  { id: "top-1", category: "top" as const },
  { id: "top-2", category: "top" as const },
  { id: "bottom-1", category: "bottom" as const },
  { id: "shoes-1", category: "shoes" as const },
  { id: "shoes-2", category: "shoes" as const },
  { id: "outer-1", category: "outerwear" as const },
  { id: "acc-1", category: "accessory" as const },
];

function modelResult(
  overrides: Partial<PurchaseCheckModelResult> = {},
): PurchaseCheckModelResult {
  return {
    verdict: "buy",
    headline: "Pairs with most of your closet.",
    reasoning: "It works with your tees and trousers.",
    compatibleItemIds: [],
    exampleOutfits: [],
    similarItems: [],
    gapsFilled: [],
    priceNote: null,
    ...overrides,
  };
}

describe("estimateOutfits", () => {
  const counts = { top: 3, bottom: 2, shoes: 4, outerwear: 1, accessory: 5 };

  it("multiplies the other core categories for a core candidate", () => {
    expect(estimateOutfits("top", counts)).toBe(8);
    expect(estimateOutfits("shoes", counts)).toBe(6);
  });

  it("needs every core category for a layering candidate", () => {
    expect(estimateOutfits("outerwear", counts)).toBe(24);
    expect(estimateOutfits("accessory", { ...counts, bottom: 0 })).toBe(0);
  });
});

describe("summarizePurchaseCheck", () => {
  it("counts only owned, de-duplicated items from other categories", () => {
    const check = summarizePurchaseCheck(
      candidate,
      owned,
      modelResult({
        compatibleItemIds: [
          "top-1",
          "top-1",
          "top-2",
          "bottom-1",
          "shoes-1",
          "outer-1",
          "invented",
        ],
      }),
    );

    expect(check.compatibleItemIds).toEqual([
      "top-1",
      "top-2",
      "bottom-1",
      "shoes-1",
    ]);
    expect(check.compatibleCounts).toEqual({
      top: 2,
      bottom: 1,
      shoes: 1,
      outerwear: 0,
      accessory: 0,
    });
    expect(check.outfitEstimate).toBe(2);
    expect(check.candidate).toBe(candidate);
  });

  it("keeps only wearable, distinct example outfits", () => {
    const valid = { itemIds: ["top-1", "bottom-1", "shoes-1"], rationale: "a" };
    const check = summarizePurchaseCheck(
      candidate,
      owned,
      modelResult({
        exampleOutfits: [
          valid,
          { itemIds: ["shoes-1", "bottom-1", "top-1"], rationale: "dup" },
          { itemIds: ["top-1", "bottom-1"], rationale: "no shoes" },
          {
            itemIds: ["top-1", "bottom-1", "shoes-1", "outer-1"],
            rationale: "two jackets",
          },
          { itemIds: ["top-2", "bottom-1", "ghost"], rationale: "unknown" },
          {
            itemIds: ["top-2", "bottom-1", "shoes-2", "acc-1"],
            rationale: "b",
          },
        ],
      }),
    );

    expect(check.exampleOutfits.map(({ rationale }) => rationale)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops unknown or repeated similar items", () => {
    const check = summarizePurchaseCheck(
      candidate,
      owned,
      modelResult({
        similarItems: [
          { itemId: "outer-1", note: "Same olive tone." },
          { itemId: "outer-1", note: "Again." },
          { itemId: "ghost", note: "Invented." },
        ],
      }),
    );

    expect(check.similarItems).toEqual([
      { itemId: "outer-1", note: "Same olive tone." },
    ]);
  });
});

describe("purchase check schemas", () => {
  it("accepts a well-formed model result", () => {
    expect(purchaseCheckModelSchema.safeParse(modelResult()).success).toBe(
      true,
    );
    expect(
      purchaseCheckModelSchema.safeParse({ ...modelResult(), verdict: "yes" })
        .success,
    ).toBe(false);
  });

  it("parses positive prices only", () => {
    expect(purchasePriceSchema.parse("79.5")).toBe(79.5);
    for (const value of ["0", "-3", "abc", "Infinity"]) {
      expect(purchasePriceSchema.safeParse(value).success).toBe(false);
    }
  });
});
