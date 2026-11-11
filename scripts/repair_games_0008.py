import os
from urllib.parse import urlsplit

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hello_world.settings")
django.setup()

from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
from games.models import Game

if os.environ.get("VERCEL_ENV") != "production" or connection.vendor != "postgresql":
    raise SystemExit("GGz release repair requires the production PostgreSQL environment.")
if not os.environ.get("DATABASE_URL", "").startswith(("postgres://", "postgresql://")):
    raise SystemExit("GGz release repair requires the configured PostgreSQL URL.")

target = ("games", "0008_game_twitch_category_id_game_twitch_category_name")
expected = {"twitch_category_id", "twitch_category_name"}
media_host = urlsplit(os.environ.get("AWS_S3_ENDPOINT_URL", "")).hostname or ""
print("GGz media endpoint uses the historical project:",
      media_host in {"urwolkhnjkbmblfqinlf.storage.supabase.co", "urwolkhnjkbmblfqinlf.supabase.co"}, flush=True)

with transaction.atomic():
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '5s'")
        cursor.execute("SELECT pg_advisory_xact_lock(hashtext('ggz.games.0008'))")
        tables = set(connection.introspection.table_names(cursor))
        if not {"games_game", "django_migrations", "accounts_gamerprofile"}.issubset(tables):
            raise SystemExit("GGz tables missing from the selected database.")
        columns = {field.name for field in connection.introspection.get_table_description(cursor, "games_game")}
        executor = MigrationExecutor(connection)
        steps = executor.migration_plan([target])
        if [(item.app_label, item.name, backwards) for item, backwards in steps] == [(*target, False)]:
            if columns & expected:
                raise SystemExit("GGz migration history and existing columns disagree; no schema change made.")
            cursor.execute("LOCK TABLE public.games_game IN SHARE ROW EXCLUSIVE MODE")
            cursor.execute("CREATE SCHEMA IF NOT EXISTS ggz_release_backups")
            cursor.execute("REVOKE ALL ON SCHEMA ggz_release_backups FROM PUBLIC")
            cursor.execute("CREATE TABLE ggz_release_backups.games_game_before_0008 AS TABLE public.games_game")
            cursor.execute("CREATE TABLE ggz_release_backups.django_migrations_before_0008 AS TABLE public.django_migrations")
            cursor.execute("SELECT (SELECT count(*) FROM public.games_game) = (SELECT count(*) FROM ggz_release_backups.games_game_before_0008)")
            if not cursor.fetchone()[0]:
                raise SystemExit("GGz pre-migration snapshot count did not match.")
            executor.migrate([target], plan=steps)
            print("GGz scoped backup created and migration games.0008 applied.", flush=True)
        elif steps or not expected.issubset(columns):
            raise SystemExit("GGz database needs review: unexpected migration plan or column state.")
        else:
            print("GGz games.0008 is already applied.", flush=True)
        list(Game.objects.values("id", "twitch_category_id", "twitch_category_name")[:1])
print("GGz PostgreSQL schema and representative game read verified.", flush=True)
