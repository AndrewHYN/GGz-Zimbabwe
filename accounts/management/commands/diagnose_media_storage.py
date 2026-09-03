from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from botocore.exceptions import ClientError

from hello_world.storage import log_s3_client_error


class Command(BaseCommand):
    help = "Run a safe PUT, HEAD, GET, and DELETE check against configured media storage."

    def handle(self, *args, **options):
        if not settings.USE_S3_MEDIA_STORAGE:
            raise CommandError("Persistent media storage is not configured.")

        name = "_ggz_storage_diagnostic/test.txt"
        payload = b"GGz storage diagnostic"
        results = {}

        try:
            default_storage.save(name, ContentFile(payload))
            results["PUT"] = None
        except ClientError as error:
            results["PUT"] = error

        try:
            results["HEAD"] = None if default_storage.exists(name) else CommandError("object does not exist")
        except ClientError as error:
            results["HEAD"] = error

        try:
            with default_storage.open(name, "rb") as stored_file:
                results["GET"] = None if stored_file.read() == payload else CommandError("content mismatch")
        except ClientError as error:
            results["GET"] = error

        try:
            default_storage.delete(name)
            results["DELETE"] = None
        except ClientError as error:
            results["DELETE"] = error

        for operation in ("PUT", "HEAD", "GET", "DELETE"):
            error = results[operation]
            self.stdout.write(f"{operation}: {'PASS' if error is None else 'FAIL'}")
            if error is not None:
                if isinstance(error, ClientError):
                    response = error.response
                    error_data = response.get("Error", {})
                    metadata = response.get("ResponseMetadata", {})
                    self.stdout.write(f"{operation}_ERROR_CODE: {error_data.get('Code', '')}")
                    self.stdout.write(f"{operation}_ERROR_MESSAGE: {error_data.get('Message', '')}")
                    self.stdout.write(f"{operation}_HTTP_STATUS: {metadata.get('HTTPStatusCode', '')}")
                    log_s3_client_error(error)
                else:
                    self.stdout.write(f"{operation}_ERROR_CODE: ")
                    self.stdout.write(f"{operation}_ERROR_MESSAGE: {error}")
                    self.stdout.write(f"{operation}_HTTP_STATUS: ")
            else:
                self.stdout.write(f"{operation}_ERROR_CODE: ")
                self.stdout.write(f"{operation}_ERROR_MESSAGE: ")
                self.stdout.write(f"{operation}_HTTP_STATUS: ")

        if any(results.values()):
            raise CommandError("Media storage diagnostic failed.")