import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_SIZE_BYTES,
  UploadValidationError,
  validateImageFile,
} from "@/lib/uploads";

describe("validateImageFile", () => {
  it("accepts a PNG with a matching signature", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "shirt.png",
      { type: "image/png" },
    );

    await expect(validateImageFile(file)).resolves.toBe("image/png");
  });

  it("rejects content that does not match its MIME type", async () => {
    const file = new File(["not an image"], "shirt.png", {
      type: "image/png",
    });

    await expect(validateImageFile(file)).rejects.toMatchObject({
      status: 415,
    });
  });

  it("rejects unsupported image formats", async () => {
    const file = new File([new Uint8Array([0x47, 0x49, 0x46])], "shirt.gif", {
      type: "image/gif",
    });

    await expect(validateImageFile(file)).rejects.toBeInstanceOf(
      UploadValidationError,
    );
  });

  it("rejects images above the size limit", async () => {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );

    await expect(validateImageFile(file)).rejects.toMatchObject({
      status: 413,
    });
  });
});
