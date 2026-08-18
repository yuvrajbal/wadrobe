# Wadrobe

Phase 3 of a phone-first AI wardrobe recommendation app. Wardrobe ingestion,
manual outfit building, structured critique, and context-aware outfit
recommendations are complete. Recommendations account for occasion, current or
manual weather, walking level, style direction, and recent save/reject feedback.

## Requirements

- Node.js 20.9 or newer
- Docker with Compose (for the local Postgres instance)
- An OpenAI API key (used for garment ingestion, critique, and recommendations)

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

## Manual outfit builder

Open `/builder` to assemble an outfit from available wardrobe items. The builder
provides required slots for a top, bottom, and shoes, plus optional outerwear and
accessory slots. Each picker is filtered to the slot category; selected pieces
can be replaced or removed individually.

- `POST /api/outfits` validates and saves a manual outfit. `source` is always
  `manual` and `status` is always `saved`; clients cannot override either field.
- `GET /api/outfits` lists current-user outfits and accepts optional `status` and
  `source` filters.
- `PATCH /api/outfits/:id` updates an owned outfit and
  `DELETE /api/outfits/:id` deletes one.

All outfit writes verify that every referenced item exists, belongs to the
current user, is available, and forms a valid combination. A valid manual outfit
has exactly one top, bottom, and pair of shoes, with at most one outerwear and
one accessory item.

## Outfit critique

`POST /api/outfits/critique` validates the same outfit rules before asking the
model for a short structured assessment. The model receives compact item
attributes (category, colors, pattern, formality, seasons, material, and fit),
never item images, URLs, names, or notes. Malformed structured responses are
retried once before the endpoint returns a stable error.

## Context-aware suggestions

Open `/suggestions` and provide an occasion, temperature, walking level, and
style direction. Temperature can be entered manually or filled from browser
geolocation through the server-side Open-Meteo adapter.

`POST /api/suggestions` loads only the current user's available wardrobe items
and a bounded set of recent saved/rejected outfits. A deterministic, recency-
weighted summary captures preferred and avoided items, colors, formality levels,
and styles. The model receives that summary, compact item attributes, and
feedback IDs—never images, image URLs, names, notes, or user IDs. Its structured
response is validated for known item IDs, required category coverage,
availability, distinct combinations, and a maximum of three looks.
Malformed or invalid responses are retried once.

Each suggestion can be:

- saved or rejected through `POST /api/outfits/feedback`; these decisions are
  stored as `source: ai` for future recommendation context;
- opened in `/builder` with its available pieces preselected for manual edits.

`GET /api/weather` validates browser coordinates and proxies only the current
temperature from Open-Meteo. Weather failure never blocks suggestions because
the temperature field remains manually editable.

## Current milestone status

- Phase 0 — setup: complete
- Phase 1 — wardrobe: complete (merged in PR #1)
- Phase 2 — manual outfit builder: complete
- Phase 3 — context-aware suggestions: complete
- Phase 4 — saved-outfit personalization: complete
- Phase 5 — polish: planned

## Useful commands

```bash
npm run check        # formatting, lint, types, and tests
npm run build        # production Next.js build
npm run db:migrate   # apply pending migrations
```

Only server modules read `OPENAI_API_KEY`; never create a `NEXT_PUBLIC_` variant.
