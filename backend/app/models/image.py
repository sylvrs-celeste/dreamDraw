"""Image — one uploaded collage plus its generated derivatives."""

import uuid

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Image(Base, TimestampMixin):
    __tablename__ = "images"

    id: Mapped[uuid.UUID] = uuid_pk()
    entry_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("entries.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Keys are built from UUIDs, never from the uploaded filename.
    # Worth remembering: the cascade above only removes these rows. S3 knows
    # nothing about it, so delete routes have to clean up the objects too or
    # the bucket slowly fills with files nothing references.
    s3_key_original: Mapped[str] = mapped_column(Text, nullable=False)
    s3_key_medium: Mapped[str] = mapped_column(Text, nullable=False)
    s3_key_thumb: Mapped[str] = mapped_column(Text, nullable=False)

    # Size of the original once EXIF rotation has been applied. The gallery
    # uses the ratio to reserve space before the image finishes loading.
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    entry: Mapped["Entry"] = relationship(  # noqa: F821
        back_populates="images",
        foreign_keys=[entry_id],
    )

    __table_args__ = (Index("ix_images_entry_id_sort_order", "entry_id", "sort_order"),)

    def __repr__(self) -> str:
        return f"<Image {self.id} entry={self.entry_id} order={self.sort_order}>"
