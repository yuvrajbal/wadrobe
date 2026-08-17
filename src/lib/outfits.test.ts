import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  insert: vi.fn(),
  insertReturning: vi.fn(),
  insertValues: vi.fn(),
  listLimit: vi.fn(),
  listOrderBy: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectLimit: vi.fn(),
  selectWhere: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDatabase: () => ({
    delete: dbMocks.delete,
    insert: dbMocks.insert,
    select: dbMocks.select,
    update: dbMocks.update,
  }),
}));

import {
  createOutfit,
  createAiOutfitFeedback,
  deleteOutfit,
  getValidOutfitItems,
  listOutfits,
  listRecentOutfitFeedback,
  updateOutfit,
} from "@/lib/outfits";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const itemIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function wardrobeItem(
  index: number,
  category: "top" | "bottom" | "shoes" | "outerwear" | "accessory",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: itemIds[index],
    userId,
    imageUrl: `/uploads/${category}.jpg`,
    name: category,
    category,
    colors: ["navy"],
    pattern: "solid",
    formality: 3,
    season: ["fall"],
    material: "cotton",
    fit: "regular",
    notes: "",
    available: true,
    createdAt: new Date("2026-08-03T12:00:00Z"),
    ...overrides,
  };
}

const validItems = [
  wardrobeItem(0, "top"),
  wardrobeItem(1, "bottom"),
  wardrobeItem(2, "shoes"),
];
const outfit = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId,
  itemIds,
  context: {},
  status: "saved" as const,
  source: "manual" as const,
  createdAt: new Date("2026-08-05T12:00:00Z"),
};

describe("outfit domain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.select.mockReturnValue({ from: dbMocks.selectFrom });
    dbMocks.selectFrom.mockReturnValue({ where: dbMocks.selectWhere });
    dbMocks.insert.mockReturnValue({ values: dbMocks.insertValues });
    dbMocks.insertValues.mockReturnValue({
      returning: dbMocks.insertReturning,
    });
    dbMocks.insertReturning.mockResolvedValue([outfit]);
    dbMocks.update.mockReturnValue({ set: dbMocks.updateSet });
    dbMocks.updateSet.mockReturnValue({ where: dbMocks.updateWhere });
    dbMocks.updateWhere.mockReturnValue({ returning: dbMocks.updateReturning });
    dbMocks.updateReturning.mockResolvedValue([outfit]);
    dbMocks.delete.mockReturnValue({ where: dbMocks.deleteWhere });
    dbMocks.deleteWhere.mockReturnValue({ returning: dbMocks.deleteReturning });
    dbMocks.deleteReturning.mockResolvedValue([outfit]);
  });

  it("creates a current-user manual saved outfit after validation", async () => {
    dbMocks.selectWhere.mockResolvedValueOnce(validItems);

    await expect(
      createOutfit(userId, { itemIds, context: {} }),
    ).resolves.toEqual(outfit);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      userId,
      itemIds,
      context: {},
      source: "manual",
      status: "saved",
    });
  });

  it("persists AI save or reject feedback with its request context", async () => {
    dbMocks.selectWhere.mockResolvedValueOnce(validItems);
    const context = {
      occasion: "dinner",
      temperature: 68,
      temperatureUnit: "fahrenheit" as const,
      walkingLevel: "moderate" as const,
      style: "minimal",
    };

    await expect(
      createAiOutfitFeedback(userId, {
        itemIds,
        context,
        status: "rejected",
      }),
    ).resolves.toEqual(outfit);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      userId,
      itemIds,
      context,
      source: "ai",
      status: "rejected",
    });
  });

  it("rejects an item owned by another user", async () => {
    dbMocks.selectWhere.mockResolvedValueOnce([
      validItems[0],
      validItems[1],
      { ...validItems[2], userId: otherUserId },
    ]);

    await expect(getValidOutfitItems(userId, itemIds)).rejects.toMatchObject({
      code: "item_not_owned",
    });
    expect(dbMocks.insert).not.toHaveBeenCalled();
  });

  it("rejects deleted and unavailable items", async () => {
    dbMocks.selectWhere.mockResolvedValueOnce(validItems.slice(0, 2));
    await expect(getValidOutfitItems(userId, itemIds)).rejects.toMatchObject({
      code: "item_not_found",
    });

    dbMocks.selectWhere.mockResolvedValueOnce([
      validItems[0],
      validItems[1],
      { ...validItems[2], available: false },
    ]);
    await expect(getValidOutfitItems(userId, itemIds)).rejects.toMatchObject({
      code: "item_unavailable",
    });
  });

  it("rejects invalid category combinations", async () => {
    dbMocks.selectWhere.mockResolvedValueOnce([
      wardrobeItem(0, "top"),
      wardrobeItem(1, "top"),
      wardrobeItem(2, "shoes"),
    ]);

    await expect(getValidOutfitItems(userId, itemIds)).rejects.toMatchObject({
      code: "invalid_combination",
    });
  });

  it("lists, updates, and deletes only current-user outfits", async () => {
    dbMocks.selectWhere.mockReturnValueOnce({ orderBy: dbMocks.listOrderBy });
    dbMocks.listOrderBy.mockResolvedValueOnce([outfit]);
    await expect(listOutfits(userId, { status: "saved" })).resolves.toEqual([
      outfit,
    ]);

    dbMocks.selectWhere.mockReturnValueOnce({ limit: dbMocks.selectLimit });
    dbMocks.selectLimit.mockResolvedValueOnce([outfit]);
    await expect(
      updateOutfit(outfit.id, userId, { context: { occasion: "work" } }),
    ).resolves.toEqual(outfit);
    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      context: { occasion: "work" },
    });

    await expect(deleteOutfit(outfit.id, userId)).resolves.toEqual(outfit);
  });

  it("bounds recent saved and rejected feedback", async () => {
    dbMocks.selectWhere.mockReturnValueOnce({ orderBy: dbMocks.listOrderBy });
    dbMocks.listOrderBy.mockReturnValueOnce({ limit: dbMocks.listLimit });
    dbMocks.listLimit.mockResolvedValueOnce([outfit]);

    await expect(listRecentOutfitFeedback(userId, 8)).resolves.toEqual([
      outfit,
    ]);
    expect(dbMocks.listLimit).toHaveBeenCalledWith(8);
  });
});
