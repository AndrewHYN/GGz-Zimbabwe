# Production deployment and migration

This project keeps SQLite for local development and supports PostgreSQL through `DATABASE_URL`. The original `db.sqlite3` is source data and must remain untouched during migration.

## Environment configuration

Production must set:

- `DJANGO_SECRET_KEY`: a long random value. `SECRET_KEY` is not read.
- `DEBUG=False`
- `ALLOWED_HOSTS`: comma-separated deployed hostnames only.
- `CSRF_TRUSTED_ORIGINS`: comma-separated HTTPS origins, including the Vercel production/custom domain and any preview origin that accepts form posts.
- `DATABASE_URL`: PostgreSQL connection URL.
- `GOOGLE_MAPS_API_KEY`: a browser key restricted by HTTP referrer and the required Maps APIs.
- `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, and `DJANGO_SUPERUSER_PASSWORD` when creating the initial admin explicitly.

For local development, leave `DATABASE_URL` unset and use the SQLite defaults. Set `ALLOWED_HOSTS=localhost,127.0.0.1` and `CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000`. Set `USE_X_FORWARDED_PROTO=True` only when a trusted TLS-terminating proxy forwards `X-Forwarded-Proto` (Vercel and Render do); leave it false for direct local HTTP.

The settings use `SESSION_COOKIE_SAMESITE=Lax`, `CSRF_COOKIE_SAMESITE=Lax`, secure cookies in non-debug mode, `X_FRAME_OPTIONS=DENY`, content-type sniffing protection, and a same-origin referrer policy. `SECURE_SSL_REDIRECT` is enabled by default only for a deployed, non-debug environment. Do not enable HSTS until the domain is known to be HTTPS-only; then set `SECURE_HSTS_SECONDS` explicitly.

## Backup verification

Run these commands before migration, storing the backup outside the repository:

```bash
sha256sum db.sqlite3
cp --reflink=auto db.sqlite3 /secure/backup/ggz.sqlite3
sha256sum /secure/backup/ggz.sqlite3
python - <<'PY'
import sqlite3
for path in ("db.sqlite3", "/secure/backup/ggz.sqlite3"):
    with sqlite3.connect(path) as connection:
        result = connection.execute("PRAGMA integrity_check").fetchone()[0]
        assert result == "ok", (path, result)
        print(path, result)
PY
DJANGO_SECRET_KEY=local-only python manage.py dumpdata --indent 2 > /secure/backup/ggz-dump.json
python -m json.tool /secure/backup/ggz-dump.json >/dev/null
```

Record the dump object count with `python -c 'import json; print(len(json.load(open("/secure/backup/ggz-dump.json"))))'`. Do not place either backup under this repository or test-restore over production.

## SQLite to PostgreSQL migration

Provision a fresh PostgreSQL database, configure its `DATABASE_URL`, set `DJANGO_SECRET_KEY`, `DEBUG=False`, hosts, and origins, then run:

```bash
sha256sum db.sqlite3
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py migrate_sqlite_to_postgres
sha256sum db.sqlite3
```

The command identifies SQLite as the source and PostgreSQL as the destination, validates both schemas, stops on application data in the destination, exports to a temporary JSON file, imports in a transaction, repairs PostgreSQL serial sequences, prints SQLite/PostgreSQL counts for every application model, and verifies the source checksum. It never runs migrations or writes through the SQLite connection and never deletes or truncates destination data.

A populated destination is a stop condition. Do not merge or overwrite it. Investigate it separately and use a new database for a rehearsal or clean import. The `--allow-populated-destination` option exists only as an explicit operator acknowledgement; it does not delete, overwrite, merge, or bypass count validation and is not a production recovery strategy.

The import preserves Django-managed primary keys and relationships, including many-to-many data, nullable values, unique constraints, indexes, timestamps, booleans, decimals, JSON/text values, slugs, user relationships, and content references represented by serialized application objects. File fields preserve database names only; files must be migrated separately.

## Static and media files

`hello_world/static/` is source static content and `staticfiles/` is the `collectstatic` output. `hello_world/media/` is user-uploaded media. They are not interchangeable. The current repository has ImageFields for avatars, posts, tournaments, listings, organizations, events, and teams. Audit every referenced file before deployment:

```bash
find hello_world/media -type f -print | sort
python manage.py collectstatic --noinput
python manage.py findstatic admin/css/base.css --verbosity 2
```

Vercel’s filesystem is ephemeral for deployed functions. This repository has no configured object-storage backend, so production uploads are **not verified production-ready**. Configure an external storage provider using environment variables, preserve existing database file names where possible, copy the media tree to that provider, and verify an upload and read after deployment. Never change paths only to satisfy deployment.

## Vercel and Render

The current Vercel Django documentation is the source of truth for supported Python runtime, project structure, build output, function timeout, filesystem, environment variables, and migrations: <https://vercel.com/docs/frameworks/backend/django>. This repository was not verified against a live Vercel deployment, and it has no `vercel.json` or `api/index.py`; neither should be added until the current documentation explicitly requires it. The WSGI callable in this repository is `hello_world.wsgi:application`.

Do not put migrations, imports, admin creation, or destructive database commands in a Vercel build or startup hook. Apply migrations and run the explicit import command as an operator-controlled release step. Vercel preview URLs must be added to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` only when those previews are intended to accept authenticated form submissions. Render remains supported by `render.yaml`; its persistent disk is separate from the Vercel deployment model.

## Rollback and smoke test

For application failure, redeploy the previous known-good code while preserving the PostgreSQL database. For migration or import failure, stop the release, retain the original SQLite file and verified backup, inspect the count report, and use a newly provisioned database for another rehearsal. For Vercel, Maps, or media failure, roll back the application deployment and correct environment/storage restrictions; do not drop or truncate production tables.

After deployment, run safe GET checks for `/health/`, `/`, games, discovery, organizations, tournaments, events, marketplace, messages, feed, search, leaderboard, and `/admin/`. Use a non-destructive test account for registration/login, profile, CSRF-protected forms, and migrated-user authentication. Production smoke testing, PostgreSQL rehearsal, media upload/read, and Google Maps domain behavior remain pending until the deployed services and credentials are available.

## Verification status

### Verified locally

- Django settings load with local SQLite defaults.
- PostgreSQL URL parsing, SSL mode selection, zero connection reuse, secure cookies, and proxy-header behavior are covered by controlled settings checks.
- SQLite source checksum baseline: record the value from the pre-migration command; it must match after preparation.
- Existing migrations, password validators, WSGI callable, routes, and authentication model are preserved.

### Requires external verification

- PostgreSQL migration rehearsal, counts, relationships, sequences, new-record creation, authentication, and permissions.
- Current Vercel build/runtime behavior and deployed smoke tests.
- External object-storage upload/read behavior.
- Google Cloud API restrictions and production map rendering.
