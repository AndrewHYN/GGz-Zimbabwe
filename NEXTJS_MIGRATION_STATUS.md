# GGz Next.js consolidation — release held

The application uses Next.js for both pages and API handlers. Better Auth manages
accounts and PostgreSQL stores community data. Django is retained only as source
migration/reference material, with its CI workflow manual-only. No Django proxy,
Python process or second runtime is needed. Automatic Vercel Git deployments remain
disabled in both configuration locations. No production site or source data has
been changed.

## Implemented

- Registration, username/email login, sessions, logout, password change/recovery,
  optional Google OAuth and legacy PBKDF2 password compatibility.
- Private profiles, editing, follows, friend requests, respect, blocks, library.
- Tournament drafts/publishing, player invitations, registration/withdrawal,
  locked capacity, elimination brackets/byes, results and cancellation.
- Events, organization association, owner editing/lifecycle, capacity-limited
  RSVPs, organization promotion requests and audited staff promotion review.
- Teams, roster/captain management, invitations and recipient-approved ownership
  transfers. Owners retain control until a transfer is accepted.
- Organization/venue management, reviews/ratings, private coordinates, public
  venue discovery and a working OpenStreetMap fallback.
- Challenge acceptance/scheduling, opponent-confirmed results, disputes, staff
  resolution and game-specific rankings derived from completed results.
- Feed posts/comments/likes/saves/reports; marketplace listing/saving/sold status.
- Private messaging with recipient-approved requests, unread state/notifications.
- Staff-only reports, content moderation, verification, account suspension and
  audit history. Staff roles come from a protected database table.
- Server-side image validation, decoded/re-encoded WebP uploads and media CSP;
  Twitch category mapping, token refresh and upstream error handling.
- Origin checks, streamed request-size limits, write throttling, private API
  responses, blocked/suspended account enforcement and database RLS/revoked grants.

## Verification

Lint, TypeScript, production build and native integration tests are run from
`frontend/`. Tests cover ownership/permissions, private venues, hidden content,
capacity/brackets, messages, invitations, challenge disputes/rankings, migration
references/counts/credentials/rollback, password recovery, OAuth request forwarding,
image decoding and mocked S3/Twitch integrations. Browser checks cover desktop and
mobile routes plus real signup, tournament draft/publish, organization/venue,
team invitation/ownership transfer, two-player result confirmation and moderation.
Final local results: 31 integration tests, 9 HTTP routes, 14 desktop routes,
5 mobile routes and all authenticated browser flows passed; desktop/mobile and
management screenshots inspected. Mocked provider checks do not establish that
production credentials or hosted callback URLs work.

## Data migration runbook

Use Node 24. Configure `.env.local` from `.env.example`. Run `npm run db:migrate`
explicitly against a backed-up target database; migrations never run during builds
or requests. They create separate `ggz_*` tables and leave legacy tables unchanged.
Use a server role owning those tables; never expose it to browser clients.

1. Inventory the actual source with `npm run db:inventory`. Do not infer the
   application database from the inactive historical Supabase media project.
2. Set `LEGACY_DATABASE_URL` to the verified source. Export with
   `npm run db:legacy -- export /private/path/source.legacy.json`.
   Export uses a read-only repeatable-read transaction and creates a mode-0600
   snapshot without overwriting an existing file. Snapshots contain credentials
   and private messages: keep them outside Git and public storage.
3. Dry-run with `npm run db:legacy -- inspect /private/path/source.legacy.json`.
   Resolve every reported reference, duplicate login/tag or media issue. Set
   `MEDIA_PUBLIC_URL` only to the verified HTTPS location containing legacy files.
   Identity corrections can use `--overrides=/private/path/overrides.json`, with
   `users` keyed by legacy user ID (`email`/`username`) and `gamerTags` keyed by
   legacy profile ID. Original snapshot/archive records stay unchanged.
4. Review the source/target counts, warnings and SHA-256 fingerprint. Import into
   an empty native target with `npm run db:legacy -- import
   /private/path/source.legacy.json --fingerprint=<reviewed-sha256>` (one line).
   Supply the same overrides when used during inspection. Import is transactional,
   preserves numeric IDs per entity kind, private relationships/messages, legacy
   password hashes and staff roles; every source row is also archived privately.
   Repeating the same import is idempotent; different snapshots or existing native
   records are refused. Reconcile the actual records/media before releasing.
5. `npm run db:legacy -- rollback <fingerprint>` only removes an unchanged import.
   It refuses rollback after entity, account/staff, session or verification activity.
   It never deletes source tables. After activity, restore/migrate through a reviewed
   backup procedure instead of attempting to force rollback.

Legacy completed challenges lack a directly recorded winner. They enter a visible
staff reconciliation queue and do not create guessed ranking points. Staff can
record a winner with evidence; existing imported profile totals are preserved.
Historical external-feed records and obsolete push subscriptions are retained
privately for traceability, not reactivated against old third-party endpoints.

Manage staff explicitly with `npm run staff -- <exact-email> admin` or
`moderator`, and `npm run staff -- <exact-email> revoke`; the CLI prints usage if
arguments are incomplete. Users cannot grant roles from the app.

## Production release gates

The remaining gates require the actual environment and source records: inventory,
reviewed import/reconciliation, verification of live Google callbacks/SMTP/S3/Twitch
credentials, and hosted end-to-end checks. Vercel access was unavailable in the
previous session; this follow-up intentionally performs no Vercel operations.
Keep deployment disabled until those gates pass. Do not present local fixtures as
production migration evidence.

## Local checks

From `frontend/`: `npm ci`; configure a fresh secret of at least 32 characters,
`BETTER_AUTH_URL=http://127.0.0.1:3000` and
`GGZ_LOCAL_DATABASE=./.local-db`; then `npm run db:migrate` and `npm run db:seed`.
The seed is local-only and creates the game catalogue.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:http`, `npm run test:browser`. Both smoke scripts start/stop their
own production server; run them sequentially after building. Browser tests use a
local-only staff fixture and refuse a hosted/remote database. On restricted Linux,
run `node scripts/prepare-browser.mjs`, then set `CHROMIUM_EXECUTABLE`,
`FONTCONFIG_PATH` and `LD_LIBRARY_PATH` to the prepared `.browser-cache` locations.
The multi-user browser checks remove the adapter's single-process flag to maintain
isolated sessions. Test data, secrets, browser files and local databases are ignored.
