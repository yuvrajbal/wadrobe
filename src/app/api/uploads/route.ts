import { NextResponse } from "next/server";

import { storeImage, UploadValidationError } from "@/lib/uploads";

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

  try {
    const upload = await storeImage(file);
    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Image upload failed", error);
    return NextResponse.json(
      { error: "The image could not be stored." },
      { status: 500 },
    );
  }
}
