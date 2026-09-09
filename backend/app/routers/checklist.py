from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import ChecklistItem, Trip
from app.schemas import ChecklistItemCreate, ChecklistItemRead, ChecklistItemUpdate

router = APIRouter(tags=["checklist"], dependencies=[Depends(require_session)])

# 한 여행이 가질 수 있는 체크리스트 항목 수 상한. Day와 달리 자동 일괄 생성 경로가
# 없어서(항상 사용자가 한 줄씩 입력) 오타 하나로 수천 행이 생기는 사고는 구조적으로
# 불가능하지만, 클라이언트 루프 버그가 무료 티어 DB를 채우는 것만 막는 가드레일로 둔다.
# 실사용(준비물 목록)에서 100개를 넘길 일은 없다.
MAX_TRIP_CHECKLIST_ITEMS = 100


def _get_trip_or_404(db: Session, trip_id: int) -> Trip:
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _get_item_or_404(db: Session, item_id: int) -> ChecklistItem:
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@router.get("/api/trips/{trip_id}/checklist", response_model=list[ChecklistItemRead])
def list_checklist_items(trip_id: int, db: Session = Depends(get_db)):
    # 없는 트립이면 빈 배열이 아니라 404를 준다. 빈 배열은 "체크리스트가 비어 있다"와
    # 구분이 안 돼서, 프론트가 잘못된 tripId로 조회 중인 상황을 조용히 숨긴다.
    _get_trip_or_404(db, trip_id)
    # 정렬은 생성 순서(= id 오름차순). 순서 변경 기능이 없어 별도 정렬 컬럼을 두지 않았다(ADR-0003).
    return db.exec(
        select(ChecklistItem).where(ChecklistItem.trip_id == trip_id).order_by(ChecklistItem.id)
    ).all()


@router.post("/api/trips/{trip_id}/checklist", response_model=ChecklistItemRead, status_code=201)
def create_checklist_item(trip_id: int, body: ChecklistItemCreate, db: Session = Depends(get_db)):
    _get_trip_or_404(db, trip_id)

    count = db.exec(
        select(func.count(ChecklistItem.id)).where(ChecklistItem.trip_id == trip_id)
    ).one()
    if count >= MAX_TRIP_CHECKLIST_ITEMS:
        raise HTTPException(
            status_code=422,
            detail=f"trip cannot hold more than {MAX_TRIP_CHECKLIST_ITEMS} checklist items",
        )

    item = ChecklistItem(trip_id=trip_id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/api/checklist/{item_id}", response_model=ChecklistItemRead)
def update_checklist_item(
    item_id: int, body: ChecklistItemUpdate, db: Session = Depends(get_db)
):
    # 체크 토글과 텍스트 수정 둘 다 이 엔드포인트로 처리한다(`update_item`과 같은 패턴).
    item = _get_item_or_404(db, item_id)
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field_name, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/checklist/{item_id}", status_code=204)
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, item_id)
    db.delete(item)
    db.commit()
