import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createLocalImageStorage,
  createS3ImageStorage,
} from "@/lib/image-storage";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("local image storage", () => {
  it("round-trips and deletes an object", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "wadrobe-storage-"));
    temporaryDirectories.push(directory);
    const storage = createLocalImageStorage(directory);
    const key = "123e4567-e89b-42d3-a456-426614174000.png";
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    await storage.put(key, body, "image/png");
    await expect(storage.get(key)).resolves.toEqual({
      body,
      contentType: "image/png",
      size: body.byteLength,
    });

    await storage.delete(key);
    await expect(storage.get(key)).resolves.toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it("rejects traversal and unrelated object keys", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "wadrobe-storage-"));
    temporaryDirectories.push(directory);
    const storage = createLocalImageStorage(directory);

    await expect(storage.get("../private.txt")).rejects.toThrow(
      "invalid image object key",
    );
  });
});

describe("S3 image storage", () => {
  it("uses a private prefixed object for put, get, and delete", async () => {
    const body = new Uint8Array([0xff, 0xd8, 0xff]);
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(body) },
        ContentLength: 3,
        ContentType: "image/jpeg",
      })
      .mockResolvedValueOnce({});
    const storage = createS3ImageStorage({
      bucket: "private-images",
      prefix: "/wardrobe/",
      client: { send } as unknown as S3Client,
    });
    const key = "123e4567-e89b-42d3-a456-426614174000.jpg";

    await storage.put(key, body, "image/jpeg");
    await expect(storage.get(key)).resolves.toEqual({
      body,
      contentType: "image/jpeg",
      size: 3,
    });
    await storage.delete(key);

    expect(send.mock.calls.map(([command]) => command.input)).toEqual([
      expect.objectContaining({
        Bucket: "private-images",
        Key: `wardrobe/${key}`,
        ContentType: "image/jpeg",
      }),
      { Bucket: "private-images", Key: `wardrobe/${key}` },
      { Bucket: "private-images", Key: `wardrobe/${key}` },
    ]);
  });

  it("returns null for a missing object", async () => {
    const missing = Object.assign(new Error("missing"), {
      name: "NoSuchKey",
    });
    const send = vi.fn().mockRejectedValue(missing);
    const storage = createS3ImageStorage({
      bucket: "private-images",
      client: { send } as unknown as S3Client,
    });

    await expect(
      storage.get("123e4567-e89b-42d3-a456-426614174000.webp"),
    ).resolves.toBeNull();
  });
});
