import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, ItineraryItem, Trip
from app.schemas import (
    OutOfRangeDayRead,
    TripCreate,
    TripDetailRead,
    TripRead,
    TripUpdate,
    TripUpdateResult,
)
from app.services.trip_days import (
    MAX_TRIP_TOTAL_DAYS,
    build_days_for_range,
    diff_days_for_range,
    is_duplicate_day_error,
    validate_date_range,
)

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

    # 여기서는 `uq_day_trip_id_date` 충돌이 구조적으로 불가능하다: trip.id가 방금 발급된
    # 새 값이라 다른 트랜잭션이 같은 trip_id로 Day를 넣을 수 없고, build_days_for_range()가
    # 만드는 날짜들도 서로 중복이 없다. 그래서 update_trip과 달리 IntegrityError를 잡지 않는다
    # (잡아도 도달할 수 없는 코드가 된다).
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


@router.patch("/{trip_id}", response_model=TripUpdateResult)
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

    for field_name, value in patch.items():
        setattr(trip, field_name, value)
    trip.updated_at = dt.datetime.utcnow()
    db.add(trip)

    # --- Day 동기화 ---
    # 요청이 날짜 필드를 건드렸을 때만 동작한다. 이름만 바꾸는 PATCH가 Day를 건드리면
    # 예상 밖 부수효과(이 기능 이전에 만들어져 Day가 없는 여행에 갑자기 90개가 생기는 등)가
    # 되므로, "날짜를 보냈다"를 동기화 신호로 삼는다.
    # 두 날짜가 다 있을 때만 동기화하는 것은 create_trip / validate_date_range와 같은 기준이다.
    added: list[Day] = []
    out_of_range: list[Day] = []
    if ("start_date" in patch or "end_date" in patch) and trip.start_date and trip.end_date:
        existing = db.exec(
            select(Day).where(Day.trip_id == trip_id).order_by(Day.sort_order, Day.date)
        ).all()
        diff = diff_days_for_range(trip_id, trip.start_date, trip.end_date, existing)

        # 범위 밖 Day를 지우지 않기 때문에 기간 이동 PATCH를 반복하면 Day가 누적된다.
        # 총개수 상한을 넘으면 저장하지 않고, 사용자가 먼저 정리하도록 안내한다.
        if len(existing) + len(diff.to_add) > MAX_TRIP_TOTAL_DAYS:
            db.rollback()
            raise HTTPException(
                status_code=422,
                detail=(
                    f"trip cannot hold more than {MAX_TRIP_TOTAL_DAYS} days "
                    "(delete out-of-range days first)"
                ),
            )

        db.add_all(diff.to_add)
        added = diff.to_add
        out_of_range = diff.out_of_range

    # 범위 밖 Day에 딸린 일정 수 — 프론트가 "일정 N개가 함께 사라진다"고 경고하는 근거.
    # commit 전에 세어야 out_of_range 객체가 살아있는 상태에서 id를 쓸 수 있다.
    item_counts: dict[int, int] = {}
    if out_of_range:
        item_counts = {
            day_id: count
            for day_id, count in db.exec(
                select(ItineraryItem.day_id, func.count(ItineraryItem.id))
                .where(ItineraryItem.day_id.in_([day.id for day in out_of_range]))
                .group_by(ItineraryItem.day_id)
            ).all()
        }

    # `diff_days_for_range()`의 "이미 있는 날짜는 추가하지 않는다"는 이 트랜잭션이 읽은
    # `existing` 스냅샷에만 근거한다. 두 사람이 거의 동시에 같은 트립의 기간을 늘리면
    # 서로의 커밋 전 상태를 못 봐서 같은 날짜를 각자 INSERT하는데, 그 충돌은 DB 유니크 제약
    # `uq_day_trip_id_date`가 여기서 잡는다. 자동 재시도는 하지 않는다 — 상대 요청이 기간까지
    # 바꿨을 수 있어 재시도가 곧 상대 변경을 덮어쓰는 last-write-wins가 되기 때문이다.
    # 사용자가 최신 상태를 보고 다시 판단하도록 409로 돌려준다(트립 수정 자체도 롤백되므로
    # "일부만 반영된" 상태는 생기지 않는다).
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if not is_duplicate_day_error(exc):
            raise
        raise HTTPException(
            status_code=409,
            detail=(
                "another request just changed this trip's days; "
                "refresh and try again"
            ),
        ) from exc
    db.refresh(trip)

    days = db.exec(
        select(Day).where(Day.trip_id == trip_id).order_by(Day.sort_order, Day.date)
    ).all()
    for day in added:
        db.refresh(day)

    return TripUpdateResult(
        **trip.model_dump(),
        days=days,
        added_day_ids=[day.id for day in added],
        out_of_range_days=[
            OutOfRangeDayRead(
                **day.model_dump(), item_count=item_counts.get(day.id, 0)
            )
            for day in out_of_range
        ],
    )


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
