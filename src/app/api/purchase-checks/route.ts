import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/current-user";
import {
  checkPurchase,
  EmptyWardrobeError,
  PurchaseCheckError,
} from "@/lib/purchase-check";
import { purchasePriceSchema } from "@/lib/purchase-check-schema";
import { UploadValidationError } from "@/lib/uploads";
import { listWardrobeItems } from "@/lib/wardrobe-items";
import { WardrobeVisionError } from "@/lib/wardrobe-vision";

export const runtime = "nodejs";

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

  const rawPrice = formData.get("price");
  let price: number | undefined;
  if (typeof rawPrice === "string" && rawPrice.trim() !== "") {
    const parsed = purchasePriceSchema.safeParse(rawPrice);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter the price as a positive number." },
        { status: 400 },
      );
    }
    price = parsed.data;
  }

  try {
    const userId = await getCurrentUserId();
    const items = await listWardrobeItems(userId, {});
    const check = await checkPurchase({ file, items, price });
    return NextResponse.json({ check });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof EmptyWardrobeError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof WardrobeVisionError) {
      console.error("Purchase check vision analysis failed", error);
      return NextResponse.json(
        { error: "The photo could not be analyzed. Please try another one." },
        { status: 502 },
      );
    }
    if (error instanceof PurchaseCheckError) {
      console.error("Purchase check failed", error);
      return NextResponse.json(
        { error: "The item could not be compared. Please try again." },
        { status: 502 },
      );
    }
    console.error("Purchase check failed", error);
    return NextResponse.json(
      { error: "The item could not be checked." },
      { status: 500 },
    );
  }
}
