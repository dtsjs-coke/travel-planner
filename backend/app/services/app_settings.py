"""앱 전역 설정(`AppSettings` 싱글턴 행) 읽기/쓰기.

지금 담는 건 참가자 두 명의 **표시 이름**뿐이다. `ItineraryItem.paid_by`에는 이름이 아니라
슬롯 키(`participant_1`/`participant_2`)가 저장되므로, 이름 변경은 **이 행 하나만 갱신**하면
끝나고 지출 데이터는 손대지 않는다 (ADR-0007).
"""

import datetime as dt

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.models import AppSettings
from app.services.settlement import PARTICIPANT_1, PARTICIPANT_2, Participant

# 싱글턴 행의 고정 PK. "설정은 하나뿐"을 코드가 아니라 기본키로 강제한다 —
# 조건 없는 `SELECT ... LIMIT 1`을 쓰면 언젠가 두 번째 행이 생겨도 아무도 눈치채지 못한다.
SETTINGS_ROW_ID = 1

# 참가자 슬롯 키 → `AppSettings`의 이름 컬럼. 이 매핑이 키와 저장 위치를 잇는 유일한 지점이다.
_KEY_TO_NAME_COLUMN: dict[str, str] = {
    PARTICIPANT_1: "participant_1_name",
    PARTICIPANT_2: "participant_2_name",
}


class DuplicateParticipantNameError(ValueError):
    """두 참가자의 이름이 같아지는 변경. 라우터가 422로 바꾼다."""


def _to_participants(row: AppSettings) -> list[Participant]:
    return [
        Participant(key=key, name=getattr(row, column))
        for key, column in _KEY_TO_NAME_COLUMN.items()
    ]


def load_participants(db: Session) -> list[Participant]:
    """현재 참가자(슬롯 키 + 이름) 목록. 설정 행이 아직 없으면 모델 기본값을 쓴다.

    **읽기만 하고 행을 만들지 않는다.** 이 함수는 정산 조회 등 읽기 경로에서도 불리는데,
    조회가 조용히 INSERT를 하면 읽기 요청이 쓰기 트랜잭션이 되고 동시 조회 두 건이 PK 충돌로
    500이 될 수 있다. 행은 실제로 이름을 바꿀 때(`update_participant_names`)만 만든다.
    """
    row = db.get(AppSettings, SETTINGS_ROW_ID) or AppSettings()
    return _to_participants(row)


def _get_or_create_row(db: Session) -> AppSettings:
    row = db.get(AppSettings, SETTINGS_ROW_ID)
    if row is not None:
        return row

    row = AppSettings(id=SETTINGS_ROW_ID)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # 두 요청이 동시에 첫 행을 만들려 한 경우. PK가 고정이라 한쪽만 성공하고,
        # 진 쪽은 상대가 넣은 행(기본값이므로 내용이 같다)을 다시 읽어서 이어가면 된다.
        db.rollback()
        row = db.get(AppSettings, SETTINGS_ROW_ID)
        if row is None:
            raise
    return row


def update_participant_names(db: Session, patch: dict[str, str]) -> list[Participant]:
    """참가자 이름을 부분 갱신한다. `patch`에 없는 슬롯은 그대로 둔다.

    `patch`는 스키마(`AppSettingsUpdate`)에서 이미 검증/정규화된 {슬롯 키: 이름} 맵이다
    (빈 값·공백·모르는 키·길이 초과는 여기 오기 전에 422로 걸린다).

    두 사람의 이름이 같아지면 `DuplicateParticipantNameError`를 던진다. 데이터가 깨지는
    건 아니지만("희경이 희경에게 5,000원 송금") 화면이 무의미해지고, 사용자가 의도했을 리 없다.
    """
    row = _get_or_create_row(db)

    # 부분 갱신을 "적용한 결과"를 먼저 만들어서 검사한 뒤에 반영한다. 컬럼을 하나씩 바꿔가며
    # 검사하면 순서에 따라 통과/거부가 갈린다(예: 두 이름을 서로 맞바꾸는 요청).
    resulting = {key: getattr(row, column) for key, column in _KEY_TO_NAME_COLUMN.items()}
    resulting.update(patch)

    if len(set(resulting.values())) != len(resulting):
        raise DuplicateParticipantNameError("participant names must be different from each other")

    if all(getattr(row, column) == resulting[key] for key, column in _KEY_TO_NAME_COLUMN.items()):
        # 바뀐 게 없으면 쓰지 않는다(빈 PATCH도 여기로 온다). 200 + 현재 값.
        return _to_participants(row)

    for key, column in _KEY_TO_NAME_COLUMN.items():
        setattr(row, column, resulting[key])
    row.updated_at = dt.datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_participants(row)
