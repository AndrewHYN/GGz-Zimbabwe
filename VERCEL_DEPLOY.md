# Vercel deployment

The Django WSGI application is `hello_world.wsgi:application`. Current Vercel Django guidance is the source of truth: <https://vercel.com/docs/frameworks/backend/django>.

This repository currently has no `vercel.json` or `api/index.py`. Do not add either unless the current Vercel documentation or deployment output explicitly requires it. Do not add migration, import, admin-bootstrap, or destructive commands to a build or startup hook.

## Environment variables

Configure these in Vercel for the relevant environments:

```text
DJANGO_SECRET_KEY=
DEBUG=False
DATABASE_URL=
ALLOWED_HOSTS=
CSRF_TRUSTED_ORIGINS=
GOOGLE_MAPS_API_KEY=
MAX_UPLOAD_SIZE=4194304
DJANGO_SUPERUSER_USERNAME=Hyndrrx
DJANGO_SUPERUSER_EMAIL=
DJANGO_SUPERUSER_PASSWORD=
USE_X_FORWARDED_PROTO=True
SECURE_SSL_REDIRECT=True
```

Use the exact Vercel production domain and custom domain in `ALLOWED_HOSTS`, and their HTTPS origins in `CSRF_TRUSTED_ORIGINS`. Add preview hostnames/origins only when previews are intended to accept authenticated form submissions. Never commit values from this file.

## Release order

1. Preserve and verify the SQLite backup.
2. Provision PostgreSQL and configure Vercel environment variables.
3. Deploy the code.
4. Run `python manage.py migrate --noinput` against PostgreSQL.
5. Run `python manage.py migrate_sqlite_to_postgres` once against the fresh database.
6. Run the idempotent `python manage.py create_admin` with the admin values in environment variables.
7. Configure Google Maps API restrictions for the deployed domain.
8. Configure persistent Supabase S3-compatible object storage for media; Vercel function storage is ephemeral.
9. Run non-destructive smoke tests.

Do not automatically import data on every deployment. Do not use Vercel build steps for database data migration.

## Current status

Vercel deployment and live smoke tests are **NOT VERIFIED** from this Codespace. The
SQLite-to-Neon PostgreSQL migration is **COMPLETED** and verified with matching model
counts, relationship checks, and repaired sequences. Media persistence requires external
storage configuration. When all `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, and `AWS_S3_REGION_NAME` variables
are present, Django uses `django-storages` for media and otherwise keeps local filesystem
storage. Google Maps requires a browser key restricted to the production referrers and
the enabled Maps APIs.

Supabase's S3-compatible credentials may allow public object reads while denying
`HeadObject`. The configured `hello_world.storage.SupabaseMediaStorage` avoids
that permission-sensitive duplicate-name probe by generating a UUID-backed key
for every upload. It preserves duplicate-name safety without making the bucket
public to work around credentials.

`MAX_UPLOAD_SIZE` defaults to `4194304` bytes (4 MiB). This is deliberately below
Vercel's approximately 4.5 MB serverless request-body limit so multipart overhead
does not reject an image before Django can return a validation error. Keep the
same value in Vercel unless the deployment runtime's request limit is verified.

For an intentionally selected development/demo database, use
`python manage.py seed_demo`. The command is transactional and idempotent, but it
is not part of the Vercel build and must never be run automatically against Neon.
