import { describe, expect, it } from "vitest";

import {
  isHeicFile,
  MAX_UPLOAD_EDGE_PX,
  scaledDimensions,
} from "@/lib/resize-image";

describe("scaledDimensions", () => {
  it("keeps images that already fit", () => {
    expect(scaledDimensions(1200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(scaledDimensions(MAX_UPLOAD_EDGE_PX, 10)).toEqual({
      width: MAX_UPLOAD_EDGE_PX,
      height: 10,
    });
  });

  it("scales the long edge down and preserves aspect ratio", () => {
    expect(scaledDimensions(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(scaledDimensions(4032, 3024)).toEqual({ width: 2048, height: 1536 });
  });

  it("never produces a zero-sized edge", () => {
    expect(scaledDimensions(100_000, 1)).toEqual({ width: 2048, height: 1 });
  });
});

describe("isHeicFile", () => {
  it("detects HEIC by MIME type", () => {
    expect(isHeicFile({ name: "photo", type: "image/heic" })).toBe(true);
    expect(isHeicFile({ name: "photo", type: "image/HEIF" })).toBe(true);
  });

  it("detects HEIC by extension when the browser reports no type", () => {
    expect(isHeicFile({ name: "IMG_0001.HEIC", type: "" })).toBe(true);
    expect(isHeicFile({ name: "IMG_0001.heif", type: "" })).toBe(true);
  });

  it("ignores other images", () => {
    expect(isHeicFile({ name: "IMG_0001.jpg", type: "image/jpeg" })).toBe(
      false,
    );
    expect(isHeicFile({ name: "heic.png", type: "image/png" })).toBe(false);
  });
});
