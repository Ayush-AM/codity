"""add_oauth_fields_to_users

Revision ID: e7f8a9b0c1d2
Revises: 74f6f6b57844
Create Date: 2026-08-24 17:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = '74f6f6b57844'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=1024), nullable=True)
    op.add_column('users', sa.Column('oauth_provider', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('oauth_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_oauth_provider'), 'users', ['oauth_provider'], unique=False)
    op.create_index(op.f('ix_users_oauth_id'), 'users', ['oauth_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_oauth_id'), table_name='users')
    op.drop_index(op.f('ix_users_oauth_provider'), table_name='users')
    op.drop_column('users', 'oauth_id')
    op.drop_column('users', 'oauth_provider')
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=1024), nullable=False)
