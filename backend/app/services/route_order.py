"""하루 동선의 방문 순서를 좌표 기준으로 재정렬한다 (순수 계산 — DB/HTTP/LLM을 모른다).

LLM이 제안한 순서는 쓰지 않는다. LLM은 "무엇을 갈지"를 고르고, "어떤 순서로 갈지"는
실제 좌표를 가진 서버가 정한다(ADR-0009). 이 모듈이 그 규칙의 단일 소스다.

정교한 TSP는 하지 않는다 — 하루 방문지가 2~5곳이라 최근접 이웃(greedy)과 최적해의 차이가
거의 없고, 있어도 "차로 5분"이다. 대신 **고정 위치 규칙**이 실제 사용성을 결정한다:

- `PIN_FIRST`(이동/공항/역): 그날의 시작점이다. 도착하기 전에 관광할 수는 없다.
- `PIN_LAST`(숙소): 그날의 끝점이다. 체크인하고 다시 나갈 수는 있지만, 일정표상 숙소는
  하루의 마지막 줄에 있는 게 읽기 자연스럽다.
- 나머지: 시작 앵커에서 최근접 이웃으로 잇는다.

시작 앵커(`start`)는 호출자가 준다 — 첫날은 도착 공항/역, 둘째날 이후는 **전날 숙소**다.
이게 "첫날 숙소가 둘째날 일정의 시작점"이라는 연속성 요구를 구현하는 지점이다.
"""

from __future__ import annotations

import math
from typing import Protocol, Sequence, TypeVar

# 고정 위치 표식. 문자열 상수로 두는 이유: 이 모듈은 "숙소"나 "공항" 같은 도메인 개념을
# 몰라야 하고(호출자가 kind → pin으로 번역한다), 그래야 순수 함수로 남는다.
PIN_FIRST = "first"
PIN_LAST = "last"

EARTH_RADIUS_KM = 6371.0088


class Positioned(Protocol):
    """이 모듈이 필요로 하는 최소 인터페이스. `lat`/`lng`가 None이면 좌표 없는 항목이다."""

    lat: float | None
    lng: float | None
    pin: str | None


P = TypeVar("P", bound=Positioned)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """두 좌표(위도, 경도) 사이의 대권 거리(km).

    도로 거리가 아니라 직선 거리다 — Directions API를 부르면 정확해지지만 호출 수가
    (지점 수)^2로 늘어난다(백로그 Tier 2의 "이동시간 표시"가 그 논의를 따로 갖고 있다).
    하루 반경 수십 km 안에서 방문 순서를 정하는 데는 직선 거리로 충분하다.
    """
    lat1, lng1 = a
    lat2, lng2 = b
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lng2 - lng1)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, h)))


def _coords(item: Positioned) -> tuple[float, float] | None:
    if item.lat is None or item.lng is None:
        return None
    return (item.lat, item.lng)


def order_day_places(
    places: Sequence[P], *, start: tuple[float, float] | None = None
) -> list[P]:
    """하루치 방문지를 방문 순서대로 재배열한다 (입력 객체를 수정하지 않는다).

    규칙:
    1. `pin == PIN_FIRST`인 항목은 주어진 순서 그대로 맨 앞.
    2. `pin == PIN_LAST`인 항목은 주어진 순서 그대로 맨 뒤.
    3. 나머지는 앵커에서 시작하는 최근접 이웃 순서. 앵커는 (a) 마지막 PIN_FIRST 항목의 좌표,
       (b) 없으면 인자로 받은 `start`, (c) 둘 다 없으면 앵커 없이 **입력 순서 유지**.
    4. 좌표가 없는 항목(lat/lng None)은 거리를 계산할 수 없으므로 재정렬 대상에서 빼고
       중간 그룹의 맨 뒤에 입력 순서로 붙인다. 순서를 지어내지 않는다.
    """
    firsts = [p for p in places if p.pin == PIN_FIRST]
    lasts = [p for p in places if p.pin == PIN_LAST]
    middles = [p for p in places if p.pin not in (PIN_FIRST, PIN_LAST)]

    locatable = [p for p in middles if _coords(p) is not None]
    unlocatable = [p for p in middles if _coords(p) is None]

    anchor: tuple[float, float] | None = None
    for candidate in firsts:
        coords = _coords(candidate)
        if coords is not None:
            anchor = coords  # 여러 개면 마지막 PIN_FIRST가 실제 출발점이다
    if anchor is None:
        anchor = start

    if anchor is None:
        # 앵커가 없으면 "어디서 출발하는지"를 모른다. 임의 지점을 골라 최근접 이웃을 돌리면
        # 입력 순서를 근거 없이 뒤섞는 것이라(LLM이 준 순서보다 나을 이유가 없다) 그냥 둔다.
        ordered_middles = list(locatable)
    else:
        remaining = list(locatable)
        ordered_middles = []
        cursor = anchor
        while remaining:
            nearest = min(remaining, key=lambda p: haversine_km(cursor, _coords(p)))  # type: ignore[arg-type]
            remaining.remove(nearest)
            ordered_middles.append(nearest)
            cursor = _coords(nearest)  # type: ignore[assignment]

    return [*firsts, *ordered_middles, *unlocatable, *lasts]


def last_coords(places: Sequence[P]) -> tuple[float, float] | None:
    """정렬이 끝난 하루 일정의 **마지막 좌표** — 다음 날의 시작 앵커로 쓴다.

    뒤에서부터 좌표가 있는 첫 항목을 찾는다(마지막 항목이 좌표 없는 항목일 수 있다).
    """
    for item in reversed(list(places)):
        coords = _coords(item)
        if coords is not None:
            return coords
    return None
