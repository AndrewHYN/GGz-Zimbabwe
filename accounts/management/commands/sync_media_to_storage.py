import hashlib
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.core.files.storage import default_storage


class Command(BaseCommand):
    help = "Upload local media to the configured persistent storage and verify a new upload."

    def add_arguments(self, parser):
        parser.add_argument(
            "--verify-upload",
            action="store_true",
            help="Perform a temporary upload, read-back, and delete round trip.",
        )

    def handle(self, *args, **options):
        if not settings.USE_S3_MEDIA_STORAGE:
            raise CommandError("Persistent S3 media storage is not configured.")

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.is_dir():
            raise CommandError(f"Local media directory does not exist: {media_root}")

        uploaded = 0
        skipped = 0
        verified = 0
        for path in sorted(file_path for file_path in media_root.rglob("*") if file_path.is_file()):
            name = path.relative_to(media_root).as_posix()
            if default_storage.exists(name):
                skipped += 1
            else:
                with path.open("rb") as media_file:
                    saved_name = default_storage.save(name, File(media_file))
                if saved_name != name:
                    raise CommandError(f"Storage changed media path from {name} to {saved_name}")
                uploaded += 1

            with path.open("rb") as local_file:
                local_digest = hashlib.sha256(local_file.read()).digest()
            with default_storage.open(name, "rb") as remote_file:
                remote_digest = hashlib.sha256(remote_file.read()).digest()
            if local_digest != remote_digest:
                raise CommandError(f"Remote content differs from local media: {name}")
            verified += 1

        if options["verify_upload"]:
            verification_name = "_storage_verification/media-upload-check.txt"
            payload = b"GGz persistent media storage verification"
            if default_storage.exists(verification_name):
                default_storage.delete(verification_name)
            saved_name = default_storage.save(verification_name, ContentFile(payload))
            try:
                with default_storage.open(saved_name, "rb") as uploaded_file:
                    if uploaded_file.read() != payload:
                        raise CommandError("New media upload read-back does not match.")
            finally:
                default_storage.delete(saved_name)

        self.stdout.write(
            self.style.SUCCESS(
                f"Media storage verified: uploaded={uploaded}, skipped={skipped}, verified={verified}, "
                f"new_upload_verified={options['verify_upload']}"
            )
        )
