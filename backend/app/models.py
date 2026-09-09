import datetime as dt

from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class Trip(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    destination: str | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    currency: str = "KRW"
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class Day(SQLModel, table=True):
    # 한 여행 안에서 같은 날짜의 Day는 하나뿐이다. 애플리케이션 레벨(diff_days_for_range의
    # "이미 있는 날짜는 추가하지 않음")만으로는 동시 요청을 막지 못한다 — 두 트랜잭션이
    # 서로의 커밋 전 상태를 읽고 각자 "이 날짜엔 Day가 없다"고 판단하면 같은 날짜가 2번 INSERT된다.
    # 두 사람이 함께 쓰는 공유 여행 계획이라 실제로 가능한 경로라서 DB 레벨로 못박는다.
    __table_args__ = (UniqueConstraint("trip_id", "date", name="uq_day_trip_id_date"),)

    id: int | None = Field(default=None, primary_key=True)
    trip_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trip.id", ondelete="CASCADE"), nullable=False)
    )
    date: dt.date
    label: str | None = None
    sort_order: int = 0


class ItineraryItem(SQLModel, table=True):
    __tablename__ = "itinerary_item"

    id: int | None = Field(default=None, primary_key=True)
    day_id: int = Field(
        sa_column=Column(Integer, ForeignKey("day.id", ondelete="CASCADE"), nullable=False)
    )
    position: int = 0
    title: str
    category: str | None = None
    source: str = "manual"  # "google_places" | "manual"
    place_id: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    notes: str | None = None
    cost_amount: float | None = None
    cost_currency: str | None = None
    url: str | None = None
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
