import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: "session=test" })),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));

import { getCurrentUserId } from "@/lib/current-user";

describe("getCurrentUserId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the verified session user ID", async () => {
    authMocks.getSession.mockResolvedValue({
      session: { expiresAt: new Date(Date.now() + 60_000) },
      user: { id: "123e4567-e89b-42d3-a456-426614174000" },
    });

    await expect(getCurrentUserId()).resolves.toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("rejects a missing or expired session", async () => {
    authMocks.getSession.mockResolvedValue(null);

    await expect(getCurrentUserId()).rejects.toMatchObject({
      name: "AuthenticationRequiredError",
    });
  });
});
