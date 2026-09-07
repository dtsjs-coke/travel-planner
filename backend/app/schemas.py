import datetime as dt

from pydantic import BaseModel, ConfigDict, model_validator

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
