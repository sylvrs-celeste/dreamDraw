"""Entry CRUD.

Reads are public and addressed by slug; writes require a session and are
addressed by id. That split is deliberate: slugs are for humans and can change
hands if an entry is renamed, whereas an id is stable and is what the admin UI
already holds.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.deps import require_session
from app.models import Entry, Tag
from app.schemas.entry import (
    EntryCreate,
    EntryDetail,
    EntryPage,
    EntrySummary,
    EntryUpdate,
)
from app.services.slugs import unique_entry_slug
from app.services.tags import resolve_tags

router = APIRouter(prefix="/entries", tags=["entries"])


async def _get_by_id(session: AsyncSession, entry_id: uuid.UUID) -> Entry:
    entry = await session.get(Entry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


@router.get("", response_model=EntryPage)
async def list_entries(
    session: AsyncSession = Depends(get_session),
    tag: str | None = Query(default=None, description="Filter by tag slug"),
    sort: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    per_page: int | None = Query(default=None, ge=1),
) -> EntryPage:
    per_page = min(per_page or settings.default_page_size, settings.max_page_size)

    filters = []
    if tag:
        # EXISTS rather than a join: a join would multiply rows when an entry
        # carries several tags, and break both LIMIT and the count.
        filters.append(Entry.tags.any(Tag.slug == tag))

    total = await session.scalar(
        select(func.count()).select_from(Entry).where(*filters)
    )

    order = Entry.art_date.asc() if sort == "asc" else Entry.art_date.desc()
    stmt = (
        select(Entry)
        .where(*filters)
        # art_date is only a date, so same-day entries would otherwise come
        # back in arbitrary order and appear to shuffle between pages.
        .order_by(order, Entry.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    entries = (await session.execute(stmt)).scalars().all()

    return EntryPage(
        items=[EntrySummary.model_validate(e) for e in entries],
        total=total or 0,
        page=page,
        per_page=per_page,
        has_next=(page * per_page) < (total or 0),
    )


@router.get("/{slug}", response_model=EntryDetail)
async def get_entry(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> EntryDetail:
    entry = await session.scalar(select(Entry).where(Entry.slug == slug))
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return EntryDetail.model_validate(entry)


@router.post("", response_model=EntryDetail, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: EntryCreate,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> EntryDetail:
    """Metadata only. Images are attached afterwards, via the upload route."""
    entry = Entry(
        title=payload.title,
        slug=await unique_entry_slug(session, payload.title),
        description=payload.description,
        art_date=payload.art_date,
    )
    entry.tags = await resolve_tags(session, payload.tags)

    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return EntryDetail.model_validate(entry)


@router.patch("/{entry_id}", response_model=EntryDetail)
async def update_entry(
    entry_id: uuid.UUID,
    payload: EntryUpdate,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> EntryDetail:
    entry = await _get_by_id(session, entry_id)
    fields = payload.model_dump(exclude_unset=True)

    if "title" in fields:
        entry.title = fields["title"]
        # Note the slug is not touched here. Once an entry has been linked or
        # shared, quietly changing its address breaks that link, and there is
        # no redirect layer to soften it. Renaming should be safe to do.

    # ...but an explicit slug in the payload is a deliberate act, so honour it.
    # null means "rebuild from the title", which is the escape hatch for an
    # entry created with a title that was wrong at the time.
    if "slug" in fields:
        source = fields["slug"] or fields.get("title") or entry.title
        entry.slug = await unique_entry_slug(session, source, exclude_id=entry.id)

    if "art_date" in fields:
        entry.art_date = fields["art_date"]

    if "description" in fields:
        entry.description = fields["description"]

    if "tags" in fields and fields["tags"] is not None:
        entry.tags = await resolve_tags(session, fields["tags"])

    if "cover_image_id" in fields:
        cover_id = fields["cover_image_id"]
        if cover_id is not None:
            # Without this check an entry could point at an image belonging to
            # a different entry, which the FK alone would happily allow.
            if not any(img.id == cover_id for img in entry.images):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Cover image must belong to this entry",
                )
        entry.cover_image_id = cover_id

    await session.commit()
    await session.refresh(entry)
    return EntryDetail.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> Response:
    entry = await _get_by_id(session, entry_id)

    # The cascade clears the image rows, but S3 has no idea any of this
    # happened. Step 5 has to delete the objects here as well, otherwise every
    # deleted entry leaves files in the bucket that nothing will ever
    # reference again. Safe as it stands only because nothing can upload yet.
    await session.delete(entry)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
