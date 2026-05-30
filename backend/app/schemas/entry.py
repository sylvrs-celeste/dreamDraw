"""Request and response models for entries, tags and images."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class TagWithCount(TagRead):
    entry_count: int


class ImageRead(BaseModel):
    """What the browser gets for one image.

    S3 keys never appear here. The urls are presigned and expire after an hour,
    so anything caching this response must expire sooner.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alt_text: str | None
    sort_order: int
    url_thumb: str
    url_medium: str
    # The gallery reserves space from this ratio so the masonry doesn't reflow
    # as images arrive.
    width: int
    height: int
    mime_type: str


class EntryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    art_date: date
    description: str | None = Field(default=None, max_length=5000)


class EntryCreate(EntryBase):
    # Tag names as typed by the owner. Slugs are derived, and tags that don't
    # exist yet are created on the way through.
    tags: list[str] = Field(default_factory=list, max_length=20)


class EntryUpdate(BaseModel):
    """Every field optional. Omitting one leaves it alone; passing null on a
    nullable field clears it.
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    art_date: date | None = None
    description: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=20)
    cover_image_id: uuid.UUID | None = None

    # Renaming an entry leaves its slug alone, so this is the way to correct
    # one. Whatever is passed gets slugified, so "Winter Studies" and
    # "winter-studies" both arrive as the same thing. Passing null instead
    # rebuilds it from the current title.
    slug: str | None = Field(default=None, max_length=200)


class EntrySummary(BaseModel):
    """List representation. Carries just enough to render one polaroid."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    art_date: date
    tags: list[TagRead]
    cover_image: ImageRead | None


class EntryDetail(EntrySummary):
    description: str | None
    images: list[ImageRead]
    created_at: datetime
    updated_at: datetime

    # Named by direction rather than prev/next, which flips meaning depending
    # on which way the gallery happens to be sorted.
    newer_slug: str | None = None
    older_slug: str | None = None


class EntryPage(BaseModel):
    items: list[EntrySummary]
    total: int
    page: int
    per_page: int
    has_next: bool


class ImageUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=500)
    sort_order: int | None = Field(default=None, ge=0)


class UploadFailure(BaseModel):
    filename: str
    error: str


class UploadResult(BaseModel):
    """One bad file in a drop of twenty should not lose the other nineteen,
    so failures are reported alongside whatever did make it."""

    uploaded: list[ImageRead]
    failed: list[UploadFailure]
