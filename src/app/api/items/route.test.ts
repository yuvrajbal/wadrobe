import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  ingestWardrobeItem: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/item-ingestion", () => ({
  ingestWardrobeItem: routeMocks.ingestWardrobeItem,
}));

import { POST } from "@/app/api/items/route";
import { WardrobeVisionError } from "@/lib/wardrobe-vision";

const userId = "00000000-0000-4000-8000-000000000001";
const item = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  userId,
  imageUrl: "/uploads/shirt.jpg",
  name: "navy oxford shirt",
};

function multipartRequest(withFile = true) {
  const formData = new FormData();

  if (withFile) {
    formData.set(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "shirt.jpg", {
        type: "image/jpeg",
      }),
    );
  }

  return new Request("http://localhost/api/items", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getCurrentUserId.mockReturnValue(userId);
    routeMocks.ingestWardrobeItem.mockResolvedValue(item);
  });

  it("creates an item for the current MVP user", async () => {
    const response = await POST(multipartRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ item });
    expect(routeMocks.ingestWardrobeItem).toHaveBeenCalledWith(
      expect.any(File),
      userId,
    );
  });

  it("requires a multipart file field", async () => {
    const response = await POST(multipartRequest(false));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A file field is required.",
    });
    expect(routeMocks.ingestWardrobeItem).not.toHaveBeenCalled();
  });

  it("returns a stable upstream error when vision analysis fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.ingestWardrobeItem.mockRejectedValue(
      new WardrobeVisionError("malformed model response"),
    );

    const response = await POST(multipartRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The image could not be analyzed. Please try another photo.",
    });
  });
});
