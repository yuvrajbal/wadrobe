# AI Wardrobe Recommendation App — Project Specification

> **Implementation status (August 2026):** Required tasks 1–18 and 20–22 are
> implemented. Task 19, the optional analytics surface, is not implemented and
> is not required for the MVP. The remaining non-blocking mobile follow-ups are
> smaller secondary touch targets and physical Safari/iOS verification; see
> [the mobile browser audit](docs/mobile-browser-audit.md). API paths below
> reflect the implemented routes.

## 1. Overview

A personal wardrobe app where a user photographs their clothing, and an AI suggests outfits based on occasion, weather, and personal style. The app learns from which outfits the user saves and rejects.

**Core principle:** Images are processed **once** at ingestion into structured text attributes. All recommendation reasoning happens over compact JSON — never over images. This keeps recommendation calls cheap and fast.

## 2. Tech Stack (suggested — adjust to preference)

- **Frontend:** Next.js, Tailwind for styling.
- **Backend:** Next.js API routes.
- **Database:** Postgres (relational fits the item/outfit model well).
- **File storage:** Local disk for MVP or anything that's quick for mvp; S3-compatible bucket for production.
- **AI:** Open ai API. One vision-capable model for ingestion, one text call for recommendations.

## 3. Data Model

### `items`

| field      | type      | notes                                              |
| ---------- | --------- | -------------------------------------------------- |
| id         | uuid (PK) |                                                    |
| user_id    | uuid      |                                                    |
| image_url  | string    | stored file reference                              |
| name       | string    | AI-generated, user-editable                        |
| category   | enum      | `top`, `bottom`, `shoes`, `outerwear`, `accessory` |
| colors     | string[]  | primary + secondary                                |
| pattern    | string    | e.g. solid, striped, plaid                         |
| formality  | int (1–5) | 1 = very casual, 5 = formal                        |
| season     | string[]  | `spring`, `summer`, `fall`, `winter`               |
| material   | string    | optional                                           |
| fit        | string    | optional (slim, regular, loose)                    |
| notes      | text      | user notes                                         |
| available  | boolean   | false = in laundry / unavailable                   |
| created_at | timestamp |                                                    |

### `outfits`

| field      | type      | notes                                  |
| ---------- | --------- | -------------------------------------- |
| id         | uuid (PK) |                                        |
| user_id    | uuid      |                                        |
| item_ids   | uuid[]    | references items                       |
| context    | jsonb     | occasion, temp, style used to generate |
| status     | enum      | `saved`, `rejected`, `suggested`       |
| source     | enum      | `manual`, `ai`                         |
| created_at | timestamp |                                        |

## 4. AI Integration

### Ingestion (once per item)

On item upload, send **one** vision call. Prompt the model to return **only** JSON matching the item attribute schema (category, colors, pattern, formality, season, material, fit, suggested name). Parse, store, allow the user to edit the result. Re-run only if the image is replaced.

### Recommendation (per request)

Send the user's **available** items as a compact JSON array of `{id, category, colors, pattern, formality, season}` plus the request context (occasion, temperature, walking level, style) plus a short summary of recent saved/rejected outfits. Instruct the model to return JSON: an array of up to 3 outfits, each a list of item IDs plus a one-line rationale. Map IDs back to images client-side.

**Do not send images at recommendation time.**

## 5. Build Tasks (in order)

### Phase 0 — Setup

1. Initialize repo, frontend + backend scaffolding, linting/formatting.
2. Set up database and run migrations for `items` and `outfits` tables.
3. Configure environment variables and the OpenAI API client (key handled server-side only — never exposed to the frontend).
4. Implement image upload endpoint (`POST /api/uploads`; store file, return a
   stable app URL).

### Phase 1 — Wardrobe (Screen 1)

5. Build `POST /api/items` endpoint: accept image, call the vision model for attribute extraction, persist item.
6. Build `GET /api/items` (filter by category, availability) and `PATCH /api/items/:id` (edit tags, notes, availability) and `DELETE /api/items/:id`.
7. Build the wardrobe grid UI: tabs/filter by category (Tops, Bottoms, Shoes, Outerwear), item cards showing image + name + tags.
8. Add item detail/edit modal so users can correct AI-generated tags and toggle availability.

### Phase 2 — Outfit Builder (Screen 2)

9. Build the manual builder UI: slots for top, bottom, shoes, outerwear; tapping a slot opens a picker filtered to that category and to available items.
10. Render the selected items as a clean outfit board.
11. Implement "Replace one item" (re-open picker for that slot) and "Save outfit" (`POST /api/outfits` with `source: manual`, `status: saved`).
12. Implement "Critique this outfit": send the current combination to the model, return a short text assessment. (This replaces the vague "Ask AI" button.)

### Phase 3 — Suggestions (Screen 3)

13. Build the request form: occasion, temperature (auto-fill from geolocation + a weather API, with manual override), walking level, style.
14. Build `POST /api/suggestions`: assemble compact JSON of available items + context + recent feedback summary, call the text model, parse up to 3 outfit suggestions.
15. Render suggestions as outfit boards, each with its rationale.
16. Add per-suggestion actions: Save (`status: saved`), Reject (`status: rejected`), or open in the builder to tweak.

### Phase 4 — Saved Outfits & Personalization (Screen 4)

17. Build `GET /api/outfits?status=saved` and the saved-outfits gallery.
18. Compute a lightweight personalization summary: most-used items, preferred colors/formality, recent saves and rejections. Feed this summary into every recommendation call.
19. Add basic analytics surface (optional): most-worn items, gaps in the wardrobe.

### Phase 5 — Polish

20. Loading/error states for all AI calls; graceful fallback if the model returns malformed JSON (retry once, then surface an error).
21. Empty states (no items yet, no saved outfits).
22. Responsive/mobile layout — this is a phone-first use case.

## 6. Guardrails for the Implementer

- Always parse AI responses defensively: strip code fences, `try/catch` the JSON parse, validate against the expected schema before using.
- Vision calls only on ingestion or image replacement. Never in the recommendation path.
- Keep the recommendation prompt payload small: send only the attribute fields listed in §4, not full item rows.
- Let users override every AI-generated field. Treat model output as a draft.
- API key lives server-side only.

## 7. Out of Scope for MVP (deferred)

- Rendering outfits on a body/avatar ("generate preview").
- Social sharing, multi-user wardrobes.
- Automatic season/weather-based push suggestions.
