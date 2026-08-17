import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  createAiOutfitFeedback: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/outfits", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/outfits")>();
  return {
    ...original,
    createAiOutfitFeedback: routeMocks.createAiOutfitFeedback,
  };
});

import { POST } from "@/app/api/outfits/feedback/route";

const userId = "00000000-0000-4000-8000-000000000001";
const itemIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const context = {
  occasion: "dinner",
  temperature: 68,
  temperatureUnit: "fahrenheit",
  walkingLevel: "moderate",
  style: "minimal",
};

describe("POST /api/outfits/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getCurrentUserId.mockReturnValue(userId);
    routeMocks.createAiOutfitFeedback.mockResolvedValue({ id: "outfit" });
  });

  it("persists a current-user AI rejection", async () => {
    const body = { itemIds, context, status: "rejected" };
    const response = await POST(
      new Request("http://localhost/api/outfits/feedback", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(201);
    expect(routeMocks.createAiOutfitFeedback).toHaveBeenCalledWith(
      userId,
      body,
    );
  });

  it("rejects suggested status and client-controlled source", async () => {
    const response = await POST(
      new Request("http://localhost/api/outfits/feedback", {
        method: "POST",
        body: JSON.stringify({
          itemIds,
          context,
          status: "suggested",
          source: "manual",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.createAiOutfitFeedback).not.toHaveBeenCalled();
  });

  it("rejects feedback without the original recommendation context", async () => {
    const response = await POST(
      new Request("http://localhost/api/outfits/feedback", {
        method: "POST",
        body: JSON.stringify({
          itemIds,
          context: { occasion: "dinner" },
          status: "saved",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.createAiOutfitFeedback).not.toHaveBeenCalled();
  });
});
