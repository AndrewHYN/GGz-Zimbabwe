# GGz Zimbabwe

A local gaming community for players, squads and free competitions.

The consolidation branch uses **Next.js for the UI and backend**, with Better Auth
and PostgreSQL. Start the application from `frontend/`. It has no Django proxy or
Python runtime requirement.

**Release status: held.** This is not a completed production migration. Read
[NEXTJS_MIGRATION_STATUS.md](NEXTJS_MIGRATION_STATUS.md) for verified work,
remaining parity gaps and the production access blocker. Git deployments are
currently disabled to prevent an unverified migration from going live.

## Development

Use Node 24 and npm. In `frontend/`, run `npm ci`, create `.env.local` using
`.env.example`, and configure either `DATABASE_URL` or a local development database
with `GGZ_LOCAL_DATABASE=./.local-db`. Add a new `BETTER_AUTH_SECRET` of at least
32 random characters and set `BETTER_AUTH_URL=http://127.0.0.1:3000`.

Run `npm run db:migrate`, `npm run db:seed`, then
`npm run dev -- --hostname 127.0.0.1`. The seed is local-only.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:http`
- `npm run test:browser`

The browser check needs Chromium. It supports `CHROMIUM_EXECUTABLE` for a locally
installed browser, or the bundled test browser adapter on a supported Linux host.
Both smoke commands start and stop their own local production server.

## Data and integrations

The explicit migration creates new `ggz_*` tables. It never runs in the build or
on a request, and it does not alter the existing application tables. A production
data importer and reconciliation are still required before release. Use the
read-only `npm run db:inventory` command to inspect the identified legacy database.

Google login, SMTP recovery, S3-compatible image storage, Twitch live discovery
and the map use the environment settings listed in `frontend/.env.example`.
Credentials stay server-side. Do not copy another project's credentials.

The old Python code and [historical README](LEGACY_DJANGO_README.md) are retained
for data migration, feature comparison and rollback reference until parity and
migration verification are complete. They are not part of the Next.js runtime.
