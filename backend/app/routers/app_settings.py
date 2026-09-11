from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.schemas import AppSettingsRead, AppSettingsUpdate
from app.services.app_settings import (
    DuplicateParticipantNameError,
    load_participants,
    update_participant_names,
)

# 모듈 이름이 `settings.py`가 아닌 이유: `app.config.settings`(환경변수)와 헷갈리기 쉬운데
# 이 둘은 정반대의 것이다(ADR-0007). 라우트 경로는 사용자 관점의 `/api/settings` 그대로 둔다.
router = APIRouter(
    prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_session)]
)


@router.get("", response_model=AppSettingsRead)
def get_app_settings(db: Session = Depends(get_db)):
    """마스터 환경설정 조회. 지금은 참가자 두 명의 표시 이름뿐이다.

    조회에도 세션을 요구한다 — 이 앱은 공유 비밀번호를 모르면 아무것도 못 보는 구조라
    설정만 공개하면 인증 경계에 예외가 하나 생긴다. 참가자 이름은 실명이기도 하다.

    설정 행이 아직 없으면 기본값을 돌려준다(행을 만들지 않는다).
    """
    return AppSettingsRead(participants=load_participants(db))


@router.patch("", response_model=AppSettingsRead)
def patch_app_settings(body: AppSettingsUpdate, db: Session = Depends(get_db)):
    """참가자 이름 변경. 바꿀 슬롯만 보내면 된다(`{"participants": {"participant_1": "새이름"}}`).

    **기존 지출 데이터는 건드리지 않는다.** `ItineraryItem.paid_by`에는 이름이 아니라 슬롯 키가
    들어 있어서, 이 행 하나만 바뀌면 과거 지출도 자동으로 새 이름으로 보인다(ADR-0007).
    """
    try:
        participants = update_participant_names(db, body.participants)
    except DuplicateParticipantNameError as exc:
        # 두 사람 이름이 같아지는 변경. 스키마만으로는 잡을 수 없다(다른 슬롯의 현재 값을
        # 알아야 판단 가능) — 400이 아니라 422로 두어 다른 값 검증 실패와 같은 취급을 받게 한다.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AppSettingsRead(participants=participants)
