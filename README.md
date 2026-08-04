# Wadrobe

Phase 1 of a phone-first AI wardrobe recommendation app. The repository contains
the web application shell, Postgres schema, server-only OpenAI client, local
image storage, and AI-assisted wardrobe item ingestion.

## Requirements

- Node.js 20.9 or newer
- Docker with Compose (for the local Postgres instance)
- An OpenAI API key (needed from Phase 1 onward; the Phase 0 build does not call
  the API)

## Local setup

```bash
cp .env.example .env.local
docker compose up -d postgres
npm install
npm run db:migrate
npm run dev
```

The app runs at `http://localhost:3000`. `GET /api/health` verifies the database
connection.

## User identity

The MVP is intentionally single-user. Server-side code obtains the current user
ID from `getCurrentUserId()` in `src/lib/current-user.ts`; do not copy its UUID
into route handlers or database queries. This keeps user scoping consistent and
provides one replacement point when authentication is introduced.

When authentication is added, replace the helper's fixed UUID with the user ID
from the authenticated server session. Existing item and outfit rows can then be
assigned to the first real account in a data migration before the fixed identity
is removed.

## Image uploads

`POST /api/uploads` accepts multipart form data in a field named `file`. It
accepts JPEG, PNG, and WebP files up to 10 MB, checks the file signature, stores
the image under `public/uploads`, and returns its public URL.

```bash
curl -F "file=@./shirt.png" http://localhost:3000/api/uploads
```

Local-disk storage is intentionally an MVP adapter. Replace it with durable
object storage before deploying across multiple or ephemeral application
instances.

## Wardrobe item ingestion

`POST /api/items` accepts the same multipart `file` field, stores the validated
image, analyzes it once with OpenAI vision, validates the structured attributes,
and persists the item for the single MVP user. The stored image is removed if
analysis or database persistence fails.

```bash
curl -F "file=@./shirt.png" http://localhost:3000/api/items
```

The vision response is an editable draft containing a name, category, colors,
pattern, formality, seasons, material, and fit. The request uses Structured
Outputs and does not store the model response at OpenAI.

## Wardrobe item management

- `GET /api/items` lists the current user's items. Optional filters are
  `category=top|bottom|shoes|outerwear|accessory` and
  `available=true|false`.
- `PATCH /api/items/:id` accepts any non-empty subset of the editable item
  fields: name, category, colors, pattern, formality, season, material, fit,
  notes, and availability.
- `DELETE /api/items/:id` deletes an owned item and cleans up its local image.

Every operation is scoped server-side to `getCurrentUserId()`; clients cannot
select or change a user ID.

## Useful commands

```bash
npm run check        # formatting, lint, types, and tests
npm run build        # production Next.js build
npm run db:migrate   # apply pending migrations
```

Only server modules read `OPENAI_API_KEY`; never create a `NEXT_PUBLIC_` variant.
