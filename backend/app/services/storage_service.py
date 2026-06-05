"""
Storage Service — wraps Supabase Storage for image uploads.
"""
import logging
import mimetypes
import os
import uuid
from typing import Optional

from app.models.database import get_supabase

logger = logging.getLogger(__name__)

DISEASE_BUCKET = "disease-images"


def _safe_extension(filename: Optional[str], content_type: Optional[str]) -> str:
    """Pick a safe lowercase extension from the filename or content type."""
    if filename:
        _, ext = os.path.splitext(filename)
        ext = ext.lower().lstrip(".")
        if ext in {"jpg", "jpeg", "png", "webp"}:
            return ext
    if content_type:
        guess = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guess:
            return guess.lower().lstrip(".")
    return "jpg"


def upload_disease_image(
    user_id: str,
    image_bytes: bytes,
    content_type: Optional[str] = None,
    original_filename: Optional[str] = None,
) -> str:
    """
    Upload a disease leaf image. Returns the public URL, or "" if upload fails.
    Filename is randomized via uuid4 to avoid collisions and path traversal.
    """
    ext = _safe_extension(original_filename, content_type)
    object_path = f"{user_id}/{uuid.uuid4().hex}.{ext}"

    db = get_supabase()

    try:
        db.storage.from_(DISEASE_BUCKET).upload(
            path=object_path,
            file=image_bytes,
            file_options={"content-type": content_type or "image/jpeg"},
        )
        return db.storage.from_(DISEASE_BUCKET).get_public_url(object_path)
    except Exception as exc:
        logger.warning("Disease image upload failed: %s", exc)
        return ""
