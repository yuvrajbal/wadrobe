import { describe, expect, it } from "vitest";

import { forEachWithConcurrency } from "./concurrency";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("forEachWithConcurrency", () => {
  it("never runs more than the limit at once and visits every input", async () => {
    let running = 0;
    let peak = 0;
    const seen: number[] = [];

    await forEachWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(value);
      running -= 1;
    });

    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps going after a task rejects", async () => {
    const seen: string[] = [];

    await forEachWithConcurrency(["a", "b", "c"], 1, async (value) => {
      if (value === "b") throw new Error("boom");
      seen.push(value);
    });

    expect(seen).toEqual(["a", "c"]);
  });

  it("starts the next input as soon as a slot frees up", async () => {
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    const run = forEachWithConcurrency([0, 1, 2], 2, async (value) => {
      started.push(value);
      await gates[value].promise;
    });

    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    gates[1].resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual([0, 1, 2]);

    gates[0].resolve();
    gates[2].resolve();
    await run;
  });

  it("resolves immediately for no inputs", async () => {
    await expect(
      forEachWithConcurrency([], 3, async () => {}),
    ).resolves.toBeUndefined();
  });
});
