import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  listRecentOutfitFeedback: vi.fn(),
  listWardrobeItems: vi.fn(),
  recommendOutfits: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/wardrobe-items", () => ({
  listWardrobeItems: routeMocks.listWardrobeItems,
}));
vi.mock("@/lib/outfits", () => ({
  listRecentOutfitFeedback: routeMocks.listRecentOutfitFeedback,
}));
vi.mock("@/lib/outfit-recommendations", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/outfit-recommendations")>();
  return { ...original, recommendOutfits: routeMocks.recommendOutfits };
});

import { POST } from "@/app/api/suggestions/route";
import { OutfitRecommendationError } from "@/lib/outfit-recommendations";

const userId = "00000000-0000-4000-8000-000000000001";
const context = {
  occasion: "work dinner",
  temperature: 68,
  temperatureUnit: "fahrenheit",
  walkingLevel: "moderate",
  style: "relaxed tailoring",
};

function suggestionRequest(body: unknown) {
  return new Request("http://localhost/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getCurrentUserId.mockReturnValue(userId);
    routeMocks.listWardrobeItems.mockResolvedValue([{ id: "item" }]);
    routeMocks.listRecentOutfitFeedback.mockResolvedValue([
      { status: "saved" },
    ]);
    routeMocks.recommendOutfits.mockResolvedValue({ suggestions: [] });
  });

  it("assembles current-user available items, context, and feedback", async () => {
    const response = await POST(suggestionRequest({ context }));

    expect(response.status).toBe(200);
    expect(routeMocks.listWardrobeItems).toHaveBeenCalledWith(userId, {
      available: true,
    });
    expect(routeMocks.listRecentOutfitFeedback).toHaveBeenCalledWith(userId);
    expect(routeMocks.recommendOutfits).toHaveBeenCalledWith({
      items: [{ id: "item" }],
      feedback: [{ status: "saved" }],
      context,
    });
  });

  it("rejects incomplete request context before reading wardrobe data", async () => {
    const response = await POST(
      suggestionRequest({ context: { occasion: "work" } }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.listWardrobeItems).not.toHaveBeenCalled();
  });

  it("returns a stable AI failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.recommendOutfits.mockRejectedValue(
      new OutfitRecommendationError("malformed"),
    );
    const response = await POST(suggestionRequest({ context }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Suggestions are unavailable right now. Please try again.",
    });
  });
});
