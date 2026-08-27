"""Turning typed tag names into Tag rows."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Tag
from app.services.slugs import to_slug


async def resolve_tags(session: AsyncSession, names: list[str]) -> list[Tag]:
    """Map tag names to rows, creating any that don't exist yet.

    Matching is done on the slug, so "Mixed Media", "mixed media" and
    "mixed-media" all land on the same tag rather than three near-duplicates.
    The first spelling to arrive is the one whose display name sticks.
    """
    wanted: dict[str, str] = {}
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        wanted.setdefault(to_slug(name), name)

    if not wanted:
        return []

    existing = (
        await session.execute(select(Tag).where(Tag.slug.in_(wanted.keys())))
    ).scalars().all()

    tags = list(existing)
    found = {tag.slug for tag in existing}

    for slug, name in wanted.items():
        if slug not in found:
            tag = Tag(name=name, slug=slug)
            session.add(tag)
            tags.append(tag)

    # Flush so newly created tags have ids before they're associated with an
    # entry in the same transaction.
    await session.flush()
    return tags


async def delete_orphan_tags(session: AsyncSession) -> int:
    """Drop tags that no longer belong to any entry.

    Tags get created just by typing them, so retagging or deleting an entry
    tends to leave strays behind. Left alone they pile up in the filter tray as
    buttons that lead to an empty gallery.

    Call after the change is flushed, or the rows being removed will still look
    attached.
    """
    from sqlalchemy import delete

    from app.models import entry_tags

    used = select(entry_tags.c.tag_id)
    result = await session.execute(delete(Tag).where(Tag.id.not_in(used)))
    return result.rowcount or 0
