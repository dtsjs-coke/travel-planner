"""add app_settings singleton table

Revision ID: 0e8fd49e8ad8
Revises: 093074f849bc
Create Date: 2026-09-11 13:06:31.991028

"""
import datetime as dt
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0e8fd49e8ad8'
down_revision: Union[str, Sequence[str], None] = '093074f849bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    앱 전역 설정(참가자 두 명의 표시 이름)을 담는 싱글턴 테이블 + 기본값 한 행.

    **`ItineraryItem.paid_by`의 기존 데이터를 건드릴 필요가 없다.** 이 마이그레이션의 직전
    리비전(`093074f849bc`)이 `paid_by` 컬럼을 추가했고 그 값은 아직 어디에서도 채워지지
    않았다(로컬 `dev.db`·운영 Neon 모두 전부 NULL). 즉 "이름 문자열을 저장하던 방식 →
    슬롯 키를 저장하는 방식"으로 바꾸면서 변환해야 할 행이 하나도 없다 — 이 재설계가
    지금 시점에 공짜인 이유이고, 나중으로 미룰수록 비싸지는 이유다(ADR-0007).

    시드 행을 넣는 이유: 운영 DB를 콘솔에서 열었을 때 현재 이름이 행으로 보이게 하기 위함.
    행이 없어도 애플리케이션은 모델 기본값으로 동작한다(`services/app_settings.py`).
    """
    op.create_table('app_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('participant_1_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('participant_2_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    app_settings = sa.table(
        'app_settings',
        sa.column('id', sa.Integer),
        sa.column('participant_1_name', sa.String),
        sa.column('participant_2_name', sa.String),
        sa.column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        app_settings,
        [
            {
                'id': 1,  # 싱글턴 행의 고정 PK
                'participant_1_name': '희경',
                'participant_2_name': '재승',
                'updated_at': dt.datetime.utcnow(),
            }
        ],
    )


def downgrade() -> None:
    """Downgrade schema.

    테이블을 통째로 지우므로 **사용자가 바꾼 이름은 사라진다**(다시 upgrade하면 기본값으로
    돌아온다). 지출 데이터에는 슬롯 키만 들어 있어 영향이 없고, 이름만 기본값으로 되돌아간다.
    """
    op.drop_table('app_settings')
