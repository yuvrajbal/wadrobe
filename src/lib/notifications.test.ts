import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

import { notifications, safeNotificationMessage } from "@/lib/notifications";

describe("notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a stable namespaced ID and an accessible display duration", () => {
    notifications.error({
      id: "wardrobe-upload",
      title: "The garment could not be added.",
      description: "Try another photo.",
    });

    expect(toastMocks.error).toHaveBeenCalledWith(
      "The garment could not be added.",
      expect.objectContaining({
        id: "app:wardrobe-upload",
        description: "Try another photo.",
        duration: 8_000,
      }),
    );
  });

  it("exposes all supported notification levels through the adapter", () => {
    notifications.success({ id: "saved", title: "Saved." });
    notifications.warning({ id: "warning", title: "Check this." });
    notifications.info({ id: "info", title: "Ready." });

    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.warning).toHaveBeenCalledOnce();
    expect(toastMocks.info).toHaveBeenCalledOnce();
  });

  it("dismisses notifications through their namespaced action ID", () => {
    notifications.dismiss("saved-outfits-load");

    expect(toastMocks.dismiss).toHaveBeenCalledWith("app:saved-outfits-load");
  });

  it("replaces unsafe, empty, oversized, and non-string details", () => {
    const fallback = "Please try again.";

    expect(safeNotificationMessage("  Try another photo.  ", fallback)).toBe(
      "Try another photo.",
    );
    expect(
      safeNotificationMessage("Authorization: Bearer private", fallback),
    ).toBe(fallback);
    expect(
      safeNotificationMessage("at handler (/app/api.ts:4:2)", fallback),
    ).toBe(fallback);
    expect(safeNotificationMessage("x".repeat(241), fallback)).toBe(fallback);
    expect(safeNotificationMessage(new Error("internal"), fallback)).toBe(
      fallback,
    );
  });
});
