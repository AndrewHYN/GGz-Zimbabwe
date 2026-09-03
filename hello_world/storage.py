import logging
from pathlib import PurePosixPath
from uuid import uuid4

from storages.backends.s3 import S3Storage, clean_name, is_seekable
from storages.utils import ReadBytesWrapper


logger = logging.getLogger(__name__)


def log_s3_client_error(error):
    response = error.response
    error_data = response.get("Error", {})
    metadata = response.get("ResponseMetadata", {})
    logger.error("S3_OPERATION=%s", getattr(error, "operation_name", ""))
    logger.error("S3_ERROR_CODE=%s", error_data.get("Code", ""))
    logger.error("S3_ERROR_MESSAGE=%s", error_data.get("Message", ""))
    logger.error("S3_HTTP_STATUS=%s", metadata.get("HTTPStatusCode", ""))
    logger.error("S3_REQUEST_ID=%s", metadata.get("RequestId", ""))
    logger.error("S3_HOST_ID=%s", metadata.get("HostId", ""))
    logger.error("S3_RETRYABLE=%s", metadata.get("RetryAttempts", 0) > 0)


class SupabaseMediaStorage(S3Storage):
    """Use unique object keys without a permission-sensitive HeadObject check."""

    def _save(self, name, content):
        from storages.backends.s3 import ClientError

        cleaned_name = clean_name(name)
        name = self._normalize_name(cleaned_name)
        params = self._get_write_parameters(name, content)
        if is_seekable(content):
            content.seek(0)
        content = ReadBytesWrapper(content)
        obj = self.bucket.Object(name)
        logger.info(
            "S3_PUT_TARGET bucket=%s key=%s endpoint_host=%s region=%s addressing_style=%s signature_version=%s",
            self.bucket_name,
            name,
            self.endpoint_url.split("//", 1)[-1].split("/", 1)[0],
            self.region_name,
            self.addressing_style,
            self.signature_version,
        )
        original_close = content.close
        content.close = lambda: None
        try:
            try:
                obj.upload_fileobj(content, ExtraArgs=params, Config=self.transfer_config)
            except ClientError as error:
                log_s3_client_error(error)
                raise
        finally:
            content.close = original_close
        return cleaned_name

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