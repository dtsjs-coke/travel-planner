"""add place detail fields to itinerary_item

Revision ID: c41b7f2ad9e6
Revises: 0e8fd49e8ad8
Create Date: 2026-09-14 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'c41b7f2ad9e6'
down_revision: Union[str, Sequence[str], None] = '0e8fd49e8ad8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    일정 상세보기(ADR-0011)에서 쓰는 nullable 컬럼 2개 추가. **백필하지 않는다** —
    기존 일정은 두 값이 모두 NULL이고, 그게 곧 "모름"이라는 정상 상태다. 값은
    앞으로 장소를 검색해 등록할 때 Places 응답에서 **추가 비용 없이** 채워진다.

    이 리비전은 원래 컬럼을 4개 추가했다(`opening_hours` / `place_details_synced_at`
    포함). 영업시간은 Places의 Enterprise 요금 티어라 2026-09-13에 기능 자체를
    철회했고, **이 마이그레이션은 운영 DB에 아직 한 번도 적용된 적이 없어서**
    "컬럼을 지우는 새 리비전"을 쌓는 대신 이 파일을 직접 고쳤다(리비전 ID는 그대로).
    로컬 `dev.db`는 downgrade 후 재적용해 정합성을 맞췄다. 자세한 경위는
    ADR-0011의 "철회 기록" 섹션 참고.
    """
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('place_category', sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('region_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.drop_column('region_name')
        batch_op.drop_column('place_category')
