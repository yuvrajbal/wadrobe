import { beforeEach, describe, expect, it, vi } from "vitest";

const ingestionMocks = vi.hoisted(() => ({
  analyzeWardrobeItem: vi.fn(),
  deleteStoredImage: vi.fn(),
  insert: vi.fn(),
  returning: vi.fn(),
  storeImage: vi.fn(),
  values: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDatabase: () => ({ insert: ingestionMocks.insert }),
}));
vi.mock("@/lib/uploads", () => ({
  deleteStoredImage: ingestionMocks.deleteStoredImage,
  storeImage: ingestionMocks.storeImage,
}));
vi.mock("@/lib/wardrobe-vision", () => ({
  analyzeWardrobeItem: ingestionMocks.analyzeWardrobeItem,
}));

import { ingestWardrobeItem } from "@/lib/item-ingestion";

const upload = {
  key: "123e4567-e89b-42d3-a456-426614174000.jpg",
  size: 3,
  type: "image/jpeg" as const,
  url: "/api/images/123e4567-e89b-42d3-a456-426614174000.jpg",
};

const attributes = {
  name: "navy oxford shirt",
  category: "top" as const,
  colors: ["navy"],
  pattern: "solid",
  formality: 3,
  season: ["spring", "fall"] as const,
  material: "cotton",
  fit: "regular",
};

const createdItem = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  userId: "00000000-0000-4000-8000-000000000001",
  imageUrl: upload.url,
  ...attributes,
};

function imageFile() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], "shirt.jpg", {
    type: "image/jpeg",
  });
}

describe("ingestWardrobeItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ingestionMocks.insert.mockReturnValue({ values: ingestionMocks.values });
    ingestionMocks.values.mockReturnValue({
      returning: ingestionMocks.returning,
    });
    ingestionMocks.storeImage.mockResolvedValue(upload);
    ingestionMocks.analyzeWardrobeItem.mockResolvedValue(attributes);
    ingestionMocks.returning.mockResolvedValue([createdItem]);
  });

  it("stores, analyzes, and persists one wardrobe item", async () => {
    const file = imageFile();

    await expect(ingestWardrobeItem(file, createdItem.userId)).resolves.toEqual(
      createdItem,
    );

    expect(ingestionMocks.storeImage).toHaveBeenCalledWith(file);
    expect(ingestionMocks.analyzeWardrobeItem).toHaveBeenCalledWith(
      file,
      "image/jpeg",
    );
    expect(ingestionMocks.values).toHaveBeenCalledWith({
      userId: createdItem.userId,
      imageUrl: upload.url,
      ...attributes,
    });
    expect(ingestionMocks.deleteStoredImage).not.toHaveBeenCalled();
  });

  it("deletes the stored image when vision analysis fails", async () => {
    ingestionMocks.analyzeWardrobeItem.mockRejectedValue(
      new Error("vision unavailable"),
    );

    await expect(
      ingestWardrobeItem(imageFile(), createdItem.userId),
    ).rejects.toThrow("vision unavailable");

    expect(ingestionMocks.deleteStoredImage).toHaveBeenCalledWith(upload.key);
    expect(ingestionMocks.insert).not.toHaveBeenCalled();
  });

  it("deletes the stored image when database persistence fails", async () => {
    ingestionMocks.returning.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      ingestWardrobeItem(imageFile(), createdItem.userId),
    ).rejects.toThrow("database unavailable");

    expect(ingestionMocks.deleteStoredImage).toHaveBeenCalledWith(upload.key);
  });
});
