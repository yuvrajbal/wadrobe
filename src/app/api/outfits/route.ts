import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import {
  outfitCreateSchema,
  outfitListFiltersSchema,
} from "@/lib/outfit-schema";
import { createOutfit, listOutfits, OutfitDomainError } from "@/lib/outfits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const filters = outfitListFiltersSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!filters.success) {
    return NextResponse.json(
      { error: "Invalid outfit filters." },
      { status: 400 },
    );
  }

  try {
    const outfits = await listOutfits(getCurrentUserId(), filters.data);
    return NextResponse.json({ outfits });
  } catch (error) {
    console.error("Outfit listing failed", error);
    return NextResponse.json(
      { error: "The outfits could not be loaded." },
      { status: 500 },
    );
  }
}

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

  const payload = outfitCreateSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: "Choose a valid top, bottom, and shoes." },
      { status: 400 },
    );
  }

  try {
    const outfit = await createOutfit(getCurrentUserId(), payload.data);
    return NextResponse.json({ outfit }, { status: 201 });
  } catch (error) {
    if (error instanceof OutfitDomainError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Manual outfit creation failed", error);
    return NextResponse.json(
      { error: "The outfit could not be saved." },
      { status: 500 },
    );
  }
}
