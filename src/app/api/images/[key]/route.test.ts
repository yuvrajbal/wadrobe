import { beforeEach, describe, expect, it, vi } from "vitest";

const imageMocks = vi.hoisted(() => ({ readStoredImage: vi.fn() }));

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
  });

  it("returns 404 when the object is missing", async () => {
    imageMocks.readStoredImage.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context("x"));
    expect(response.status).toBe(404);
  });
});
