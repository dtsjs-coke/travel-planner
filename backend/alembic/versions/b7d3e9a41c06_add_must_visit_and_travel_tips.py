"""add itinerary_item.is_must_visit + trip.travel_tips (travel guide page)

Revision ID: b7d3e9a41c06
Revises: f2b8d61c3a57
Create Date: 2026-10-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b7d3e9a41c06'
down_revision: Union[str, Sequence[str], None] = 'f2b8d61c3a57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    "여행 가이드" 읽기 전용 페이지(ADR-0015)용 컬럼 2개. 둘 다 **추가만** 하므로 기존 데이터 손실이 없다.

    - `itinerary_item.is_must_visit`: NOT NULL + **서버 기본값 false**. 기존 행이 이미 있으므로
      서버 기본값이 필요하다(`a3f1c9d47b20`/`f2b8d61c3a57`과 같은 이유). Postgres boolean은
      `DEFAULT 0`을 받지 않으므로 `sa.text('false')`로 쓴다(SQLite도 이 리터럴을 0으로 받는다).
    - `trip.travel_tips`: nullable 자유 텍스트. 기존 여행은 NULL(= 아직 안 적음)이라 백필이 없다.
      타입은 기존 문자열 컬럼(`notes` 등)과 같은 `AutoString`(길이 무제한 VARCHAR) — 길이 상한은
      DB 제약이 아니라 입력 검증(`MAX_TRIP_TRAVEL_TIPS_LENGTH`)으로만 건다.
    """
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_must_visit',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('false'),
            )
        )

    with op.batch_alter_table('trip', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('travel_tips', sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema.

    **데이터 손실 주의**: 필수 방문 표시와 팁/추천 메모 본문이 사라진다(다시 upgrade하면 전부
    false / NULL로 돌아온다). 일정·여행 자체에는 영향이 없다.
    """
    with op.batch_alter_table('trip', schema=None) as batch_op:
        batch_op.drop_column('travel_tips')

    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.drop_column('is_must_visit')
