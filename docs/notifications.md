# Notification conventions

Wadrobe uses [Sonner](https://sonner.emilkowal.ski/) for transient action
feedback. The single viewport is mounted in the root layout through
`NotificationProvider`; feature components must not mount another viewport or
import Sonner directly.

Call the typed `notifications` adapter in `src/lib/notifications.ts`:

```ts
notifications.success({
  id: "outfit-save",
  title: "Outfit saved to your collection.",
});
```

## Choosing the right feedback

- Keep field validation next to the field or form so the user can correct it.
- Keep persistent, blocking load errors inline with their retry action. A toast
  may also announce the failure when it happens.
- Use an error toast for a failed user-initiated async action and make the copy
  explain what the user can do next.
- Use success toasts only when the result is not already unmistakable. Do not
  toast routine navigation, selection changes, or every successful load.
- Use warning for recoverable browser limitations, such as denied location
  access, and info for neutral asynchronous updates.

Every notification needs a stable, action-specific `id`. Reusing the ID causes
rapid retries and rerenders to update the existing toast rather than announce a
stack of duplicates. Include an entity ID when independent actions may happen
at the same time.

Only show user-safe copy. API routes should return stable public errors, and
unexpected values passed to a toast should go through
`safeNotificationMessage`. Never display exception objects, stack traces,
provider responses, tokens, credentials, database URLs, or storage details.

The global viewport uses a polite live region, does not move focus, includes a
keyboard-focusable dismiss button, limits visible notifications, and keeps
errors and warnings visible for eight seconds. Sonner and the application CSS
both respect `prefers-reduced-motion`.
