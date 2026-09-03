# GGz Feature Audit

Audit date: 2026-09-03

## Scope and evidence

The canonical production host was smoke-tested with non-mutating `GET` requests. The
Codespace has no `DATABASE_URL` or production credentials, so local checks use the
preserved SQLite database and no live user, upload, or production record was changed.
Route reachability is not treated as proof that an authenticated workflow works.

## Authenticated action matrix

| Feature | URL | Method | Auth | CSRF | DB mutation | Media | Response | Existing test | Production risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Challenge friend | `/games/<id>/challenge/` | POST | Yes | Django middleware | Challenge, notification | No | Redirect to game | Yes | Target validation and duplicate pending prevention fixed; live POST unverified |
| Challenge action | `/tournaments/challenges/<id>/<action>/` | POST | Yes | Django middleware | Challenge status, notification | No | Redirect | Yes | Live POST unverified |
| Create tournament | `/tournaments/create/` | POST | Yes | Django middleware | Tournament | Optional banner | Redirect | Yes | Live POST/media unverified |
| Edit tournament | `/tournaments/<slug>/edit/` | POST | Organizer | Django middleware | Tournament | Optional banner | Redirect | Partial | Live POST/media unverified |
| Create event | `/events/create/` | POST | Staff | Django middleware | Event | Optional banner | Redirect | Yes | Live POST/media unverified |
| Create marketplace listing | `/marketplace/create/` | POST | Yes | Django middleware | Listing/images | Images | Redirect | Partial | Live POST/media unverified |
| Create/edit organisation | `/organizations/create/`, `/organizations/<slug>/edit/` | POST | Staff | Django middleware | Organisation | Optional logo | Redirect | Yes | Live POST/media unverified |
| Edit profile/avatar | `/profiles/<gamer_tag>/edit/` | POST | Owner | Django middleware | Profile | Optional avatar | Redirect/form error | Yes | Exact live upload pending |
| Create/edit post | `/feed/posts/create/`, `/feed/posts/<id>/edit/` | POST | Yes/author | Django middleware | Post | Optional image | Redirect/form error | Yes | Live POST/media unverified |
| Send message | `/messages/<id>/` | POST | Participant | Django middleware | Message/notification | No | Redirect or JSON | Yes | Live POST unverified |
| Like/save post | `/feed/posts/<id>/like/`, `/save/` | POST | Yes | Django middleware | Like/save | No | Redirect or JSON | Yes | Live AJAX unverified |
| Follow/social action | `/profiles/<gamer_tag>/<action>/` | POST | Yes | Django middleware | Follow/request/block | No | Redirect or JSON | Yes | Live AJAX unverified |
| Notifications read/unread | `/notifications/<id>/read/`, `/unread/` | POST | Yes | Django middleware | Notification state | No | Redirect | Yes | Live POST unverified |
| Team actions | `/teams/<id>/...` | POST | Yes/role | Django middleware | Membership/team | No active upload form | Redirect | Yes | Live POST unverified |

## Demo data

`python manage.py seed_demo` now provides an idempotent, transactional demo dataset
covering users/profiles, games and game relationships, follows/friendship, posts,
comments/likes, challenges, tournaments/registrations/bracket matches, events,
organizations/locations, teams/memberships, marketplace listings/images,
conversations/messages, notifications, rankings/reputation fields, map coordinates,
and YouTube trailer URLs. Demo passwords are supplied through `GGZ_DEMO_PASSWORD`
or use the documented demo-only fallback; this command must be run only against an
intentionally selected database.

