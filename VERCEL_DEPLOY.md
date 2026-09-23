# Vercel deployment

## GGz 2.0 frontend architecture

The frontend/ directory is the GGz 2.0 Next.js application. Vercel must deploy this application separately from the Django backend.

Required Vercel Project settings for the Next.js project:

- Root Directory: frontend
- Framework Preset: Next.js
- Install Command: npm ci
- Build Command: npm run build
- Output Directory: .next
- Node.js Version: 24.x
- Environment: set NEXT_PUBLIC_DJANGO_URL to the deployed Django API origin before runtime/browser verification.

The repository contains a single `frontend/vercel.json` (`framework: nextjs`, `installCommand: npm ci`, `buildCommand: npm run build`, `outputDirectory: .next`) matching the recommended monorepo Root Directory of `frontend`. There is intentionally no root-level `vercel.json` anymore, so only one configuration strategy applies. These file settings override the corresponding Project Settings for a deployment.

The legacy scripts/vercel-build.sh is now frontend-only. It exists as a compatibility safeguard for a stale Vercel Build Command that still invokes that filename; it no longer runs Django migrations, PostgreSQL checks, or collectstatic.

## Backend

The Django backend is a separate deployment concern. It retains the production PostgreSQL, migration, authentication, media-storage, and optional Google Maps environment requirements documented in DEPLOYMENT.md. Do not reintroduce Django migrations into the Next.js Vercel frontend build.

## Deployment verification status

### GGz 2.0 frontend (`ggz-frontend`)

- Vercel deployment: SUCCESS for the `feat/ggz-nextjs-ui-2` branch head
- Production URL: `https://ggz-frontend.vercel.app` (serves the latest production deployment)
- Local `npm run lint`: 0 errors (2 pre-existing `exhaustive-deps` warnings)
- Local `npm run build`: SUCCESS (Next.js 16.3.5, all routes generate)
- Browser smoke test: public routes verified live (`/`, `/games`, `/games/8`, `/tournaments`, `/events`, `/marketplace`, `/teams`); client pages render correct loading/auth states

### Deployment tracks (do not confuse these)

- **Branch/preview deployment:** built automatically from `feat/ggz-nextjs-ui-2` pushes. This is where new frontend work (detail pages, Radar, leaderboards) is verified first.
- **Production deployment:** `https://ggz-frontend.vercel.app` serves the latest production promotion. It lags the feature branch until merged through the normal flow — do not manually retarget production to the branch.
- **Legacy project (`g-gz-zimbabwe`):** old Django-era Vercel project. Treat any FAILURE there as legacy infrastructure unless it is proven to be the active GGz 2.0 deployment. Do not let it dictate GGz 2.0 configuration.

### Historical diagnostic note (resolved)

An earlier `debug/vercel-minimal` experiment showed FAILURE even for a minimal app, which at the time pointed at project/build-environment configuration rather than application source. The actual application-side blockers found afterwards were `export const dynamic = "force-dynamic"` overuse, TypeScript API field mismatches, duplicate lockfiles, and contradictory root/`frontend` vercel.json files — all removed. The `ggz-frontend` project now builds and serves successfully.

## Legacy Django Vercel notes

The following historical instructions are retained only for reference and should not be used for the GGz 2.0 frontend deployment:

- hello_world.wsgi:application
- scripts/vercel-build.sh running Django migrations
- PostgreSQL-required Django build checks
- collectstatic as part of the frontend Vercel build

For the current architecture, those operations belong to the separate Django deployment.

## Environment variables

Configure these for the Django backend deployment as appropriate:

DJANGO_SECRET_KEY=
DEBUG=False
DATABASE_URL=
ALLOWED_HOSTS=
CSRF_TRUSTED_ORIGINS=
# Canonical Next.js origin (OAuth callbacks + password-reset links).
FRONTEND_URL=https://ggz-frontend.vercel.app
# Optional. Unset falls back to OpenStreetMap; a paid Maps key is not required.
GOOGLE_MAPS_API_KEY=
MAX_UPLOAD_SIZE=4194304
DJANGO_SUPERUSER_USERNAME=
DJANGO_SUPERUSER_EMAIL=
DJANGO_SUPERUSER_PASSWORD=
USE_X_FORWARDED_PROTO=True
SECURE_SSL_REDIRECT=True

Configure this for the Next.js frontend:

NEXT_PUBLIC_DJANGO_URL=

Use the exact deployed Django API origin. Never commit the actual value if it is environment-specific or private.