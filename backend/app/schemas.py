import datetime as dt
import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.route_order import ORDER_STYLES, STYLE_NEAREST
from app.services.settlement import PARTICIPANT_KEYS
from app.services.trip_days import MAX_TRIP_TOTAL_DAYS, validate_date_range

# 참가자 표시 이름 길이 상한. 이 값은 정산 표/결제자 선택박스에 그대로 렌더링되므로
# 상한이 없으면 한 사람이 레이아웃을 깨뜨릴 수 있다. 닉네임 용도라 넉넉히 20자.
MAX_PARTICIPANT_NAME_LENGTH = 20

# 여행 이름 길이 상한. DB 컬럼 제약이 아니라 입력 검증으로만 둔다(ChecklistItem.text와
# 같은 패턴, 마이그레이션 불필요). 여행 목록 카드 제목/탭 타이틀에 그대로 렌더링되는
# 짧은 라벨이라 100자면 충분하고, 없으면 무료 티어 DB에 수 MB짜리 붙여넣기가 들어올 수
# 있다(2026-09-07 qa 발견, Backlog Tier 2).
MAX_TRIP_NAME_LENGTH = 100

# 일정 제목 길이 상한. 위 MAX_TRIP_NAME_LENGTH와 같은 이유. 구글 플레이스 이름처럼
# 다소 긴 값도 들어올 수 있어 여행 이름보다 여유를 조금 더 둔다.
MAX_ITINERARY_ITEM_TITLE_LENGTH = 150

# 일정 상세보기에서 채워지는 선택 필드들의 길이 상한(ADR-0011). 전부 같은 이유다 —
# 컬럼 제약이 아니라 입력 검증으로만 두고(마이그레이션 불필요), 무료 티어 DB에
# 수 MB짜리 붙여넣기가 들어오는 것을 막는다.
MAX_PLACE_CATEGORY_LENGTH = 50  # "문화센터", "한식당" 수준의 짧은 라벨
MAX_REGION_NAME_LENGTH = 100  # "광주광역시 동구"
# 자유 입력칸(알아본 정보/링크 메모). 위 셋보다 훨씬 넉넉하지만 무제한은 아니다 —
# 이번에 처음으로 **사용자가 직접 타이핑하는 칸**이 생기므로 상한을 함께 둔다
# (AI 추천이 넣는 한 줄 이유는 200자라 영향 없다).
MAX_ITEM_NOTES_LENGTH = 2000


def _validate_name_length(value: str, *, field_label: str, max_length: int) -> str:
    """이름/제목류 필드의 길이 상한을 검증한다(trim 등 다른 정규화는 하지 않는다 —
    기존 name/title 필드의 공백 처리 정책을 이 김에 바꾸지 않기 위함)."""
    if len(value) > max_length:
        raise ValueError(f"{field_label} must be at most {max_length} characters")
    return value


