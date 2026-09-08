# Authentication and user-data migration

## Selected approach

Wadrobe uses [Better Auth](https://www.better-auth.com/) with GitHub OAuth and
the Drizzle/Postgres adapter. This fits the Next.js 16 App Router and the
selected Vercel + Neon deployment without adding a second persistence service.
GitHub supplies the verified external identity; Better Auth maps it to a UUID in
the local `users` table and stores opaque sessions in `sessions`.

The domain only sees the application UUID returned by `getCurrentUserId()`.
Provider account identifiers and tokens stay in `accounts`, so switching or
adding providers does not change item or outfit ownership keys.

## Local setup

1. Create a GitHub OAuth app in GitHub Developer Settings.
2. Set its homepage URL to `http://localhost:3000` and its callback URL to
   `http://localhost:3000/api/auth/callback/github`.
3. If using a GitHub App instead of an OAuth app, grant read-only access to email
   addresses. The account must expose a usable email address.
4. Copy `.env.example` to `.env.local` and set:

   - `BETTER_AUTH_SECRET` to at least 32 random bytes (for example,
     `openssl rand -base64 32`);
   - `BETTER_AUTH_URL=http://localhost:3000`;
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from GitHub.

5. Run `npm run db:migrate`, start the app, and use **Continue with GitHub**.

Never expose these values with a `NEXT_PUBLIC_` prefix. Use separate GitHub OAuth
apps and secrets for local, preview, and production environments.

## Session and route behavior

- Sessions are stored server-side, expire after seven days, and roll forward
  after 24 hours of activity. Better Auth treats deleted or expired rows as
  unauthenticated and refreshes eligible sessions through its route handler.
- `/`, `/builder`, `/suggestions`, and `/saved` are protected by the Next.js
  proxy and redirect to `/sign-in` with a same-origin callback URL.
- Item, outfit, feedback, suggestion, critique, upload, and image-delivery route
  handlers independently validate the session. This is the security boundary;
  the page redirect is only user experience.
- All database queries include the application `user_id`. Private object keys
  are also recorded in `image_objects`, and an image is read or deleted only
  when that record belongs to the session user. Legacy `/uploads/...` files are
  intercepted and served only when an item with that exact URL belongs to the
  session user; move them to private object storage with the shared-persistence
  runbook before public deployment.
- Sign-out revokes the current database session and returns to `/sign-in`.

## Production configuration

Create a production GitHub OAuth app with:

- homepage URL `https://<production-host>`;
- callback URL `https://<production-host>/api/auth/callback/github`.

Set `BETTER_AUTH_URL` to that exact HTTPS origin and add
`BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` as encrypted
server-only deployment variables. Apply database migrations before routing
traffic to the new build. Keep Neon and private R2 configuration as described in
`docs/shared-persistence-migration.md`.

Preview deployments need their own stable callback origin and OAuth app; do not
point a wildcard preview host at the production OAuth credentials.

## Assign existing MVP data to the first account

Migration `0001_authentication.sql` preserves all existing rows under a locked,
non-login placeholder user. It also creates ownership records for existing
private image URLs and adds foreign keys. To hand that data to the first real
account:

1. Back up Postgres and object storage.
2. Run `npm run db:migrate` and deploy the authenticated build.
3. Have the intended owner sign in once with GitHub. Do not invite other users
   until the claim is complete.
4. Run:

   ```bash
   npm run db:claim-legacy -- owner@example.com
   ```

5. Verify the reported item, outfit, and image counts, then confirm the owner can
   load, edit, and delete the migrated records.

The claim runs in one transaction, updates only the legacy UUID, and deletes the
placeholder after success. It refuses to run when the target account does not
exist or the placeholder has already been claimed. A failure rolls back every
database ownership change; the backup remains the rollback path.

## Account recovery and access changes

Wadrobe does not store passwords. Sign-in, MFA, locked-account recovery, and
email recovery are handled by GitHub. A GitHub account that loses access must be
recovered through GitHub before its Wadrobe data is accessible. Operators should
not edit `accounts.user_id` or transfer wardrobe ownership ad hoc; any future
account-transfer flow needs explicit identity verification and an audited data
migration.
