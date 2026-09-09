from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.models import Day, Trip
from app.schemas import DayCreate, DayRead, DayUpdate
from app.services.trip_days import is_duplicate_day_error

router = APIRouter(tags=["days"], dependencies=[Depends(require_session)])

# `uq_day_trip_id_date` 도입 전에는 같은 날짜의 Day를 몇 개든 만들 수 있었다. 이제는
# DB가 막으므로, 동시 요청뿐 아니라 사용자가 그냥 같은 날짜를 두 번 추가하는 평범한
# 경로도 여기로 온다. 500 대신 무엇이 문제인지 알려주는 409로 바꾼다.
_DUPLICATE_DAY_DETAIL = "this trip already has a day with that date"


def _commit_day(db: Session, day: Day) -> Day:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if not is_duplicate_day_error(exc):
            raise
        raise HTTPException(status_code=409, detail=_DUPLICATE_DAY_DETAIL) from exc
    db.refresh(day)
    return day


@router.post("/api/trips/{trip_id}/days", response_model=DayRead, status_code=201)
def create_day(trip_id: int, body: DayCreate, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    day = Day(trip_id=trip_id, date=body.date, label=body.label)
    db.add(day)
    return _commit_day(db, day)


@router.patch("/api/days/{day_id}", response_model=DayRead)
def update_day(day_id: int, body: DayUpdate, db: Session = Depends(get_db)):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(day, field, value)
    db.add(day)
    return _commit_day(db, day)


@router.delete("/api/days/{day_id}", status_code=204)
def delete_day(day_id: int, db: Session = Depends(get_db)):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    db.delete(day)
    db.commit()
