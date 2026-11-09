import "server-only";

import { getDatabase } from "@/lib/db";
import { items } from "@/lib/db/schema";
import type { WardrobeItemAttributes } from "@/lib/item-schema";
import { deleteStoredImage, storeImage, type StoredImage } from "@/lib/uploads";
import { analyzeWardrobeItem } from "@/lib/wardrobe-vision";

/**
 * Stores the photo and creates an item. Pass `knownAttributes` when the photo
 * was already analyzed (for example by a purchase check) to skip the vision
 * call; the user can edit the result afterwards either way.
 */
export async function ingestWardrobeItem(
  file: File,
  userId: string,
  knownAttributes?: WardrobeItemAttributes,
) {
  let upload: StoredImage | undefined;

  try {
    upload = await storeImage(file);
    const attributes =
      knownAttributes ?? (await analyzeWardrobeItem(file, upload.type));

    const [item] = await getDatabase()
      .insert(items)
      .values({
        userId,
        imageUrl: upload.url,
        ...attributes,
      })
      .returning();

    if (!item) {
      throw new Error("The database did not return the created wardrobe item.");
    }

    return item;
  } catch (error) {
    if (upload) {
      try {
        await deleteStoredImage(upload.key);
      } catch (cleanupError) {
        console.error("Failed to clean up wardrobe image", cleanupError);
      }
    }

    throw error;
  }
}
