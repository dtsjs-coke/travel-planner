import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, ItineraryItem
from app.schemas import (
    ItineraryItemCreate,
    ItineraryItemRead,
    ItineraryItemUpdate,
    MoveItemRequest,
    ReorderItemsRequest,
)

router = APIRouter(tags=["items"], dependencies=[Depends(require_session)])


def _next_position(db: Session, day_id: int) -> int:
    """`day_id`의 맨 뒤에 붙일 position. 항목이 없으면 0."""
    max_position = db.exec(
        select(ItineraryItem.position)
        .where(ItineraryItem.day_id == day_id)
        .order_by(ItineraryItem.position.desc())
    ).first()
    return (max_position + 1) if max_position is not None else 0


@router.get("/api/days/{day_id}/items", response_model=list[ItineraryItemRead])
def list_items(day_id: int, db: Session = Depends(get_db)):
    return db.exec(
        select(ItineraryItem).where(ItineraryItem.day_id == day_id).order_by(ItineraryItem.position)
    ).all()


@router.post("/api/days/{day_id}/items", response_model=ItineraryItemRead, status_code=201)
def create_item(day_id: int, body: ItineraryItemCreate, db: Session = Depends(get_db)):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    item = ItineraryItem(day_id=day_id, position=_next_position(db, day_id), **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/api/items/{item_id}", response_model=ItineraryItemRead)
def update_item(item_id: int, body: ItineraryItemUpdate, db: Session = Depends(get_db)):
    item = db.get(ItineraryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = dt.datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ItineraryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    day_id = item.day_id
    db.delete(item)
    db.commit()

    remaining = db.exec(
        select(ItineraryItem).where(ItineraryItem.day_id == day_id).order_by(ItineraryItem.position)
    ).all()
    for index, remaining_item in enumerate(remaining):
        remaining_item.position = index
        db.add(remaining_item)
    db.commit()


@router.post("/api/items/{item_id}/move", response_model=ItineraryItemRead)
def move_item(item_id: int, body: MoveItemRequest, db: Session = Depends(get_db)):
    """일정을 같은 여행 안의 다른 Day로 옮긴다 (목적지 Day의 맨 뒤에 추가).

    `PATCH /api/items/{id}`에 `day_id`를 얹지 않고 별도 엔드포인트로 둔 이유,
    삽입 위치를 받지 않는 이유, 원본 Day를 재정렬하는 이유는 ADR-0004 참고.
    """
    item = db.get(ItineraryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # 이미 그 Day에 있으면 아무것도 하지 않고 현재 상태를 그대로 준다(멱등).
    # 여기서 "맨 뒤로 붙이기"를 실행하면 재시도/더블탭이 같은 Day 안의 순서를
    # 몰래 바꿔버린다 — 이동 요청의 의도는 순서 변경이 아니다.
    if item.day_id == body.target_day_id:
        return item

    target_day = db.get(Day, body.target_day_id)
    if not target_day:
        raise HTTPException(status_code=404, detail="Day not found")

    source_day = db.get(Day, item.day_id)
    # `item.day_id`는 NOT NULL FK(CASCADE)라 source_day가 None인 상태는 도달 불가능하다.
    # 별도 분기를 만들지 않고 아래 조건에 합쳐 두어, 만약의 경우에도 500이 아니라 거부가 되게 한다.
    if source_day is None or source_day.trip_id != target_day.trip_id:
        # 다른 여행의 Day로는 옮길 수 없다. 존재하지 않는 것(404)이 아니라
        # "존재하지만 이 요청에서 유효한 대상이 아니다"라 422로 구분한다.
        raise HTTPException(
            status_code=422, detail="target day must belong to the same trip as the item"
        )

    # 읽기를 먼저 다 끝낸 뒤에 item을 수정한다. 순서를 바꾸면 안 되는 이유:
    # SQLAlchemy는 autoflush가 켜져 있어서, `item.day_id`를 바꾼 뒤 SELECT를 날리면
    # 그 변경이 먼저 DB에 flush된다. 그러면 아직 옛 position을 가진 item이 이미
    # 목적지 Day 소속으로 보여서 `_next_position()`이 자기 자신의 position을 최댓값으로
    # 집어삼킨다(예: 빈 Day로 옮겼는데 position이 0이 아니라 "옛 position + 1"이 됨).
    source_day_id = item.day_id
    remaining = db.exec(
        select(ItineraryItem)
        .where(ItineraryItem.day_id == source_day_id, ItineraryItem.id != item.id)
        .order_by(ItineraryItem.position)
    ).all()
    target_position = _next_position(db, target_day.id)

    item.day_id = target_day.id
    item.position = target_position
    item.updated_at = dt.datetime.utcnow()
    db.add(item)

    # 원본 Day에 생긴 position 구멍을 메운다(`delete_item`과 같은 정책).
    # 이동과 재번호 매기기를 한 번의 commit으로 처리해, 중간에 실패해도
    # "옮겨졌는데 원본은 구멍난" 상태가 남지 않게 한다.
    for index, remaining_item in enumerate(remaining):
        remaining_item.position = index
        db.add(remaining_item)

    db.commit()
    db.refresh(item)
    return item


@router.post("/api/days/{day_id}/items/reorder", response_model=list[ItineraryItemRead])
def reorder_items(day_id: int, body: ReorderItemsRequest, db: Session = Depends(get_db)):
    items = db.exec(select(ItineraryItem).where(ItineraryItem.day_id == day_id)).all()
    items_by_id = {item.id: item for item in items}

    if set(body.ordered_item_ids) != set(items_by_id.keys()):
        raise HTTPException(status_code=400, detail="ordered_item_ids must match exactly the items in this day")

    for index, item_id in enumerate(body.ordered_item_ids):
        items_by_id[item_id].position = index
        db.add(items_by_id[item_id])
    db.commit()

    return db.exec(
        select(ItineraryItem).where(ItineraryItem.day_id == day_id).order_by(ItineraryItem.position)
    ).all()
