import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import type { Item } from "@/lib/db/schema";
import type { WardrobeItemAttributes } from "@/lib/item-schema";
import { getOpenAIClient } from "@/lib/openai";
import {
  purchaseCheckModelSchema,
  summarizePurchaseCheck,
  type PurchaseCheck,
} from "@/lib/purchase-check-schema";
import { validateImageFile } from "@/lib/uploads";
import { analyzeWardrobeItem } from "@/lib/wardrobe-vision";

export class PurchaseCheckError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PurchaseCheckError";
  }
}

export class EmptyWardrobeError extends Error {
  constructor() {
    super("Add a few wardrobe items before checking a purchase.");
    this.name = "EmptyWardrobeError";
  }
}

function compactItem(item: Item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    colors: item.colors,
    pattern: item.pattern,
    formality: item.formality,
    season: item.season,
    material: item.material,
    fit: item.fit,
  };
}

const instructions = [
  "You help someone decide whether to buy a garment by comparing it with the wardrobe they already own.",
  "compatibleItemIds: every owned item, from a different category than the candidate, that would look good worn with the candidate. Judge color, pattern, formality, and season. Be honest; leave out weak pairings.",
  "exampleOutfits: up to three distinct outfits built from owned item IDs that, together with the candidate, contain exactly one top, one bottom, and one pair of shoes, plus at most one outerwear and one accessory. Never include the candidate itself; it is added automatically.",
  "similarItems: owned items so close to the candidate (same category with similar color, pattern, and formality) that buying it would mostly duplicate them. Use an empty list when nothing is close.",
  "gapsFilled: short phrases for real gaps the candidate fills, such as a missing season, formality level, or color family. Use an empty list when it fills none.",
  "verdict: buy when it pairs widely and fills a gap or is not a duplicate; skip when it duplicates owned pieces or pairs with little; otherwise maybe.",
  "If a price is supplied, weigh it against how often the piece would realistically be worn and use priceNote for a one-sentence comment; otherwise priceNote is null. Do not assume a currency symbol.",
  "headline is one plain sentence; reasoning is two or three sentences that refer to owned items by name. Return only the requested structure.",
].join("\n");

export async function judgePurchase({
  candidate,
  items,
  price,
}: {
  candidate: WardrobeItemAttributes;
  items: Item[];
  price?: number;
}): Promise<PurchaseCheck> {
  const payload = {
    candidate,
    price: price ?? null,
    ownedItems: items.map(compactItem),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: { output_parsed?: unknown };

    try {
      response = await getOpenAIClient().responses.parse({
        model: "gpt-5.6-terra",
        reasoning: { effort: "low" },
        store: false,
        input: [
          { role: "system", content: instructions },
          { role: "user", content: JSON.stringify(payload) },
        ],
        text: {
          format: zodTextFormat(purchaseCheckModelSchema, "purchase_check"),
        },
      });
    } catch (error) {
      throw new PurchaseCheckError("The purchase check request failed.", {
        cause: error,
      });
    }

    const result = purchaseCheckModelSchema.safeParse(response.output_parsed);
    if (result.success) {
      return summarizePurchaseCheck(candidate, items, result.data);
    }

    if (attempt === 1) {
      throw new PurchaseCheckError(
        "The model did not return a valid purchase check.",
        { cause: result.error },
      );
    }
  }

  throw new PurchaseCheckError("The model did not return a purchase check.");
}

/**
 * Analyzes a photo of a garment the user is considering and compares it with
 * their whole wardrobe (including items in the laundry). Nothing is stored.
 */
export async function checkPurchase({
  file,
  items,
  price,
}: {
  file: File;
  items: Item[];
  price?: number;
}): Promise<PurchaseCheck> {
  const mimeType = await validateImageFile(file);
  if (items.length === 0) throw new EmptyWardrobeError();

  const candidate = await analyzeWardrobeItem(file, mimeType);
  return judgePurchase({ candidate, items, price });
}
