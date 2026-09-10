import datetime as dt

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.services.trip_days import validate_date_range


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TripCreate(BaseModel):
    name: str
    destination: str | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    currency: str = "KRW"

    @model_validator(mode="after")
    def _validate_date_range(self):
        # 두 날짜가 모두 있으면 서버가 그 범위만큼 Day를 자동 생성하므로 여기서 범위를 검증한다.
        validate_date_range(self.start_date, self.end_date)
        return self


class TripUpdate(BaseModel):
    name: str | None = None
    destination: str | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    currency: str | None = None

    # 날짜 검증은 여기서 못 한다: PATCH는 부분 업데이트라 요청에 한쪽 날짜만 올 수 있고,
    # 그때는 DB에 저장된 기존 값과 합쳐야 최종 기간이 정해진다.
    # → `update_trip` 라우터가 병합 후 validate_date_range()를 호출한다.


class TripRead(ORMModel):
    id: int
    name: str
    destination: str | None
    start_date: dt.date | None
    end_date: dt.date | None
    currency: str
    created_at: dt.datetime
    updated_at: dt.datetime


class DayCreate(BaseModel):
    date: dt.date
    label: str | None = None


class DayUpdate(BaseModel):
    date: dt.date | None = None
    label: str | None = None


class DayRead(ORMModel):
    id: int
    trip_id: int
    date: dt.date
    label: str | None
    sort_order: int


class TripDetailRead(TripRead):
    days: list[DayRead] = []


class OutOfRangeDayRead(DayRead):
    """수정된 여행 기간을 벗어나게 된 기존 Day. `item_count`는 그 Day에 딸린 일정 수로,
    프론트가 "이 날짜를 지우면 일정 N개도 함께 사라진다"고 경고하는 데 쓴다."""

    item_count: int


class TripUpdateResult(TripDetailRead):
    """`PATCH /api/trips/{id}` 응답. 기존 `TripRead` 필드를 모두 포함하는 상위집합이라
    날짜를 안 건드리는 기존 클라이언트는 그대로 동작한다(추가 필드는 무시하면 됨).

    days:              동기화 후 이 여행의 전체 Day 목록 (범위 밖 Day도 지우지 않았으므로 포함)
    added_day_ids:     이번 PATCH로 새로 생성된 Day의 id
    out_of_range_days: 새 기간을 벗어난 기존 Day (서버는 지우지 않음 — 프론트가 사용자에게
                       확인받은 뒤 `DELETE /api/days/{id}`로 개별 삭제)
    """

    added_day_ids: list[int] = []
    out_of_range_days: list[OutOfRangeDayRead] = []


class ItineraryItemCreate(BaseModel):
    source: str = "manual"  # "google_places" | "manual"
    title: str
    category: str | None = None
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

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be empty")
        return stripped


class ItineraryItemUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    notes: str | None = None
    cost_amount: float | None = None
    cost_currency: str | None = None
    url: str | None = None

    # title 필드가 요청에 아예 없으면 라우터가 model_dump(exclude_unset=True)로
    # 걸러내므로 이 validator 자체가 호출되지 않는다(기본값 None은 validate_default
    # 없이는 트리거되지 않음). 반대로 validator가 호출됐다는 것은 클라이언트가 값을
    # 명시적으로 보냈다는 뜻이므로, None이든 빈/공백 문자열이든 둘 다 거부한다.
    # (과거에는 `if value is None: return value` 조기 리턴이 있었는데, 이는
    # 명시적으로 {"title": null}을 보낸 경우까지 통과시켜 DB NOT NULL 제약 위반으로
    # 500 에러가 나는 버그를 유발했다.)
    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str:
        if value is None or not value.strip():
            raise ValueError("title must not be empty")
        return value.strip()


class ItineraryItemRead(ORMModel):
    id: int
    day_id: int
    position: int
    title: str
    category: str | None
    source: str
    place_id: str | None
    address: str | None
    lat: float | None
    lng: float | None
    start_time: dt.time | None
    end_time: dt.time | None
    notes: str | None
    cost_amount: float | None
    cost_currency: str | None
    url: str | None


class ReorderItemsRequest(BaseModel):
    ordered_item_ids: list[int]


class MoveItemRequest(BaseModel):
    """`POST /api/items/{id}/move` 요청 본문. 일정을 같은 여행의 다른 Day로 옮긴다.

    삽입 위치(`position`)는 받지 않는다 — 항상 목적지 Day의 맨 뒤에 붙이고, 그 안에서의
    순서 조정은 기존 `POST /api/days/{id}/items/reorder`가 담당한다(ADR-0004).
    """

    target_day_id: int


# 체크리스트 항목 텍스트 상한. DB 컬럼 제약이 아니라 입력 검증으로만 둔다
# ("여권 챙기기" 수준의 한 줄 메모가 용도라 200자면 충분하고, 무제한 텍스트를
#  그대로 받으면 무료 티어 DB에 수 MB짜리 붙여넣기가 들어올 수 있다).
MAX_CHECKLIST_TEXT_LENGTH = 200


def _normalize_checklist_text(value: str | None) -> str:
    """체크리스트 텍스트를 trim 정규화하고 빈 값/과도한 길이를 거부한다.

    `None`도 거부한다: 이 함수를 호출하는 validator가 돌았다는 것 자체가
    "클라이언트가 값을 명시적으로 보냈다"는 뜻이다(필드를 생략하면 라우터의
    `model_dump(exclude_unset=True)`가 걸러내 validator가 아예 호출되지 않는다).
    `{"text": null}`을 통과시키면 라우터가 `setattr(item, "text", None)`을 실행해
    DB NOT NULL 위반 → 처리되지 않은 500이 된다 —
    `ItineraryItemUpdate.title`에서 실제로 겪었던 버그라 같은 실수를 반복하지 않는다.
    """
    if value is None:
        raise ValueError("text must not be empty")
    stripped = value.strip()
    if not stripped:
        raise ValueError("text must not be empty")
    if len(stripped) > MAX_CHECKLIST_TEXT_LENGTH:
        raise ValueError(f"text must be at most {MAX_CHECKLIST_TEXT_LENGTH} characters")
    return stripped


class ChecklistItemCreate(BaseModel):
    text: str
    is_checked: bool = False

    @field_validator("text")
    @classmethod
    def _validate_text(cls, value: str) -> str:
        return _normalize_checklist_text(value)


class ChecklistItemUpdate(BaseModel):
    """텍스트 수정과 체크 토글을 같은 PATCH로 처리한다(둘 다 선택적, 부분 업데이트)."""

    text: str | None = None
    is_checked: bool | None = None

    @field_validator("text")
    @classmethod
    def _validate_text(cls, value: str | None) -> str:
        return _normalize_checklist_text(value)

    # text와 같은 이유로 명시적 null을 거부한다. `is_checked`는 DB에서 NOT NULL이라
    # `{"is_checked": null}`이 통과하면 setattr(None) → 500이 된다.
    @field_validator("is_checked")
    @classmethod
    def _validate_is_checked(cls, value: bool | None) -> bool:
        if value is None:
            raise ValueError("is_checked must not be null")
        return value


class ChecklistItemRead(ORMModel):
    id: int
    trip_id: int
    text: str
    is_checked: bool
    created_at: dt.datetime
