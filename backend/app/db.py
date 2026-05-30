"""Async engine and session plumbing."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,
    # This site can sit idle for hours, and stale pooled connections come back
    # dead. pre_ping costs a round trip and saves a lot of confusion.
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # so response serialization can still read the object
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Session dependency. Routes are expected to commit for themselves;
    anything that raises first gets rolled back rather than half-applied.
    """
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
