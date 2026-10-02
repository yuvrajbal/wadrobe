import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUserMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserId: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: currentUserMocks.auth,
}));

vi.mock("@/lib/users", () => ({
  getOrCreateUserId: currentUserMocks.getOrCreateUserId,
}));

import {
  AuthenticationRequiredError,
  getCurrentUserId,
} from "@/lib/current-user";

describe("getCurrentUserId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the Clerk session to the app's internal UUID", async () => {
    currentUserMocks.auth.mockResolvedValue({ userId: "user_clerk" });
    currentUserMocks.getOrCreateUserId.mockResolvedValue(
      "00000000-0000-4000-8000-000000000001",
    );

    await expect(getCurrentUserId()).resolves.toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(currentUserMocks.getOrCreateUserId).toHaveBeenCalledWith(
      "user_clerk",
    );
  });

  it("rejects a request without a Clerk session", async () => {
    currentUserMocks.auth.mockResolvedValue({ userId: null });

    await expect(getCurrentUserId()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(currentUserMocks.getOrCreateUserId).not.toHaveBeenCalled();
  });
});
