import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIClient } from "@/lib/openai";
import type { SupportedMimeType } from "@/lib/uploads";

const seasons = ["spring", "summer", "fall", "winter"] as const;

export const wardrobeItemAttributesSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.enum(["top", "bottom", "shoes", "outerwear", "accessory"]),
  colors: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
  pattern: z.string().trim().min(1).max(80),
  formality: z.number().int().min(1).max(5),
  season: z.array(z.enum(seasons)).min(1).max(seasons.length),
  material: z.string().trim().min(1).max(120).nullable(),
  fit: z.string().trim().min(1).max(80).nullable(),
});

export type WardrobeItemAttributes = z.infer<
  typeof wardrobeItemAttributesSchema
>;

export class WardrobeVisionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WardrobeVisionError";
  }
}

export async function analyzeWardrobeItem(
  file: File,
  mimeType: SupportedMimeType,
): Promise<WardrobeItemAttributes> {
  const image = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const response = await getOpenAIClient().responses.parse({
      model: "gpt-5.6",
      store: false,
      input: [
        {
          role: "system",
          content:
            "Extract editable wardrobe attributes for the primary garment in the image. Use concise lowercase labels for colors, pattern, material, and fit. Infer season suitability and formality from the visible garment. Return only the requested structured result.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe this wardrobe item as a draft the user can correct.",
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${image}`,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          wardrobeItemAttributesSchema,
          "wardrobe_item_attributes",
        ),
      },
    });

    const parsed = wardrobeItemAttributesSchema.safeParse(
      response.output_parsed,
    );

    if (!parsed.success) {
      throw new WardrobeVisionError(
        "The vision model did not return valid wardrobe attributes.",
        { cause: parsed.error },
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof WardrobeVisionError) {
      throw error;
    }

    throw new WardrobeVisionError("The wardrobe image could not be analyzed.", {
      cause: error,
    });
  }
}
