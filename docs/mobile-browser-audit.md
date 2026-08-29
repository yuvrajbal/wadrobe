# Mobile browser UI/UX audit

Audit date: August 28, 2026

Related issue: [#9](https://github.com/yuvrajbal/wadrobe/issues/9)

## Coverage

The automated audit uses Playwright's Pixel 7 device profile with Chromium 151,
including touch input and a mobile browser user agent.

| Profile            | Viewport          | Orientation | Coverage                                                                  |
| ------------------ | ----------------- | ----------- | ------------------------------------------------------------------------- |
| Pixel 7 / Chromium | 412 x 839 CSS px  | Portrait    | All functional end-to-end journeys plus mobile layout checks              |
| Pixel 7 / Chromium | 915 x 412 CSS px  | Landscape   | All primary routes, responsive navigation, and horizontal-overflow checks |
| Desktop Chrome     | 1280 x 720 CSS px | Landscape   | Existing regression baseline                                              |

Physical Android and iOS devices were not available. A Playwright WebKit 26.5
runtime was downloaded to approximate mobile Safari, but it could not launch on
the audit host because `libgstcodecparsers-1.0.so.0` and `libavif.so.13` are not
installed and host-level package installation requires unavailable sudo access.
Safari/iOS therefore remains explicitly unverified; no Safari-specific conclusion
is inferred from Chromium.

API calls are deterministically mocked in the end-to-end suite. This isolates
browser layout, input, state, and navigation behavior from database, image-analysis,
weather, and model availability.

## Routes and flows tested

| Route or flow      | Portrait coverage                                                                                                  | Landscape coverage                                              | Result             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------ |
| `/` wardrobe       | Load, search/filter, edit garment, choose/replace upload, analyze upload, error recovery                           | Route layout, navigation, no page overflow                      | Pass after #10 fix |
| `/builder`         | Open item picker, select required pieces, validation, critique, save                                               | Route layout, navigation, no page overflow                      | Pass after #10 fix |
| `/suggestions`     | Load recovery, form validation, walking-level selection, generate, save feedback, carry look to builder            | Route layout, navigation, no page overflow                      | Pass               |
| `/saved`           | Load recovery, render saved outfit, navigate onward                                                                | Route layout, navigation, no page overflow                      | Pass               |
| Primary navigation | Active-route state, all four links, minimum 44 x 44 px targets                                                     | Responsive desktop-style navigation at the landscape breakpoint | Pass               |
| Browser history    | Back from Saved to Suggestions with correct active state                                                           | —                                                               | Pass               |
| Dialog behavior    | Garment details and builder picker bounded by viewport; edit/upload actions remain tappable above fixed navigation | Bounds covered by route-level responsive checks only            | Pass after #10 fix |

No page-level horizontal scrolling was found on the four primary routes in either
orientation. The wardrobe category row intentionally scrolls inside its own
container and does not widen the document. No clipped headings, overlapping route
content, broken primary links, or critical navigation blockers remain after the
dialog fix.

## Findings

### High: dialog sheets can be clipped or blocked by mobile navigation

Tracked by [#10](https://github.com/yuvrajbal/wadrobe/issues/10) and fixed with
this audit.

Reproduction before the fix:

1. Open `/` in the Pixel 7 portrait profile at 412 x 839 CSS px.
2. Scroll to the garment collection and open a garment.
3. Observe that the sheet is positioned relative to the scrolled page instead of
   the visual viewport; in the captured run its bottom reached approximately
   1,297 CSS px.
4. Scroll the sheet to **Save changes**, or open the upload sheet and scroll to
   **Analyze item**.
5. Attempt to tap the action. The fixed bottom navigation intercepts the pointer.

Expected: dialog sheets stay within the visual viewport, scroll internally, and
remain above application navigation.

Cause: the page-entry animation transformed `<main>` and retained its opacity
animation state. Those properties created fixed-position and stacking contexts
around dialogs nested in `<main>`.

Resolution: the page entry now uses a non-retained opacity-only animation, and
the dialog panels explicitly allow flex shrinking while retaining viewport-relative
maximum heights. Mobile regression tests verify bounds and execute the previously
blocked edit and upload actions.

### Medium: compact secondary controls have small touch targets

Tracked by [#11](https://github.com/yuvrajbal/wadrobe/issues/11); not blocking the
primary navigation audit.

Several compact controls are approximately 32–40 CSS px in at least one dimension,
including category chips, some dialog close/action controls, walking-level choices,
builder Replace/Remove controls, feedback actions, and the saved-outfit Edit look
link. They remain usable, but fall below the common 44 x 44 CSS px mobile target
guideline and can be awkward when adjacent.

Expected: enlarge the hit areas to at least 44 x 44 CSS px without necessarily
changing the visible size of compact icons or text.

## Repeat the audit

Install the Chromium runtime once, then run the mobile suite:

```sh
npm run test:e2e:install
npm run test:e2e:mobile
```

Run the complete desktop and mobile matrix with:

```sh
npm run test:e2e
```

The mobile project runs the same functional journeys as desktop plus
`e2e/mobile-audit.spec.ts`, which owns portrait/landscape navigation, history,
overflow, touch-target, and dialog-bound checks.
