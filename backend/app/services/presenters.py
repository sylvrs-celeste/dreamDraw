"""Turning ORM rows into response models.

Kept out of the schemas because building a presigned URL is an S3 call, and
importing storage from a Pydantic model would tangle the two together.
"""

from app.models import Entry, Image
from app.schemas.entry import EntryDetail, EntrySummary, ImageRead, TagRead
from app.services import storage


def image_read(image: Image) -> ImageRead:
    return ImageRead(
        id=image.id,
        alt_text=image.alt_text,
        sort_order=image.sort_order,
        url_thumb=storage.presigned_url(image.s3_key_thumb),
        url_medium=storage.presigned_url(image.s3_key_medium),
        width=image.width,
        height=image.height,
        mime_type=image.mime_type,
    )


def _cover(entry: Entry) -> Image | None:
    """The chosen cover, else the first image, else nothing.

    Falling back rather than returning null keeps the gallery from showing a
    hole for an entry that has images but no cover explicitly set.
    """
    if entry.cover_image is not None:
        return entry.cover_image
    return entry.images[0] if entry.images else None


def entry_summary(entry: Entry) -> EntrySummary:
    cover = _cover(entry)
    return EntrySummary(
        id=entry.id,
        title=entry.title,
        slug=entry.slug,
        art_date=entry.art_date,
        tags=[TagRead.model_validate(t) for t in entry.tags],
        cover_image=image_read(cover) if cover else None,
    )


def entry_detail(entry: Entry) -> EntryDetail:
    cover = _cover(entry)
    return EntryDetail(
        id=entry.id,
        title=entry.title,
        slug=entry.slug,
        art_date=entry.art_date,
        description=entry.description,
        tags=[TagRead.model_validate(t) for t in entry.tags],
        cover_image=image_read(cover) if cover else None,
        images=[image_read(i) for i in entry.images],
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )
