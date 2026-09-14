"""add route sort fields (itinerary_item.route_role, app_settings.route_sort_enabled)

Revision ID: a3f1c9d47b20
Revises: c41b7f2ad9e6
Create Date: 2026-09-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'a3f1c9d47b20'
down_revision: Union[str, Sequence[str], None] = 'c41b7f2ad9e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    "일정 AI 정렬"(ADR-0012)에 필요한 컬럼 2개. 두 테이블을 한 리비전에 담는 이유는
    **하나의 기능**이기 때문이다 — 토글만 있고 역할 컬럼이 없거나 그 반대인 중간 상태는
    의미가 없다.

    1. `itinerary_item.route_role` (nullable): `"start"`/`"end"`/NULL. 백필하지 않는다 —
       기존 일정은 전부 NULL이고, 그게 "역할 없음"이라는 정상 상태다. 여행의 첫날에는
       사용자가 화면에서 시작점/끝점을 지정해야 정렬이 실행된다.
    2. `app_settings.route_sort_enabled` (NOT NULL, 기본 true): 기능 온/오프.
       **기존 시드 행(`id=1`)이 이미 있으므로 서버 기본값이 필요하다.** `sa.text("true")`를
       쓰는 이유: Postgres의 boolean은 `DEFAULT 1`을 받지 않고, SQLite는 3.23+부터
       `true` 리터럴을 이해한다(이 프로젝트의 파이썬 3.12는 그보다 최신 SQLite를 쓴다).
    """
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('route_role', sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )

    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'route_sort_enabled',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('true'),
            )
        )


def downgrade() -> None:
    """Downgrade schema.

    사용자가 지정한 시작/끝점과 토글 상태가 사라진다(다시 upgrade하면 역할은 전부 NULL,
    토글은 켜짐으로 돌아온다). 일정 자체와 순서(`position`)에는 영향이 없다.
    """
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('route_sort_enabled')

    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.drop_column('route_role')
