from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.models import Day, Trip
from app.schemas import DayCreate, DayRead, DayUpdate

router = APIRouter(tags=["days"], dependencies=[Depends(require_session)])


@router.post("/api/trips/{trip_id}/days", response_model=DayRead, status_code=201)
def create_day(trip_id: int, body: DayCreate, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    day = Day(trip_id=trip_id, date=body.date, label=body.label)
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


@router.patch("/api/days/{day_id}", response_model=DayRead)
def update_day(day_id: int, body: DayUpdate, db: Session = Depends(get_db)):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(day, field, value)
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


@router.delete("/api/days/{day_id}", status_code=204)
def delete_day(day_id: int, db: Session = Depends(get_db)):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    db.delete(day)
    db.commit()
