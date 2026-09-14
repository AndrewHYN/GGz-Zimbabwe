"""Centralized upload validation helpers."""

from django import forms
from django.conf import settings

ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP", "GIF"}
MAX_IMAGE_PIXELS = 24_000_000


def _validated_image(image, field_name="image"):
    """Revalidate an uploaded image before any form/model accepts it.

    Enforces the size cap, verifies the payload with Pillow, rejects content
    that does not decode as a whitelisted image format, and rejects paths that
    would decompress to an unreasonable pixel count. The returned upload still
    carries the original bytes so models store the exact payload.
    """
    from django.core.files.uploadedfile import UploadedFile
    from PIL import Image, UnidentifiedImageError

    if not isinstance(image, UploadedFile):
        return image
    if image.size > settings.MAX_UPLOAD_SIZE:
        raise forms.ValidationError("Images must be 4 MB or smaller.")
    try:
        with Image.open(image) as opened:
            opened.verify()
        image.seek(0)
        with Image.open(image) as opened:
            image_format = (opened.format or "").upper()
            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise forms.ValidationError("Images must be PNG, JPEG, WEBP, or GIF.")
            if opened.width * opened.height > MAX_IMAGE_PIXELS:
                raise forms.ValidationError("Image dimensions are too large.")
        image.seek(0)
    except (UnidentifiedImageError, OSError, ValueError):
        raise forms.ValidationError("Upload a valid image file.")
    return image