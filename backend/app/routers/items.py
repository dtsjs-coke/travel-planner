import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, ItineraryItem
from app.schemas import ItineraryItemCreate, ItineraryItemRead, ItineraryItemUpdate, ReorderItemsRequest

router = APIRouter(tags=["items"], dependencies=[Depends(require_session)])


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

    max_position = db.exec(
        select(ItineraryItem.position).where(ItineraryItem.day_id == day_id).order_by(ItineraryItem.position.desc())
    ).first()
    next_position = (max_position + 1) if max_position is not None else 0

    item = ItineraryItem(day_id=day_id, position=next_position, **body.model_dump())
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
