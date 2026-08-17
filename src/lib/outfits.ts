import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { items, outfits, type Item, type Outfit } from "@/lib/db/schema";
import type {
  OutfitCreate,
  OutfitFeedback,
  OutfitListFilters,
  OutfitUpdate,
} from "@/lib/outfit-schema";

export type OutfitDomainErrorCode =
  | "item_not_found"
  | "item_not_owned"
  | "item_unavailable"
  | "invalid_combination";

export class OutfitDomainError extends Error {
  constructor(
    public readonly code: OutfitDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OutfitDomainError";
  }
}

export async function getValidOutfitItems(
  userId: string,
  itemIds: string[],
): Promise<Item[]> {
  const foundItems = await getDatabase()
    .select()
    .from(items)
    .where(inArray(items.id, itemIds));

  if (foundItems.length !== itemIds.length) {
    throw new OutfitDomainError(
      "item_not_found",
      "One or more wardrobe items no longer exist.",
    );
  }

  if (foundItems.some((item) => item.userId !== userId)) {
    throw new OutfitDomainError(
      "item_not_owned",
      "Every wardrobe item must belong to the current user.",
    );
  }

  if (foundItems.some((item) => !item.available)) {
    throw new OutfitDomainError(
      "item_unavailable",
      "Remove unavailable wardrobe items before continuing.",
    );
  }

  const counts = new Map<string, number>();
  for (const item of foundItems) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  const hasRequiredPieces = ["top", "bottom", "shoes"].every(
    (category) => counts.get(category) === 1,
  );
  const hasOnlyOnePerSlot = [
    "top",
    "bottom",
    "shoes",
    "outerwear",
    "accessory",
  ].every((category) => (counts.get(category) ?? 0) <= 1);

  if (!hasRequiredPieces || !hasOnlyOnePerSlot) {
    throw new OutfitDomainError(
      "invalid_combination",
      "Choose one top, one bottom, one pair of shoes, and at most one outerwear and accessory item.",
    );
  }

  const byId = new Map(foundItems.map((item) => [item.id, item]));
  return itemIds.map((id) => byId.get(id)!);
}

export async function createOutfit(
  userId: string,
  payload: OutfitCreate,
): Promise<Outfit> {
  await getValidOutfitItems(userId, payload.itemIds);

  const [outfit] = await getDatabase()
    .insert(outfits)
    .values({
      userId,
      itemIds: payload.itemIds,
      context: payload.context,
      source: "manual",
      status: "saved",
    })
    .returning();

  return outfit;
}

export async function createAiOutfitFeedback(
  userId: string,
  payload: OutfitFeedback,
): Promise<Outfit> {
  await getValidOutfitItems(userId, payload.itemIds);

  const [outfit] = await getDatabase()
    .insert(outfits)
    .values({
      userId,
      itemIds: payload.itemIds,
      context: payload.context,
      source: "ai",
      status: payload.status,
    })
    .returning();

  return outfit;
}

export async function listOutfits(
  userId: string,
  filters: OutfitListFilters = {},
): Promise<Outfit[]> {
  const conditions = [eq(outfits.userId, userId)];

  if (filters.status) conditions.push(eq(outfits.status, filters.status));
  if (filters.source) conditions.push(eq(outfits.source, filters.source));

  return getDatabase()
    .select()
    .from(outfits)
    .where(and(...conditions))
    .orderBy(desc(outfits.createdAt));
}

export async function listRecentOutfitFeedback(
  userId: string,
  limit = 12,
): Promise<Outfit[]> {
  return getDatabase()
    .select()
    .from(outfits)
    .where(
      and(
        eq(outfits.userId, userId),
        inArray(outfits.status, ["saved", "rejected"]),
      ),
    )
    .orderBy(desc(outfits.createdAt))
    .limit(limit);
}

export async function updateOutfit(
  id: string,
  userId: string,
  update: OutfitUpdate,
): Promise<Outfit | null> {
  const [existing] = await getDatabase()
    .select()
    .from(outfits)
    .where(and(eq(outfits.id, id), eq(outfits.userId, userId)))
    .limit(1);

  if (!existing) return null;

  if (update.itemIds) {
    await getValidOutfitItems(userId, update.itemIds);
  }

  const [updated] = await getDatabase()
    .update(outfits)
    .set(update)
    .where(and(eq(outfits.id, id), eq(outfits.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteOutfit(
  id: string,
  userId: string,
): Promise<Outfit | null> {
  const [outfit] = await getDatabase()
    .delete(outfits)
    .where(and(eq(outfits.id, id), eq(outfits.userId, userId)))
    .returning();

  return outfit ?? null;
}
