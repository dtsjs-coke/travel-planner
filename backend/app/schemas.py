import datetime as dt
import math

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.settlement import PARTICIPANT_KEYS
from app.services.trip_days import validate_date_range

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


class AppSettingsUpdate(BaseModel):
    """`PATCH /api/settings` 바디. 바꿀 슬롯만 담는 부분 갱신 맵.

    ```jsonc
    {"participants": {"participant_1": "새이름"}}   // participant_2는 그대로
    ```

    맵으로 받는 이유: 슬롯 키가 이미 `GET /api/settings` 응답의 어휘라, 프론트가
    `participant_1_name` 같은 필드명을 따로 외우지 않고 받은 키를 그대로 돌려보낼 수 있다.

    **명시적 null은 여기서 422다.** `dict[str, str]` 타입이 `{"participant_1": null}`을
    거부한다 — 이름 컬럼은 NOT NULL이고 "이름 없음"이라는 상태가 이 앱에 존재하지 않기 때문이다
    (`paid_by`와 반대 방향의 판단). "안 바꿈"은 null이 아니라 **키를 빼는 것**으로 표현한다.
    """

    participants: dict[str, str] = Field(default_factory=dict)

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
