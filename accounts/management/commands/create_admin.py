import os

from decouple import config
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a Django superuser from environment variables if it does not already exist."

    def handle(self, *args, **options):
        username = config("DJANGO_SUPERUSER_USERNAME", default="").strip()
        email = config("DJANGO_SUPERUSER_EMAIL", default="").strip()
        password = config("DJANGO_SUPERUSER_PASSWORD", default="")

        if not username or not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping superuser creation: DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and DJANGO_SUPERUSER_PASSWORD must all be set."
                )
            )
            return

        user_model = get_user_model()

        if user_model.objects.filter(username=username).exists():
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' already exists; no changes made."))
            return

        if user_model.objects.filter(email=email).exists():
            self.stdout.write(self.style.SUCCESS(f"User with email '{email}' already exists; no changes made."))
            return

        user_model.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser '{username}'."))