| Feature | Exists | Live Tested | Status | Fixed | Modernized | AJAX | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication and sessions | Yes | Public login page only | PARTIALLY WORKING | Yes | No | No | Local blank `DJANGO_SECRET_KEY` no longer prevents sessions/tests. Authenticated live flow remains unverified. |
| Registration and password management | Yes | No | PARTIALLY WORKING | No | No | No | Registration exists; password reset/change requires authenticated flow testing. |
| Profiles and profile editing | Yes | No | PARTIALLY WORKING | No | No | No | `GamerProfile` and edit views/templates exist. |
| Profile avatars | Yes | Public existing object | BROKEN — BLOCKED | Validation fixed | No | No | Existing Supabase avatar URL returned 200; the shared 4 MiB ceiling rejects oversized uploads server-side; a new live upload was not performed. |
| Gamer discovery and maps | Yes | Public route only | PARTIALLY WORKING | No | Partial | Yes | Discovery, geo routes, map data JSON, and map controls exist. |
| Games and game detail | Yes | No | PARTIALLY WORKING | No | No | No | Listing, detail, leaderboard, reviews, and wishlist foundations exist. |
| Follow/unfollow and social graph | Yes | No | PARTIALLY WORKING | AJAX guard fixed | Yes | Yes | Follow action returns JSON for XMLHttpRequest; AJAX now rejects login redirects/HTML errors visibly; live state/count/notification flow unverified. |
| Community feed | Yes | `/feed/` returned 200 | PARTIALLY WORKING | Like response fixed | Partial | Partial | Posts, detail, edit, delete, likes, saves, comments, and feed tabs exist; like counts now come from persisted `PostLike` rows. |
| Feed media posts | Yes | Public existing object | BROKEN — BLOCKED | Existing validation | No | Partial | Existing Supabase post image URL returned 200; a new live upload and persistence remain unverified. |
| Reviews | Yes | No | PARTIALLY WORKING | No | No | No | Game reviews and feed content foundations exist; styling and end-to-end creation need live verification. |
| Organizations | Yes | `/organizations/` returned 200 | PARTIALLY WORKING | No | No | No | Public, create/edit, dashboards, members, locations, and logo field exist. |
| Organization permissions | Yes | No | PARTIALLY WORKING | No | No | No | Permission checks exist in views; authenticated negative-path tests should be expanded. |
| Teams and invitations | Yes | No | PARTIALLY WORKING | No | No | No | Team CRUD and invitations have models, views, forms, and templates. |
| Tournaments | Yes | `/tournaments/` returned 200 | PARTIALLY WORKING | No | No | No | CRUD, registration, management, participants, and organizer flows exist. |
| Tournament media | Yes | No | BROKEN — BLOCKED | Validation fixed | No | No | Banner `ImageField` and multipart forms exist; the shared 4 MiB ceiling rejects oversized uploads server-side; new live upload was not performed. |
| Tournament brackets and advancement | Yes | No | DEMO/MVP | No | No | No | Bracket generation, byes, matches, and advancement are covered by local tests. |
| Events | Yes | No | PARTIALLY WORKING | Validation fixed | No | No | Event CRUD and banner upload foundations exist; the shared 4 MiB ceiling rejects oversized banners server-side. |
| Marketplace | Yes | `/marketplace/` returned 200 | PARTIALLY WORKING | No | No | Partial | Listing ownership, detail, forms, and multiple-image request handling exist. |
| Marketplace media | Yes | Public existing object | BROKEN — BLOCKED | Existing validation | No | No | Existing Supabase listing image URL returned 200; new upload and persistence require production credentials. |
| Contact seller | Yes | No | DEMO/MVP | No | No | No | Messaging models exist; live seller-contact workflow needs verification. |
| Messaging | Yes | `/messages/` returned 200 | PARTIALLY WORKING | AJAX send and response guard fixed | Yes | Yes | Authorized message sends now return JSON and update the conversation without a reload; login redirects and HTML errors become visible status messages; authenticated live send/receive remains unverified. |
| Notifications | Yes | No | PARTIALLY WORKING | No | No | Partial | Notification list and event creation foundations exist; read/unread live flow unverified. |
| Leaderboards, reputation, ranks | Yes | No | DEMO/MVP | No | Partial | No | Leaderboard and profile rank/reputation foundations exist. |
| Search | Yes | No | PARTIALLY WORKING | No | No | No | Global search template/route exists; entity coverage and pagination need verification. |
| Google Maps/location | Yes | No | PARTIALLY WORKING | No | Partial | Yes | Environment-based map configuration and map-data endpoint exist. |
| Navigation and public routes | Yes | All smoke routes | WORKING | No | No | No | `/`, login, feed, organizations, tournaments, marketplace, messages, admin, and health returned 200. |
| Admin | Yes | `/admin/` returned 200 | PARTIALLY WORKING | No | No | No | HTTP reachability only; admin authentication and model operations unverified. |
| Persistent media storage | Yes | Public existing objects | BROKEN — BLOCKED | URL generation fixed | No | No | Representative existing avatar, post, and listing objects returned 200 from Supabase; required production variables are absent locally and new authenticated uploads remain unverified. The 4 MiB application limit is below Vercel's request ceiling. |
| Responsive/accessibility/UI modernization | Yes | No | PLANNED | No | No | No | Existing Bootstrap/custom CSS and templates need browser-level audit before targeted redesign. |

