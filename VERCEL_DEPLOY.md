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

The repository contains a root vercel.json for repository-root deployments and frontend/vercel.json for the recommended monorepo Root Directory of frontend. Vercel supports framework, buildCommand, installCommand, and outputDirectory in vercel.json, and these override the corresponding Project Settings for a deployment. Vercel's monorepo guidance recommends setting the Root Directory to the application directory. citeturn707245search0turn678667search0

The legacy scripts/vercel-build.sh is now frontend-only. It exists as a compatibility safeguard for a stale Vercel Build Command that still invokes that filename; it no longer runs Django migrations, PostgreSQL checks, or collectstatic.

## Backend

The Django backend is a separate deployment concern. It retains the production PostgreSQL, migration, authentication, media-storage, and Google Maps environment requirements documented in DEPLOYMENT.md. Do not reintroduce Django migrations into the Next.js Vercel frontend build.

## Deployment verification status

### M15.2 frontend

- UI/UX implementation: COMPLETE
- TypeScript/lint audit: COMPLETE (the previous audit reported zero errors/warnings)
- Next 16 route compatibility fixes: APPLIED
- Backend-backed page build-time isolation: APPLIED
- Legacy Django Vercel build path: REMOVED from the active build script
- Node runtime pinned to 24.x
- Vercel Install/Build configuration: VERSIONED IN REPO
- Vercel deployment: STILL FAILING
- Browser smoke test: BLOCKED

### Diagnostic result

A separate debug/vercel-minimal branch was created from the current GGz 2.0 code. It reduced the frontend to a minimal Next.js app with only layout.tsx, page.tsx, a minimal next.config.ts, and no Django/API page code. The same Vercel project still reported FAILURE for that deployment.

This isolates the remaining failure to the Vercel project/build environment or project configuration, not the M15.2 application source.

The connected Vercel API is currently returning 403 Not authorized for the andrewhyn scope, and its build-log action is unavailable in the current connection. Until the Vercel connection is re-authenticated, the exact platform error and Project Settings cannot be read or changed from this session.

### Required Vercel-side verification

1. Re-authenticate the Vercel connection for the andrewhyn scope.
2. Confirm Root Directory is exactly frontend.
3. Confirm Framework Preset is Next.js.
4. Confirm Node.js is 24.x.
5. Confirm there is no stale Build/Install override pointing to a Django command.
6. Redeploy the current feat/ggz-nextjs-ui-2 branch and read the build log.
7. Only after a successful deployment, set/verify NEXT_PUBLIC_DJANGO_URL and run browser smoke tests for the GGz routes.

Do not begin M15.3 until the Vercel deployment succeeds and the browser smoke test has passed.

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