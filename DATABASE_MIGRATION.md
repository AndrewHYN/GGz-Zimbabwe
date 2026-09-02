# SQLite to PostgreSQL

`db.sqlite3` is the read-only source of truth. Do not run migrations, writes, flushes, resets, deletes, truncates, or destructive SQL against it.

## Before migration

```bash
git status --short
sha256sum db.sqlite3
python manage.py check
```

Create and verify a local backup using the procedure in [DEPLOYMENT.md](DEPLOYMENT.md). The current verified source checksum is:

```text
f1123157d7a9042285a788a1af79d0b9dae3ae407b99833709778fa070bb0695
```

Provision a fresh PostgreSQL database and set `DATABASE_URL`. Never use a populated production database for rehearsal or import.

## Import

```bash
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py migrate_sqlite_to_postgres
sha256sum db.sqlite3
```

The command validates the SQLite schema and PostgreSQL schema, refuses missing `DATABASE_URL`, refuses application data already present in PostgreSQL, exports all Django application models, imports existing primary keys and relationships, repairs sequences, verifies per-model counts, and confirms that the SQLite checksum did not change. It does not delete or overwrite either database.

The `--allow-populated-destination` flag is an explicit operator acknowledgement only. It does not make merging safe and is not a production recovery strategy. Stop and use a fresh database when the destination contains application data.

## Verification

The command prints `SQLite=<count> PostgreSQL=<count>` for each application model. Every count must match. Verify foreign keys, many-to-many tables, authentication records, organization/team/tournament relationships, conversations/messages, marketplace ownership, social graph, and sequence-backed new-record creation before switching production traffic.

Migration status in this Codespace: **NOT PERFORMED**. `DATABASE_URL` is not available.
