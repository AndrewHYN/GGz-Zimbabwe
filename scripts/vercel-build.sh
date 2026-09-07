#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "database configured: no"
    echo "Vercel build requires DATABASE_URL for production migrations." >&2
    exit 1
fi

database_scheme="${DATABASE_URL%%:*}"
if [[ "${database_scheme,,}" == "sqlite" ]]; then
    echo "database configured: yes"
    echo "backend detected: SQLite"
    echo "Vercel migrations require PostgreSQL; refusing to run against SQLite." >&2
    exit 1
fi

if [[ "${database_scheme,,}" != "postgres" && "${database_scheme,,}" != "postgresql" ]]; then
    echo "database configured: yes"
    echo "backend detected: unsupported"
    echo "Vercel migrations require a PostgreSQL DATABASE_URL." >&2
    exit 1
fi

echo "database configured: yes"
echo "backend detected: PostgreSQL"
echo "installing dependencies"
python -m pip install -r requirements.txt
echo "migration command starting"
python manage.py migrate --noinput
echo "collectstatic command starting"
python manage.py collectstatic --noinput