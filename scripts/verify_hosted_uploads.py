import os
from io import BytesIO
from secrets import token_urlsafe
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

import django
import requests
from PIL import Image

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hello_world.settings")
django.setup()

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.core.files.storage import default_storage
from django.db import connection, transaction
from accounts.models import GamerProfile, Post

ORIGIN = "https://ggz-frontend.vercel.app"

if os.environ.get("VERCEL_ENV") != "production" or connection.vendor != "postgresql":
    raise SystemExit("GGz hosted verification requires the production Django deployment.")
if settings.FRONTEND_URL.rstrip("/") != ORIGIN or not settings.USE_S3_MEDIA_STORAGE:
    raise SystemExit("GGz hosted verification requires the canonical frontend and persistent media.")

class CheckFailed(Exception):
    pass

def expect(response, status, label):
    if response.status_code != status:
        raise CheckFailed(f"{label} returned HTTP {response.status_code}.")
    return response

def verify_bytes(url, payload, label):
    target = urlsplit(urljoin(ORIGIN, url))
    storage = urlsplit(settings.MEDIA_URL)
    if target.scheme != "https" or target.netloc != storage.netloc or not target.path.startswith(storage.path):
        raise CheckFailed(f"{label} returned an unexpected media origin.")
    response = expect(requests.get(target.geturl(), timeout=15, allow_redirects=False), 200, label)
    if response.content != payload or "image/png" not in response.headers.get("content-type", ""):
        raise CheckFailed(f"{label} returned different image bytes.")

def verify():
    identity = "GGzQA" + uuid4().hex[:14]
    password = token_urlsafe(32)
    buffer = BytesIO()
    Image.new("RGB", (8, 8), "#ecaa40").save(buffer, format="PNG")
    payload = buffer.getvalue()
    user = None
    session_key = None
    with requests.Session() as http:
        http.headers.update({"X-Requested-With": "XMLHttpRequest", "Origin": ORIGIN, "Referer": ORIGIN + "/"})
        def post(path, status, label, **kwargs):
            token = http.cookies.get("csrftoken")
            if not token:
                raise CheckFailed("The canonical frontend did not set a CSRF cookie.")
            return expect(http.post(ORIGIN + path, headers={"X-CSRFToken": token}, timeout=20,
                allow_redirects=False, **kwargs), status, label)
        def image_file(kind):
            return (identity + "-" + kind + ".png", payload, "image/png")
        try:
            ready = expect(http.get(ORIGIN + "/api/ready/", timeout=15, allow_redirects=False), 200, "Frontend readiness")
            if ready.json().get("status") != "ready":
                raise CheckFailed("The frontend readiness payload was unexpected.")
            with transaction.atomic():
                user = User.objects.create_user(username=identity, password=password)
                profile = GamerProfile.objects.create(user=user, gamer_tag=identity)
            expect(http.get(ORIGIN + "/api/csrf/", timeout=15, allow_redirects=False), 200, "CSRF bootstrap")
            post("/api/auth/login/", 200, "Canonical login", json={"username": identity, "password": password})
            session_key = http.cookies.get("sessionid")
            if not session_key:
                raise CheckFailed("Canonical login did not establish a session.")
            path = "/api/profiles/" + identity + "/media/"
            for field in ("avatar", "cover"):
                post(path, 200, field + " upload", files={field: image_file(field)})
            guest_profile = expect(requests.get(ORIGIN + "/api/profiles/detail/" + identity + "/",
                timeout=15, allow_redirects=False), 200, "Fresh public profile").json()
            for field in ("avatar", "cover"):
                verify_bytes(guest_profile[field], payload, field + " public read")
            result = post("/api/feed/create/", 201, "Feed upload", data={"body": "Temporary GGz release verification"},
                files={"image": image_file("feed")}).json()
            entry = Post.objects.get(pk=result["id"], author=profile)
            verify_bytes(entry.image.url, payload, "Feed image public read")
            print("GGz hosted CSRF, sign-in, avatar, cover, and feed upload/read passed.", flush=True)
        finally:
            if user and User.objects.filter(pk=user.pk, username=identity).exists():
                profile = GamerProfile.objects.filter(user=user).first()
                keys = []
                if profile:
                    keys.extend(image.name for image in (profile.avatar, profile.cover) if image)
                    keys.extend(profile.posts.exclude(image="").values_list("image", flat=True))
                if session_key:
                    Session.objects.filter(session_key=session_key).delete()
                user.delete()
                for key in keys:
                    if key and identity in key:
                        default_storage.delete(key)
                print("GGz hosted verification records and images removed.", flush=True)

try:
    verify()
except CheckFailed as error:
    raise SystemExit(str(error)) from None
except Exception as error:
    raise SystemExit("GGz hosted verification stopped at " + type(error).__name__) from None
