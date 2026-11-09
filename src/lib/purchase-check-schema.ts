import { z } from "zod";

import { itemCategories, type WardrobeItemAttributes } from "@/lib/item-schema";

type Category = (typeof itemCategories)[number];
type OwnedItem = { id: string; category: Category };

export const purchaseVerdicts = ["buy", "maybe", "skip"] as const;

/** Optional price typed by the shopper, in their local currency. */
export const purchasePriceSchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(1_000_000);

const itemIdListSchema = z.array(z.string().trim().min(1).max(64)).max(200);

/** Structured judgement returned by the model; item IDs are re-validated. */
export const purchaseCheckModelSchema = z
  .object({
    verdict: z.enum(purchaseVerdicts),
    headline: z.string().trim().min(1).max(160),
    reasoning: z.string().trim().min(1).max(480),
    compatibleItemIds: itemIdListSchema,
    exampleOutfits: z
      .array(
        z
          .object({
            itemIds: z.array(z.string().trim().min(1).max(64)).min(1).max(4),
            rationale: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .max(3),
    similarItems: z
      .array(
        z
          .object({
            itemId: z.string().trim().min(1).max(64),
            note: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .max(3),
    gapsFilled: z.array(z.string().trim().min(1).max(160)).max(3),
    priceNote: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export type PurchaseCheckModelResult = z.infer<typeof purchaseCheckModelSchema>;
export type PurchaseVerdict = (typeof purchaseVerdicts)[number];
export type CategoryCounts = Record<Category, number>;

export type PurchaseCheck = {
  candidate: WardrobeItemAttributes;
  verdict: PurchaseVerdict;
  headline: string;
  reasoning: string;
  compatibleItemIds: string[];
  compatibleCounts: CategoryCounts;
  outfitEstimate: number;
  exampleOutfits: { itemIds: string[]; rationale: string }[];
  similarItems: { itemId: string; note: string }[];
  gapsFilled: string[];
  priceNote: string | null;
};

const coreCategories = ["top", "bottom", "shoes"] as const satisfies Category[];

function emptyCounts(): CategoryCounts {
  return { top: 0, bottom: 0, shoes: 0, outerwear: 0, accessory: 0 };
}

/**
 * Estimates how many top + bottom + shoes combinations the new piece enables,
 * counting only owned items the model judged compatible with it. Outerwear and
 * accessories are layered onto any core outfit, so they need every core slot.
 */
export function estimateOutfits(
  candidateCategory: Category,
  counts: CategoryCounts,
): number {
  return coreCategories
    .filter((category) => category !== candidateCategory)
    .reduce((total, category) => total * counts[category], 1);
}

function isValidOutfit(categories: Category[]): boolean {
  const counts = emptyCounts();
  for (const category of categories) counts[category] += 1;
  return (
    coreCategories.every((category) => counts[category] === 1) &&
    counts.outerwear <= 1 &&
    counts.accessory <= 1
  );
}

/**
 * Drops anything the model invented: unknown or repeated item IDs, outfits that
 * would not be wearable once the candidate is added, and the candidate's own
 * category in the compatibility list (a second jacket does not pair with a
 * jacket).
 */
export function summarizePurchaseCheck(
  candidate: WardrobeItemAttributes,
  ownedItems: OwnedItem[],
  result: PurchaseCheckModelResult,
): PurchaseCheck {
  const owned = new Map(ownedItems.map((item) => [item.id, item]));

  const compatibleItemIds = [...new Set(result.compatibleItemIds)].filter(
    (id) => {
      const item = owned.get(id);
      return item !== undefined && item.category !== candidate.category;
    },
  );
  const compatibleCounts = emptyCounts();
  for (const id of compatibleItemIds) {
    compatibleCounts[owned.get(id)!.category] += 1;
  }

  const seenOutfits = new Set<string>();
  const exampleOutfits = result.exampleOutfits.filter((outfit) => {
    const ids = [...new Set(outfit.itemIds)];
    if (ids.length !== outfit.itemIds.length) return false;
    const items = ids.map((id) => owned.get(id));
    if (items.some((item) => item === undefined)) return false;
    const categories = [
      candidate.category,
      ...items.map((item) => item!.category),
    ];
    if (!isValidOutfit(categories)) return false;
    const signature = [...ids].sort().join(":");
    if (seenOutfits.has(signature)) return false;
    seenOutfits.add(signature);
    return true;
  });

  const seenSimilar = new Set<string>();
  const similarItems = result.similarItems.filter(({ itemId }) => {
    if (!owned.has(itemId) || seenSimilar.has(itemId)) return false;
    seenSimilar.add(itemId);
    return true;
  });

  return {
    candidate,
    verdict: result.verdict,
    headline: result.headline,
    reasoning: result.reasoning,
    compatibleItemIds,
    compatibleCounts,
    outfitEstimate: estimateOutfits(candidate.category, compatibleCounts),
    exampleOutfits,
    similarItems,
    gapsFilled: result.gapsFilled,
    priceNote: result.priceNote,
  };
}