def _normalize_paid_by(value: str | None) -> str | None:
    """결제자를 검증/정규화한다. 허용값은 참가자 **슬롯 키** 또는 "미지정"(None).

    저장되는 건 표시 이름("희경")이 아니라 키("participant_1")다 — 이름은 설정에서 바뀌는
    런타임 값이라 지출 행에 복사해두면 이름 변경이 데이터 재작성 작업이 된다(ADR-0007).
    덕분에 이 검증은 **DB를 보지 않는 정적 검사**로 남는다(pydantic validator가 DB 세션을
    잡을 방법이 없다는 현실적인 제약과도 맞는다).

    `title`/`text`와 달리 **명시적 null을 허용한다**: `paid_by` 컬럼은 nullable이고,
    "결제자를 다시 미지정으로 되돌린다"는 건 실제로 필요한 조작이라 `{"paid_by": null}`이
    라우터의 `setattr(item, "paid_by", None)`으로 이어져도 안전하다.
    (NOT NULL 컬럼에서 명시적 null을 통과시켜 500이 났던 `ItineraryItemUpdate.title` 버그와는
     상황이 반대다 — 그쪽은 null이 DB 제약 위반이지만 여기서는 정상적인 값이다.)

    빈 문자열/공백도 None으로 본다. 프론트의 `<select>`에서 "미지정" 옵션의 value가 보통
    빈 문자열이라, 그걸 422로 튕기면 화면 쪽에 "빈 문자열이면 필드를 빼고 보내기" 같은
    변환 코드가 생긴다.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if stripped not in PARTICIPANT_KEYS:
        allowed = ", ".join(PARTICIPANT_KEYS)
        raise ValueError(f"paid_by must be one of: {allowed} (or null)")
    return stripped


def _normalize_cost_amount(value: float | None) -> float | None:
    """비용 금액을 검증한다. 음수/NaN/무한대를 막는다(명시적 null = "비용 지움"은 허용).

    음수를 막는 이유: 정산은 이 값을 그대로 합산하므로 음수 하나가 "누가 누구에게 얼마"를
    통째로 뒤집는다. NaN/Infinity를 막는 이유: 파이썬 `json.loads`는 `NaN`/`Infinity`
    리터럴을 기본으로 받아들여서, 한 건만 섞여도 합계 전체가 NaN이 되고 응답 직렬화까지 깨진다.
    """
    if value is None:
        return None
    if not math.isfinite(value):
        raise ValueError("cost_amount must be a finite number")
    if value < 0:
        raise ValueError("cost_amount must not be negative")
    return value


def _normalize_optional_text(value: str | None, *, field_label: str, max_length: int) -> str | None:
    """상세보기의 선택 텍스트 필드(카테고리/지역명/영업시간/자유 메모)를 정규화한다.

    `paid_by`와 같은 정책이다 — **명시적 null도, 빈 문자열도 "지움"(None)으로 본다.**
    전부 nullable 컬럼이고, 사용자가 입력칸을 비우는 건 정상적인 조작이다. 프론트의
    `<input>`은 지운 값을 빈 문자열로 보내므로, 그걸 422로 튕기면 화면 쪽에
    "빈 문자열이면 null로 바꿔 보내기" 같은 변환 코드가 생긴다.

    `strip()`은 양끝만 다듬으므로 영업시간/메모의 **줄바꿈은 그대로 보존된다**.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if len(stripped) > max_length:
        raise ValueError(f"{field_label} must be at most {max_length} characters")
    return stripped


def _normalize_cost_currency(value: str | None) -> str | None:
    """통화 코드를 대문자로 정규화한다("krw " -> "KRW", "" -> None).

    정산은 `Trip.currency`와 문자열이 같은 항목만 합산하므로, 대소문자/공백 차이 하나로
    같은 통화가 "다른 통화"로 분류돼 합계에서 빠지는 걸 저장 시점에 막는다.
    """
    if value is None:
        return None
    stripped = value.strip().upper()
    return stripped or None


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TripCreate(BaseModel):
    name: str
    destination: str | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    currency: str = "KRW"

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        return _validate_name_length(
            value, field_label="name", max_length=MAX_TRIP_NAME_LENGTH
        )

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

    # `name`은 NOT NULL 컬럼이라 `ItineraryItemUpdate.title`과 같은 이유로 명시적 null을
    # 거부한다. validator가 호출됐다는 것 자체가 클라이언트가 값을 명시적으로 보냈다는
    # 뜻이다(필드를 생략하면 라우터의 model_dump(exclude_unset=True)가 걸러내 validator가
    # 아예 호출되지 않는다). 이걸 막지 않으면 `{"name": null}`이 setattr(trip, "name", None)로
    # 이어져 DB NOT NULL 위반 500이 난다(title에서 실제로 겪었던 버그와 같은 함정).
    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("name must not be null")
        return _validate_name_length(
            value, field_label="name", max_length=MAX_TRIP_NAME_LENGTH
        )


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


class PlaceDetailFields(BaseModel):
    """일정 상세보기에서 보여주고 고치는 선택 필드들(ADR-0011).

    Create와 Update가 **정책이 완전히 같아서**(전부 nullable, 빈 값 = 지움) 한 곳에 모았다.
    `title`/`cost_amount`처럼 생성과 수정의 null 정책이 갈리는 필드는 여기 넣지 않는다.
    """

    place_category: str | None = None
    region_name: str | None = None

    @field_validator("place_category")
    @classmethod
    def _validate_place_category(cls, value: str | None) -> str | None:
        return _normalize_optional_text(
            value, field_label="place_category", max_length=MAX_PLACE_CATEGORY_LENGTH
        )

    @field_validator("region_name")
    @classmethod
    def _validate_region_name(cls, value: str | None) -> str | None:
        return _normalize_optional_text(
            value, field_label="region_name", max_length=MAX_REGION_NAME_LENGTH
        )

    @field_validator("notes", check_fields=False)
    @classmethod
    def _validate_notes(cls, value: str | None) -> str | None:
        # `notes`는 이 믹스인이 선언하지 않고 Create/Update가 각각 가지고 있다
        # (원래 있던 필드의 선언 위치를 옮기지 않기 위함) → `check_fields=False`.
        return _normalize_optional_text(
            value, field_label="notes", max_length=MAX_ITEM_NOTES_LENGTH
        )


