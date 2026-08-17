import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import {
  InsufficientWardrobeError,
  OutfitRecommendationError,
  recommendOutfits,
} from "@/lib/outfit-recommendations";
import { recommendationRequestSchema } from "@/lib/outfit-schema";
import { listRecentOutfitFeedback } from "@/lib/outfits";
import { listWardrobeItems } from "@/lib/wardrobe-items";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON suggestion request." },
      { status: 400 },
    );
  }

  const requestData = recommendationRequestSchema.safeParse(body);
  if (!requestData.success) {
    return NextResponse.json(
      { error: "Add valid occasion, weather, walking, and style details." },
      { status: 400 },
    );
  }

  try {
    const userId = getCurrentUserId();
    const [items, feedback] = await Promise.all([
      listWardrobeItems(userId, { available: true }),
      listRecentOutfitFeedback(userId),
    ]);
    const result = await recommendOutfits({
      items,
      feedback,
      context: requestData.data.context,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InsufficientWardrobeError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof OutfitRecommendationError) {
      console.error("Outfit recommendation failed", error);
      return NextResponse.json(
        { error: "Suggestions are unavailable right now. Please try again." },
        { status: 502 },
      );
    }
    console.error("Outfit suggestion request failed", error);
    return NextResponse.json(
      { error: "Suggestions could not be created." },
      { status: 500 },
    );
  }
}
