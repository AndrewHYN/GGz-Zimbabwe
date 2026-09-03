from pathlib import PurePosixPath
from uuid import uuid4

from storages.backends.s3 import S3Storage


class SupabaseMediaStorage(S3Storage):
    """Use unique object keys without a permission-sensitive HeadObject check."""

    def get_available_name(self, name, max_length=None):
        path = PurePosixPath(name)
        stem = path.stem or "upload"
        suffix = path.suffix
        directory = str(path.parent)
        unique_name = f"{stem}-{uuid4().hex}{suffix}"
        result = f"{directory}/{unique_name}" if directory != "." else unique_name
        if max_length and len(result) > max_length:
            available_stem_length = max_length - len(suffix) - 33
            if available_stem_length < 1:
                raise ValueError("The uploaded filename is too long.")
            unique_name = f"{stem[:available_stem_length]}-{uuid4().hex}{suffix}"
            result = f"{directory}/{unique_name}" if directory != "." else unique_name
        return result