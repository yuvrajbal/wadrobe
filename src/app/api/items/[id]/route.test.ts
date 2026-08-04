import { beforeEach, describe, expect, it, vi } from "vitest";

const itemRouteMocks = vi.hoisted(() => ({
  deleteWardrobeItem: vi.fn(),
  getCurrentUserId: vi.fn(),
  updateWardrobeItem: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: itemRouteMocks.getCurrentUserId,
}));
vi.mock("@/lib/wardrobe-items", () => ({
  deleteWardrobeItem: itemRouteMocks.deleteWardrobeItem,
  updateWardrobeItem: itemRouteMocks.updateWardrobeItem,
}));

import { DELETE, PATCH } from "@/app/api/items/[id]/route";

const userId = "00000000-0000-4000-8000-000000000001";
const itemId = "223e4567-e89b-42d3-a456-426614174000";
const item = {
  id: itemId,
  userId,
  imageUrl: "/uploads/shirt.jpg",
  name: "navy oxford shirt",
};

function context(id = itemId) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/items/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    itemRouteMocks.getCurrentUserId.mockReturnValue(userId);
    itemRouteMocks.updateWardrobeItem.mockResolvedValue(item);
  });

  it("updates editable fields for the current user", async () => {
    const response = await PATCH(
      patchRequest({ name: "blue shirt", available: false }),
      context(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ item });
    expect(itemRouteMocks.updateWardrobeItem).toHaveBeenCalledWith(
      itemId,
      userId,
      { name: "blue shirt", available: false },
    );
  });

  it("rejects protected fields", async () => {
    const response = await PATCH(
      patchRequest({ userId: "323e4567-e89b-42d3-a456-426614174000" }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(itemRouteMocks.updateWardrobeItem).not.toHaveBeenCalled();
  });

  it("returns 404 when the current user does not own the item", async () => {
    itemRouteMocks.updateWardrobeItem.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ notes: "favorite" }),
      context(),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/items/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    itemRouteMocks.getCurrentUserId.mockReturnValue(userId);
    itemRouteMocks.deleteWardrobeItem.mockResolvedValue(item);
  });

  it("deletes the current user's item", async () => {
    const request = new Request(`http://localhost/api/items/${itemId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, context());

    expect(response.status).toBe(204);
    expect(itemRouteMocks.deleteWardrobeItem).toHaveBeenCalledWith(
      itemId,
      userId,
    );
  });

  it("returns 404 when the current user does not own the item", async () => {
    itemRouteMocks.deleteWardrobeItem.mockResolvedValue(null);
    const request = new Request(`http://localhost/api/items/${itemId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, context());

    expect(response.status).toBe(404);
  });
});
