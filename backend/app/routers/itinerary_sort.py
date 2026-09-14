"""일정 AI 정렬 라우터 (ADR-0012).

`items.py`(일정 CRUD)에 넣지 않고 분리한 이유는 `checklist.py`/`settlement.py`/`export.py`를
뺀 것과 같다 — 여기 있는 두 엔드포인트는 **하나의 기능**이고, 둘 다 마스터 환경설정의
토글 하나에 함께 매여 있다(꺼지면 둘 다 403).

이 기능은 외부 API를 전혀 호출하지 않는다(순수 좌표 계산). AI 추천 라우터와 달리
`async def`가 아닌 이유이기도 하다 — 기다릴 I/O가 없고, 짧은 DB 작업뿐이다.
"""

import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.models import Day, Trip
from app.schemas import (
    ItineraryItemRead,
    RouteEndpointsUpdate,
    SortItineraryRequest,
    SortItineraryResultRead,
)
from app.services.app_settings import load_app_settings
from app.services.itinerary_sort import (
    InvalidDaySelectionError,
    MissingRouteEndpointsError,
    set_route_endpoints,
    sort_trip_itinerary,
)

router = APIRouter(tags=["itinerary-sort"], dependencies=[Depends(require_session)])

# 같은 여행에 정렬 요청이 동시에 두 건 들어오면, 각자 읽은 순서를 바탕으로 계산한 뒤
# 서로의 `position`을 덮어써 **한 Day 안에 같은 position이 여럿 남을 수 있다**(position에는
# 유니크 제약이 없어서 DB가 막아주지 않는다). 그래서 이 엔드포인트는 한 번에 하나만 돈다.
#
# 트립별 락 딕셔너리가 아니라 **엔드포인트 전역 락 하나**인 이유: 사용자가 2명이고 연산이
# 밀리초 단위라 경합 비용이 실질적으로 0인 반면, 키별 락은 생명주기(언제 지우나) 관리가
# 필요하다. 뒤에 도착한 요청은 409로 거절하지 않고 **기다렸다가 새 데이터로 다시 계산**한다 —
# 이 연산은 같은 입력에 같은 결과를 내므로(결정적) 이어서 도는 것이 항상 안전하다.
#
# **한계**: 이 락은 프로세스 안에서만 유효하다. 워커/인스턴스가 여러 개면 보장이 깨진다
# (Render 무료 티어는 단일 인스턴스다 — ADR-0012의 "감수하는 것" 참고).
_sort_lock = threading.Lock()

_FEATURE_DISABLED_DETAIL = "itinerary sort is disabled in app settings"


def _require_feature_enabled(db: Session) -> None:
    """마스터 환경설정에서 이 기능이 켜져 있는지 확인한다(꺼져 있으면 403).

    프론트가 버튼을 숨기는 것만으로는 부족하다 — 토글은 서버에 있고, API는 그 토글을
    스스로 확인해야 "껐다"는 말이 실제로 지켜진다.

    401(인증)·503(서버 설정 미비)이 아니라 403인 이유: 인증은 이미 통과한 상태이고,
    이건 서버 장애나 미설정이 아니라 **사용자가 스스로 끈 상태**다. 503을 쓰면
    `GEMINI_API_KEY` 미설정(AI 추천)과 같은 칸에 묶여 안내 문구를 구분할 수 없다.
    """
    if not load_app_settings(db).route_sort_enabled:
        raise HTTPException(status_code=403, detail=_FEATURE_DISABLED_DETAIL)


@router.put("/api/days/{day_id}/route-endpoints", response_model=list[ItineraryItemRead])
def put_route_endpoints(
    day_id: int, body: RouteEndpointsUpdate, db: Session = Depends(get_db)
):
    """그 Day의 시작점/끝점을 지정한다(둘 다 한 번에, `null`이면 해제).

    여행 첫날에는 이 지정이 **정렬의 선행 조건**이다(둘째 날부터는 전날의 끝 장소가
    시작점이 되고 끝점은 알고리즘이 정한다 — ADR-0012). 다만 서버는 어느 Day에든 지정을
    허용한다: 규칙이 "지정이 있으면 그것을 고정한다"로 균일해서 특별 취급이 오히려 코드를
    늘리고, 나중에 "이 날만 시작점을 따로 잡고 싶다"가 나와도 서버 변경이 필요 없다.

    응답은 `POST /api/days/{id}/items/reorder`와 같이 **그 Day의 전체 일정 목록**이라,
    프론트가 캐시를 통째로 갈아끼울 수 있다.
    """
    _require_feature_enabled(db)

    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    try:
        items = set_route_endpoints(
            db, day=day, start_item_id=body.start_item_id, end_item_id=body.end_item_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return items


@router.post("/api/trips/{trip_id}/sort-itinerary", response_model=SortItineraryResultRead)
def sort_itinerary(trip_id: int, body: SortItineraryRequest, db: Session = Depends(get_db)):
    """선택한 날짜들의 일정을 최적 방문 순서로 재정렬한다.

    외부 API를 호출하지 않는다(등록된 좌표만으로 계산). 상태 코드:
    200(부분 성공 포함) / 401 / 403(기능 꺼짐) / 404(여행 없음) /
    422(day_ids가 이 여행 것이 아님 · 첫날 시작/끝점 미지정).

    **부분 실패는 200이다.** 어떤 날짜를 정렬하지 못하는 것은 서버 오류가 아니라
    "그 날짜의 데이터가 부족하다"는 상태이고, 다른 날짜는 정상 처리됐기 때문이다
    (정산의 `unassigned_*`, AI 추천의 `failed_plan_count`와 같은 보고 방식).
    전부 실패해도 200이며, 그 사실은 `sorted_days`가 비어 있는 것으로 드러난다.
    """
    # DB를 건드리기 **전에** 락을 잡는다. 먼저 읽어두면 그 스냅샷이 락을 기다리는 동안
    # 낡아버려서, 앞 요청이 방금 커밋한 순서를 못 보고 다시 옛 순서를 기준으로 계산한다.
    with _sort_lock:
        _require_feature_enabled(db)

        trip = db.get(Trip, trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        try:
            result = sort_trip_itinerary(
                db, trip=trip, day_ids=body.day_ids, style=body.style
            )
        except (InvalidDaySelectionError, MissingRouteEndpointsError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result
