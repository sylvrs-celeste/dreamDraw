"""Health check — the ALB target group polls this."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Liveness, including a real query against Postgres.

    The round trip is on purpose. If this returned 200 while the database was
    unreachable, the target group would happily keep sending traffic to an
    instance that can't serve a single page.
    """
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
