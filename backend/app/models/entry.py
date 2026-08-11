"""Entry — one unit of the art journey."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk
from app.models.tag import entry_tags


class Entry(Base, TimestampMixin):
    __tablename__ = "entries"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # When the work was made, which the owner picks. Not the same thing as
    # created_at, and it's what the gallery sorts and groups by.
    art_date: Mapped[date] = mapped_column(Date, nullable=False)

    # This and images.entry_id point at each other, so one of them has to be
    # added after both tables exist. Note that use_alter only helps create_all;
    # migration 0001 has to add this constraint by hand.
    cover_image_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "images.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_entries_cover_image_id",
        ),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Both relationships need an explicit foreign_keys. There are two FK paths
    # between entries and images, and SQLAlchemy won't guess which is which.
    images: Mapped[list["Image"]] = relationship(  # noqa: F821
        back_populates="entry",
        foreign_keys="Image.entry_id",
        cascade="all, delete-orphan",
        order_by="Image.sort_order",
        lazy="selectin",
    )

    # post_update splits the insert in two: write the entry, then come back and
    # set the cover once the image row is actually there.
    cover_image: Mapped["Image | None"] = relationship(  # noqa: F821
        foreign_keys=[cover_image_id],
        post_update=True,
        lazy="selectin",
    )

    tags: Mapped[list["Tag"]] = relationship(  # noqa: F821
        secondary=entry_tags,
        back_populates="entries",
        lazy="selectin",
        order_by="Tag.name",
    )

    __table_args__ = (
        # Gallery default ordering is newest-first by art date.
        Index("ix_entries_art_date", text("art_date DESC")),
    )

    def __repr__(self) -> str:
        return f"<Entry {self.slug} {self.art_date}>"
