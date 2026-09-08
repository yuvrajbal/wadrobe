import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userOwnsWardrobeImage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));
vi.mock("@/lib/wardrobe-items", () => ({
  userOwnsWardrobeImage: authMocks.userOwnsWardrobeImage,
}));

import { proxy } from "@/proxy";

describe("protected page proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.userOwnsWardrobeImage.mockResolvedValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects an unauthenticated request to sign in", async () => {
    authMocks.getSession.mockResolvedValue(null);
    const response = await proxy(
      new NextRequest("http://localhost/builder?items=one"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/sign-in?callbackUrl=%2Fbuilder%3Fitems%3Done",
    );
  });

  it("allows a request with a verified session", async () => {
    authMocks.getSession.mockResolvedValue({
      session: { expiresAt: new Date(Date.now() + 60_000) },
      user: { id: "123e4567-e89b-42d3-a456-426614174000" },
    });

    const response = await proxy(new NextRequest("http://localhost/saved"));
    expect(response.status).toBe(200);
  });

  it("returns JSON 401 before an unauthenticated API request is handled", async () => {
    authMocks.getSession.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest("http://localhost/api/outfits/critique", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  it("does not serve another user's legacy public image", async () => {
    authMocks.getSession.mockResolvedValue({
      session: { expiresAt: new Date(Date.now() + 60_000) },
      user: { id: "123e4567-e89b-42d3-a456-426614174000" },
    });
    authMocks.userOwnsWardrobeImage.mockResolvedValue(false);

    const response = await proxy(
      new NextRequest("http://localhost/uploads/legacy-shirt.jpg"),
    );

    expect(response.status).toBe(404);
    expect(authMocks.userOwnsWardrobeImage).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000",
      "/uploads/legacy-shirt.jpg",
    );
  });

  it("allows the explicit browser-test bypass only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_AUTH_BYPASS", "true");

    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.status).toBe(200);
    expect(authMocks.getSession).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "production");
    authMocks.getSession.mockResolvedValue(null);
    const productionResponse = await proxy(
      new NextRequest("http://localhost/"),
    );
    expect(productionResponse.status).toBe(307);
    expect(authMocks.getSession).toHaveBeenCalledOnce();
  });
});
