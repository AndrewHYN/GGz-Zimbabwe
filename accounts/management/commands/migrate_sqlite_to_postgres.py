import hashlib
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.db.migrations.executor import MigrationExecutor


SYSTEM_MODELS = {
    "admin.logentry",
    "auth.permission",
    "contenttypes.contenttype",
    "sessions.session",
}


class Command(BaseCommand):
    help = "Safely import the read-only SQLite source database into an empty PostgreSQL database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--allow-populated-destination",
            action="store_true",
            help="Explicitly acknowledge a populated destination; no records are deleted or overwritten.",
        )

    def handle(self, *args, **options):
        database_url = os.environ.get("DATABASE_URL", "").strip()
        if not database_url:
            raise CommandError("DATABASE_URL is required; SQLite is the source and PostgreSQL is the destination.")
        if connections["default"].vendor != "postgresql":
            raise CommandError("The destination must be PostgreSQL when DATABASE_URL is set.")

        source_path = Path(settings.BASE_DIR) / "db.sqlite3"
        if not source_path.is_file():
            raise CommandError(f"SQLite source does not exist: {source_path}")
        source_checksum = self._sha256(source_path)
        source_alias = "sqlite_source"
        source_database = connections.databases["default"].copy()
        source_database.update(
            {"ENGINE": "django.db.backends.sqlite3", "NAME": str(source_path), "OPTIONS": {}}
        )
        connections.databases[source_alias] = source_database

        self.stdout.write(f"Source: SQLite {source_path}")
        self.stdout.write("Destination: PostgreSQL from DATABASE_URL (credentials hidden)")
        self._validate_source(source_alias)
        self._validate_destination()

        destination_has_data = self._destination_has_application_data()
        if destination_has_data and not options["allow_populated_destination"]:
            raise CommandError(
                "Destination contains application data. STOP: no records were changed. "
                "Use a fresh PostgreSQL database or explicitly pass --allow-populated-destination."
            )
        if destination_has_data:
            self.stdout.write(self.style.WARNING("Destination is populated; import will not delete or overwrite records."))

        model_labels = self._application_model_labels()
        with NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as export_file:
            export_path = export_file.name
        try:
            call_command(
                "dumpdata",
                *model_labels,
                database=source_alias,
                natural_foreign=True,
                natural_primary=True,
                indent=2,
                output=export_path,
                verbosity=0,
            )
            with open(export_path, encoding="utf-8") as serialized_file:
                payload = json.load(serialized_file)
            if not isinstance(payload, list):
                raise CommandError("SQLite export is not a JSON object list.")
            self.stdout.write(f"Exported {len(payload)} objects from SQLite.")
            if self._sha256(source_path) != source_checksum:
                raise CommandError("SQLite source checksum changed during export; destination was not modified.")
            with transaction.atomic(using="default"):
                call_command("loaddata", export_path, database="default", verbosity=0)
        finally:
            Path(export_path).unlink(missing_ok=True)

        if self._sha256(source_path) != source_checksum:
            raise CommandError("SQLite source checksum changed; import was aborted after the change was detected.")
        self._repair_sequences()
        self._report_counts(source_alias, model_labels)
        self.stdout.write(self.style.SUCCESS("Import completed and PostgreSQL sequences were repaired."))

    def _application_model_labels(self):
        return [
            model._meta.label_lower
            for model in apps.get_models()
            if model._meta.label_lower not in SYSTEM_MODELS and not model._meta.proxy
        ]

    def _validate_source(self, alias):
        connection = connections[alias]
        connection.ensure_connection()
        required_tables = {model._meta.db_table for model in apps.get_models() if not model._meta.proxy}
        actual_tables = set(connection.introspection.table_names())
        missing_tables = sorted(required_tables - actual_tables)
        if missing_tables:
            raise CommandError(f"SQLite source is missing expected tables: {', '.join(missing_tables)}")

    def _validate_destination(self):
        connection = connections["default"]
        connection.ensure_connection()
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if plan:
            raise CommandError("Destination migrations are not fully applied; run migrate before importing.")
        expected_tables = {
            model._meta.db_table for model in apps.get_models() if not model._meta.proxy
        }
        actual_tables = set(connection.introspection.table_names())
        missing_tables = sorted(expected_tables - actual_tables)
        if missing_tables:
            raise CommandError(f"PostgreSQL destination is missing expected tables: {', '.join(missing_tables)}")

    def _destination_has_application_data(self):
        connection = connections["default"]
        tables = {
            model._meta.db_table
            for model in apps.get_models()
            if model._meta.label_lower not in SYSTEM_MODELS and not model._meta.proxy
        }
        with connection.cursor() as cursor:
            for table in tables:
                quoted_table = connection.ops.quote_name(table)
                cursor.execute(f"SELECT 1 FROM {quoted_table} LIMIT 1")
                if cursor.fetchone():
                    return True
        return False

    def _repair_sequences(self):
        connection = connections["default"]
        with connection.cursor() as cursor:
            for model in apps.get_models():
                if model._meta.proxy or not model._meta.auto_created:
                    table = model._meta.db_table
                    pk_column = model._meta.pk.column
                    cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", [table, pk_column])
                    sequence = cursor.fetchone()[0]
                    if sequence:
                        cursor.execute(
                            f"SELECT setval(%s, COALESCE((SELECT MAX({connection.ops.quote_name(pk_column)}) FROM {connection.ops.quote_name(table)}), 1), true)",
                            [sequence],
                        )

    def _report_counts(self, source_alias, model_labels):
        differences = []
        for label in model_labels:
            model = apps.get_model(label)
            source_count = model.objects.using(source_alias).count()
            destination_count = model.objects.using("default").count()
            self.stdout.write(f"{label}: SQLite={source_count} PostgreSQL={destination_count}")
            if source_count != destination_count:
                differences.append(f"{label} ({source_count} != {destination_count})")
        if differences:
            raise CommandError("Record count differences detected: " + ", ".join(differences))

    @staticmethod
    def _sha256(path):
        digest = hashlib.sha256()
        with path.open("rb") as database_file:
            for chunk in iter(lambda: database_file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
