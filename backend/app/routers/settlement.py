from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, ItineraryItem, Trip
from app.schemas import SettlementRead
from app.services.app_settings import load_participants
from app.services.settlement import ExpenseRow, compute_settlement

router = APIRouter(tags=["settlement"], dependencies=[Depends(require_session)])


@router.get("/api/trips/{trip_id}/settlement", response_model=SettlementRead)
def get_trip_settlement(trip_id: int, db: Session = Depends(get_db)):
    """여행 하나의 지출 집계 + 더치페이 정산 결과를 계산해서 돌려준다.

    저장하지 않고 매 요청마다 계산한다 — 일정의 비용/결제자가 바뀔 때마다 갱신해야 하는
    파생값이라, 테이블에 두면 원본과 어긋난 상태를 관리해야 한다(ADR-0006).

    지출이 하나도 없거나 결제자가 전부 미지정이어도 에러가 아니다: 합계 0,
    `transfer: null`인 정상 응답을 준다.
    """
    trip = db.get(Trip, trip_id)
    if not trip:
        # 빈 결과가 아니라 404 — 잘못된 tripId로 조회 중인 상황을 조용히 숨기지 않는다
        # (`list_checklist_items`와 같은 기준).
        raise HTTPException(status_code=404, detail="Trip not found")

    rows = db.exec(
        select(ItineraryItem.paid_by, ItineraryItem.cost_amount, ItineraryItem.cost_currency)
        .join(Day, Day.id == ItineraryItem.day_id)
        .where(Day.trip_id == trip_id)
    ).all()

    # 이름은 계산 직전에 설정에서 읽는다. `paid_by`에는 슬롯 키만 들어 있어서, 이름을 바꾼
    # 직후에도 과거 지출이 새 이름으로 집계된다(데이터 백필 없음 — ADR-0007).
    result = compute_settlement(
        [ExpenseRow(paid_by=paid_by, amount=amount, currency=currency)
         for paid_by, amount, currency in rows],
        trip_currency=trip.currency,
        participants=load_participants(db),
    )
    return SettlementRead(trip_id=trip_id, **vars(result))
