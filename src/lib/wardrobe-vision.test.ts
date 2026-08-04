import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({
  parse: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({
    responses: {
      parse: openAIMocks.parse,
    },
  }),
}));

import {
  analyzeWardrobeItem,
  WardrobeVisionError,
} from "@/lib/wardrobe-vision";

const validAttributes = {
  name: "navy oxford shirt",
  category: "top" as const,
  colors: ["navy"],
  pattern: "solid",
  formality: 3,
  season: ["spring", "fall"] as const,
  material: "cotton",
  fit: "regular",
};

function imageFile() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], "shirt.jpg", {
    type: "image/jpeg",
  });
}

describe("analyzeWardrobeItem", () => {
  beforeEach(() => {
    openAIMocks.parse.mockReset();
  });

  it("sends the image once and returns validated structured attributes", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: validAttributes });

    await expect(
      analyzeWardrobeItem(imageFile(), "image/jpeg"),
    ).resolves.toEqual(validAttributes);

    expect(openAIMocks.parse).toHaveBeenCalledOnce();
    expect(openAIMocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        store: false,
        input: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_image",
                image_url: expect.stringMatching(/^data:image\/jpeg;base64,/),
                detail: "high",
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("rejects a missing parsed response", async () => {
    openAIMocks.parse.mockResolvedValue({ output_parsed: null });

    await expect(
      analyzeWardrobeItem(imageFile(), "image/jpeg"),
    ).rejects.toBeInstanceOf(WardrobeVisionError);
  });

  it("rejects attributes outside the persistence contract", async () => {
    openAIMocks.parse.mockResolvedValue({
      output_parsed: { ...validAttributes, formality: 8 },
    });

    await expect(
      analyzeWardrobeItem(imageFile(), "image/jpeg"),
    ).rejects.toThrow("did not return valid wardrobe attributes");
  });
});
