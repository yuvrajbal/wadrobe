import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import { ingestWardrobeItem } from "@/lib/item-ingestion";
import {
  itemListFiltersSchema,
  wardrobeItemAttributesSchema,
  type WardrobeItemAttributes,
} from "@/lib/item-schema";
import { UploadValidationError } from "@/lib/uploads";
import { listWardrobeItems } from "@/lib/wardrobe-items";
import { WardrobeVisionError } from "@/lib/wardrobe-vision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const filters = itemListFiltersSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!filters.success) {
    return NextResponse.json(
      { error: "Invalid item filters." },
      { status: 400 },
    );
  }

  try {
    const userId = await getCurrentUserId();
    const items = await listWardrobeItems(userId, filters.data);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Wardrobe item listing failed", error);
    return NextResponse.json(
      { error: "The wardrobe items could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data with a file field." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A file field is required." },
      { status: 400 },
    );
  }

  // Optional pre-analyzed attributes (sent after a purchase check) let the
  // item be created without a second vision call.
  const rawAttributes = formData.get("attributes");
  let attributes: WardrobeItemAttributes | undefined;
  if (typeof rawAttributes === "string") {
    let json: unknown;
    try {
      json = JSON.parse(rawAttributes);
    } catch {
      json = undefined;
    }
    const parsed = wardrobeItemAttributesSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The item details were invalid." },
        { status: 400 },
      );
    }
    attributes = parsed.data;
  }

  try {
    const userId = await getCurrentUserId();
    const item = await ingestWardrobeItem(file, userId, attributes);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof WardrobeVisionError) {
      console.error("Wardrobe vision analysis failed", error);
      return NextResponse.json(
        { error: "The image could not be analyzed. Please try another photo." },
        { status: 502 },
      );
    }

    console.error("Wardrobe item ingestion failed", error);
    return NextResponse.json(
      { error: "The wardrobe item could not be created." },
      { status: 500 },
    );
  }
}
