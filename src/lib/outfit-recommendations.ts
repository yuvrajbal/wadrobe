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

function outfitSignature(itemIds: string[]) {
  return [...itemIds].sort().join(":");
}

function rejectedSignaturesWithAlternatives(items: Item[], feedback: Outfit[]) {
  const availableIds = new Set(items.map(({ id }) => id));
  const rejected = new Set(
    feedback
      .filter(
        (outfit) =>
          outfit.status === "rejected" &&
          outfit.itemIds.every((id) => availableIds.has(id)),
      )
      .map((outfit) => outfitSignature(outfit.itemIds)),
  );
  const categoryCount = (category: Item["category"]) =>
    items.filter((item) => item.category === category).length;
  const possibleOutfits =
    categoryCount("top") *
    categoryCount("bottom") *
    categoryCount("shoes") *
    (categoryCount("outerwear") + 1) *
    (categoryCount("accessory") + 1);

  return possibleOutfits > rejected.size ? rejected : new Set<string>();
}

function validateSuggestionItems(
  result: OutfitSuggestions,
  availableItems: Item[],
  rejectedSignatures: Set<string>,
): string[] {
  const itemMap = new Map(availableItems.map((item) => [item.id, item]));
  const seenOutfits = new Set<string>();
  const errors: string[] = [];

  for (const [index, suggestion] of result.suggestions.entries()) {
    const selected = suggestion.itemIds.map((id) => itemMap.get(id));
    if (selected.some((item) => !item)) {
      errors.push(`Look ${index + 1} referenced an unavailable item.`);
      continue;
    }

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
      errors.push(`Look ${index + 1} had invalid category coverage.`);
    }

    const signature = outfitSignature(suggestion.itemIds);
    if (seenOutfits.has(signature)) {
      errors.push(`Look ${index + 1} duplicated another suggestion.`);
    }
    if (rejectedSignatures.has(signature)) {
      errors.push(`Look ${index + 1} exactly repeated a rejected outfit.`);
    }
    seenOutfits.add(signature);
  }

  return errors;
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
  const rejectedSignatures = rejectedSignaturesWithAlternatives(
    items,
    feedback,
  );
  let lastValidationError: unknown;
  let repairInstruction: string | undefined;

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
              "Create three ranked, genuinely distinct, wearable outfits when the wardrobe allows it; otherwise return as many as are feasible. Use only supplied available item IDs. Every outfit must contain exactly one top, one bottom, and one pair of shoes, with at most one outerwear and one accessory. Rank priorities in this order: occasion and formality, temperature and season suitability, walking comfort, color and pattern harmony, then personalization. Treat preferred personalization signals positively and avoided signals negatively. Never exactly repeat a recent rejected outfit when another combination is possible. Vary core pieces, not only accessories, whenever inventory permits. Each rationale must name the practical reason the look fits this request without mentioning feedback. Return only the requested structure.",
          },
          ...(repairInstruction
            ? [
                {
                  role: "system" as const,
                  content: repairInstruction,
                },
              ]
            : []),
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
    if (result.success) {
      const validationErrors = validateSuggestionItems(
        result.data,
        items,
        rejectedSignatures,
      );
      if (validationErrors.length === 0) return result.data;
      lastValidationError = new Error(validationErrors.join(" "));
      repairInstruction = `The previous response was invalid: ${validationErrors.join(" ")} Return a corrected, fully valid set.`;
    } else {
      const schemaErrors = result.error.issues
        .slice(0, 3)
        .map(
          (issue) => `${issue.path.join(".") || "response"}: ${issue.message}`,
        )
        .join("; ");
      lastValidationError = result.error;
      repairInstruction = `The previous response did not match the required structure: ${schemaErrors}. Return a corrected, fully valid set.`;
    }
  }

  throw new OutfitRecommendationError(
    "The model did not return valid outfit suggestions.",
    { cause: lastValidationError },
  );
}
