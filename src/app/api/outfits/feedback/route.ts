import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import { outfitFeedbackSchema } from "@/lib/outfit-schema";
import { createAiOutfitFeedback, OutfitDomainError } from "@/lib/outfits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON outfit feedback." },
      { status: 400 },
    );
  }

  const feedback = outfitFeedbackSchema.safeParse(body);
  if (!feedback.success) {
    return NextResponse.json(
      { error: "Invalid outfit feedback." },
      { status: 400 },
    );
  }

  try {
    const outfit = await createAiOutfitFeedback(
      getCurrentUserId(),
      feedback.data,
    );
    return NextResponse.json({ outfit }, { status: 201 });
  } catch (error) {
    if (error instanceof OutfitDomainError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Outfit feedback persistence failed", error);
    return NextResponse.json(
      { error: "Your feedback could not be saved." },
      { status: 500 },
    );
  }
}
