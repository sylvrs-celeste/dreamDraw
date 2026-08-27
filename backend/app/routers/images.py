"""Per-image edits and deletion."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import require_session
from app.models import Entry, Image
from app.schemas.entry import ImageRead, ImageUpdate
from app.services import storage
from app.services.presenters import image_read

router = APIRouter(prefix="/images", tags=["images"])


async def _get(session: AsyncSession, image_id: uuid.UUID) -> Image:
    image = await session.get(Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    return image


@router.patch("/{image_id}", response_model=ImageRead)
async def update_image(
    image_id: uuid.UUID,
    payload: ImageUpdate,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> ImageRead:
    image = await _get(session, image_id)
    fields = payload.model_dump(exclude_unset=True)

    if "alt_text" in fields:
        image.alt_text = fields["alt_text"]
    if "sort_order" in fields and fields["sort_order"] is not None:
        image.sort_order = fields["sort_order"]

    await session.commit()
    await session.refresh(image)
    return image_read(image)


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _auth: dict = Depends(require_session),
) -> Response:
    image = await _get(session, image_id)
    keys = [image.s3_key_original, image.s3_key_medium, image.s3_key_thumb]
    entry_id = image.entry_id

    # If this was the cover, clear the pointer first. The FK is ON DELETE SET
    # NULL so the database would cope either way, but doing it here means the
    # entry object in this session is correct too.
    entry = await session.get(Entry, entry_id)
    if entry is not None and entry.cover_image_id == image.id:
        entry.cover_image_id = None

    await session.delete(image)
    await session.commit()

    # Objects go after the commit. If S3 fails now we leak files, which is
    # untidy; deleting them first and then failing to commit would leave rows
    # pointing at images that no longer exist, which is worse.
    await run_in_threadpool(storage.delete_many, keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
