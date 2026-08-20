import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import type { Item, Outfit } from "@/lib/db/schema";
import type { PersonalizationSummary } from "@/lib/outfit-personalization";
import {
  outfitSuggestionsSchema,
  type OutfitSuggestions,
  type RecommendationContext,
} from "@/lib/outfit-schema";
import { getOpenAIClient } from "@/lib/openai";

export class OutfitRecommendationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OutfitRecommendationError";
  }
}

export class InsufficientWardrobeError extends Error {
  constructor() {
    super("Add an available top, bottom, and pair of shoes first.");
    this.name = "InsufficientWardrobeError";
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
  };
}

function compactFeedback(outfit: Outfit) {
  return {
    status: outfit.status,
    itemIds: outfit.itemIds,
    occasion: outfit.context.occasion,
    style: outfit.context.style,
  };
}

function validateSuggestionItems(
  result: OutfitSuggestions,
  availableItems: Item[],
): boolean {
  const itemMap = new Map(availableItems.map((item) => [item.id, item]));
  const seenOutfits = new Set<string>();

  for (const suggestion of result.suggestions) {
    const selected = suggestion.itemIds.map((id) => itemMap.get(id));
    if (selected.some((item) => !item)) return false;

    const counts = new Map<string, number>();
    for (const item of selected) {
      counts.set(item!.category, (counts.get(item!.category) ?? 0) + 1);
    }

    if (
      !["top", "bottom", "shoes"].every(
        (category) => counts.get(category) === 1,
      ) ||
      ["outerwear", "accessory"].some(
        (category) => (counts.get(category) ?? 0) > 1,
      )
    ) {
      return false;
    }

    const signature = [...suggestion.itemIds].sort().join(":");
    if (seenOutfits.has(signature)) return false;
    seenOutfits.add(signature);
  }

  return true;
}

export async function recommendOutfits({
  items,
  context,
  feedback,
  personalization,
}: {
  items: Item[];
  context: RecommendationContext;
  feedback: Outfit[];
  personalization: PersonalizationSummary;
}): Promise<OutfitSuggestions> {
  const categories = new Set(items.map((item) => item.category));
  if (
    !(["top", "bottom", "shoes"] as const).every((value) =>
      categories.has(value),
    )
  ) {
    throw new InsufficientWardrobeError();
  }

  const payload = {
    context,
    availableItems: items.map(compactItem),
    personalization,
    recentFeedback: feedback.map(compactFeedback),
  };
  let lastValidationError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: { output_parsed?: unknown };

    try {
      response = await getOpenAIClient().responses.parse({
        model: "gpt-5.6-terra",
        reasoning: { effort: "low" },
        store: false,
        input: [
          {
            role: "system",
            content:
              "Create up to three distinct, wearable outfits for the request. Use only supplied available item IDs. Every outfit must contain exactly one top, one bottom, and one pair of shoes, with at most one outerwear and one accessory. Account for temperature, walking, occasion, style, season, color, pattern, and formality. Use the personalization summary as soft preferences, treating preferred signals positively and avoided signals negatively. Use recent feedback for context without repeating past outfits mechanically. When signals conflict with the current request, prioritize practicality and the current context. Keep each rationale practical and concise. Return only the requested structure.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        text: {
          format: zodTextFormat(outfitSuggestionsSchema, "outfit_suggestions"),
        },
      });
    } catch (error) {
      throw new OutfitRecommendationError(
        "The recommendation request failed.",
        { cause: error },
      );
    }

    const result = outfitSuggestionsSchema.safeParse(response.output_parsed);
    if (result.success && validateSuggestionItems(result.data, items)) {
      return result.data;
    }

    lastValidationError = result.success
      ? new Error("The response referenced invalid outfit combinations.")
      : result.error;
  }

  throw new OutfitRecommendationError(
    "The model did not return valid outfit suggestions.",
    { cause: lastValidationError },
  );
}
