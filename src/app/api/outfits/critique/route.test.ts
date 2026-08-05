import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  critiqueOutfit: vi.fn(),
  getCurrentUserId: vi.fn(),
  getValidOutfitItems: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/outfit-critique", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/outfit-critique")>();
  return { ...original, critiqueOutfit: routeMocks.critiqueOutfit };
});
vi.mock("@/lib/outfits", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/outfits")>();
  return { ...original, getValidOutfitItems: routeMocks.getValidOutfitItems };
});

import { POST } from "@/app/api/outfits/critique/route";
import { OutfitCritiqueError } from "@/lib/outfit-critique";

const userId = "00000000-0000-4000-8000-000000000001";
const itemIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const critique = {
  verdict: "works",
  summary: "Cohesive.",
  strengths: [],
  suggestion: null,
};

describe("POST /api/outfits/critique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getCurrentUserId.mockReturnValue(userId);
    routeMocks.getValidOutfitItems.mockResolvedValue([{ id: itemIds[0] }]);
    routeMocks.critiqueOutfit.mockResolvedValue(critique);
  });

  it("validates ownership and availability before requesting critique", async () => {
    const response = await POST(
      new Request("http://localhost/api/outfits/critique", {
        method: "POST",
        body: JSON.stringify({ itemIds }),
      }),
    );
    expect(response.status).toBe(200);
    expect(routeMocks.getValidOutfitItems).toHaveBeenCalledWith(
      userId,
      itemIds,
    );
    expect(routeMocks.critiqueOutfit).toHaveBeenCalledOnce();
  });

  it("returns a stable upstream error for malformed AI responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.critiqueOutfit.mockRejectedValue(
      new OutfitCritiqueError("malformed"),
    );
    const response = await POST(
      new Request("http://localhost/api/outfits/critique", {
        method: "POST",
        body: JSON.stringify({ itemIds }),
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The outfit could not be critiqued. Please try again.",
    });
  });
});
