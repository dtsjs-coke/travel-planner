"""이미 등록된 일정을 날짜별로 **최적 방문 순서**로 재정렬한다 (ADR-0012).

"AI 여행 추천"(ADR-0009/0010)과 이름이 비슷하지만 **완전히 다른 기능**이다:

| | AI 여행 추천 | 일정 AI 정렬 (이 모듈) |
|---|---|---|
| 입력 | 지역/기간/스타일 조건 | **이미 등록된** 일정과 그 좌표 |
| 외부 호출 | Gemini + Google Places | **없음** (순수 계산, 사실상 무료) |
| 출력 | 새 Trip 여러 개 | 기존 항목들의 `position` 재배치 |

LLM이 필요 없는 이유: 등록된 일정에는 이미 `lat`/`lng`가 있고, "시작점에서 출발해 어떤
순서로 도는가"는 **좌표만으로 푸는 기하 문제**다. 실제 순서 계산은 AI 추천과 같은 순수 모듈
(`services/route_order.py`)을 쓴다 — 이 모듈은 그 위에 **날짜 사이의 연속성**을 얹는다.

핵심 규칙(자세한 근거는 ADR-0012):

1. 어떤 날의 시작 앵커는 (a) 그 Day에 사용자가 지정한 `route_role == "start"` 항목,
   (b) 없으면 **달력상 전날**(선택 여부와 무관)의 마지막 장소다.
2. 여행의 첫날은 (b)가 존재할 수 없으므로 (a)가 **필수**다 — 그래서 첫날만 시작점/끝점을
   사용자가 직접 고른다. 둘째 날부터는 끝점을 알고리즘이 정한다(= 그날 마지막 방문지).
3. (a)도 (b)도 못 구하면 **그 날짜만 실패**로 보고하고 나머지 날짜는 정상 처리한다
   (부분 성공 — AI 추천의 `failed_plan_count`/`warnings`와 같은 성격).
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
    last_coords,
    order_day_places,
)

# 사용자가 지정하는 동선 역할. `ItineraryItem.route_role`에 이 값이 그대로 저장된다.
# `category`(AI가 생성 시점에 넣는 `arrival`/`lodging` 등)와 별개의 컬럼인 이유는 ADR-0012.
ROUTE_ROLE_START = "start"
ROUTE_ROLE_END = "end"
ROUTE_ROLES: tuple[str, ...] = (ROUTE_ROLE_START, ROUTE_ROLE_END)

_ROLE_TO_PIN = {ROUTE_ROLE_START: PIN_FIRST, ROUTE_ROLE_END: PIN_LAST}

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


class InvalidDaySelectionError(ValueError):
    """`day_ids`가 비었거나 이 여행의 Day가 아닌 것이 섞여 있다. 라우터가 422로 바꾼다."""


class MissingRouteEndpointsError(ValueError):
    """여행 첫날의 시작점/끝점이 지정되지 않았다. 라우터가 422로 바꾼다.

    이 한 가지만 **날짜별 실패가 아니라 요청 전체를 막는 422**다. 나머지 실패 사유와 달리
    "데이터가 모자란다"가 아니라 "사용자가 먼저 골라야 하는 입력이 빠졌다"에 가깝고,
    프론트는 이걸 받아 "시작점과 끝점을 정했는지" 확인하는 알림을 띄운다(ADR-0012).
    """


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


def _find_role(items: Sequence[ItineraryItem], role: str) -> ItineraryItem | None:
    """그 Day에서 해당 역할을 가진 첫 항목. 역할은 Day당 최대 하나로 유지되지만
    (`set_route_endpoints`), 혹시 여럿이어도 조용히 첫 번째를 쓰고 넘어간다 —
    표시 순서가 애매해질 뿐 데이터가 손상되는 상황이 아니다."""
    for item in items:
        if item.route_role == role:
            return item
    return None


def set_route_endpoints(
    db: Session, *, day: Day, start_item_id: int | None, end_item_id: int | None
) -> list[ItineraryItem]:
    """그 Day의 시작점/끝점 지정을 **통째로 교체**한다(PUT 의미론).

    두 값을 한 번에 받는 이유: "시작점만 바꾸기"와 "끝점만 바꾸기"를 따로 두면 둘이 같은
    항목을 가리키는 중간 상태를 화면에서 만들 수 있고, 프론트도 두 번 호출해야 한다.
    `null`을 보내면 그 역할을 지운다.

    같은 Day의 다른 항목이 갖고 있던 같은 역할은 **같은 트랜잭션에서 지운다** —
    "Day당 역할 하나"를 DB 제약 대신 이 함수가 보장한다(ADR-0012).
    """
    items = db.exec(
        select(ItineraryItem)
        .where(ItineraryItem.day_id == day.id)
        .order_by(ItineraryItem.position, ItineraryItem.id)
    ).all()
    items_by_id = {item.id: item for item in items}

    requested = {
        ROUTE_ROLE_START: start_item_id,
        ROUTE_ROLE_END: end_item_id,
    }
    for item_id in requested.values():
        if item_id is not None and item_id not in items_by_id:
            # 다른 Day/다른 여행의 항목이거나 없는 항목. 존재 여부를 따로 알려주지 않고
            # 둘 다 422로 묶는다 — 어느 쪽이든 "이 Day의 시작/끝점이 될 수 없다"는 같은 문제다.
            raise ValueError("route endpoint items must belong to this day")
    if start_item_id is not None and start_item_id == end_item_id:
        # 한 항목은 position이 하나뿐이라 목록의 맨 앞이면서 맨 뒤일 수 없다.
        raise ValueError("start and end points must be different items")

    for item in items:
        desired = None
        for role, item_id in requested.items():
            if item_id == item.id:
                desired = role
        if item.route_role != desired:
            item.route_role = desired
            db.add(item)
    db.commit()
    return list(items_by_id.values())


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

    # --- 여행 첫날 사전 검사 ------------------------------------------------------
    # "첫날"은 `trip.start_date`가 아니라 **실제로 존재하는 Day 중 가장 이른 것**이다.
    # 기간 PATCH가 범위 밖 Day를 지우지 않으므로(ADR-0001) 둘은 어긋날 수 있고, 사용자가
    # 화면에서 보는 첫 번째 Day 탭은 후자다.
    if days:
        first_day = days[0]
        first_day_items = items_by_day.get(first_day.id, [])
        if first_day.id in selected_ids and len(first_day_items) >= 2:
            has_start = _find_role(first_day_items, ROUTE_ROLE_START) is not None
            has_end = _find_role(first_day_items, ROUTE_ROLE_END) is not None
            if not (has_start and has_end):
                raise MissingRouteEndpointsError(
                    "the first day of this trip must have its start and end points designated"
                )

    result = SortItineraryResult(trip_id=trip.id, style=style)
    selected_set = set(selected_ids)
    # Day별 "그날의 마지막 좌표" 캐시. 정렬한 날은 새 순서 기준으로 갱신되고, 정렬하지
    # 않은 날(선택 안 됨/실패)은 현재 순서 기준이다 — 둘 다 "사용자가 보는 마지막 장소"다.
    end_coords_cache: dict[int, tuple[float, float] | None] = {}

    def end_coords_of(day: Day) -> tuple[float, float] | None:
        if day.id not in end_coords_cache:
            end_coords_cache[day.id] = last_coords(
                [
                    _Placed(item=item, lat=item.lat, lng=item.lng, pin=None)
                    for item in items_by_day.get(day.id, [])
                ]
            )
        return end_coords_cache[day.id]

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

        start_item = _find_role(items, ROUTE_ROLE_START)
        anchor: tuple[float, float] | None = None
        if start_item is not None:
            if _coords_of(start_item) is None:
                result.failed_days.append(
                    DaySortIssue(
                        day.id,
                        day.date,
                        REASON_START_POINT_NO_COORDINATES,
                        "시작점으로 지정한 일정에 좌표가 없어 순서를 계산할 수 없습니다. "
                        "구글 장소 검색으로 등록한 일정을 시작점으로 지정해주세요.",
                    )
                )
                continue
            # 앵커는 `order_day_places`가 PIN_FIRST 항목에서 직접 읽는다(여기서는 넘기지 않는다).
        else:
            previous_date = day.date - dt.timedelta(days=1)
            previous_day = day_by_date.get(previous_date)
            if previous_day is None:
                result.failed_days.append(
                    DaySortIssue(
                        day.id,
                        day.date,
                        REASON_MISSING_PREVIOUS_DAY,
                        f"전날({_format_date(previous_date)})이 이 여행에 없어 시작점을 정할 수 없습니다. "
                        "그 날짜를 추가하거나, 이 날의 시작점을 직접 지정해주세요.",
                    )
                )
                continue
            anchor = end_coords_of(previous_day)
            if anchor is None:
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

        placed = [
            _Placed(
                item=item,
                lat=item.lat,
                lng=item.lng,
                pin=_ROLE_TO_PIN.get(item.route_role or ""),
            )
            for item in items
        ]
        ordered = order_day_places(placed, start=anchor, style=style)
        ordered_items = [placed_item.item for placed_item in ordered]

        changed = False
        for index, item in enumerate(ordered_items):
            if item.position != index:
                changed = True
                pending_updates.append((item, index))

        # 새 순서 기준으로 다음 날의 앵커를 갱신한다. (정렬로 마지막 장소가 바뀌었을 수 있다.)
        end_coords_cache[day.id] = last_coords(ordered)
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
