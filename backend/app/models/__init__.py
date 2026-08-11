"""SQLAlchemy models.

Every model must be imported here. Alembic's autogenerate only sees tables
that have been registered on Base.metadata by import time.
"""

from app.models.base import Base
from app.models.entry import Entry
from app.models.image import Image
from app.models.tag import Tag, entry_tags

__all__ = ["Base", "Entry", "Image", "Tag", "entry_tags"]
