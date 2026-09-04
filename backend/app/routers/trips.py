import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, Trip
from app.schemas import TripCreate, TripDetailRead, TripRead, TripUpdate

router = APIRouter(prefix="/api/trips", tags=["trips"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[TripRead])
def list_trips(db: Session = Depends(get_db)):
    return db.exec(select(Trip).order_by(Trip.start_date)).all()


@router.post("", response_model=TripRead, status_code=201)
def create_trip(body: TripCreate, db: Session = Depends(get_db)):
    trip = Trip(**body.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


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
    for field, value in body.model_dump(exclude_unset=True).items():
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
