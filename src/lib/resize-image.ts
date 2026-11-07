// Browser-only helpers. Hosting platforms can cap request bodies well below the
// 10 MB server limit (Vercel functions reject anything over 4.5 MB), so photos
// are downscaled before upload. The vision model's high-detail mode does not
// use more than ~2000 px, so nothing useful is lost.

export const MAX_UPLOAD_EDGE_PX = 2048;
export const MAX_UNTOUCHED_UPLOAD_BYTES = 2 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

export function scaledDimensions(
  width: number,
  height: number,
  maxEdge = MAX_UPLOAD_EDGE_PX,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };

  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// iPhones save photos as HEIC. Only Safari can decode it natively, and many
// browsers report an empty MIME type for it, so the extension is checked too.
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSION = /\.(heic|heif)$/i;

export const ACCEPTED_IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export function isHeicFile(file: { name: string; type: string }): boolean {
  return (
    HEIC_TYPES.has(file.type.toLowerCase()) || HEIC_EXTENSION.test(file.name)
  );
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("This photo could not be read. Try a JPEG, PNG, or WebP image.");
    this.name = "UnsupportedImageError";
  }
}

async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (!isHeicFile(file)) return null;
  }

  try {
    // Loaded on demand: the decoder is large and only needed for HEIC.
    const { heicTo } = await import("heic-to/next");
    return await heicTo({
      blob: file,
      type: "bitmap",
      options: { imageOrientation: "from-image" },
    });
  } catch {
    throw new UnsupportedImageError();
  }
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^./]+$/, "") || "photo";
  return `${base}.jpg`;
}

/**
 * Returns a JPEG no larger than MAX_UPLOAD_EDGE_PX on its long edge. Small
 * JPEG/PNG/WebP images are returned untouched, HEIC is always converted, and
 * other files the browser cannot decode are passed through so the server can
 * report the real validation error.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const heic = isHeicFile(file);
  const bitmap = await decodeImage(file);
  if (!bitmap) return file;

  try {
    const target = scaledDimensions(bitmap.width, bitmap.height);
    const needsResize =
      target.width !== bitmap.width || target.height !== bitmap.height;

    if (!heic && !needsResize && file.size <= MAX_UNTOUCHED_UPLOAD_BYTES) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    // JPEG has no alpha channel; flatten transparent PNG/WebP onto white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    if (!blob) {
      if (heic) throw new UnsupportedImageError();
      return file;
    }
    if (!heic && blob.size >= file.size) return file;

    return new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
