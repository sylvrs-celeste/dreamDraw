"""Tag listing for the filter tray."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Tag, entry_tags
from app.schemas.entry import TagWithCount

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagWithCount])
async def list_tags(session: AsyncSession = Depends(get_session)) -> list[TagWithCount]:
    """Every tag with how many entries use it.

    Outer join so a tag that has lost all its entries still comes back, with a
    count of zero, rather than vanishing from the filter tray.
    """
    stmt = (
        select(Tag, func.count(entry_tags.c.entry_id).label("entry_count"))
        .outerjoin(entry_tags, Tag.id == entry_tags.c.tag_id)
        .group_by(Tag.id)
        .order_by(Tag.name)
    )
    rows = await session.execute(stmt)
    return [
        TagWithCount(id=tag.id, name=tag.name, slug=tag.slug, entry_count=count)
        for tag, count in rows.all()
    ]
