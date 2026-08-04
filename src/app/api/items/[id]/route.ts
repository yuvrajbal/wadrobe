import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import { itemIdSchema, itemUpdateSchema } from "@/lib/item-schema";
import { deleteWardrobeItem, updateWardrobeItem } from "@/lib/wardrobe-items";

export const runtime = "nodejs";

type ItemRouteContext = {
  params: Promise<{ id: string }>;
};

async function getItemId(context: ItemRouteContext): Promise<string | null> {
  const result = itemIdSchema.safeParse((await context.params).id);
  return result.success ? result.data : null;
}

export async function PATCH(request: Request, context: ItemRouteContext) {
  const id = await getItemId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON item update." },
      { status: 400 },
    );
  }

  const attributes = itemUpdateSchema.safeParse(body);

  if (!attributes.success) {
    return NextResponse.json(
      { error: "Invalid item update." },
      { status: 400 },
    );
  }

  try {
    const item = await updateWardrobeItem(
      id,
      getCurrentUserId(),
      attributes.data,
    );

    if (!item) {
      return NextResponse.json(
        { error: "Wardrobe item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Wardrobe item update failed", error);
    return NextResponse.json(
      { error: "The wardrobe item could not be updated." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: ItemRouteContext) {
  const id = await getItemId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  try {
    const item = await deleteWardrobeItem(id, getCurrentUserId());

    if (!item) {
      return NextResponse.json(
        { error: "Wardrobe item not found." },
        { status: 404 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Wardrobe item deletion failed", error);
    return NextResponse.json(
      { error: "The wardrobe item could not be deleted." },
      { status: 500 },
    );
  }
}
