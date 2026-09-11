import datetime as dt

from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class AppSettings(SQLModel, table=True):
    """앱 전역 설정 — **항상 최대 한 행**(`id=1`)만 존재하는 싱글턴 테이블.

    `app/config.py`의 `Settings`(pydantic-settings)와 혼동하지 말 것. 그쪽은 `.env`/환경변수라
    **재배포해야 바뀌고 배포 환경마다 달라지는 값**(DB URL, 시크릿, CORS)이다. 이 테이블은
    반대로 **두 사용자가 화면에서 실시간으로 바꾸는 값**이라 DB에 있어야 한다(ADR-0007).

    참가자 이름은 여행(Trip)별이 아니라 앱 전역이다 — 같은 두 사람이 모든 여행을 함께 쓰므로
    여행마다 이름을 따로 두면 이름 변경이 여행 수만큼의 조작이 된다.

    설정 항목이 늘면 컬럼을 추가한다. key-value 테이블로 만들지 않은 이유는 ADR-0007 참고.
    """

    __tablename__ = "app_settings"

    # `id`는 항상 1이다(싱글턴). 서비스 레이어(`services/app_settings.py`)가 이 값을 고정해서
    # 읽고 쓰므로, 두 요청이 동시에 첫 행을 만들려 해도 두 번째는 PK 충돌로 실패하고 재조회한다.
    id: int | None = Field(default=None, primary_key=True)
    # 참가자 슬롯 "participant_1" / "participant_2"의 현재 표시 이름.
    # 아래 기본값이 이 앱에서 참가자 이름의 유일한 기본값 정의다 — 행이 아직 없을 때
    # `load_participants()`가 이 모델을 그대로 인스턴스화해서 기본값을 얻는다(중복 정의 방지).
    participant_1_name: str = "희경"
    participant_2_name: str = "재승"
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


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
    # 이 비용을 결제한 사람의 **참가자 슬롯 키**("participant_1"/"participant_2").
    # NULL = 미지정(정산에서 제외). 표시 이름이 아니라 키를 저장하는 이유는 ADR-0007 참고 —
    # 이름은 `AppSettings`에서 언제든 바뀔 수 있는 런타임 값이라, 여기에 이름을 넣으면
    # 이름을 바꿀 때마다 이 컬럼 전체를 다시 써야 한다.
    # 허용값(PARTICIPANT_KEYS)은 애플리케이션 레벨(schemas.py)에서만 검증한다 — 슬롯이 늘거나
    # 줄 일이 없어 CHECK 제약의 이득이 거의 없고, 모르는 값은 정산에서 "미지정"으로 안전하게
    # 퇴화한다.
    paid_by: str | None = None
    url: str | None = None
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
