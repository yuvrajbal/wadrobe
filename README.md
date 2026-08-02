# Wadrobe

Phase 0 of a phone-first AI wardrobe recommendation app. The repository now
contains the web application shell, Postgres schema, server-only OpenAI client,
and local image storage endpoint.

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

## Useful commands

```bash
npm run check        # formatting, lint, types, and tests
npm run build        # production Next.js build
npm run db:migrate   # apply pending migrations
```

Only server modules read `OPENAI_API_KEY`; never create a `NEXT_PUBLIC_` variant.
