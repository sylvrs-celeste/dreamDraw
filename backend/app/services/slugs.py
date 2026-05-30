"""Slug generation for entries and tags."""

from slugify import slugify as _slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Titles like "!!!" or an emoji-only string slugify down to nothing, and an
# empty slug would collide with every other empty one.
FALLBACK_SLUG = "untitled"

MAX_SLUG_LENGTH = 80


def to_slug(value: str) -> str:
    slug = _slugify(value, max_length=MAX_SLUG_LENGTH, word_boundary=True)
    return slug or FALLBACK_SLUG


async def unique_entry_slug(
    session: AsyncSession,
    title: str,
    *,
    exclude_id=None,
) -> str:
    """Slugify a title, adding -2, -3 ... until nothing else is using it.

    Deliberately not a UUID suffix. These end up in the address bar, and
    "winter-studies-2" reads better than "winter-studies-8f3a1c".
    """
    from app.models import Entry  # local import keeps services free of model cycles

    base = to_slug(title)

    stmt = select(Entry.slug).where(Entry.slug.like(f"{base}%"))
    if exclude_id is not None:
        stmt = stmt.where(Entry.id != exclude_id)
    taken = set((await session.execute(stmt)).scalars().all())

    if base not in taken:
        return base

    suffix = 2
    while f"{base}-{suffix}" in taken:
        suffix += 1
    return f"{base}-{suffix}"
