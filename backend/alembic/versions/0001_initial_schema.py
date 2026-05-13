"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-08-11 11:36:14.953974
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # entries.cover_image_id and images.entry_id reference each other, so
    # whichever table goes first can't carry its constraint yet.
    #
    # The model sets use_alter=True for this, but that flag doesn't survive
    # autogenerate: Alembic renders create_table without the constraint and
    # never emits the follow-up ALTER, so the FK just quietly goes missing.
    # Hence the explicit create_foreign_key at the end of this function.
    op.create_table('entries',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('slug', sa.Text(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('art_date', sa.Date(), nullable=False),
    sa.Column('cover_image_id', sa.UUID(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_entries')),
    sa.UniqueConstraint('slug', name=op.f('uq_entries_slug'))
    )
    op.create_index('ix_entries_art_date', 'entries', [sa.text('art_date DESC')], unique=False)
    op.create_table('tags',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('slug', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tags')),
    sa.UniqueConstraint('name', name=op.f('uq_tags_name')),
    sa.UniqueConstraint('slug', name=op.f('uq_tags_slug'))
    )
    op.create_table('entry_tags',
    sa.Column('entry_id', sa.UUID(), nullable=False),
    sa.Column('tag_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['entry_id'], ['entries.id'], name=op.f('fk_entry_tags_entry_id'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name=op.f('fk_entry_tags_tag_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('entry_id', 'tag_id', name=op.f('pk_entry_tags'))
    )
    op.create_table('images',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('entry_id', sa.UUID(), nullable=False),
    sa.Column('s3_key_original', sa.Text(), nullable=False),
    sa.Column('s3_key_medium', sa.Text(), nullable=False),
    sa.Column('s3_key_thumb', sa.Text(), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('mime_type', sa.Text(), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('alt_text', sa.Text(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['entry_id'], ['entries.id'], name=op.f('fk_images_entry_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_images'))
    )
    op.create_index('ix_images_entry_id_sort_order', 'images', ['entry_id', 'sort_order'], unique=False)

    # Closes the cycle. SET NULL rather than CASCADE: removing the image that
    # happened to be the cover must not delete the entry itself.
    op.create_foreign_key(
        'fk_entries_cover_image_id',
        'entries',
        'images',
        ['cover_image_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # Must drop first — images cannot be dropped while entries still points at it.
    op.drop_constraint('fk_entries_cover_image_id', 'entries', type_='foreignkey')

    op.drop_index('ix_images_entry_id_sort_order', table_name='images')
    op.drop_table('images')
    op.drop_table('entry_tags')
    op.drop_table('tags')
    op.drop_index('ix_entries_art_date', table_name='entries')
    op.drop_table('entries')
