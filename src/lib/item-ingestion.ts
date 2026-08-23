import "server-only";

import { getDatabase } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { deleteStoredImage, storeImage, type StoredImage } from "@/lib/uploads";
import { analyzeWardrobeItem } from "@/lib/wardrobe-vision";

export async function ingestWardrobeItem(file: File, userId: string) {
  let upload: StoredImage | undefined;

  try {
    upload = await storeImage(file);
    const attributes = await analyzeWardrobeItem(file, upload.type);

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
