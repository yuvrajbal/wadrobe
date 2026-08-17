import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/weather/route";

describe("GET /api/weather", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns rounded current Fahrenheit temperature", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ current: { temperature_2m: 71.6 } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/weather?latitude=40.7&longitude=-74"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      temperature: 72,
      unit: "fahrenheit",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("current=temperature_2m"),
      { next: { revalidate: 900 } },
    );
  });

  it("rejects out-of-range coordinates without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(
      new Request("http://localhost/api/weather?latitude=400&longitude=-74"),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a manual-entry fallback when weather is malformed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ current: {} }))),
    );
    const response = await GET(
      new Request("http://localhost/api/weather?latitude=40.7&longitude=-74"),
    );
    expect(response.status).toBe(502);
  });
});
