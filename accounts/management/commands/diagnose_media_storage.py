from io import BytesIO
from uuid import uuid4

import requests
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from PIL import Image


class Command(BaseCommand):
    help = "Verify the configured media store with a disposable image."

    def handle(self, *args, **options):
        if not settings.USE_S3_MEDIA_STORAGE:
            raise CommandError("Persistent media storage is not configured.")

        buffer = BytesIO()
        Image.new("RGB", (4, 4), "#eca840").save(buffer, format="PNG")
        payload = buffer.getvalue()
        upload = ContentFile(payload)
        upload.content_type = "image/png"
        key = "_ggz_storage_diagnostic/" + uuid4().hex + ".png"
        saved_key = None
        failures = []

        def check(operation, run):
            try:
                result = run()
                if result is False:
                    raise CommandError("Missing object or content mismatch.")
            except (BotoCoreError, ClientError, OSError, requests.RequestException, CommandError) as error:
                failures.append(operation)
                code = error.response.get("Error", {}).get("Code") if isinstance(error, ClientError) else type(error).__name__
                self.stdout.write(f"{operation}: FAIL ({code})")
                return None
            self.stdout.write(f"{operation}: PASS")
            return result

        def private_read():
            with default_storage.open(saved_key, "rb") as image:
                return image.read() == payload

        def public_read():
            response = requests.get(default_storage.url(saved_key), timeout=10, allow_redirects=False)
            return response.status_code == 200 and response.content == payload

        try:
            saved_key = check("PUT", lambda: default_storage.save(key, upload))
            if saved_key:
                check("HEAD", lambda: default_storage.exists(saved_key))
                check("GET", private_read)
                check("PUBLIC_GET", public_read)
        finally:
            if saved_key:
                check("DELETE", lambda: default_storage.delete(saved_key))
        if failures:
            raise CommandError("Media storage diagnostic failed: " + ", ".join(failures))