class ItineraryItemCreate(PlaceDetailFields):
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
    paid_by: str | None = None
    url: str | None = None

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be empty")
        return _validate_name_length(
            stripped, field_label="title", max_length=MAX_ITINERARY_ITEM_TITLE_LENGTH
        )

    @field_validator("cost_amount")
    @classmethod
    def _validate_cost_amount(cls, value: float | None) -> float | None:
        return _normalize_cost_amount(value)

    @field_validator("cost_currency")
    @classmethod
    def _validate_cost_currency(cls, value: str | None) -> str | None:
        return _normalize_cost_currency(value)

    @field_validator("paid_by")
    @classmethod
    def _validate_paid_by(cls, value: str | None) -> str | None:
        return _normalize_paid_by(value)


class ItineraryItemUpdate(PlaceDetailFields):
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
    paid_by: str | None = None
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
        return _validate_name_length(
            value.strip(), field_label="title", max_length=MAX_ITINERARY_ITEM_TITLE_LENGTH
        )

    # `cost_amount`/`cost_currency`/`paid_by`는 title과 달리 **명시적 null을 허용**한다
    # (셋 다 nullable 컬럼이고, "비용/결제자를 지웠다"는 정상적인 수정이다).
    @field_validator("cost_amount")
    @classmethod
    def _validate_cost_amount(cls, value: float | None) -> float | None:
        return _normalize_cost_amount(value)

    @field_validator("cost_currency")
    @classmethod
    def _validate_cost_currency(cls, value: str | None) -> str | None:
        return _normalize_cost_currency(value)

    @field_validator("paid_by")
    @classmethod
    def _validate_paid_by(cls, value: str | None) -> str | None:
        return _normalize_paid_by(value)


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
    paid_by: str | None
    url: str | None
    # 상세보기용 필드(ADR-0011). 장소를 등록할 때 Places 검색 응답에서 채워지고,
    # 이후로는 사용자가 상세보기에서 직접 고친다.
    place_category: str | None
    region_name: str | None
    # 일정 AI 정렬의 시작점/끝점 지정(ADR-0012). `"start"` / `"end"` / null.
    # **Create/Update 스키마에는 일부러 없다** — 이 값은 "Day당 하나"라는 제약이 있어서
    # 다른 항목의 역할을 함께 지워야 하고, 그건 단일 항목 PATCH가 할 수 있는 일이 아니다.
    # 지정은 `PUT /api/days/{id}/route-endpoints` 한 곳에서만 한다.
    route_role: str | None


class ReorderItemsRequest(BaseModel):
    ordered_item_ids: list[int]


class MoveItemRequest(BaseModel):
    """`POST /api/items/{id}/move` 요청 본문. 일정을 같은 여행의 다른 Day로 옮긴다.

    삽입 위치(`position`)는 받지 않는다 — 항상 목적지 Day의 맨 뒤에 붙이고, 그 안에서의
    순서 조정은 기존 `POST /api/days/{id}/items/reorder`가 담당한다(ADR-0004).
    """

    target_day_id: int


# --- 일정 AI 정렬 (ADR-0012) ----------------------------------------------------
# 한 요청에 담을 수 있는 날짜 수 상한은 "여행 하나가 가질 수 있는 Day 총개수"와 같다
# (`MAX_TRIP_TOTAL_DAYS`). 어차피 그보다 많은 Day는 존재할 수 없으므로 이 상한은
# "말도 안 되게 큰 배열"만 걸러내는 용도다 — 외부 호출이 없어 비용 상한은 필요 없다.