## Media inventory

All discovered upload fields use Django storage resolution rather than feature-specific
storage code:

| Model/feature | Field | Upload path |
| --- | --- | --- |
| `GamerProfile` | `avatar` | `avatars/` |
| `Post` | `image` | `posts/` |
| `Tournament` | `banner` | `tournaments/` |
| `Event` | `banner` | `events/` |
| `Organization` | `logo` | `organizations/logos/` |
| `Team` | `logo`, `banner` | `teams/logos/`, `teams/banners/` |
| `Listing` | `image` | `listings/` |

The active upload forms consistently use `settings.MAX_UPLOAD_SIZE`, defaulting to 4 MiB:
`GamerProfileForm.avatar`, `PostForm.image`, `TournamentForm.banner`, `EventForm.banner`,
`OrganizationForm.logo`, and `ListingImageForm.image`. `Team.logo` and `Team.banner` are
model fields only; no supported team upload form/view currently exists.

When all required AWS-compatible environment variables are present, settings select
`storages.backends.s3boto3.S3Boto3Storage` and generate public Supabase URLs. Local
development intentionally remains on filesystem storage when those variables are absent.

## Current fixes

- Blank `DJANGO_SECRET_KEY` values now use the explicit local development fallback instead
  of overriding it with an empty string. Production still receives its secret from the
  environment.
- External gaming-feed requests now use the configurable `EXTERNAL_FEED_TIMEOUT`, which
  defaults to 3 seconds instead of allowing a 20-second upstream wait to consume a Vercel
  request budget. The timeout path is covered by a regression test.

## Production timeout incident

The reported authenticated timeout could not be reproduced from this Codespace because
no production session or Vercel log access is available. The strongest code-level timeout
hazard found is the synchronous RSS refresh path used by explicit feed refresh and by
empty personalized discovery results. It previously allowed four upstream sources to
wait up to 20 seconds each. This is mitigated with a 3-second per-source ceiling, while
source failures remain non-fatal and return cached/empty results. Session cookies and
authentication settings were not weakened. The exact live trigger and authenticated
post-fix flow remain pending manual verification with Vercel logs and a real account.

## Supabase upload incident

Production identified `botocore.exceptions.ClientError: 403 Forbidden` from
`S3Storage.exists()` during `HeadObject` while saving `/profiles/Hyndrrx/edit/`.
Public GET access to existing objects does not imply that the configured Supabase
S3 key is allowed to issue `HeadObject`; django-storages re-raises that 403 before
it can upload. `SupabaseMediaStorage` now generates a UUID-backed object key for
each upload, avoiding the permission-sensitive existence probe while preserving
duplicate-name safety. Account upload saves convert storage exceptions into safe
form errors and log the exception server-side. The exact regression is covered by
storage tests. A real new authenticated production upload remains pending manual
verification.

## Verification

| Check | Result |
| --- | --- |
| `python manage.py check` | PASS |
| `python manage.py check --deploy` | PASS with `security.W004`, `security.W008`, `security.W009` warnings |
| `python manage.py makemigrations --check --dry-run` | PASS, no changes |
| `python manage.py test` | PASS, 141 tests |
| `git diff --check` | PASS |
| Canonical public route smoke test | PASS, all listed routes returned HTTP 200 |
| Representative public Supabase media URLs | PASS, avatar JPEG, post PNG, and listing object returned HTTP 200 |

## Blockers and next actions

- Live authenticated and media workflows require using the deployment's configured
  credentials; none are available in this Codespace and no credentials should be pasted
  into chat.
- Deployment checks still warn about HSTS, SSL redirect, and the intentionally short local
  fallback key. Production settings should be checked in Vercel without exposing values;
  enabling transport-security settings should be validated against the deployment first.
- Browser-level responsive and visual modernization work remains pending because route
  smoke tests cannot establish layout quality.

## Data safety

Neon reset: NO  
SQLite modified: NO  
SQLite migration rerun: NO  
Production data intentionally deleted: NO

## Git checkpoint

The settings repair is committed as `8be4080`, the audit as `9f2f589`, and upload
validation as `a3e2f39`; all are pushed to `origin/main`.