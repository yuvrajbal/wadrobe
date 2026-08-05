import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import { critiqueOutfit, OutfitCritiqueError } from "@/lib/outfit-critique";
import { outfitCritiqueRequestSchema } from "@/lib/outfit-schema";
import { getValidOutfitItems, OutfitDomainError } from "@/lib/outfits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON outfit." },
      { status: 400 },
    );
  }

  const payload = outfitCritiqueRequestSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: "Choose a valid top, bottom, and shoes first." },
      { status: 400 },
    );
  }

  try {
    const items = await getValidOutfitItems(
      getCurrentUserId(),
      payload.data.itemIds,
    );
    const critique = await critiqueOutfit(items);
    return NextResponse.json({ critique });
  } catch (error) {
    if (error instanceof OutfitDomainError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof OutfitCritiqueError) {
      console.error("Outfit critique failed", error);
      return NextResponse.json(
        { error: "The outfit could not be critiqued. Please try again." },
        { status: 502 },
      );
    }
    console.error("Outfit critique failed", error);
    return NextResponse.json(
      { error: "The outfit could not be critiqued." },
      { status: 500 },
    );
  }
}
