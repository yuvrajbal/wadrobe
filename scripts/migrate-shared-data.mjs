import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const apply = process.env.MIGRATION_APPLY === "true";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sslOption(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!["require", "disable"].includes(value)) {
    throw new Error(`${name} must be require or disable.`);
  }
  return value === "require" ? "require" : false;
}

function normalizePrefix(prefix) {
  const value = prefix?.replace(/^\/+|\/+$/g, "") ?? "";
  return value ? `${value}/` : "";
}

function mimeType(bytes, extension) {
  const has = (signature, offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (extension === "jpg" && has([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    extension === "png" &&
    has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (
    extension === "webp" &&
    has([0x52, 0x49, 0x46, 0x46]) &&
    has([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  throw new Error(`Image contents do not match the .${extension} extension.`);
}

function comparable(value) {
  return JSON.stringify(value, (_key, nested) =>
    nested instanceof Date ? nested.toISOString() : nested,
  );
}

function withoutImageUrl(item) {
  const { imageUrl, ...rest } = item;
  void imageUrl;
  return rest;
}

function assertNoConflicts(sourceRows, destinationRows, label, transform) {
  const destinationById = new Map(destinationRows.map((row) => [row.id, row]));
  for (const row of sourceRows) {
    const existing = destinationById.get(row.id);
    if (
      existing &&
      comparable(transform(existing)) !== comparable(transform(row))
    ) {
      throw new Error(
        `${label} ${row.id} exists in both databases with different data. Resolve it before retrying.`,
      );
    }
  }
}

const sourceDatabaseUrl = required("SOURCE_DATABASE_URL");
const destinationDatabaseUrl = required("DATABASE_URL");
if (sourceDatabaseUrl === destinationDatabaseUrl) {
  throw new Error("Source and destination database URLs must be different.");
}

const sourceUploadDirectory = path.resolve(
  process.env.SOURCE_UPLOAD_DIR ?? "public/uploads",
);
const bucket = required("S3_BUCKET");
const objectPrefix = normalizePrefix(process.env.S3_KEY_PREFIX);
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
  throw new Error(
    "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together.",
  );
}

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});
const source = postgres(sourceDatabaseUrl, {
  max: 1,
  ssl: sslOption("SOURCE_DATABASE_SSL", "disable"),
});
const destination = postgres(destinationDatabaseUrl, {
  max: 1,
  ssl: sslOption("DATABASE_SSL", "require"),
});

const itemQuery = (sql) => sql`
  select
    id::text as id,
    user_id::text as "userId",
    image_url as "imageUrl",
    name,
    category,
    colors,
    pattern,
    formality,
    season,
    material,
    fit,
    notes,
    available,
    created_at as "createdAt"
  from items
  order by id
`;

const outfitQuery = (sql) => sql`
  select
    id::text as id,
    user_id::text as "userId",
    item_ids::text[] as "itemIds",
    context,
    status,
    source,
    created_at as "createdAt"
  from outfits
  order by id
`;

const uploadedKeys = [];

try {
  const [sourceItems, sourceOutfits, destinationItems, destinationOutfits] =
    await Promise.all([
      itemQuery(source),
      outfitQuery(source),
      itemQuery(destination),
      outfitQuery(destination),
    ]);

  assertNoConflicts(sourceItems, destinationItems, "Item", withoutImageUrl);
  assertNoConflicts(sourceOutfits, destinationOutfits, "Outfit", (row) => row);

  const availableItemIds = new Set([
    ...sourceItems.map(({ id }) => id),
    ...destinationItems.map(({ id }) => id),
  ]);
  for (const outfit of sourceOutfits) {
    const missing = outfit.itemIds.filter((id) => !availableItemIds.has(id));
    if (missing.length) {
      throw new Error(
        `Outfit ${outfit.id} references missing items: ${missing.join(", ")}`,
      );
    }
  }

  const imagePlans = [];
  for (const item of sourceItems) {
    if (!item.imageUrl.startsWith("/uploads/")) continue;
    const relativePath = item.imageUrl.slice("/uploads/".length);
    const sourcePath = path.resolve(sourceUploadDirectory, relativePath);
    if (!sourcePath.startsWith(`${sourceUploadDirectory}${path.sep}`)) {
      throw new Error(`Unsafe image path on item ${item.id}.`);
    }

    const extension = path.extname(relativePath).slice(1).toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
      throw new Error(
        `Item ${item.id} uses unsupported legacy image ${item.imageUrl}. Convert it to JPEG, PNG, or WebP before migrating.`,
      );
    }
    const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
    const body = await readFile(sourcePath);
    if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Item ${item.id} has an empty or oversized image.`);
    }
    const contentType = mimeType(body, normalizedExtension);
    const key = `${item.id}.${normalizedExtension}`;
    imagePlans.push({
      body,
      contentType,
      itemId: item.id,
      key,
      objectKey: `${objectPrefix}${key}`,
      url: `/api/images/${key}`,
    });
  }

  console.log(
    `${apply ? "Applying" : "Dry run:"} ${sourceItems.length} items, ${sourceOutfits.length} outfits, and ${imagePlans.length} local images. Destination currently has ${destinationItems.length} items and ${destinationOutfits.length} outfits.`,
  );

  if (!apply) {
    console.log(
      "No changes made. Set MIGRATION_APPLY=true to execute this plan.",
    );
    process.exitCode = 0;
  } else {
    for (const image of imagePlans) {
      let existingBody;
      try {
        const existing = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: image.objectKey }),
        );
        existingBody = existing.Body
          ? Buffer.from(await existing.Body.transformToByteArray())
          : undefined;
      } catch (error) {
        if (
          error?.name !== "NoSuchKey" &&
          error?.$metadata?.httpStatusCode !== 404
        ) {
          throw error;
        }
      }

      if (existingBody) {
        if (
          existingBody.byteLength !== image.body.byteLength ||
          !timingSafeEqual(existingBody, image.body)
        ) {
          throw new Error(
            `Object ${image.objectKey} already exists with different contents.`,
          );
        }
        continue;
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: image.objectKey,
          Body: image.body,
          ContentType: image.contentType,
          CacheControl: "private, max-age=31536000, immutable",
        }),
      );
      uploadedKeys.push(image.objectKey);
    }

    const migratedUrlByItemId = new Map(
      imagePlans.map(({ itemId, url }) => [itemId, url]),
    );
    const counts = await destination.begin(async (transaction) => {
      for (const item of sourceItems) {
        const imageUrl = migratedUrlByItemId.get(item.id) ?? item.imageUrl;
        await transaction`
          insert into items (
            id, user_id, image_url, name, category, colors, pattern,
            formality, season, material, fit, notes, available, created_at
          ) values (
            ${item.id}, ${item.userId}, ${imageUrl}, ${item.name},
            ${item.category}, ${item.colors}, ${item.pattern},
            ${item.formality}, ${item.season}, ${item.material}, ${item.fit},
            ${item.notes}, ${item.available}, ${item.createdAt}
          )
          on conflict (id) do update set image_url = excluded.image_url
        `;
      }

      for (const outfit of sourceOutfits) {
        await transaction`
          insert into outfits (
            id, user_id, item_ids, context, status, source, created_at
          ) values (
            ${outfit.id}, ${outfit.userId}, ${outfit.itemIds},
            ${transaction.json(outfit.context)}, ${outfit.status},
            ${outfit.source}, ${outfit.createdAt}
          )
          on conflict (id) do nothing
        `;
      }

      const [verification] = await transaction`
        select
          (select count(*)::int from items) as items,
          (select count(*)::int from outfits) as outfits,
          (
            select count(*)::int
            from outfits o
            cross join unnest(o.item_ids) as refs(item_id)
            left join items i on i.id = refs.item_id
            where i.id is null
          ) as "brokenReferences"
      `;
      if (verification.brokenReferences !== 0) {
        throw new Error(
          `Verification found ${verification.brokenReferences} broken outfit references.`,
        );
      }
      return verification;
    });
    console.log(
      `Migration verified: destination has ${counts.items} items, ${counts.outfits} outfits, and no broken outfit references.`,
    );
  }
} catch (error) {
  if (uploadedKeys.length) {
    console.error("Migration failed; removing newly uploaded objects.");
    await Promise.allSettled(
      uploadedKeys.map((Key) =>
        s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })),
      ),
    );
  }
  throw error;
} finally {
  await Promise.all([source.end(), destination.end()]);
}
