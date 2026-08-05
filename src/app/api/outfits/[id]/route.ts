import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import { outfitIdSchema, outfitUpdateSchema } from "@/lib/outfit-schema";
import { deleteOutfit, OutfitDomainError, updateOutfit } from "@/lib/outfits";

export const runtime = "nodejs";

type OutfitRouteContext = { params: Promise<{ id: string }> };

async function getOutfitId(context: OutfitRouteContext) {
  const result = outfitIdSchema.safeParse((await context.params).id);
  return result.success ? result.data : null;
}

export async function PATCH(request: Request, context: OutfitRouteContext) {
  const id = await getOutfitId(context);
  if (!id) {
    return NextResponse.json({ error: "Invalid outfit ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON outfit update." },
      { status: 400 },
    );
  }

  const update = outfitUpdateSchema.safeParse(body);
  if (!update.success) {
    return NextResponse.json(
      { error: "Invalid outfit update." },
      { status: 400 },
    );
  }

  try {
    const outfit = await updateOutfit(id, getCurrentUserId(), update.data);
    if (!outfit) {
      return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
    }
    return NextResponse.json({ outfit });
  } catch (error) {
    if (error instanceof OutfitDomainError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Outfit update failed", error);
    return NextResponse.json(
      { error: "The outfit could not be updated." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: OutfitRouteContext) {
  const id = await getOutfitId(context);
  if (!id) {
    return NextResponse.json({ error: "Invalid outfit ID." }, { status: 400 });
  }

  try {
    const outfit = await deleteOutfit(id, getCurrentUserId());
    if (!outfit) {
      return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Outfit deletion failed", error);
    return NextResponse.json(
      { error: "The outfit could not be deleted." },
      { status: 500 },
    );
  }
}
