"""Entry CRUD.

Reads are public and addressed by slug; writes require a session and are
addressed by id. That split is deliberate: slugs are for humans and can change
hands if an entry is renamed, whereas an id is stable and is what the admin UI
already holds.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.deps import require_session
from app.models import Entry, Image, Tag
from app.schemas.entry import (
    EntryCreate,
    EntryDetail,
    EntryPage,
    EntryUpdate,
    UploadFailure,
    UploadResult,
)
from app.services import storage
from app.services.images import InvalidImage, process
from app.services.presenters import entry_detail, entry_summary, image_read
from app.services.slugs import unique_entry_slug
from app.services.tags import delete_orphan_tags, resolve_tags

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
        items=[entry_summary(e) for e in entries],
        total=total or 0,
        page=page,
        per_page=per_page,
        has_next=(page * per_page) < (total or 0),
    )


async def _neighbour(session: AsyncSession, entry: Entry, *, newer: bool) -> str | None:
    """Slug of the adjacent entry by art date.

    Ties on art_date are broken by created_at, matching how the gallery orders
    its list -- otherwise stepping through entries could loop between two
    pieces made on the same day.
    """
    key = (Entry.art_date, Entry.created_at)
    here = (entry.art_date, entry.created_at)
    if newer:
        return await session.scalar(
            select(Entry.slug)
            .where(tuple_(*key) > tuple_(*here))
            .order_by(Entry.art_date.asc(), Entry.created_at.asc())
            .limit(1)
        )
    return await session.scalar(
        select(Entry.slug)
        .where(tuple_(*key) < tuple_(*here))
        .order_by(Entry.art_date.desc(), Entry.created_at.desc())
        .limit(1)
    )


@router.get("/{slug}", response_model=EntryDetail)
async def get_entry(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> EntryDetail:
    entry = await session.scalar(select(Entry).where(Entry.slug == slug))
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry_detail(
        entry,
        newer_slug=await _neighbour(session, entry, newer=True),
        older_slug=await _neighbour(session, entry, newer=False),
    )


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
    return entry_detail(entry)


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
        await session.flush()
        await delete_orphan_tags(session)

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
    return entry_detail(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> Response:
    entry = await _get_by_id(session, entry_id)

    # Collect the keys before the cascade takes the rows away.
    keys = [
        k
        for image in entry.images
        for k in (image.s3_key_original, image.s3_key_medium, image.s3_key_thumb)
    ]

    await session.delete(entry)
    await session.flush()
    await delete_orphan_tags(session)
    await session.commit()

    await run_in_threadpool(storage.delete_many, keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{entry_id}/images",
    response_model=UploadResult,
    status_code=status.HTTP_201_CREATED,
)
async def upload_images(
    entry_id: uuid.UUID,
    files: list[UploadFile],
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> UploadResult:
    entry = await _get_by_id(session, entry_id)

    existing = len(entry.images)
    if existing + len(files) > settings.max_files_per_entry:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"An entry can hold {settings.max_files_per_entry} images; "
            f"this one already has {existing}",
        )

    next_order = max((i.sort_order for i in entry.images), default=-1) + 1
    uploaded: list[Image] = []
    failed: list[UploadFailure] = []

    for file in files:
        name = file.filename or "unnamed"
        raw = await file.read()
        try:
            # Pillow is CPU-bound and boto3 blocks. On the event loop a 25 MB
            # upload would stall every other request, health checks included.
            processed = await run_in_threadpool(process, raw)
        except InvalidImage as exc:
            failed.append(UploadFailure(filename=name, error=str(exc)))
            continue

        image_id = uuid.uuid4()
        keys = storage.build_keys(entry.id, image_id, processed.extension)

        try:
            await run_in_threadpool(
                storage.put, keys["original"], processed.original, processed.mime_type
            )
            await run_in_threadpool(
                storage.put, keys["medium"], processed.medium.data, "image/webp"
            )
            await run_in_threadpool(
                storage.put, keys["thumb"], processed.thumb.data, "image/webp"
            )
        except storage.StorageError as exc:
            # Don't leave half an image in the bucket for a row that will
            # never exist.
            await run_in_threadpool(storage.delete_many, list(keys.values()))
            failed.append(UploadFailure(filename=name, error=str(exc)))
            continue

        image = Image(
            id=image_id,
            entry_id=entry.id,
            s3_key_original=keys["original"],
            s3_key_medium=keys["medium"],
            s3_key_thumb=keys["thumb"],
            width=processed.width,
            height=processed.height,
            mime_type=processed.mime_type,
            size_bytes=len(processed.original),
            sort_order=next_order,
        )
        session.add(image)
        uploaded.append(image)
        next_order += 1

    await session.flush()

    # First image to arrive becomes the cover unless one was already picked.
    if entry.cover_image_id is None and uploaded:
        entry.cover_image_id = uploaded[0].id

    await session.commit()
    for image in uploaded:
        await session.refresh(image)

    return UploadResult(
        uploaded=[image_read(i) for i in uploaded], failed=failed
    )
