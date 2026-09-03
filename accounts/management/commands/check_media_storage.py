import os
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Run a safe PUT, HEAD, GET, and DELETE check against configured media storage."

    def handle(self, *args, **options):
        configured = bool(settings.USE_S3_MEDIA_STORAGE)
        self.stdout.write(f"provider configured: {'yes' if configured else 'no'}")
        self.stdout.write(f"bucket configured: {'yes' if bool(os.environ.get('AWS_STORAGE_BUCKET_NAME')) else 'no'}")
        self.stdout.write(f"endpoint configured: {'yes' if bool(os.environ.get('AWS_S3_ENDPOINT_URL')) else 'no'}")
        self.stdout.write(f"region configured: {'yes' if bool(os.environ.get('AWS_S3_REGION_NAME')) else 'no'}")
        if not configured:
            raise CommandError("Persistent media storage is not configured.")

        name = f"_storage_verification/{uuid4().hex}.txt"
        payload = b"GGz media storage verification"
        results = {"write": False, "head": False, "read": False, "delete": False}
        saved_name = name
        try:
            saved_name = default_storage.save(name, ContentFile(payload))
            results["write"] = True
            results["head"] = default_storage.exists(saved_name)
            with default_storage.open(saved_name, "rb") as uploaded_file:
                results["read"] = uploaded_file.read() == payload
        finally:
            try:
                default_storage.delete(saved_name)
                results["delete"] = not default_storage.exists(saved_name)
            except Exception:
                results["delete"] = False

        for operation, passed in results.items():
            self.stdout.write(f"{operation}: {'PASS' if passed else 'FAIL'}")
        if not all(results.values()):
            raise CommandError("Media storage verification failed.")