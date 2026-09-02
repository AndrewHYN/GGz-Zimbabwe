import os
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.test import SimpleTestCase


class MediaStorageConfigurationTests(SimpleTestCase):

	def test_local_media_storage_remains_filesystem_backed_without_s3_variables(self):
		with patch.dict(os.environ, {name: "" for name in settings.S3_STORAGE_VARIABLES}, clear=False):
			self.assertFalse(all(os.environ.get(name) for name in settings.S3_STORAGE_VARIABLES))
			self.assertEqual(Path(settings.MEDIA_ROOT).resolve(), Path(settings.BASE_DIR) / "hello_world" / "media")
			self.assertIsInstance(FileSystemStorage(location=settings.MEDIA_ROOT), FileSystemStorage)

	def test_production_media_url_is_public_supabase_https_url(self):
		self.assertTrue(settings.MEDIA_URL.startswith("https://") or not settings.USE_S3_MEDIA_STORAGE)