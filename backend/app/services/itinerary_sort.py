"""이미 등록된 일정을 날짜별로 **최적 방문 순서**로 재정렬한다 (ADR-0012 → **ADR-0013으로 개정**).

"AI 여행 추천"(ADR-0009/0010)과 이름이 비슷하지만 **완전히 다른 기능**이다:

| | AI 여행 추천 | 일정 AI 정렬 (이 모듈) |
|---|---|---|
| 입력 | 지역/기간/스타일 조건 | **이미 등록된** 일정과 그 좌표 |
| 외부 호출 | Gemini + Google Places | **없음** (순수 계산, 사실상 무료) |
| 출력 | 새 Trip 여러 개 | 기존 항목들의 `position` 재배치 |

LLM이 필요 없는 이유: 등록된 일정에는 이미 `lat`/`lng`가 있고, "시작점에서 출발해 어떤
순서로 도는가"는 **좌표만으로 푸는 기하 문제**다. 실제 순서 계산은 AI 추천과 같은 순수 모듈
(`services/route_order.py`)을 쓴다 — 이 모듈은 그 위에 **날짜 사이의 연속성**을 얹는다.

핵심 규칙(자세한 근거는 ADR-0013. ADR-0012의 `route_role` "핀 고정" 방식은 폐기됐다):

1. **여행의 첫날**: 양 끝을 사용자가 이미 배치해둔 **현재 순서의 첫 항목/마지막 항목**으로
   고정한다(별도 지정 UI 없음). "이게 정말 출발/도착 지점이 맞는지"는 프론트가 정렬을
   실행하기 **전에** 확인 대화상자로 묻고, 서버는 그 확인을 다시 검사하지 않는다.
2. **중간 날짜**: 그날 항목 중 **숙박시설(Google Places 카테고리로 판별)의 개수**가
   양 끝을 정한다 — 2개 이상이면 앞의 것이 시작·뒤의 것이 끝, 1개면 그것이 끝(시작은 전날
   승계), 0개면 시작만 승계하고 끝은 알고리즘이 정한다.
3. **마지막 날**: 끝은 사용자가 확인한 여행 전체 도착점(현재 순서의 마지막 항목)으로 고정하고,
   시작은 전날에서 승계한다.
4. **연속성**: 전날의 마지막 장소가 그날의 시작이 된다. 이 연속성은 "선택된 날짜"가 아니라
   **달력상 인접한 날짜** 기준이다(Day1과 Day3만 골라도 Day3의 앵커는 Day2의 끝 장소다).
   숙소로 앵커가 정해진 날은 **전날의 끝과 그 숙소가 같은 장소인지 검사**하고, 다르면
   그 날짜를 실패로 보고한다(조용히 이어 붙이지 않는다).
5. 앵커를 정할 수 없거나 연속성이 깨진 날짜는 **그 날짜만 실패**로 보고하고 나머지 날짜는
   정상 처리한다(부분 성공 — AI 추천의 `failed_plan_count`/`warnings`와 같은 성격).
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from sqlmodel import Session, select

from app.models import Day, ItineraryItem, Trip
from app.services.route_order import (
    PIN_FIRST,
    PIN_LAST,
    STYLE_NEAREST,
    haversine_km,
    order_day_places,
)

# --- 숙박시설 판별 ---------------------------------------------------------------
# 중간 날짜의 시작/끝을 정하는 유일한 신호다(ADR-0013 결정 2). 사용자가 별도로 "이건 숙소"라고
# 찍는 UI는 없다 — Google Places가 등록 시점에 공짜로 준 카테고리(`place_category`,
# ADR-0011)를 그대로 읽는다.
#
# `place_category`에는 `primaryTypeDisplayName`(구글이 현지화해 준 라벨, 이 앱은 `ko`)이
# 들어가고, 그게 없을 때만 원시 타입 코드(`primaryType`)로 퇴화한다(`google_places.py`의
# `extract_category_label`). 그래서 한국어 라벨과 영문 타입 코드를 **둘 다** 본다.
#
# **부분 문자열**로 찾는 이유: 실제 값이 "리조트 호텔"/"비즈니스 호텔"/"관광 호텔"처럼 수식어를
# 달고 오기 때문이다. 반대로 영문 `inn`은 부분 문자열로 쓰면 "Inner"/"Winner" 같은 말에 걸리므로
# **정확히 일치할 때만** 인정한다.
_LODGING_KEYWORDS: tuple[str, ...] = (
    # 한국어 라벨 — 실제로 저장되는 값의 대부분이 이쪽이다.
    "호텔",
    "모텔",
    "여관",
    "리조트",
    "펜션",
    "민박",
    "게스트하우스",
    "게스트 하우스",
    "호스텔",
    "료칸",
    "콘도",
    "레지던스",
    "숙박",
    "산장",
    "야영장",
    "캠핑장",
    # 영문 라벨 / 원시 타입 코드
    "hotel",
    "motel",
    "hostel",
    "lodging",
    "resort",
    "guest_house",
    "guest house",
    "guesthouse",
    "bed_and_breakfast",
    "bed and breakfast",
    "campground",
    "camping",
    "cottage",
    "farmstay",
    "rv_park",
)
# 부분 문자열로 쓰면 오탐이 나는 짧은 타입 코드들(정확히 일치할 때만 숙소로 본다).
_LODGING_EXACT: frozenset[str] = frozenset(
    {"inn", "japanese_inn", "budget_japanese_inn", "japanese_inn_with_meals", "private_guest_room"}
)
# AI 추천(ADR-0009/0010)이 **생성 시점에** 부여하는 동선 역할 코드. `category`는 장소 분류가
# 아니지만(models.py의 경고 참고) `"lodging"`만은 서버가 직접 넣은 확정적인 표시라, 카테고리
# 문자열 매칭보다 정확하다. **읽기만** 하고 이 모듈이 쓰지는 않는다.
_AI_LODGING_CATEGORY = "lodging"

# 두 장소를 "물리적으로 같은 곳"으로 볼 거리 상한(km). `place_id`가 같으면 이 값을 보지 않고
# 바로 같은 곳이다 — 이 반경은 **같은 호텔이 서로 다른 Places 항목으로 등록된 경우**
# (본관/별관/주차장 등)를 같은 곳으로 묶기 위한 폴백이다.
#
# ADR-0010이 "가까우면 같은 숙소로 본다"를 기각한 것과 모순되지 않는다: 그쪽은 임계값으로
# **서로 다른 호텔을 하나로 합쳐버리는**(사용자 의도를 덮어쓰는) 용도였고, 여기서는 판정이
# 갈려도 결과가 "실패로 보고하고 사용자에게 묻는다"라서 틀렸을 때의 방향이 안전하다.
SAME_PLACE_RADIUS_KM = 0.2

# --- 정렬하지 않은 날짜의 사유 코드 ------------------------------------------------
# `skipped`(조치 불필요) / `failed`(사용자 조치 필요)로 나뉜다. 코드는 안정적인 영문 식별자,
# `message`는 **그대로 화면에 띄울 수 있는 한국어**다 — 에러 `detail`(영문 + 프론트 매핑)과
# 달리 200 응답 본문에 담기는 안내문이라, AI 추천의 `warnings`와 같은 방식을 따른다.
REASON_NO_ITEMS = "no_items"
REASON_SINGLE_ITEM = "single_item"
REASON_NO_COORDINATES = "no_coordinates"
REASON_START_POINT_NO_COORDINATES = "start_point_no_coordinates"
REASON_MISSING_PREVIOUS_DAY = "missing_previous_day"
REASON_PREVIOUS_DAY_EMPTY = "previous_day_empty"
REASON_PREVIOUS_DAY_NO_COORDINATES = "previous_day_no_coordinates"
# --- ADR-0013에서 추가된 사유 코드 ---
REASON_LODGING_NO_COORDINATES = "lodging_no_coordinates"
REASON_LODGING_CONTINUITY_MISMATCH = "lodging_continuity_mismatch"


class InvalidDaySelectionError(ValueError):
    """`day_ids`가 비었거나 이 여행의 Day가 아닌 것이 섞여 있다. 라우터가 422로 바꾼다."""


@dataclass
class _Placed:
    """`order_day_places`가 요구하는 최소 인터페이스(`lat`/`lng`/`pin`)를 채우는 래퍼.

    `ItineraryItem`에 `pin` 속성을 직접 붙이지 않는 이유: 그 모델은 DB 테이블이고,
    매핑되지 않은 속성을 얹으면 "저장되는 값"과 "계산용 임시값"의 경계가 흐려진다.
    """

    item: ItineraryItem
    lat: float | None
    lng: float | None
    pin: str | None


@dataclass(frozen=True)
class DaySortOutcome:
    """정렬을 실제로 수행한 날짜 하나.

    `changed=False`는 실패가 아니라 "이미 최적 순서였다"는 뜻이다(쓰기도 일어나지 않았다).
    """

    day_id: int
    date: dt.date
    item_count: int
    changed: bool
    unlocatable_item_count: int


@dataclass(frozen=True)
class DaySortIssue:
    day_id: int
    date: dt.date
    reason_code: str
    message: str


@dataclass
class SortItineraryResult:
    trip_id: int
    style: str
    sorted_days: list[DaySortOutcome] = field(default_factory=list)
    skipped_days: list[DaySortIssue] = field(default_factory=list)
    failed_days: list[DaySortIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _format_date(value: dt.date) -> str:
    """안내문에 쓰는 짧은 날짜 표기 ("9/2"). 프론트의 Day 라벨과 같은 형식(0 패딩 없음)."""
    return f"{value.month}/{value.day}"


def _coords_of(item: ItineraryItem) -> tuple[float, float] | None:
    if item.lat is None or item.lng is None:
        return None
    return (item.lat, item.lng)


def is_lodging_item(item: ItineraryItem) -> bool:
    """이 일정이 **숙박시설**인가 (ADR-0013 결정 2).

    판별 근거는 두 가지뿐이고, 둘 다 **이미 저장된 값**이라 외부 호출이 0회다:

    1. AI 추천이 붙인 동선 역할 코드 `category == "lodging"` (서버가 직접 넣은 확정적인 표시)
    2. Google Places 카테고리 라벨 `place_category`의 키워드 매칭

    **좌표가 없거나 카테고리가 비어 있는 수동 항목은 숙소로 인식되지 않는다.** 이름만 보고
    "○○호텔"을 숙소로 추정하지 않는 이유: 제목은 사용자가 자유롭게 적는 값이라 "호텔 앞 정류장",
    "호텔 뷔페 점심" 같은 것까지 그날의 시작/끝으로 고정해 버린다. 카테고리는 구글이 장소
    자체에 붙인 분류라 훨씬 안전하다(사용자도 이 트레이드오프를 알고 선택했다).

    다만 `place_category`는 상세보기에서 **사용자가 직접 고칠 수 있는 값**이라(ADR-0011),
    자동 판별이 틀렸을 때 카테고리에 "호텔"이라고 적어 넣는 것이 그대로 탈출구가 된다.
    """
    if (item.category or "").strip().lower() == _AI_LODGING_CATEGORY:
        return True
    label = (item.place_category or "").strip().lower()
    if not label:
        return False
    if label in _LODGING_EXACT:
        return True
    return any(keyword in label for keyword in _LODGING_KEYWORDS)


def _is_same_place(a: ItineraryItem, b: ItineraryItem) -> bool:
    """두 일정이 **물리적으로 같은 장소**를 가리키는가 (연속성 검사용).

    `place_id`가 둘 다 있고 같으면 즉시 같은 곳이다(구글이 같은 장소라고 말한 것보다 강한
    근거는 없다). 다르거나 없으면 좌표 거리로 판정한다 — 같은 호텔이 본관/별관처럼 별도
    Places 항목으로 등록돼 있거나, 한쪽이 수동 입력이라 `place_id`가 없을 수 있다.
    """
    if a.place_id and b.place_id and a.place_id == b.place_id:
        return True
    coords_a, coords_b = _coords_of(a), _coords_of(b)
    if coords_a is None or coords_b is None:
        # 좌표가 없으면 "같다"고 말할 근거가 없다. 호출부가 이 경우를 미리 걸러내지만,
        # 여기서도 근거 없이 같다고 하지 않는다.
        return False
    return haversine_km(coords_a, coords_b) <= SAME_PLACE_RADIUS_KM


def _load_items_by_day(db: Session, day_ids: Iterable[int]) -> dict[int, list[ItineraryItem]]:
    """여행 전체의 일정을 한 번에 읽어 Day별로 나눈다 (정렬 대상이 아닌 Day도 포함).

    선택되지 않은 Day까지 읽는 이유: 연속성은 **선택된 날짜가 아니라 달력상 전날**을 기준으로
    판단하므로(Day1과 Day3만 골라도 Day3의 시작점은 Day2의 끝 장소다), 전날이 선택되지
    않았더라도 그 Day의 마지막 장소를 알아야 한다.

    정렬 기준에 `id`를 함께 넣는 이유: `position`이 같은 행이 존재할 수 있고(과거 데이터),
    그때 순서가 흔들리면 같은 입력에 다른 결과가 나온다.
    """
    ids = list(day_ids)
    if not ids:
        return {}
    rows = db.exec(
        select(ItineraryItem)
        .where(ItineraryItem.day_id.in_(ids))  # type: ignore[attr-defined]
        .order_by(ItineraryItem.position, ItineraryItem.id)
    ).all()
    grouped: dict[int, list[ItineraryItem]] = defaultdict(list)
    for row in rows:
        grouped[row.day_id].append(row)
    return grouped


def _last_locatable(items: Sequence[ItineraryItem]) -> ItineraryItem | None:
    """그 Day의 **마지막 장소**(뒤에서부터 좌표가 있는 첫 항목).

    `route_order.last_coords()`와 같은 규칙이지만 좌표가 아니라 **항목**을 돌려준다 —
    연속성 검사가 거리뿐 아니라 `place_id`도 비교하기 때문이다(`_is_same_place`).
    """
    for item in reversed(list(items)):
        if _coords_of(item) is not None:
            return item
    return None


def sort_trip_itinerary(
    db: Session, *, trip: Trip, day_ids: Sequence[int], style: str = STYLE_NEAREST
) -> SortItineraryResult:
    """선택된 날짜들의 일정 순서를 다시 계산해 저장한다.

    **쓰기는 마지막에 한 번의 커밋으로 끝난다.** 날짜별로 커밋하면 중간에 실패했을 때
    "앞쪽 날짜만 새 순서, 뒤쪽은 옛 순서"가 남는데, 이 기능은 날짜 사이의 연속성이 전부라
    그런 중간 상태가 사용자에게 가장 혼란스럽다. 반대로 **날짜별 '실패'는 애초에 쓰기를
    만들지 않으므로**, 한 번의 커밋과 부분 성공은 서로 모순되지 않는다.
    """
    days = db.exec(
        select(Day).where(Day.trip_id == trip.id).order_by(Day.date)
    ).all()
    days_by_id = {day.id: day for day in days}
    day_by_date = {day.date: day for day in days}

    selected_ids = list(dict.fromkeys(day_ids))  # 중복 제거(입력 순서 유지) — 중복은 무해하다
    if not selected_ids:
        raise InvalidDaySelectionError("day_ids must not be empty")
    unknown = [day_id for day_id in selected_ids if day_id not in days_by_id]
    if unknown:
        # 다른 여행의 Day이거나 없는 Day. `move_item`과 같은 기준으로 404가 아니라 422다
        # ("존재하지만 이 요청에서 유효한 대상이 아니다"). 하나라도 섞이면 아무것도 하지 않는다.
        raise InvalidDaySelectionError("all day_ids must belong to this trip")

    items_by_day = _load_items_by_day(db, days_by_id.keys())

    # "첫날"/"마지막 날"은 `trip.start_date`/`end_date`가 아니라 **실제로 존재하는 Day 중
    # 가장 이른 것/가장 늦은 것**이다. 기간 PATCH가 범위 밖 Day를 지우지 않으므로(ADR-0001)
    # 둘은 어긋날 수 있고, 사용자가 화면에서 보는 Day 탭은 후자다.
    first_day = days[0] if days else None
    last_day = days[-1] if days else None

    result = SortItineraryResult(trip_id=trip.id, style=style)
    selected_set = set(selected_ids)
    # Day별 "그날의 마지막 장소(항목)" 캐시. 정렬한 날은 새 순서 기준으로 갱신되고, 정렬하지
    # 않은 날(선택 안 됨/실패)은 현재 순서 기준이다 — 둘 다 "사용자가 보는 마지막 장소"다.
    end_item_cache: dict[int, ItineraryItem | None] = {}

    def end_item_of(day: Day) -> ItineraryItem | None:
        if day.id not in end_item_cache:
            end_item_cache[day.id] = _last_locatable(items_by_day.get(day.id, []))
        return end_item_cache[day.id]

    pending_updates: list[tuple[ItineraryItem, int]] = []
    total_unlocatable = 0

    # 선택된 날짜만 처리하되 **날짜 오름차순**으로 돈다. 앞선 날짜의 새 순서가 다음 날짜의
    # 시작 앵커가 되므로(요구사항의 연속성), 처리 순서 자체가 규칙의 일부다.
    for day in days:
        if day.id not in selected_set:
            continue
        items = items_by_day.get(day.id, [])

        if not items:
            result.skipped_days.append(
                DaySortIssue(day.id, day.date, REASON_NO_ITEMS, "등록된 일정이 없어 정렬하지 않았습니다.")
            )
            continue
        if len(items) == 1:
            result.skipped_days.append(
                DaySortIssue(day.id, day.date, REASON_SINGLE_ITEM, "일정이 1개뿐이라 정렬할 것이 없습니다.")
            )
            continue

        locatable_count = sum(1 for item in items if _coords_of(item) is not None)
        if locatable_count == 0:
            # 좌표가 하나도 없으면 거리를 계산할 대상 자체가 없다. 자동 geocode는 하지 않는다
            # (외부 API 호출 = 비용, 이 기능이 무료인 이유 자체를 깨뜨린다 — ADR-0012).
            result.failed_days.append(
                DaySortIssue(
                    day.id,
                    day.date,
                    REASON_NO_COORDINATES,
                    "좌표가 있는 장소가 없어 순서를 계산할 수 없습니다. "
                    "구글 장소 검색으로 일정을 등록하거나 다시 추가해주세요.",
                )
            )
            continue

        is_first_day = first_day is not None and day.id == first_day.id
        is_last_day = last_day is not None and day.id == last_day.id

        start_pin: ItineraryItem | None = None
        end_pin: ItineraryItem | None = None
        inherited_anchor: tuple[float, float] | None = None

        if is_first_day:
            # --- 여행의 첫날: 양 끝이 곧 여행의 출발점과 그날의 종점이다 --------------
            # 사용자가 드래그로 이미 배치해둔 **현재 순서의 처음/마지막**을 그대로 쓴다.
            # "정말 이게 맞는지"는 프론트가 실행 전에 확인 대화상자로 물었다(ADR-0013 결정 1)
            # — 서버가 그 확인을 다시 검사할 방법도, 이유도 없다.
            start_pin = items[0]
            end_pin = items[-1]
            if _coords_of(start_pin) is None:
                # 출발점에 좌표가 없으면 앵커가 없어 나머지를 어디서부터 이을지 알 수 없다.
                result.failed_days.append(
                    DaySortIssue(
                        day.id,
                        day.date,
                        REASON_START_POINT_NO_COORDINATES,
                        "첫날의 첫 일정(여행 출발 지점)에 좌표가 없어 순서를 계산할 수 없습니다. "
                        "구글 장소 검색으로 등록한 일정을 맨 앞에 두거나, 그 일정을 다시 등록해주세요.",
                    )
                )
                continue
        else:
            # --- 둘째 날 이후: 시작은 전날에서 승계한다 -------------------------------
            previous_date = day.date - dt.timedelta(days=1)
            previous_day = day_by_date.get(previous_date)
            if previous_day is None:
                result.failed_days.append(
                    DaySortIssue(
                        day.id,
                        day.date,
                        REASON_MISSING_PREVIOUS_DAY,
                        f"전날({_format_date(previous_date)})이 이 여행에 없어 시작점을 정할 수 없습니다. "
                        "그 날짜를 추가해주세요.",
                    )
                )
                continue
            previous_item = end_item_of(previous_day)
            if previous_item is None:
                previous_items = items_by_day.get(previous_day.id, [])
                if not previous_items:
                    reason, detail = (
                        REASON_PREVIOUS_DAY_EMPTY,
                        f"전날({_format_date(previous_date)})에 일정이 없어 시작점을 정할 수 없습니다. "
                        "전날 일정을 확인하거나 추가해주세요.",
                    )
                else:
                    reason, detail = (
                        REASON_PREVIOUS_DAY_NO_COORDINATES,
                        f"전날({_format_date(previous_date)}) 일정에 좌표가 있는 장소가 없어 "
                        "시작점을 정할 수 없습니다. 전날 일정을 확인해주세요.",
                    )
                result.failed_days.append(DaySortIssue(day.id, day.date, reason, detail))
                continue
            inherited_anchor = _coords_of(previous_item)

            # --- 끝점: 마지막 날은 여행의 도착점, 중간 날은 숙소 ------------------------
            lodgings = [item for item in items if is_lodging_item(item)]
            if is_last_day:
                # 사용자가 확인한 "여행 전체 도착점". 마지막 날에는 숙소 규칙을 쓰지 않는다
                # (체크아웃한 날이라 그날의 끝은 숙소가 아니라 공항/역이다).
                end_pin = items[-1]
            elif lodgings:
                # 숙박 항목이 여럿이면 **마지막에 오는 것**이 그날의 끝이다.
                end_pin = lodgings[-1]

            # --- 시작 앵커로 쓸 숙소(끝점으로 이미 쓰인 항목은 제외) --------------------
            # 숙박 2개 이상 = "숙소를 옮기는 날"의 모양이다(어젯밤 묵은 곳 → 오늘 묵을 곳).
            start_candidates = [item for item in lodgings if item is not end_pin]
            continuity_ref: ItineraryItem | None = None
            if start_candidates:
                start_pin = start_candidates[0]
                continuity_ref = start_pin
            elif not is_last_day and len(lodgings) == 1:
                # 숙박 1개(중간 날) = "같은 숙소에 계속 묵는 날". 시작은 전날에서 승계하지만,
                # 그 승계가 성립하려면 **전날의 끝과 오늘의 숙소가 같은 곳**이어야 한다.
                # 그 전제를 아래에서 실제로 검사한다.
                continuity_ref = lodgings[0]

            if continuity_ref is not None:
                if _coords_of(continuity_ref) is None:
                    result.failed_days.append(
                        DaySortIssue(
                            day.id,
                            day.date,
                            REASON_LODGING_NO_COORDINATES,
                            "숙소로 판정된 일정에 좌표가 없어 전날과의 연결을 확인할 수 없습니다. "
                            "구글 장소 검색으로 숙소를 다시 등록해주세요.",
                        )
                    )
                    continue
                if not _is_same_place(previous_item, continuity_ref):
                    # 숙소를 바꿔 잡는 여행일 수 있으므로 **조용히 이어 붙이지 않는다**.
                    # 그 경우의 올바른 모양은 "그날 일정에 전날 숙소와 오늘 숙소를 둘 다 넣기"다
                    # (그러면 숙박 2개가 되어 앞의 것이 시작, 뒤의 것이 끝으로 잡힌다).
                    result.failed_days.append(
                        DaySortIssue(
                            day.id,
                            day.date,
                            REASON_LODGING_CONTINUITY_MISMATCH,
                            f"전날({_format_date(previous_date)})의 마지막 장소"
                            f"(\"{previous_item.title}\")와 이 날의 숙소"
                            f"(\"{continuity_ref.title}\")가 서로 다른 곳입니다. "
                            "숙소를 옮기는 날이라면 전날 묵은 숙소도 이 날 일정에 함께 넣어주세요. "
                            "같은 숙소가 맞다면 전날 일정의 마지막이 그 숙소인지 확인해주세요.",
                        )
                    )
                    continue

        placed = [
            _Placed(
                item=item,
                lat=item.lat,
                lng=item.lng,
                pin=(
                    PIN_FIRST
                    if item is start_pin
                    else PIN_LAST
                    if item is end_pin
                    else None
                ),
            )
            for item in items
        ]
        # 앵커는 (a) PIN_FIRST 항목이 있으면 그 좌표를 `order_day_places`가 직접 읽고,
        # (b) 없으면 여기서 넘기는 `start`(= 전날의 끝 좌표)다.
        ordered = order_day_places(placed, start=inherited_anchor, style=style)
        ordered_items = [placed_item.item for placed_item in ordered]

        changed = False
        for index, item in enumerate(ordered_items):
            if item.position != index:
                changed = True
                pending_updates.append((item, index))

        # 새 순서 기준으로 다음 날의 앵커를 갱신한다. (정렬로 마지막 장소가 바뀌었을 수 있다.)
        end_item_cache[day.id] = _last_locatable(ordered_items)
        items_by_day[day.id] = ordered_items

        unlocatable = len(items) - locatable_count
        total_unlocatable += unlocatable
        result.sorted_days.append(
            DaySortOutcome(
                day_id=day.id,
                date=day.date,
                item_count=len(items),
                changed=changed,
                unlocatable_item_count=unlocatable,
            )
        )

    for item, position in pending_updates:
        item.position = position
        db.add(item)
    if pending_updates:
        # 한 번의 커밋 = 원자성. 여기서 실패하면 아무 날짜도 바뀌지 않는다.
        db.commit()

    if total_unlocatable:
        result.warnings.append(
            f"좌표가 없는 일정 {total_unlocatable}건은 순서 계산에서 제외하고 뒤쪽에 그대로 두었습니다. "
            "구글 장소 검색으로 등록한 일정만 거리 계산에 쓸 수 있습니다."
        )
    return result
