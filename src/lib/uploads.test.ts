import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));
const databaseMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  deleteWhere: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
  selectWhere: vi.fn(),
  values: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/image-storage", () => ({
  getImageStorage: () => storageMocks,
  imageObjectKeyPattern:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|svg)$/i,
}));
vi.mock("@/lib/db", () => ({
  getDatabase: () => ({
    delete: databaseMocks.delete,
    insert: databaseMocks.insert,
    select: databaseMocks.select,
  }),
}));

import {
  deleteStoredImage,
  getStoredImageKey,
  MAX_IMAGE_SIZE_BYTES,
  readStoredImage,
  storeImage,
  UploadValidationError,
  validateImageFile,
} from "@/lib/uploads";

describe("stored image references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.insert.mockReturnValue({ values: databaseMocks.values });
    databaseMocks.select.mockReturnValue({ from: databaseMocks.from });
    databaseMocks.from.mockReturnValue({ where: databaseMocks.selectWhere });
    databaseMocks.selectWhere.mockReturnValue({ limit: databaseMocks.limit });
    databaseMocks.limit.mockResolvedValue([{ key: "owned" }]);
    databaseMocks.delete.mockReturnValue({ where: databaseMocks.deleteWhere });
  });

  it("extracts only generated object keys", () => {
    expect(
      getStoredImageKey("/api/images/123e4567-e89b-42d3-a456-426614174000.jpg"),
    ).toBe("123e4567-e89b-42d3-a456-426614174000.jpg");
    expect(getStoredImageKey("https://example.com/shirt.jpg")).toBeNull();
    expect(getStoredImageKey("/api/images/../private.txt")).toBeNull();
    expect(
      getStoredImageKey("/api/images/123e4567-e89b-42d3-a456-426614174000.svg"),
    ).toBe("123e4567-e89b-42d3-a456-426614174000.svg");
  });

  it("stores, retrieves, and deletes through the configured adapter", async () => {
    const userId = "123e4567-e89b-42d3-a456-426614174000";
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "shirt.jpg", {
      type: "image/jpeg",
    });
    const storedObject = {
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
      size: 3,
    };
    storageMocks.get.mockResolvedValue(storedObject);

    const upload = await storeImage(file, userId);
    expect(upload.url).toBe(`/api/images/${upload.key}`);
    expect(storageMocks.put).toHaveBeenCalledWith(
      upload.key,
      new Uint8Array([0xff, 0xd8, 0xff]),
      "image/jpeg",
    );

    expect(databaseMocks.values).toHaveBeenCalledWith({
      key: upload.key,
      userId,
    });
    await expect(readStoredImage(upload.key, userId)).resolves.toEqual(
      storedObject,
    );
    await deleteStoredImage(upload.key, userId);
    expect(storageMocks.delete).toHaveBeenCalledWith(upload.key);
  });

  it("does not reveal an image that is not owned by the current user", async () => {
    databaseMocks.limit.mockResolvedValue([]);

    await expect(
      readStoredImage(
        "123e4567-e89b-42d3-a456-426614174000.jpg",
        "223e4567-e89b-42d3-a456-426614174000",
      ),
    ).resolves.toBeNull();
    expect(storageMocks.get).not.toHaveBeenCalled();
  });
});

describe("validateImageFile", () => {
  it("accepts a PNG with a matching signature", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "shirt.png",
      { type: "image/png" },
    );

    await expect(validateImageFile(file)).resolves.toBe("image/png");
  });

  it("rejects content that does not match its MIME type", async () => {
    const file = new File(["not an image"], "shirt.png", {
      type: "image/png",
    });

    await expect(validateImageFile(file)).rejects.toMatchObject({
      status: 415,
    });
  });

  it("rejects unsupported image formats", async () => {
    const file = new File([new Uint8Array([0x47, 0x49, 0x46])], "shirt.gif", {
      type: "image/gif",
    });

    await expect(validateImageFile(file)).rejects.toBeInstanceOf(
      UploadValidationError,
    );
  });

  it("rejects images above the size limit", async () => {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );

    await expect(validateImageFile(file)).rejects.toMatchObject({
      status: 413,
    });
  });
});
