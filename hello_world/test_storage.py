import os
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from botocore.exceptions import ClientError
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.test import SimpleTestCase
from storages.backends.s3 import S3Storage

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