# Shared persistence migration

This runbook moves one or more existing Wadrobe installations into a shared
Neon Postgres database and a private Cloudflare R2 bucket. It is designed to be
rerunnable: identical UUIDs are skipped, conflicting UUIDs stop the migration,
and existing destination-only rows are preserved.

## 1. Provision and back up

1. Create a Neon project. Copy a direct (non-pooler) connection string for
   migrations and a pooled connection string for the running apps. Neon requires
   TLS; keep `DATABASE_SSL=require`. Neon recommends direct connections for
   schema migrations and `pg_dump`, and pooled connections for application
   traffic.
2. Configure Neon's restore window or scheduled snapshots to match the desired
   recovery point objective. Create a pre-migration snapshot when the plan
   supports it.
3. Create an R2 bucket and leave public access disabled. Create an Object Read &
   Write S3 API token restricted to this bucket. Do not use an account-wide admin
   token.
4. Stop writes to the MacBook and home-server instances. Back up every source
   before changing the destination:

   ```bash
   pg_dump --format=custom --file=wadrobe-before-cloud.dump "$SOURCE_DATABASE_URL"
   tar -czf wadrobe-uploads-before-cloud.tar.gz public/uploads
   ```

Keep the dump, uploads archive, and R2 credentials outside the repository.

## 2. Configure the destination

Store these values in an untracked, permission-restricted environment file or
secret manager. The R2 endpoint is
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com` and its region is `auto`.

```dotenv
DATABASE_URL=postgresql://...direct-neon-host.../wadrobe
DATABASE_SSL=require

IMAGE_STORAGE_DRIVER=s3
S3_BUCKET=wadrobe-images
S3_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_KEY_PREFIX=wardrobe
S3_FORCE_PATH_STYLE=false
```

Apply the schema with the direct Neon connection:

```bash
npm run db:migrate
```

Use the pooled Neon connection as `DATABASE_URL` when starting the MacBook and
home-server apps after migration.

## 3. Dry-run and migrate

Set the source values in the same shell. `SOURCE_UPLOAD_DIR` is the directory
that corresponds to the old `/uploads/` URL prefix.

```dotenv
SOURCE_DATABASE_URL=postgresql://wardrobe:wardrobe@localhost:5432/wardrobe
SOURCE_DATABASE_SSL=disable
SOURCE_UPLOAD_DIR=/absolute/path/to/wadrobe/public/uploads
```

Run without `MIGRATION_APPLY` first:

```bash
npm run db:migrate:shared
```

The dry run checks UUID conflicts, outfit references, local paths, image size,
and JPEG/PNG/WebP signatures without changing the database or bucket. The
repository-generated Spain-trip SVG fixtures are also recognized and checked
for active content; arbitrary SVG uploads remain unsupported. Resolve every
reported conflict rather than overwriting it.

When the plan is correct:

```bash
MIGRATION_APPLY=true npm run db:migrate:shared
```

The command uploads missing objects, preserves item and outfit UUIDs, updates
legacy `/uploads/...` references to stable `/api/images/...` references, merges
rows in one destination transaction, and verifies destination counts and outfit
references. If the database merge fails, objects newly uploaded by that run are
removed. Existing objects are never overwritten with different content.

To merge another installation, change only the `SOURCE_*` values and run the dry
run again. Destination-only rows remain untouched. A UUID with different data is
an explicit conflict and must be reviewed manually.

## 4. Verify and cut over

Keep source instances read-only until all checks pass:

1. Record the source and destination item/outfit counts printed by the tool.
2. Open several `imageUrl` values through each app instance and confirm the
   response is an image, not a 404.
3. Confirm the same wardrobe, saved outfits, rejected outfits, and feedback are
   visible on the MacBook, home server, and phone.
4. Upload one test garment from the phone, restart/rebuild both app instances,
   and confirm it remains visible everywhere.
5. Delete only that test item and confirm its object is gone while neighboring
   objects remain readable.
6. Confirm the R2 bucket is private and the app's token is restricted to the one
   bucket.

## Rollback

If verification fails, stop both shared app instances before restoring data.
Restore the pre-migration Neon snapshot/point in time, or restore the custom
dump into a clean database and switch both apps back to the previous
`DATABASE_URL`. Switch image storage back only after restoring the matching
uploads archive. Successful migration objects can remain in the private bucket
while diagnosing; remove only the dedicated `S3_KEY_PREFIX` after its exact
contents have been reviewed.

Do not delete the source database, source uploads, or pre-migration backups until
the shared deployment has passed verification and an independent restore has
been tested.