class RouteEndpointsUpdate(BaseModel):
    """`PUT /api/days/{day_id}/route-endpoints` 바디. 그 Day의 시작점/끝점 지정.

    ```jsonc
    {"start_item_id": 12, "end_item_id": 17}   // 지정
    {"start_item_id": null, "end_item_id": null}  // 둘 다 해제
    ```

    PATCH가 아니라 **PUT**인 이유: 두 역할은 함께 의미를 갖고(시작만 있고 끝이 없는 첫날은
    정렬이 실행되지 않는다), 매번 전체를 보내면 "필드 생략 vs 명시적 null"이라는 이
    저장소의 단골 함정이 아예 생기지 않는다. 생략하면 `null`(= 해제)이다.
    """

    start_item_id: int | None = None
    end_item_id: int | None = None


class SortItineraryRequest(BaseModel):
    """`POST /api/trips/{trip_id}/sort-itinerary` 바디.

    `day_ids`는 **연속일 필요가 없다**(Day1과 Day3만 고를 수 있다). 연속성은 선택된 날짜가
    아니라 달력상 전날을 기준으로 판단하므로, 선택되지 않은 Day2의 끝 장소가 Day3의
    시작점이 된다(ADR-0012).
    """

    day_ids: list[int]
    style: str = STYLE_NEAREST

    @field_validator("day_ids")
    @classmethod
    def _validate_day_ids(cls, value: list[int]) -> list[int]:
        deduped = list(dict.fromkeys(value))  # 중복은 무해하므로 거부하지 않고 정리만 한다
        if not deduped:
            raise ValueError("day_ids must not be empty")
        if len(deduped) > MAX_TRIP_TOTAL_DAYS:
            raise ValueError(f"at most {MAX_TRIP_TOTAL_DAYS} days can be sorted at once")
        return deduped

    @field_validator("style")
    @classmethod
    def _validate_style(cls, value: str) -> str:
        # `Literal`로 선언하지 않은 이유: 허용값의 단일 소스는 계산을 실제로 수행하는
        # `services/route_order.py`이고, 스키마가 그 목록을 복사해두면 둘이 어긋날 수 있다.
        if value not in ORDER_STYLES:
            allowed = ", ".join(ORDER_STYLES)
            raise ValueError(f"style must be one of: {allowed}")
        return value


class SortedDayRead(ORMModel):
    """정렬을 수행한 날짜. `changed=false`는 "이미 최적 순서였다"는 뜻이다(실패가 아니다)."""

    day_id: int
    date: dt.date
    item_count: int
    changed: bool
    unlocatable_item_count: int


class DaySortIssueRead(ORMModel):
    """정렬하지 못한 날짜. `reason_code`는 안정적인 영문 식별자이고,
    `message`는 **그대로 화면에 띄울 수 있는 한국어 안내문**이다.

    에러 `detail`(영문 + 프론트에서 한국어 매핑)과 정책이 다른 이유: 이건 실패 응답이 아니라
    200 본문에 담기는 부분 실패 보고라, 날짜/개수 같은 값이 문장에 섞여 들어간다
    (AI 추천의 `warnings`가 이미 같은 방식이다 — ADR-0012).
    """

    day_id: int
    date: dt.date
    reason_code: str
    message: str


class SortItineraryResultRead(ORMModel):
    """정렬 결과. 실패한 날짜가 있어도 200이며, 성공한 날짜는 이미 저장된 상태다.

    sorted_days: 순서를 다시 계산한 날짜 (프론트는 이 day_id들의 일정 캐시만 무효화하면 된다)
    skipped_days: 정렬할 것이 없어 아무것도 하지 않은 날짜 (일정 0~1개) — 조치 불필요
    failed_days: 시작점을 정할 수 없어 실패한 날짜 — **사용자 조치 필요**(안내문 포함)
    """

    trip_id: int
    style: str
    sorted_days: list[SortedDayRead]
    skipped_days: list[DaySortIssueRead]
    failed_days: list[DaySortIssueRead]
    warnings: list[str] = Field(default_factory=list)


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


# --- 앱 전역 설정(마스터 환경설정) --------------------------------------------


class ParticipantRead(ORMModel):
    """참가자 한 명. `key`는 저장/전송에, `name`은 표시에 쓴다.

    프론트는 결제자 선택박스를 `<option value={key}>{name}</option>`로 만들고,
    일정의 `paid_by`(키)를 이 목록에서 찾아 이름으로 바꿔 보여준다.
    """

    key: str
    name: str


