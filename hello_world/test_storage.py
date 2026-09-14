import os
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from botocore.exceptions import ClientError
from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from storages.backends.s3 import S3Storage

from accounts.models import GamerProfile
from .storage import SupabaseMediaStorage


class MediaStorageConfigurationTests(SimpleTestCase):

	def test_local_media_storage_remains_filesystem_backed_without_s3_variables(self):
		with patch.dict(os.environ, {name: "" for name in settings.S3_STORAGE_VARIABLES}, clear=False):
			self.assertFalse(all(os.environ.get(name) for name in settings.S3_STORAGE_VARIABLES))
			self.assertEqual(Path(settings.MEDIA_ROOT).resolve(), Path(settings.BASE_DIR) / "hello_world" / "media")
			self.assertIsInstance(FileSystemStorage(location=settings.MEDIA_ROOT), FileSystemStorage)

	def test_production_media_url_is_public_supabase_https_url(self):
		self.assertTrue(settings.MEDIA_URL.startswith("https://") or not settings.USE_S3_MEDIA_STORAGE)

	def test_supabase_storage_does_not_probe_head_object_for_unique_name(self):
		storage = SupabaseMediaStorage()
		with patch.object(storage, "exists", side_effect=AssertionError("HeadObject must not be called")):
			first = storage.get_available_name("avatars/player.jpg")
			second = storage.get_available_name("avatars/player.jpg")

		self.assertNotEqual(first, second)
		self.assertEqual(Path(first).suffix, ".jpg")
		UUID(Path(first).stem.rsplit("-", 1)[1])

	def test_supabase_storage_uses_path_style_sigv4_configuration(self):
		storage = SupabaseMediaStorage(
			endpoint_url="https://urwolkhnjkbmblfqinlf.storage.supabase.co/storage/v1/s3",
			region_name="eu-west-1",
			bucket_name="ggz-media",
			access_key="test-access-key",
			secret_key="test-secret-key",
			addressing_style="path",
			signature_version="s3v4",
		)
		self.assertEqual(storage.addressing_style, "path")
		self.assertEqual(storage.signature_version, "s3v4")
		self.assertEqual(storage.bucket_name, "ggz-media")
		self.assertEqual(storage.region_name, "eu-west-1")

	def test_standard_s3_storage_re_raises_head_object_403(self):
		storage = S3Storage()
		error = ClientError(
			{"Error": {"Code": "403", "Message": "Forbidden"}, "ResponseMetadata": {"HTTPStatusCode": 403}},
			"HeadObject",
		)
		with patch.object(storage.connection.meta.client, "head_object", side_effect=error):
			with self.assertRaises(ClientError):
				storage.exists("avatars/player.jpg")


class MediaUrlContractTests(SimpleTestCase):

	def test_filesystem_media_url_is_root_relative(self):
		if not settings.USE_S3_MEDIA_STORAGE:
			self.assertTrue(settings.MEDIA_URL.startswith("/"))
			self.assertTrue(settings.MEDIA_URL.endswith("/"))

	def test_filesystem_static_url_is_root_relative(self):
		self.assertTrue(settings.STATIC_URL.startswith("/"))


class MediaRenderingTests(TestCase):

	def setUp(self):
		self.user = User.objects.create_user(username="mediatag", password="x")
		self.profile, _ = GamerProfile.objects.get_or_create(
			user=self.user,
			defaults={
				"gamer_tag": "mediatag",
				"location_public": False,
				"rank": "unranked",
				"availability": "weekends",
				"tournament_wins": 0,
			},
		)
		self.client.force_login(self.user)

	def test_empty_avatar_never_renders_bare_media_url(self):
		self.profile.avatar.delete(save=True)
		for url_name in ("dashboard", "leaderboard"):
			response = self.client.get(reverse(url_name))
			self.assertEqual(response.status_code, 200)
			self.assertNotIn('src="/media/"', response.content.decode())

	def test_default_avatar_url_resolves_to_media_root_file(self):
		from django.core.files.base import ContentFile

		self.profile.avatar.save("probe.png", ContentFile(b"not-a-real-image"), save=True)
		response = self.client.get(reverse("dashboard"))
		self.assertEqual(response.status_code, 200)
		self.assertIn(self.profile.avatar.url, response.content.decode())

	def test_filesystem_media_route_serves_existing_file_when_not_s3(self):
		if settings.USE_S3_MEDIA_STORAGE:
			self.skipTest("S3 media storage enabled in this environment")
		import gc
		import tempfile

		with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
			name = "sub/probe.txt"
			probe = Path(tmp) / name
			probe.parent.mkdir(parents=True, exist_ok=True)
			probe.write_text("GGz media route probe", encoding="utf-8")
			with override_settings(
				DEBUG=False,
				ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
				MEDIA_ROOT=tmp,
			):
				response = self.client.get(f"{settings.MEDIA_URL}{name}")
			self.assertEqual(response.status_code, 200)
			body = b"".join(response.streaming_content)
			self.assertEqual(body.decode(), "GGz media route probe")
			response.close()
			del response
			gc.collect()