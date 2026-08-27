"""Validation and derivative generation for uploaded images."""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

# A file's real type is decided by its first few bytes, never by the filename or
# the Content-Type the browser claims. Both of those are attacker-controlled.
_MAGIC: tuple[tuple[str, int, bytes], ...] = (
    ("image/jpeg", 0, b"\xff\xd8\xff"),
    ("image/png", 0, b"\x89PNG\r\n\x1a\n"),
    # WebP is a RIFF container: "RIFF" then 4 size bytes then "WEBP".
    ("image/webp", 8, b"WEBP"),
)

_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Pillow's own guard is ~89M pixels and only warns. A 25 MB PNG can hold far
# more than that once decompressed, so cap it explicitly and treat a breach as
# a rejected upload rather than a memory spike on a 2 GB instance.
Image.MAX_IMAGE_PIXELS = 80_000_000


class InvalidImage(Exception):
    """Upload is not an image we accept, or cannot be decoded."""


@dataclass(frozen=True)
class Derivative:
    data: bytes
    width: int
    height: int


@dataclass(frozen=True)
class ProcessedImage:
    mime_type: str
    extension: str
    original: bytes
    width: int
    height: int
    medium: Derivative
    thumb: Derivative


def sniff_mime(data: bytes) -> str | None:
    """Identify a file from its magic bytes, or None if it isn't one of ours."""
    for mime, offset, signature in _MAGIC:
        if data[offset : offset + len(signature)] == signature:
            return mime
    return None


def _resize(image: Image.Image, max_edge: int) -> Derivative:
    """Fit inside max_edge on the long side, never scaling up.

    A 300px original stays 300px rather than being blown up to 400 and looking
    soft, so a small upload just produces a small thumbnail.
    """
    copy = image.copy()
    copy.thumbnail((max_edge, max_edge), Image.LANCZOS)

    buffer = io.BytesIO()
    # save() with no exif argument writes none, which is the point: this is
    # where GPS coordinates and camera serial numbers get dropped.
    copy.save(buffer, format="WEBP", quality=settings.webp_quality, method=4)
    return Derivative(buffer.getvalue(), copy.width, copy.height)


def process(data: bytes) -> ProcessedImage:
    """Validate an upload and build its derivatives.

    The original is returned byte-for-byte as uploaded, EXIF and all. Only the
    derivatives are stripped, since those are the ones served publicly.
    """
    if len(data) > settings.max_upload_bytes:
        raise InvalidImage(
            f"File is larger than {settings.max_upload_bytes // (1024 * 1024)} MB"
        )

    mime = sniff_mime(data)
    if mime is None or mime not in settings.allowed_mime_types:
        raise InvalidImage("File is not a JPEG, PNG or WebP")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Image.DecompressionBombError as exc:
        raise InvalidImage("Image dimensions are unreasonably large") from exc
    except (UnidentifiedImageError, OSError) as exc:
        # Right magic bytes, unreadable body. Truncated upload, usually.
        raise InvalidImage("Image could not be decoded") from exc

    # Order matters. Rotating first bakes the correct orientation into the
    # pixels; stripping first would throw away the tag and leave every phone
    # photo lying on its side.
    image = ImageOps.exif_transpose(image)

    # WebP has no palette or greyscale-with-alpha mode, and CMYK JPEGs invert
    # if handed over as-is.
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.mode else "RGB")

    return ProcessedImage(
        mime_type=mime,
        extension=_EXTENSION[mime],
        original=data,
        width=image.width,
        height=image.height,
        medium=_resize(image, settings.medium_max_edge),
        thumb=_resize(image, settings.thumb_max_edge),
    )
