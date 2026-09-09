"""add unique constraint on day(trip_id, date)

Revision ID: 73a697fa5fee
Revises: b9eafc6696db
Create Date: 2026-09-09 21:41:34.385760

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '73a697fa5fee'
down_revision: Union[str, Sequence[str], None] = 'b9eafc6696db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_DUPLICATE_CHECK = sa.text(
    'SELECT trip_id, "date", COUNT(*) AS n FROM day '
    'GROUP BY trip_id, "date" HAVING COUNT(*) > 1 ORDER BY trip_id, "date"'
)


def upgrade() -> None:
    """Upgrade schema."""
    # 제약을 걸기 전에 기존 중복을 먼저 확인한다. 중복이 있으면 DB가 던지는 메시지는
    # "UNIQUE constraint failed" 수준이라 어느 행이 문제인지 알 수 없으므로, 여기서
    # 어떤 (trip_id, date)가 겹치는지 찍어주고 멈춘다. 중복 해소는 어느 Day를 남기고
    # 어느 일정을 옮길지 사람이 판단해야 하는 문제라 마이그레이션이 자동으로 지우지 않는다.
    # (로컬 dev.db는 2026-09-09 확인 결과 중복 0건. 운영 Neon DB는 배포 시 이 가드가 확인한다.)
    duplicates = op.get_bind().execute(_DUPLICATE_CHECK).fetchall()
    if duplicates:
        rows = ", ".join(f"(trip_id={r[0]}, date={r[1]}, count={r[2]})" for r in duplicates)
        raise RuntimeError(
            "cannot add uq_day_trip_id_date: duplicate day rows exist -> "
            f"{rows}. Merge or delete the duplicates (and move their itinerary items) first."
        )

    # SQLite에서는 batch 모드가 day 테이블을 재생성(복사 후 교체)한다. alembic/env.py는
    # app.db.engine이 아니라 자체 엔진을 쓰므로 `PRAGMA foreign_keys`가 OFF(SQLite 기본값)이고,
    # 따라서 day 교체가 itinerary_item을 CASCADE로 지우지 않는다. Postgres에서는 batch가
    # 그냥 ALTER TABLE ... ADD CONSTRAINT로 나가므로 재생성 자체가 없다.
    with op.batch_alter_table('day', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_day_trip_id_date', ['trip_id', 'date'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('day', schema=None) as batch_op:
        batch_op.drop_constraint('uq_day_trip_id_date', type_='unique')
