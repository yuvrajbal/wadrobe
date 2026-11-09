import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeWardrobeItem: vi.fn(),
  parse: vi.fn(),
  validateImageFile: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({ responses: { parse: mocks.parse } }),
}));
vi.mock("@/lib/uploads", () => ({
  validateImageFile: mocks.validateImageFile,
}));
vi.mock("@/lib/wardrobe-vision", () => ({
  analyzeWardrobeItem: mocks.analyzeWardrobeItem,
}));

import type { Item } from "@/lib/db/schema";
import {
  checkPurchase,
  EmptyWardrobeError,
  PurchaseCheckError,
} from "@/lib/purchase-check";

const candidate = {
  name: "white oxford shirt",
  category: "top" as const,
  colors: ["white"],
  pattern: "solid",
  formality: 3,
  season: ["spring" as const, "summer" as const],
  material: "cotton",
  fit: "regular",
};

function ownedItem(id: string, category: Item["category"]): Item {
  return {
    id,
    userId: "00000000-0000-4000-8000-000000000001",
    imageUrl: `/api/images/${id}.jpg`,
    name: `${category} ${id}`,
    category,
    colors: ["navy"],
    pattern: "solid",
    formality: 3,
    season: ["spring"],
    material: null,
    fit: null,
    notes: "private note",
    available: false,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  };
}

const items = [
  ownedItem("b1", "bottom"),
  ownedItem("b2", "bottom"),
  ownedItem("s1", "shoes"),
];

const modelOutput = {
  verdict: "buy",
  headline: "A versatile staple.",
  reasoning: "Works with both trousers.",
  compatibleItemIds: ["b1", "b2", "s1"],
  exampleOutfits: [{ itemIds: ["b1", "s1"], rationale: "Crisp." }],
  similarItems: [],
  gapsFilled: ["summer top"],
  priceNote: "Fair for how often you'd wear it.",
};

function imageFile() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], "shirt.jpg", {
    type: "image/jpeg",
  });
}

describe("checkPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateImageFile.mockResolvedValue("image/jpeg");
    mocks.analyzeWardrobeItem.mockResolvedValue(candidate);
    mocks.parse.mockResolvedValue({ output_parsed: modelOutput });
  });

  it("analyzes the photo once and compares attributes, not images", async () => {
    const file = imageFile();
    const check = await checkPurchase({ file, items, price: 59 });

    expect(mocks.analyzeWardrobeItem).toHaveBeenCalledWith(file, "image/jpeg");
    expect(mocks.parse).toHaveBeenCalledOnce();
    const request = mocks.parse.mock.calls[0][0];
    const payload = JSON.parse(request.input[1].content);
    expect(payload.price).toBe(59);
    expect(payload.candidate).toEqual(candidate);
    expect(payload.ownedItems).toHaveLength(3);
    expect(payload.ownedItems[0]).not.toHaveProperty("notes");
    expect(payload.ownedItems[0]).not.toHaveProperty("imageUrl");

    expect(check.verdict).toBe("buy");
    expect(check.compatibleCounts.bottom).toBe(2);
    expect(check.outfitEstimate).toBe(2);
    expect(check.exampleOutfits).toHaveLength(1);
  });

  it("includes unavailable items because they are still owned", async () => {
    await checkPurchase({ file: imageFile(), items });
    const payload = JSON.parse(mocks.parse.mock.calls[0][0].input[1].content);
    expect(payload.price).toBeNull();
    expect(payload.ownedItems.map(({ id }: { id: string }) => id)).toEqual([
      "b1",
      "b2",
      "s1",
    ]);
  });

  it("refuses an empty wardrobe before calling any model", async () => {
    await expect(
      checkPurchase({ file: imageFile(), items: [] }),
    ).rejects.toBeInstanceOf(EmptyWardrobeError);
    expect(mocks.analyzeWardrobeItem).not.toHaveBeenCalled();
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("retries once and then fails on malformed model output", async () => {
    mocks.parse.mockResolvedValue({ output_parsed: { verdict: "yes" } });

    await expect(
      checkPurchase({ file: imageFile(), items }),
    ).rejects.toBeInstanceOf(PurchaseCheckError);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
  });

  it("wraps request failures", async () => {
    mocks.parse.mockRejectedValue(new Error("network"));

    await expect(
      checkPurchase({ file: imageFile(), items }),
    ).rejects.toBeInstanceOf(PurchaseCheckError);
  });
});
