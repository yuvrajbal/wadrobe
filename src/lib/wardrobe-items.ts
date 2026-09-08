import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { items, type Item } from "@/lib/db/schema";
import type { ItemListFilters, ItemUpdate } from "@/lib/item-schema";
import { deleteStoredImage, getStoredImageKey } from "@/lib/uploads";

export async function listWardrobeItems(
  userId: string,
  filters: ItemListFilters,
): Promise<Item[]> {
  const conditions = [eq(items.userId, userId)];

  if (filters.category !== undefined) {
    conditions.push(eq(items.category, filters.category));
  }

  if (filters.available !== undefined) {
    conditions.push(eq(items.available, filters.available));
  }

  return getDatabase()
    .select()
    .from(items)
    .where(and(...conditions))
    .orderBy(desc(items.createdAt));
}

export async function userOwnsWardrobeImage(
  userId: string,
  imageUrl: string,
): Promise<boolean> {
  const [item] = await getDatabase()
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.userId, userId), eq(items.imageUrl, imageUrl)))
    .limit(1);

  return Boolean(item);
}

export async function updateWardrobeItem(
  id: string,
  userId: string,
  attributes: ItemUpdate,
): Promise<Item | null> {
  const [item] = await getDatabase()
    .update(items)
    .set(attributes)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();

  return item ?? null;
}

export async function deleteWardrobeItem(
  id: string,
  userId: string,
): Promise<Item | null> {
  const [item] = await getDatabase()
    .delete(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();

  if (!item) {
    return null;
  }

  const imageKey = getStoredImageKey(item.imageUrl);

  if (imageKey) {
    try {
      await deleteStoredImage(imageKey, userId);
    } catch (error) {
      // The database deletion is authoritative. A storage failure should not
      // make a successful delete look retryable and produce a later 404.
      console.error("Failed to delete wardrobe image", error);
    }
  }

  return item;
}
