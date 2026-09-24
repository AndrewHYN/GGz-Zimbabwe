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

## Visual system, motion & data-visualization (M3)

The public Next.js site ships a unified visual layer defined in `frontend/src/app/globals.css` and the shared components under `frontend/src/components/`:

- **Tokens** — the `@theme` block defines the palette (`--color-ggz-base`, `--color-ggz-surface`, `--color-ggz-amber`, `--color-ggz-text-*`, `--color-gggz-cyan`, `--color-ggz-red`), radii (`--radius-md`/`--radius-lg`), and font stacks. Pages and components must consume these tokens via utility classes (`text-ggz-text-primary`, `bg-ggz-surface`, …) rather than raw hex values.
- **Theme** — dark is the default; a `[data-theme="light"]` block overrides the same tokens for light mode (Navigation theme toggle persists the choice). Ambient atmosphere layers are hidden in light mode automatically.
- **Status vocabulary** — `StatusPill` (`components/ui/StatusPill.tsx`) maps tournament status, event status/mode, and presence states to consistent tones (`live`, `open`, `scheduled`, `closed`, `completed`, `online`, …) with a pulsing `live` variant. Use the exported tone helpers (`tournamentTone`, `eventModeTone`, `presenceTone`) instead of hand-rolled badges.
- **Artwork & fallbacks** — `GameArtwork`/`SafeImage` render IGDB artwork through `next/image` and fall back to `MediaFallback` (a branded gradient placeholder with contextual copy) when artwork is missing or fails to load.
- **Cards** — `GameCard`, `TournamentCard`, `EventCard`, `ListingCard`, `GamerCard` (under `components/cards/`) share the same anatomy: `HoverCard` root, artwork slot, `StatusPill`, metadata rows, and an `EmptyState` fallback for empty lists.

### Motion guidance

- `MotionProvider` wraps the app (`layout.tsx`) with `MotionConfig reducedMotion="user"`, so every Motion-for-React animation collapses for users with OS-level reduced-motion enabled (verified: durations become ~0 under emulation).
- Use `MotionReveal` (viewport reveal: 18px rise, 0.45s, once) for section-level entrances — not for every element.
- `HoverCard` provides the shared lift interaction (−3px, spring 450/32) and must be the root of any linkable card.
- Keep motion short, opacity/transform only; avoid animating layout properties (reflows), and do not loop decorative animation besides the ambient background and the `live-ping` indicator.

### Atmosphere

- `GameAmbientBackground` (server component) fetches `/api/games/` (revalidated every 300s) and mounts at most **two** darkened IGDB artworks (opacity ≤0.07, heavy blur) behind the app shell, plus gradient veil overlays. If the games API fails, it degrades to a pure-gradient fallback — no broken state, no layout impact, and artwork `unoptimized` to keep the bundle light.
- The ambient layers animate with slow transform/opacity-only CSS keyframes (`ambient-drift-a/b`, `ambient-crossfade`, 48–72s) that are disabled under `prefers-reduced-motion`.

### Data-visualization extension points

Future charts/graphs should plug into the existing pages rather than creating new visual languages:

- **Tournament pages** (`/tournaments/`, detail) — bracket/standings views; serializer already exposes `participant_count`, `format`, `status`, `prize_description`.
- **Game detail** (`/games/[id]/`) — leaderboard and player-performance trends; reviews/activity strip already rendered with `MotionReveal` sections.
- **Events** (`/events/`) — attendance/RSVP trends (`rsvp_count`, `capacity` are in the list serializer).
- **Marketplace** (`/marketplace/`) — price-distribution sparklines per category.
- **Radar/discover** — geo-density heat overlays; the no-key OSM fallback must remain non-blocking.
- **Twitch/KokonutUI** — not built yet; if added, mount player modules inside `MotionReveal` sections using the same tokens. Do not fabricate analytics numbers — BKLit/BKLit-style metrics must be wired to real backends only.

Charts libraries (when introduced) should be lazy-loaded per route to keep the initial bundle lean.

## GGz Live — Twitch + IGDB (M4)

Public live-stream discovery runs entirely server-side through Django. The browser never sees Twitch credentials, and every Twitch failure degrades to a usable empty state.

### Architecture

