# GGz Next.js consolidation — release held

This branch is an implementation checkpoint, not a completed production migration.
The deployed site and existing database have not been changed.

## Runtime

`frontend/` contains the standalone Next.js application, native API handlers,
Better Auth accounts/sessions, and PostgreSQL persistence. The frontend no longer
rewrites requests to Django or reads `NEXT_PUBLIC_DJANGO_URL`.

Legacy Python source remains available for schema/data migration and comparison.
It is not imported, built or started by the Next.js application. Do not delete it
until the real production records have been inventoried, migrated and reconciled.

## Implemented and locally exercised

- Email/password registration, username or email login, persistent sessions, logout.
- Private profiles, profile editing, follows, friend requests, respect, blocks.
- Tournament drafts, publishing, registration, capacity locking, withdrawals,
  single-elimination brackets including byes, results, completion and cancellation.
- Event creation, capacity-limited RSVPs and withdrawal.
- Team creation, joining and leaving with owner protection.
- Feed posts, comments, likes, saves and reports.
- Private conversations and sending with blocked-contact checks.
- Marketplace listing creation, saves, reports, seller-only sold status.
- Server-side image upload and Twitch discovery adapters.
- Native data access for server-rendered pages and a visible data-error boundary.
- Gaming homepage, account layout, forms, keyboard focus and reduced-motion support.

## Latest local verification

- ESLint and TypeScript: passed.
- Integration tests: 11 passed, including five-player brackets with byes.
- Production build: passed.
- HTTP checks: 9 routes passed.
- Final browser run: 11 desktop routes and 5 mobile routes passed.
- Authenticated browser signup → dashboard and tournament draft → publish: passed.
- Final desktop and mobile screenshots inspected.
- Lockfile consistency: `npm ci --dry-run --ignore-scripts` passed.

## Release blockers and remaining work

1. Vercel environment access returns 403 for team `andrewhyn`; local CLI is logged out.
   The production database URL and integration settings cannot be verified here.
2. Inventory the actual production PostgreSQL database using `db:inventory`.
   The historical Supabase `urwolkhnjkbmblfqinlf` project was storage and is inactive;
   it must not be assumed to be the production application database.
3. Implement and dry-run a record-preserving importer against the inventoried
   production schema. Compare user, relationship, message, post, event, team,
   marketplace and tournament counts and references. This importer is NOT complete.
4. Verify hosted Google OAuth callbacks, SMTP recovery, S3 uploads, IGDB/Twitch category mapping and credentials
   and map configuration with the real GGz settings.
5. Complete parity work for legacy organization/venue administration, moderation,
   team invitations/ownership transfer, challenge acceptance/scheduling, and
   game-specific rankings. These are NOT claimed complete by this checkpoint.
6. Verify authenticated browser flows and desktop/mobile screenshots for the final
   commit; then verify the real migrated data before releasing.

Automatic Git deployments are disabled in both Vercel configuration locations.
No deployment should be enabled until all release blockers above are cleared.
Do not merge this branch into production as a finished full fix.

## Local commands

From `frontend/`, install with `npm ci`. Supply `.env.local` using `.env.example`.
For local tests, a fresh secret of at least 32 characters and
`GGZ_LOCAL_DATABASE=./.local-db` replace a remote database. No provider credentials
are needed for the core local flows. Run `npm run db:migrate`, then `npm run db:seed`.
The seed is local-only and creates catalogue entries, not fake community activity.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:http`, `npm run test:browser`.

The schema migration adds separate `ggz_*` tables and does not alter legacy tables.
It is explicit, never run on page load or as part of a build. Tables have RLS enabled
and no public grants. Use a server database role that owns the tables; browser
clients never receive database credentials.
