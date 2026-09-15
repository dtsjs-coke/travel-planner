"""drop itinerary_item.route_role (ADR-0013 supersedes ADR-0012's pinning UX)

Revision ID: e57c1b0a92d4
Revises: a3f1c9d47b20
Create Date: 2026-09-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'e57c1b0a92d4'
down_revision: Union[str, Sequence[str], None] = 'a3f1c9d47b20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    `itinerary_item.route_role`("start"/"end"/NULL)을 드롭한다. 이 컬럼은 바로 전날
    (`a3f1c9d47b20`, 2026-09-15) 추가된 것이지만, ADR-0013이 그 값을 만들어내던 UX
    (사용자가 카드 메뉴로 시작/끝점을 핀으로 고정하는 방식) 자체를 폐기했다. 그날의 양 끝은
    이제 **현재 순서의 처음/마지막 항목**과 **숙박시설 카테고리**로 매번 다시 판정하므로
    저장할 상태가 없다.

    컬럼을 남겨두지 않고 실제로 드롭하는 이유: 읽는 코드가 한 줄도 없는 컬럼이 남아 있으면
    나중에 "이건 뭐지"를 다시 조사하게 되고(이 저장소는 영업시간 기능을 배포 전에 통째로
    걷어낸 전례가 있다), 배포된 지 하루밖에 안 된 값이라 **잃을 데이터가 실질적으로 없다**.

    `app_settings.route_sort_enabled`는 **건드리지 않는다** — 기능 토글은 그대로 유효하다.

    **적용 순서 주의**: 백엔드 코드를 먼저 배포하고 그다음에 이 마이그레이션을 돌릴 것.
    반대로 하면 아직 옛 코드가 도는 동안 `SELECT ... route_role`이 없는 컬럼을 읽어 500이
    난다(SQLModel은 컬럼을 명시해 조회하므로, 코드가 먼저여도 남아 있는 컬럼은 무해하다).
    """
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.drop_column('route_role')


def downgrade() -> None:
    """Downgrade schema.

    컬럼을 nullable로 되돌린다. **값은 복구되지 않는다**(전부 NULL = "역할 없음"으로,
    `a3f1c9d47b20` 직후와 같은 상태다). 일정 자체와 순서(`position`)에는 영향이 없다.
    """
    with op.batch_alter_table('itinerary_item', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('route_role', sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )
