import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, Trip
from app.schemas import TripCreate, TripDetailRead, TripRead, TripUpdate
from app.services.trip_days import build_days_for_range, validate_date_range

router = APIRouter(prefix="/api/trips", tags=["trips"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[TripRead])
def list_trips(db: Session = Depends(get_db)):
    return db.exec(select(Trip).order_by(Trip.start_date)).all()


@router.post("", response_model=TripDetailRead, status_code=201)
def create_trip(body: TripCreate, db: Session = Depends(get_db)):
    trip = Trip(**body.model_dump())
    db.add(trip)
    db.flush()  # trip.id 확보 (아직 커밋 전 — Day 생성까지 같은 트랜잭션으로 묶는다)

    days = []
    if trip.start_date and trip.end_date:
        days = build_days_for_range(trip.id, trip.start_date, trip.end_date)
        db.add_all(days)

    db.commit()
    db.refresh(trip)
    for day in days:
        db.refresh(day)
    return TripDetailRead(**trip.model_dump(), days=days)


@router.get("/{trip_id}", response_model=TripDetailRead)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    days = db.exec(select(Day).where(Day.trip_id == trip_id).order_by(Day.sort_order, Day.date)).all()
    return TripDetailRead(**trip.model_dump(), days=days)


@router.patch("/{trip_id}", response_model=TripRead)
def update_trip(trip_id: int, body: TripUpdate, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    patch = body.model_dump(exclude_unset=True)

    # 부분 업데이트라 요청에 한쪽 날짜만 올 수 있다 — 보내지 않은 필드는 DB의 기존 값을 쓴다.
    # (명시적으로 null을 보낸 경우는 patch에 들어있으므로 "지우기"로 그대로 반영된다.)
    # trip을 수정하기 전에 검증해야 세션에 잘못된 값이 올라가지 않는다.
    try:
        validate_date_range(
            patch.get("start_date", trip.start_date),
            patch.get("end_date", trip.end_date),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    for field, value in patch.items():
        setattr(trip, field, value)
    trip.updated_at = dt.datetime.utcnow()
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
