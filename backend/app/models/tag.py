"""Tags and the entry <-> tag association table."""

import uuid

from sqlalchemy import Column, ForeignKey, Table, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, uuid_pk

# Plain Core table: the association carries no columns of its own, so there is
# nothing to gain from mapping it to a class.
entry_tags = Table(
    "entry_tags",
    Base.metadata,
    Column(
        "entry_id",
        PGUUID(as_uuid=True),
        ForeignKey("entries.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        PGUUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    # Slug drives both the ?tag= filter and the hashed accent colour, so a tag
    # keeps the same colour everywhere it appears.
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    entries: Mapped[list["Entry"]] = relationship(  # noqa: F821
        secondary=entry_tags,
        back_populates="tags",
    )

    def __repr__(self) -> str:
        return f"<Tag {self.slug}>"
