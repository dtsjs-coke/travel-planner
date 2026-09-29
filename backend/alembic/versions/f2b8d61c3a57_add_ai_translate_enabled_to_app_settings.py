"""add app_settings.ai_translate_enabled (paid feature toggle, default off)

Revision ID: f2b8d61c3a57
Revises: e57c1b0a92d4
Create Date: 2026-09-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'f2b8d61c3a57'
down_revision: Union[str, Sequence[str], None] = 'e57c1b0a92d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    "여행 도구함 > AI 번역"(ADR-0014)의 온/오프 토글. NOT NULL + **서버 기본값 false**.

    - 기존 시드 행(`id=1`)이 이미 있으므로 서버 기본값이 필요하다(`a3f1c9d47b20`의
      `route_sort_enabled`와 같은 이유). 리터럴을 `sa.text('false')`로 쓰는 이유도 같다 —
      Postgres boolean은 `DEFAULT 0`을 받지 않는다.
    - 기본값이 **false**인 이유: 이 기능은 호출마다 Gemini 과금이 발생한다. 마이그레이션이
      운영 DB에 적용되는 순간 기능이 켜진 채로 등장하면, 사용자가 "켠 적 없는" 비용 경로가
      열린다. 유료 기능은 사용자가 설정 화면에서 직접 켜야 한다(ADR-0014 결정 2).
    """
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'ai_translate_enabled',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('false'),
            )
        )


def downgrade() -> None:
    """Downgrade schema.

    토글 상태만 사라진다(다시 upgrade하면 꺼짐으로 돌아온다 — 안전한 쪽). 다른 데이터에는
    영향이 없다.
    """
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('ai_translate_enabled')
