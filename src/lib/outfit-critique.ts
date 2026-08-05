import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import type { Item } from "@/lib/db/schema";
import { outfitCritiqueSchema, type OutfitCritique } from "@/lib/outfit-schema";
import { getOpenAIClient } from "@/lib/openai";

export class OutfitCritiqueError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OutfitCritiqueError";
  }
}

function compactItem(item: Item) {
  return {
    id: item.id,
    category: item.category,
    colors: item.colors,
    pattern: item.pattern,
    formality: item.formality,
    season: item.season,
    material: item.material,
    fit: item.fit,
  };
}

export async function critiqueOutfit(items: Item[]): Promise<OutfitCritique> {
  const compactItems = items.map(compactItem);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: { output_parsed?: unknown };

    try {
      response = await getOpenAIClient().responses.parse({
        model: "gpt-5.6-luna",
        store: false,
        input: [
          {
            role: "system",
            content:
              "Assess how this outfit works as a whole. Be concise, constructive, and specific about color, pattern, formality, season, material, and fit. Do not invent visual details. Return only the requested structure.",
          },
          {
            role: "user",
            content: `Critique this outfit using only these item attributes: ${JSON.stringify(compactItems)}`,
          },
        ],
        text: {
          format: zodTextFormat(outfitCritiqueSchema, "outfit_critique"),
        },
      });
    } catch (error) {
      throw new OutfitCritiqueError("The outfit critique request failed.", {
        cause: error,
      });
    }

    const critique = outfitCritiqueSchema.safeParse(response.output_parsed);
    if (critique.success) return critique.data;

    if (attempt === 1) {
      throw new OutfitCritiqueError(
        "The model did not return a valid outfit critique.",
        { cause: critique.error },
      );
    }
  }

  throw new OutfitCritiqueError("The model did not return a critique.");
}
