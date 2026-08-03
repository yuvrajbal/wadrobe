import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCurrentUserId } from "@/lib/current-user";

describe("getCurrentUserId", () => {
  it("returns the stable single-user MVP identity", () => {
    expect(getCurrentUserId()).toBe("00000000-0000-4000-8000-000000000001");
    expect(getCurrentUserId()).toBe(getCurrentUserId());
  });
});
