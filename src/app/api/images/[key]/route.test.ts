import { beforeEach, describe, expect, it, vi } from "vitest";

const imageMocks = vi.hoisted(() => ({ readStoredImage: vi.fn() }));
const userId = "123e4567-e89b-42d3-a456-426614174000";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: vi
    .fn()
    .mockResolvedValue("123e4567-e89b-42d3-a456-426614174000"),
}));
vi.mock("@/lib/uploads", () => ({
  readStoredImage: imageMocks.readStoredImage,
}));

import { GET } from "@/app/api/images/[key]/route";

const context = (key: string) => ({ params: Promise.resolve({ key }) });

describe("GET /api/images/:key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delivers a private stored image", async () => {
    imageMocks.readStoredImage.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      size: 3,
    });

    const response = await GET(new Request("http://localhost"), context("x"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(imageMocks.readStoredImage).toHaveBeenCalledWith("x", userId);
  });

  it("returns 404 when the object is missing", async () => {
    imageMocks.readStoredImage.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context("x"));
    expect(response.status).toBe(404);
  });
});
