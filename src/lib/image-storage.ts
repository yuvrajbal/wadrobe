import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const imageObjectKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|svg)$/i;

export type StoredObject = {
  body: Uint8Array;
  contentType: string;
  size: number;
};

export interface ImageStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

function requireValidKey(key: string) {
  if (!imageObjectKeyPattern.test(key)) {
    throw new Error("Refusing to access an invalid image object key.");
  }
}

function contentTypeForKey(key: string): string {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".svg")) return "image/svg+xml";
  return "image/webp";
}

export function createLocalImageStorage(directory: string): ImageStorage {
  const absoluteDirectory = path.resolve(directory);

  return {
    async put(key, body) {
      requireValidKey(key);
      await mkdir(absoluteDirectory, { recursive: true });
      await writeFile(path.join(absoluteDirectory, key), body, { flag: "wx" });
    },

    async get(key) {
      requireValidKey(key);

      try {
        const body = await readFile(path.join(absoluteDirectory, key));
        return {
          body: new Uint8Array(body),
          contentType: contentTypeForKey(key),
          size: body.byteLength,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async delete(key) {
      requireValidKey(key);

      try {
        await unlink(path.join(absoluteDirectory, key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

type S3ImageStorageOptions = {
  bucket: string;
  prefix?: string;
  client: S3Client;
};

function normalizedPrefix(prefix: string | undefined) {
  const value = prefix?.replace(/^\/+|\/+$/g, "") ?? "";
  return value ? `${value}/` : "";
}

export function createS3ImageStorage({
  bucket,
  prefix,
  client,
}: S3ImageStorageOptions): ImageStorage {
  const objectPrefix = normalizedPrefix(prefix);
  const objectKey = (key: string) => `${objectPrefix}${key}`;

  return {
    async put(key, body, contentType) {
      requireValidKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey(key),
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=31536000, immutable",
        }),
      );
    },

    async get(key) {
      requireValidKey(key);

      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
        );
        if (!result.Body) throw new Error("Object storage returned no body.");
        const body = await result.Body.transformToByteArray();
        return {
          body,
          contentType: result.ContentType ?? contentTypeForKey(key),
          size: result.ContentLength ?? body.byteLength,
        };
      } catch (error) {
        const storageError = error as {
          name?: string;
          $metadata?: { httpStatusCode?: number };
        };
        if (
          storageError.name === "NoSuchKey" ||
          storageError.name === "NotFound" ||
          storageError.$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
        throw error;
      }
    },

    async delete(key) {
      requireValidKey(key);
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );
    },
  };
}

let imageStorage: ImageStorage | undefined;

export function getImageStorage(): ImageStorage {
  if (imageStorage) return imageStorage;

  const driver =
    process.env.IMAGE_STORAGE_DRIVER ??
    (process.env.NODE_ENV === "production" ? undefined : "local");
  if (!driver) {
    throw new Error("IMAGE_STORAGE_DRIVER is required in production.");
  }
  if (driver === "local") {
    imageStorage = createLocalImageStorage(
      process.env.IMAGE_STORAGE_LOCAL_DIR ?? ".data/uploads",
    );
    return imageStorage;
  }

  if (driver !== "s3") {
    throw new Error(`Unsupported IMAGE_STORAGE_DRIVER: ${driver}`);
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required for S3 image storage.");

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together.",
    );
  }

  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  imageStorage = createS3ImageStorage({
    bucket,
    prefix: process.env.S3_KEY_PREFIX,
    client,
  });
  return imageStorage;
}
