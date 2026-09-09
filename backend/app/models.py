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


class ChecklistItem(SQLModel, table=True):
    """여행 단위 준비물/할 일 체크리스트 항목 ("여권 챙기기", "환전 해오기" 등).

    Day가 아니라 Trip에 직접 매달린다 — 여행 전체에 걸친 준비물이라 특정 날짜에
    귀속시킬 대상이 아니고, Day에 붙이면 기간 PATCH로 Day가 범위 밖이 됐을 때
    준비물이 사라지거나 숨는 문제가 생긴다(ADR-0001 참고).

    정렬 컬럼(`position`/`sort_order`)을 두지 않는다. 이번 스코프에 순서 변경 기능이
    없어서 항상 생성 순서로만 조회하며, 그 순서는 `id` 오름차순과 같다.
    (근거와 나중에 정렬이 필요해질 때의 확장 방법은 ADR-0003 참고.)
    """

    __tablename__ = "checklist_item"

    id: int | None = Field(default=None, primary_key=True)
    trip_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trip.id", ondelete="CASCADE"), nullable=False)
    )
    text: str
    is_checked: bool = False
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


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
