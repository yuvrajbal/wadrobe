import { beforeEach, describe, expect, it, vi } from "vitest";

const itemMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  deleteReturning: vi.fn(),
  deleteStoredImage: vi.fn(),
  deleteWhere: vi.fn(),
  getStoredImageKey: vi.fn(),
  insert: vi.fn(),
  listFrom: vi.fn(),
  listOrderBy: vi.fn(),
  listWhere: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDatabase: () => ({
    delete: itemMocks.delete,
    insert: itemMocks.insert,
    select: itemMocks.select,
    update: itemMocks.update,
  }),
}));
vi.mock("@/lib/uploads", () => ({
  deleteStoredImage: itemMocks.deleteStoredImage,
  getStoredImageKey: itemMocks.getStoredImageKey,
}));

import {
  deleteWardrobeItem,
  listWardrobeItems,
  updateWardrobeItem,
} from "@/lib/wardrobe-items";

const userId = "00000000-0000-4000-8000-000000000001";
const item = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  userId,
  imageUrl: "/uploads/123e4567-e89b-42d3-a456-426614174000.jpg",
  name: "navy oxford shirt",
  category: "top" as const,
  colors: ["navy"],
  pattern: "solid",
  formality: 3,
  season: ["spring", "fall"],
  material: "cotton",
  fit: "regular",
  notes: "",
  available: true,
  createdAt: new Date("2026-08-03T12:00:00Z"),
};

describe("wardrobe item persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    itemMocks.select.mockReturnValue({ from: itemMocks.listFrom });
    itemMocks.listFrom.mockReturnValue({ where: itemMocks.listWhere });
    itemMocks.listWhere.mockReturnValue({ orderBy: itemMocks.listOrderBy });
    itemMocks.listOrderBy.mockResolvedValue([item]);

    itemMocks.update.mockReturnValue({ set: itemMocks.updateSet });
    itemMocks.updateSet.mockReturnValue({ where: itemMocks.updateWhere });
    itemMocks.updateWhere.mockReturnValue({
      returning: itemMocks.updateReturning,
    });
    itemMocks.updateReturning.mockResolvedValue([item]);

    itemMocks.delete.mockReturnValue({ where: itemMocks.deleteWhere });
    itemMocks.deleteWhere.mockReturnValue({
      returning: itemMocks.deleteReturning,
    });
    itemMocks.deleteReturning.mockResolvedValue([item]);
    itemMocks.getStoredImageKey.mockReturnValue(
      "123e4567-e89b-42d3-a456-426614174000.jpg",
    );
  });

  it("lists filtered items", async () => {
    await expect(
      listWardrobeItems(userId, { category: "top", available: true }),
    ).resolves.toEqual([item]);

    expect(itemMocks.listOrderBy).toHaveBeenCalledOnce();
  });

  it("updates an owned item", async () => {
    await expect(
      updateWardrobeItem(item.id, userId, { notes: "favorite" }),
    ).resolves.toEqual(item);

    expect(itemMocks.updateSet).toHaveBeenCalledWith({ notes: "favorite" });
  });

  it("deletes the row and its stored image", async () => {
    await expect(deleteWardrobeItem(item.id, userId)).resolves.toEqual(item);

    expect(itemMocks.deleteStoredImage).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000.jpg",
    );
  });

  it("does not touch storage when no owned item was deleted", async () => {
    itemMocks.deleteReturning.mockResolvedValue([]);

    await expect(deleteWardrobeItem(item.id, userId)).resolves.toBeNull();
    expect(itemMocks.deleteStoredImage).not.toHaveBeenCalled();
  });
});
