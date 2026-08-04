import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const extensionsByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type SupportedMimeType = keyof typeof extensionsByMimeType;

export type StoredImage = {
  fileName: string;
  size: number;
  type: SupportedMimeType;
  url: string;
};

const storedImageNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function getStoredImageFileName(imageUrl: string): string | null {
  const uploadsPrefix = "/uploads/";

  if (!imageUrl.startsWith(uploadsPrefix)) {
    return null;
  }

  const fileName = imageUrl.slice(uploadsPrefix.length);
  return storedImageNamePattern.test(fileName) ? fileName : null;
}

export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function hasBytes(
  bytes: Uint8Array,
  expected: readonly number[],
  offset = 0,
): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function hasValidSignature(
  bytes: Uint8Array,
  mimeType: SupportedMimeType,
): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return (
        hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
  }
}

export async function validateImageFile(
  file: File,
): Promise<SupportedMimeType> {
  if (file.size === 0) {
    throw new UploadValidationError("The uploaded image is empty.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new UploadValidationError("Images must be 10 MB or smaller.", 413);
  }

  if (!(file.type in extensionsByMimeType)) {
    throw new UploadValidationError(
      "Unsupported image type. Upload a JPEG, PNG, or WebP image.",
      415,
    );
  }

  const mimeType = file.type as SupportedMimeType;
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (!hasValidSignature(header, mimeType)) {
    throw new UploadValidationError(
      "The file contents do not match the declared image type.",
      415,
    );
  }

  return mimeType;
}

export async function storeImage(file: File): Promise<StoredImage> {
  const type = await validateImageFile(file);
  const fileName = `${randomUUID()}.${extensionsByMimeType[type]}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads");
  const destination = path.join(uploadDirectory, fileName);

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(destination, new Uint8Array(await file.arrayBuffer()), {
    flag: "wx",
  });

  return {
    fileName,
    size: file.size,
    type,
    url: `/uploads/${fileName}`,
  };
}

export async function deleteStoredImage(fileName: string): Promise<void> {
  if (!storedImageNamePattern.test(fileName)) {
    throw new Error("Refusing to delete an invalid stored image name.");
  }

  const destination = path.join(process.cwd(), "public", "uploads", fileName);

  try {
    await unlink(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