class AppSettingsRead(BaseModel):
    participants: list[ParticipantRead]
    # 일정 AI 정렬 기능 온/오프(ADR-0012). 프론트는 이 값으로 버튼을 숨기고,
    # 서버는 같은 값으로 API를 막는다(둘 중 하나만으로는 "껐다"가 지켜지지 않는다).
    route_sort_enabled: bool = True


class AppSettingsUpdate(BaseModel):
    """`PATCH /api/settings` 바디. 바꿀 항목만 담는 부분 갱신.

    ```jsonc
    {"participants": {"participant_1": "새이름"}}   // participant_2는 그대로
    {"route_sort_enabled": false}                  // 참가자 이름은 그대로
    ```

    맵으로 받는 이유: 슬롯 키가 이미 `GET /api/settings` 응답의 어휘라, 프론트가
    `participant_1_name` 같은 필드명을 따로 외우지 않고 받은 키를 그대로 돌려보낼 수 있다.

    **명시적 null은 여기서 422다.** `dict[str, str]` 타입이 `{"participant_1": null}`을
    거부한다 — 이름 컬럼은 NOT NULL이고 "이름 없음"이라는 상태가 이 앱에 존재하지 않기 때문이다
    (`paid_by`와 반대 방향의 판단). "안 바꿈"은 null이 아니라 **키를 빼는 것**으로 표현한다.
    """

    participants: dict[str, str] = Field(default_factory=dict)
    # `None` = "안 바꿈". 컬럼이 NOT NULL이라 명시적 null은 아래 validator가 422로 막는다
    # (참가자 이름과 같은 정책 — "안 바꿈"은 null이 아니라 **필드를 빼는 것**으로 표현한다).
    route_sort_enabled: bool | None = None

    @field_validator("route_sort_enabled")
    @classmethod
    def _validate_route_sort_enabled(cls, value: bool | None) -> bool:
        # 이 validator가 호출됐다는 것 자체가 클라이언트가 값을 명시적으로 보냈다는 뜻이다
        # (필드를 생략하면 기본값 None이 validate_default 없이는 validator를 타지 않는다).
        if value is None:
            raise ValueError("route_sort_enabled must not be null")
        return value

    @field_validator("participants")
    @classmethod
    def _validate_participants(cls, value: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key, name in value.items():
            if key not in PARTICIPANT_KEYS:
                allowed = ", ".join(PARTICIPANT_KEYS)
                raise ValueError(f"unknown participant key '{key}' (allowed: {allowed})")
            stripped = name.strip()
            if not stripped:
                raise ValueError(f"participant name for '{key}' must not be empty")
            if len(stripped) > MAX_PARTICIPANT_NAME_LENGTH:
                raise ValueError(
                    f"participant name for '{key}' must be at most "
                    f"{MAX_PARTICIPANT_NAME_LENGTH} characters"
                )
            normalized[key] = stripped
        return normalized


# --- AI 여행 추천 ---------------------------------------------------------------
# 요청은 **자유 프롬프트가 아니라 고정된 조건 집합**이다. 사용자가 프롬프트를 쓰지 않으므로
# 프롬프트 인젝션 표면이 `extra_notes` 한 필드로 줄어든다(그 한 필드도 길이/제어문자를
# 여기서 막는다). 프롬프트 조립은 서버(`services/ai_trip_suggestion.py`)가 한다. — ADR-0009

# AI 추천 전용 기간 상한. 기존 `MAX_TRIP_DAYS`(90)보다 훨씬 낮다 — 하루가 늘어날 때마다
# LLM 출력 토큰과 Places 검증 호출이 **안(plan) 개수만큼 곱해져서** 늘기 때문이다
# (14일 × 최대 6곳 × 3안 = 최대 252회 조회). 90일을 그대로 허용하면 한 번의 클릭이
# 1,600회 넘는 유료 API 호출이 된다.
AI_SUGGESTION_MAX_DAYS = 14
# 한 요청에 넣을 수 있는 도시 총개수. 많아질수록 프롬프트가 커지고 도시별 앵커 조회가 늘며,
# 무엇보다 "3일에 도시 6곳"처럼 일정 자체가 비현실적이 된다.
AI_SUGGESTION_MAX_CITIES = 3
AI_SUGGESTION_MAX_COUNTRIES = 2
AI_SUGGESTION_MAX_PLANS = 3
AI_SUGGESTION_MAX_EXTRA_NOTES_LENGTH = 200
AI_SUGGESTION_MAX_NAME_LENGTH = 50

SuggestionPace = Literal["relaxed", "normal", "packed"]
SuggestionTheme = Literal["food", "heritage", "landmark", "cafe"]
SuggestionAreaScope = Literal["selected_only", "include_nearby"]


def _clean_place_name(value: str, *, field_label: str) -> str:
    """국가/도시 이름을 정규화한다. 이 값들은 프롬프트와 Places 질의에 그대로 들어간다."""
    stripped = " ".join(value.split())  # 줄바꿈/중복 공백 제거 (프롬프트 구조 보호)
    if not stripped:
        raise ValueError(f"{field_label} must not be empty")
    if len(stripped) > AI_SUGGESTION_MAX_NAME_LENGTH:
        raise ValueError(
            f"{field_label} must be at most {AI_SUGGESTION_MAX_NAME_LENGTH} characters"
        )
    return stripped


class SuggestionRegion(BaseModel):
    """"어느 나라의 어느 도시들" 한 묶음. 여러 나라 여행은 이 묶음을 2개 보낸다.

    별도 `multi_country: bool` 플래그를 두지 않는다 — 플래그와 실제 데이터가 어긋날 수 있고
    (`multi_country=true`인데 나라가 하나), 서버가 필요한 정보는 `len(regions)`로 이미 안다.
    화면의 "여러 나라" 토글은 이 배열에 두 번째 입력 블록을 추가할지만 결정하면 된다.
    """

    country: str
    cities: list[str]

    @field_validator("country")
    @classmethod
    def _validate_country(cls, value: str) -> str:
        return _clean_place_name(value, field_label="country")

    @field_validator("cities")
    @classmethod
    def _validate_cities(cls, value: list[str]) -> list[str]:
        cleaned = [_clean_place_name(city, field_label="city") for city in value]
        if not cleaned:
            raise ValueError("cities must not be empty")
        deduped = list(dict.fromkeys(cleaned))  # 입력 순서 유지 — 첫 도시가 제목의 대표 도시다
        return deduped


class TripSuggestionRequest(BaseModel):
    regions: list[SuggestionRegion]
    start_date: dt.date
    end_date: dt.date
    # "선택한 도시만" vs "주변 도시까지 포함" — 서버가 Places 검증 시 허용 반경으로,
    # 프롬프트에서는 추천 범위 문구로 번역한다.
    area_scope: SuggestionAreaScope = "selected_only"
    pace: SuggestionPace = "normal"
    # 다중 선택. 빈 배열이면 "특별한 테마 없음"으로 프롬프트에 반영한다(에러가 아니다).
    themes: list[SuggestionTheme] = Field(default_factory=list)
    extra_notes: str | None = None
    plan_count: int = AI_SUGGESTION_MAX_PLANS

    @field_validator("regions")
    @classmethod
    def _validate_regions(cls, value: list[SuggestionRegion]) -> list[SuggestionRegion]:
        if not value:
            raise ValueError("regions must not be empty")
        if len(value) > AI_SUGGESTION_MAX_COUNTRIES:
            raise ValueError(f"at most {AI_SUGGESTION_MAX_COUNTRIES} countries are allowed")
        total_cities = sum(len(region.cities) for region in value)
        if total_cities > AI_SUGGESTION_MAX_CITIES:
            raise ValueError(f"at most {AI_SUGGESTION_MAX_CITIES} cities are allowed in total")
        return value

    @field_validator("themes")
    @classmethod
    def _validate_themes(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    @field_validator("extra_notes")
    @classmethod
    def _validate_extra_notes(cls, value: str | None) -> str | None:
        """짧은 자유 텍스트. **프롬프트에 그대로 들어가는 유일한 자유 입력**이라 여기서 막는다.

        제어문자를 지우는 이유는 프롬프트 구조 보호다 — 개행을 허용하면 조립된 프롬프트의
        섹션 경계를 흉내 내는 입력을 만들기 쉬워진다. 길이 상한은 비용(입력 토큰)과
        인젝션 표면을 동시에 줄인다. 내용 자체의 악용은 이 필터가 아니라 **출력 스키마 강제 +
        전 장소 Places 검증**이 막는다(ADR-0009).
        """
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if not cleaned:
            return None
        if len(cleaned) > AI_SUGGESTION_MAX_EXTRA_NOTES_LENGTH:
            raise ValueError(
                f"extra_notes must be at most {AI_SUGGESTION_MAX_EXTRA_NOTES_LENGTH} characters"
            )
        return cleaned

    @field_validator("plan_count")
    @classmethod
    def _validate_plan_count(cls, value: int) -> int:
        if not 1 <= value <= AI_SUGGESTION_MAX_PLANS:
            raise ValueError(f"plan_count must be between 1 and {AI_SUGGESTION_MAX_PLANS}")
        return value

    @model_validator(mode="after")
    def _validate_date_range(self):
        # 기존 여행 생성과 같은 순수 함수로 역전/상한을 먼저 본다(= Day 자동 생성에 안전한 범위).
        # 날짜가 필수(Optional 아님)라 여기서는 항상 실제 검증이 일어난다.
        validate_date_range(self.start_date, self.end_date)
        # 그 위에 AI 전용(더 낮은) 상한을 겹친다.
        span = (self.end_date - self.start_date).days + 1
        if span > AI_SUGGESTION_MAX_DAYS:
            raise ValueError(
                f"ai suggestion cannot span more than {AI_SUGGESTION_MAX_DAYS} days"
            )
        return self


class SuggestedTripRead(BaseModel):
    """생성된 여행 하나의 요약. 프론트는 이 목록을 받고 기존 여행 목록을 invalidate하면 된다
    (전체 `TripRead`를 돌려주지 않는 이유는 ADR-0009 참고 — 목록 화면이 이미 그 데이터를
    스스로 다시 받아오기 때문)."""

    id: int
    name: str
    start_date: dt.date
    end_date: dt.date
    day_count: int
    item_count: int


class TripSuggestionResult(BaseModel):
    """`POST /api/ai/trip-suggestions` 응답.

    `created_trips`가 비어 있는 응답은 없다 — 하나도 만들지 못하면 502다.
    `failed_plan_count`/`dropped_place_count`/`warnings`는 **부분 성공을 숨기지 않기 위한**
    보고 필드다(정산의 `unassigned_*`와 같은 성격).
    """

    created_trips: list[SuggestedTripRead]
    requested_plan_count: int
    failed_plan_count: int
    dropped_place_count: int
    warnings: list[str] = Field(default_factory=list)


# --- 정산(더치페이) 응답 -------------------------------------------------------
# 계산 자체는 `app/services/settlement.py`의 순수 함수가 하고(dataclass 반환),
# 여기 스키마들은 그 결과를 그대로 직렬화한다(`from_attributes=True`).
#
# 정산 응답에는 **키와 이름을 함께** 싣는다. 일정(`ItineraryItemRead`)이 키만 주는 것과
# 다른데, 이유는 성격이 다르기 때문이다: 일정은 캐시에 오래 남는 **저장된 엔티티**라
# 이름을 복사해두면 이름 변경 후 낡은 값이 남지만, 정산은 요청마다 새로 계산하는
# **파생 읽기 모델**이라 계산 시점의 이름을 함께 주는 게 자연스럽다(ADR-0007).


class ParticipantTotalRead(ORMModel):
    participant: ParticipantRead
    paid: float
    item_count: int


class TransferRead(ORMModel):
    """"from_participant가 to_participant에게 amount를 주면 정산 끝"."""

    from_participant: ParticipantRead
    to_participant: ParticipantRead
    amount: float


class CurrencyBucketRead(ORMModel):
    currency: str
    amount: float
    item_count: int


class SettlementRead(ORMModel):
    """`GET /api/trips/{trip_id}/settlement` 응답. 저장되는 값이 아니라 매번 계산한다.

    `transfer`가 null이면 "정산할 것이 없다"(지출이 없거나 이미 균형)는 뜻이다.
    `unassigned_*`와 `excluded_currencies`는 **정산에서 빠진 지출**이라, 프론트가
    "결제자 미지정 N건", "다른 통화 N건은 합산되지 않았습니다"처럼 안내하는 데 쓴다.
    """

    trip_id: int
    currency: str
    participants: list[ParticipantRead]
    per_person: list[ParticipantTotalRead]
    total: float
    per_person_share: float
    transfer: TransferRead | None
    unassigned_amount: float
    unassigned_item_count: int
    excluded_currencies: list[CurrencyBucketRead]
    has_mixed_currency: bool
