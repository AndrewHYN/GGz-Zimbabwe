import os

from decouple import config
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a Django superuser from environment variables if it does not already exist."

    def handle(self, *args, **options):
        owner_username = (os.environ.get("DJANGO_PLATFORM_OWNER_USERNAME") or config("DJANGO_PLATFORM_OWNER_USERNAME", default="Hyndrrx")).strip()
        username = (os.environ.get("DJANGO_SUPERUSER_USERNAME") or config("DJANGO_SUPERUSER_USERNAME", default=owner_username)).strip()
        email = (os.environ.get("DJANGO_SUPERUSER_EMAIL") or config("DJANGO_SUPERUSER_EMAIL", default="")).strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD") or config("DJANGO_SUPERUSER_PASSWORD", default="")

        user_model = get_user_model()
        existing_owner = user_model.objects.filter(username__iexact=owner_username).first()
        if existing_owner:
            if not existing_owner.is_superuser or not existing_owner.is_staff:
                existing_owner.is_superuser = True
                existing_owner.is_staff = True
                existing_owner.save(update_fields=("is_superuser", "is_staff"))
            self.stdout.write(self.style.SUCCESS("Platform owner account verified."))
            return

        if not username or not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping superuser creation: DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and DJANGO_SUPERUSER_PASSWORD must all be set."
                )
            )
            return

        if user_model.objects.filter(username__iexact=username).exists():
            self.stdout.write(self.style.SUCCESS("Configured administrator already exists."))
            return

        if user_model.objects.filter(email=email).exists():
            self.stdout.write(self.style.SUCCESS(f"User with email '{email}' already exists; no changes made."))
            return

        user_model.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser '{username}'."))
