#!/usr/bin/env bash
set -euo pipefail

GGZ_BUILD_VENV="$(mktemp -d)"
trap 'rm -rf "$GGZ_BUILD_VENV"' EXIT
python3 -m venv "$GGZ_BUILD_VENV"
"$GGZ_BUILD_VENV/bin/python" -m pip install -q --disable-pip-version-check -r requirements.txt

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
    case "${DATABASE_URL:-}" in
        postgres://*|postgresql://*) ;;
        *) echo "The production Django build requires a PostgreSQL DATABASE_URL." >&2; exit 1 ;;
    esac
    "$GGZ_BUILD_VENV/bin/python" manage.py shell -c 'from hello_world.core.views import readiness_check; from django.test import RequestFactory; raise SystemExit(0 if readiness_check(RequestFactory().get("/ready/")).status_code == 200 else "GGz database is not ready. Review the migration plan and the database schema.")'
    echo "GGz production database readiness passed."
fi

"$GGZ_BUILD_VENV/bin/python" manage.py collectstatic --noinput