- `games/services/twitch.py` owns all Twitch Helix traffic: app-access token acquisition (cached until `expires_in - 120s`), typed error handling (401 single retry after clearing the token, 429/timeout/invalid-JSON → typed `TwitchError`s), stream normalization into the GGz-owned `LiveStream` shape, category mapping + persistence, and per-filter stream caches (60s). Views never call Twitch directly and never log secrets.
- `GET /api/live/` (`hello_world/core/api.py:api_live`) is the **only** live endpoint. Modes via query string: bare path → global discovery (streams grouped per GGz game into `games[]`, streams enriched with `ggz_game_id`/`ggz_game_name`); `?game=<ggz-game-id>` → that game's live streams (404 for unknown ids); `?channel=<twitch-login>` → one broadcaster (precedence over `game`). `?language=` filters the global mode. GET-only.
- Category mapping order (first hit wins, then persisted forever on the game row): persisted `Game.twitch_category_id` → Twitch `games?igdb_id=` lookup (same IGDB id the catalogue already stores) → exact game name → normalized name (symbols stripped) → no match (negatively cached 24h). Successful mappings persist to `games_game.twitch_category_id/twitch_category_name` (migration `0008`), so each game resolves from Twitch at most once.
- Caches: access token (lifetime-aware), streams (60s per filter combination), category hits (7 days), category misses (1 day). All sit in Django's default cache.

### Frontend routes & components

- `/live/` — discovery hub: filter chips per GGz game, live-now grid, popular-live-games row, browse footer. Server component; fetches `/api/live/` + `/api/games/` with `revalidate`.
- `/live/[channel]/` — watch page: responsive Twitch embed (`components/live/TwitchPlayer.tsx`) that mounts `player.twitch.tv` only after layout confirms the correct `parent` hostname and ≥400px width; otherwise a clean "Watch on Twitch" card. Header always offers `https://www.twitch.tv/<login>`.
- Homepage `Live Now` section and game-detail `GGz LIVE` strip render only when there is at least one live stream; they disappear otherwise — no empty boxes.
- `components/live/TwitchStreamCard.tsx` (grid card), `GameLiveStrip.tsx` (game page), `lib/live.ts` (shared types + `formatViewers` + `twitchWatchUrl`).
- CSP: `frame-src https://player.twitch.tv` and `img-src https://static-cdn.jtvnw.net` are allow-listed in Django middleware CSP and the Next.js `headers()` CSP in `frontend/next.config.ts`.

### Environment variables (server-side only — never NEXT_PUBLIC_*)

```bash
# Reuses the IGDB Twitch application when Twitch names are blank (same app,
# app access tokens only — no user scopes, no redirect URI).
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_DISABLE_IGDB_FALLBACK=False   # True forces live discovery off entirely
# Optional overrides (defaults shown):
TWITCH_AUTH_URL=https://id.twitch.tv/oauth2/token
TWITCH_API_BASE_URL=https://api.twitch.tv/helix
TWITCH_TIMEOUT=6
TWITCH_STREAM_CACHE_SECONDS=60
TWITCH_CATEGORY_CACHE_SECONDS=604800
TWITCH_CATEGORY_MISS_CACHE_SECONDS=86400
```

Without any credentials (or with the fallback disabled), `/api/live/` returns `{"available": false, "streams": []}` and the UI renders graceful empty states. The client secret and app access tokens must never reach the browser, HTML, git, or logs — `/api/live/` responses contain only normalized stream data.

### Manual Twitch setup

1. Create an application at https://dev.twitch.tv/console/apps (or reuse the IGDB one): set the OAuth redirect URL to `http://localhost:3000` (unused for app tokens) and note the Client ID + Client Secret.
2. Put the values in `.env` as `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET` (dual-use) or the `TWITCH_*` pair above; restart Django.
3. `python manage.py migrate` adds the category columns; mappings resolve lazily on first `/api/live/` request and persist.

### Testing note

`games/tests_twitch.py` mocks the network boundary (`twitch.urlopen`) — token flow, mapping, caching, degradation, and all three API modes are covered without credentials. End-to-end runs use a local mock Helix server (`mock_twitch.py`) because real Twitch token endpoints require a whitelisted application.

## Deployment smoke check

GGz exposes a lightweight health endpoint at `/health/` for deployment and infrastructure checks:

```bash
curl http://localhost:8000/health/
```

This endpoint returns a minimal JSON response and is intentionally public and non-sensitive.
