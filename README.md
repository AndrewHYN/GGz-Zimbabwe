# GGz Zimbabwe

GGz is Zimbabwe's gaming ecosystem — discovery, competition, and community.

## Architecture (GGz 2.0)

- **Public website:** the Next.js 16 application in [`frontend/`](frontend/), deployed to the Vercel project `ggz-frontend` (`https://ggz-frontend.vercel.app`). This is the canonical public UI.
- **Backend / API:** the Django project in this repository root, deployed separately. It owns the database, authentication, business logic, and the JSON API under `/api/`.
- The Next.js site consumes the Django API over `NEXT_PUBLIC_DJANGO_URL` (see [`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md)). Django-rendered pages are legacy surface area being consolidated into Next.js routes; Django models, APIs, and server-side logic remain first-class and must not be removed.
- The legacy Vercel project `g-gz-zimbabwe` still serves the old Django-rendered UI. Treat it as deprecated infrastructure pending retirement, not as the product frontend.

## Installing dependencies

```python
pip install -r requirements.txt
```

## Production configuration

GGz is configured to run well with a local SQLite development database while allowing production settings to be supplied with environment variables.

Create a local .env file from .env.example before running the project in a non-default environment:

```bash
cp .env.example .env
```

Required environment variables:

- `DJANGO_SECRET_KEY`: a strong secret in production; local dev falls back to a development-only placeholder when unset
- `DEBUG`: set to `True` for local development and `False` in production
- `ALLOWED_HOSTS`: comma-separated hostnames for the current environment
- `CSRF_TRUSTED_ORIGINS`: comma-separated origins for Django CSRF validation
- `FRONTEND_URL`: canonical Next.js site origin (defaults to `http://localhost:3000` in development and `https://ggz-frontend.vercel.app` when `VERCEL` is detected). Django uses it for OAuth callback redirects, frontend password-reset links, and it is appended to `CSRF_TRUSTED_ORIGINS` automatically when it starts with `http(s)://`
- `DB_ENGINE`: defaults to SQLite for local development; set to `django.db.backends.postgresql` for production PostgreSQL
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: database settings for non-SQLite environments
- `STATIC_URL`, `STATIC_ROOT`, `MEDIA_URL`, `MEDIA_ROOT`: static/media configuration
- `GOOGLE_MAPS_PROVIDER`: set to `google` for the production intent of Radar; `osm` (or leaving it unset) remains the safe fallback. A paid Google Maps key is **not** required to run GGz — Radar degrades gracefully to the fallback with no key configured
- `GOOGLE_MAPS_API_KEY`: optional Google Maps JavaScript API key that unlocks provider-backed map features and optional Street View/3D behavior; leave blank to use the free OSM fallback
- `GOOGLE_MAPS_MAP_ID`: optional Google Maps Cloud Map ID for advanced map styling/custom map IDs (only used when the Maps key is configured)
- `GOOGLE_MAPS_DEFAULT_LATITUDE`, `GOOGLE_MAPS_DEFAULT_LONGITUDE`: default center coordinates for the GGz Zimbabwe discovery map
- Legacy `GGZ_MAP_*` values are still accepted for compatibility, but the canonical project setting is the `GOOGLE_MAPS_*` naming
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth web client values when Google sign-in is enabled
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_SECRET`: Apple Sign in configuration when Apple OAuth is enabled
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`: Discord OAuth application values used by the Connect Discord account-linking flow (same Discord application used by the GGz companion bot can be reused; the redirect URI must be registered in the Discord Developer Portal)
- `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`: production email delivery for password reset, verification, and account security notices
- `SESSION_COOKIE_AGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SAMESITE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`: security/session settings for deployed environments
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: optional CAPTCHA protection for high-risk auth actions when configured

See [DEPLOYMENT.md](DEPLOYMENT.md) for production hardening, Vercel deployment notes, backup verification, the guarded SQLite-to-PostgreSQL import command, media storage requirements, rollback guidance, and explicit verification status.
Focused runbooks: [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md) and [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md).

## GGz Radar map provider decision

GGz Radar uses the Google Maps Platform as the primary map engine **when an API key is configured**. The Google Maps key is optional, not a hard requirement: with no key, Radar runs on the built-in OpenStreetMap fallback (road tiles, markers, geocoding) and never blocks the page or the product.

Why Google Maps is the preferred provider when a key is available:

- Street View is an explicit product requirement for physical venue inspection, and Google provides that in the same geographic ecosystem as road, satellite, hybrid, and 3D experiences.
- The product goal is a premium gaming discovery layer with map browsing, directions, venue discovery, and future geographic expansion; Google Maps matches that requirement set more directly than a GIS-first stack.
- The existing GGz app already has a lightweight JSON map API and location data structure, so the architecture can stay simple while still supporting provider-native map features when the API key is present.
- ArcGIS would be viable if the product shifted toward GIS-heavy planning and geospatial analysis in a later phase, but it is not the better fit for the current requirement mix of Street View, city discovery, venue context, and mapping ease.

The implementation intentionally keeps one primary provider to avoid the unnecessary complexity of mixed-map architecture. When no key is configured, the app gracefully falls back to a safe, non-crashing public-data experience instead of breaking the page — so a paid Google Maps key can be deferred until premium map features are actually needed.

Production-ready guidance:

- Keep `DEBUG=False` in deployed environments.
- Set `ALLOWED_HOSTS` to the real deployed hostnames instead of leaving it broad.
- Add the real HTTPS origin(s) to `CSRF_TRUSTED_ORIGINS`.
- Set `FRONTEND_URL` to the canonical Next.js origin (for example `https://ggz-frontend.vercel.app`) so OAuth callbacks and password-reset emails link to the public site.
- Use PostgreSQL in production by setting `DB_ENGINE` and the PostgreSQL connection values.
- Run migrations before serving the app in a new environment.
- Run `python manage.py collectstatic` to generate static files for deployment.
- Configure an external object-storage provider for production user uploads; Vercel function storage is ephemeral.

## To run this application:

```bash
python manage.py runserver
```

For local Codespaces usage, this remains supported:

```bash
python manage.py runserver 0.0.0.0:8000
```

## To run migrations:

```bash
python manage.py migrate
```

## To generate static files:

```bash
python manage.py collectstatic
```

## To run the test suite:

```bash
python manage.py test
```

## Deployment smoke check

GGz exposes a lightweight health endpoint at `/health/` for deployment and infrastructure checks:

```bash
curl http://localhost:8000/health/
```

This endpoint returns a minimal JSON response and is intentionally public and non-sensitive.
