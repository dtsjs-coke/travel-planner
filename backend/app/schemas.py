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
