import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  checkPurchase: vi.fn(),
  getCurrentUserId: vi.fn(),
  listWardrobeItems: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUserId: routeMocks.getCurrentUserId,
}));
vi.mock("@/lib/wardrobe-items", () => ({
  listWardrobeItems: routeMocks.listWardrobeItems,
}));
vi.mock("@/lib/purchase-check", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/purchase-check")>();
  return { ...original, checkPurchase: routeMocks.checkPurchase };
});

import { POST } from "@/app/api/purchase-checks/route";
import { EmptyWardrobeError, PurchaseCheckError } from "@/lib/purchase-check";
import { UploadValidationError } from "@/lib/uploads";
import { WardrobeVisionError } from "@/lib/wardrobe-vision";

const userId = "00000000-0000-4000-8000-000000000001";
const items = [{ id: "item-1" }];
const check = { verdict: "maybe" };

function request({ file = true, price }: { file?: boolean; price?: string }) {
  const formData = new FormData();
  if (file) {
    formData.set(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "jacket.jpg", {
        type: "image/jpeg",
      }),
    );
  }
  if (price !== undefined) formData.set("price", price);
  return new Request("http://localhost/api/purchase-checks", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/purchase-checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.getCurrentUserId.mockResolvedValue(userId);
    routeMocks.listWardrobeItems.mockResolvedValue(items);
    routeMocks.checkPurchase.mockResolvedValue(check);
  });

  it("compares the photo with the current user's whole wardrobe", async () => {
    const response = await POST(request({ price: "120" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ check });
    expect(routeMocks.listWardrobeItems).toHaveBeenCalledWith(userId, {});
    expect(routeMocks.checkPurchase).toHaveBeenCalledWith({
      file: expect.any(File),
      items,
      price: 120,
    });
  });

  it("treats an empty price as no price", async () => {
    await POST(request({ price: "  " }));
    expect(routeMocks.checkPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ price: undefined }),
    );
  });

  it("rejects a missing file or invalid price", async () => {
    expect((await POST(request({ file: false }))).status).toBe(400);
    expect((await POST(request({ price: "-5" }))).status).toBe(400);
    expect(routeMocks.checkPurchase).not.toHaveBeenCalled();
  });

  it.each([
    [new UploadValidationError("Images must be 10 MB or smaller.", 413), 413],
    [new EmptyWardrobeError(), 422],
    [new WardrobeVisionError("bad"), 502],
    [new PurchaseCheckError("bad"), 502],
    [new Error("boom"), 500],
  ])("maps %s to status %i", async (error, status) => {
    routeMocks.checkPurchase.mockRejectedValue(error);
    const response = await POST(request({}));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.error).not.toContain("bad");
  });
});
