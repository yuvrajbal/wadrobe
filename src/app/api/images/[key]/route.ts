import { readStoredImage } from "@/lib/uploads";

export const runtime = "nodejs";

type ImageRouteContext = {
  params: Promise<{ key: string }>;
};

export async function GET(_request: Request, context: ImageRouteContext) {
  const { key } = await context.params;

  try {
    const image = await readStoredImage(key);
    if (!image) return new Response(null, { status: 404 });

    return new Response(image.body as BodyInit, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": String(image.size),
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid image")) {
      return new Response(null, { status: 400 });
    }

    console.error("Image retrieval failed", error);
    return new Response(null, { status: 500 });
  }
}
