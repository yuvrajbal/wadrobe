import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  createOutfit: vi.fn(),
  getCurrentUserId: vi.fn(),
  listOutfits: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/outfits", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/outfits")>();
  return {
    ...original,
    createOutfit: routeMocks.createOutfit,
    listOutfits: routeMocks.listOutfits,
  };
});

import { GET, POST } from "@/app/api/outfits/route";
import { OutfitDomainError } from "@/lib/outfits";

const userId = "00000000-0000-4000-8000-000000000001";
const itemIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const outfit = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId,
  itemIds,
  context: {},
  status: "saved",
  source: "manual",
};

describe("/api/outfits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getCurrentUserId.mockReturnValue(userId);
    routeMocks.createOutfit.mockResolvedValue(outfit);
    routeMocks.listOutfits.mockResolvedValue([outfit]);
  });

  it("creates a validated manual saved outfit for the current user", async () => {
    const response = await POST(
      new Request("http://localhost/api/outfits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ outfit });
    expect(routeMocks.createOutfit).toHaveBeenCalledWith(userId, {
      itemIds,
      context: {},
    });
  });

  it("rejects invalid request bodies before persistence", async () => {
    const response = await POST(
      new Request("http://localhost/api/outfits", {
        method: "POST",
        body: JSON.stringify({ itemIds: [itemIds[0]] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.createOutfit).not.toHaveBeenCalled();
  });

  it("returns an actionable unavailable-item error", async () => {
    routeMocks.createOutfit.mockRejectedValue(
      new OutfitDomainError("item_unavailable", "Remove unavailable items."),
    );
    const response = await POST(
      new Request("http://localhost/api/outfits", {
        method: "POST",
        body: JSON.stringify({ itemIds }),
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Remove unavailable items.",
    });
  });

  it("handles persistence failures without leaking internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.createOutfit.mockRejectedValue(new Error("database offline"));
    const response = await POST(
      new Request("http://localhost/api/outfits", {
        method: "POST",
        body: JSON.stringify({ itemIds }),
      }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "The outfit could not be saved.",
    });
  });

  it("lists saved outfits for the current user", async () => {
    const response = await GET(
      new Request("http://localhost/api/outfits?status=saved"),
    );
    expect(response.status).toBe(200);
    expect(routeMocks.listOutfits).toHaveBeenCalledWith(userId, {
      status: "saved",
    });
  });
});
