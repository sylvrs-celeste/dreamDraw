"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import engine
from app.routers import auth, entries, health, images, tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Let the pool close cleanly instead of dropping sockets on Postgres
    # when the container stops.
    await engine.dispose()


app = FastAPI(
    title="dreamDraw API",
    version="0.1.0",
    # Docs are handy locally but there's no reason to publish a map of the
    # write endpoints on a site that's otherwise read-only to the public.
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
    lifespan=lifespan,
)

# Local only. In production the frontend is served from the same CloudFront
# origin as the API, so no cross-origin request is ever made.
if settings.is_dev:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,  # required for the session cookie
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
