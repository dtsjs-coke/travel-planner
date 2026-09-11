"""여행 일정 내보내기 — 지금은 iCalendar(`.ics`) 하나뿐.

`trips.py`에 붙이지 않고 라우터를 분리한 이유는 `settlement.py`/`checklist.py`와 같다:
`trips.py`는 이미 트립 CRUD + Day 동기화만으로 충분히 크고, 내보내기는 `Day`/`ItineraryItem`을
읽어 **다른 포맷으로 렌더링**하는 별개 관심사다.
"""

from collections import defaultdict
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.db import get_db
from app.deps import require_session
from app.models import Day, ItineraryItem, Trip
from app.services.ics_export import IcsDay, IcsItem, build_calendar, ics_filename

router = APIRouter(tags=["export"], dependencies=[Depends(require_session)])


def _content_disposition(filename: str, trip_id: int) -> str:
    """RFC 6266 + RFC 5987. 여행 이름이 한글이면 `filename=`에는 담을 수 없으므로
    ASCII 대체값을 주고 실제 이름은 `filename*`(UTF-8 퍼센트 인코딩)으로 보낸다.
    둘 다 이해하는 브라우저는 `filename*`을 우선한다."""
    ascii_fallback = f"trip-{trip_id}.ics"
    # `safe=""` — `quote`의 기본값은 `/`를 남기는데, 헤더 파라미터에는 `/`도 `,`도 그대로
    # 두면 안 된다(`ics_filename`이 이미 `/`를 지우지만 인코딩 쪽에서도 못 박는다).
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"


@router.get(
    "/api/trips/{trip_id}/export.ics",
    response_class=Response,
    responses={200: {"content": {"text/calendar": {}}, "description": "iCalendar 파일"}},
)
def export_trip_ics(trip_id: int, db: Session = Depends(get_db)):
    """여행 전체 일정을 `.ics` 파일로 내려준다. 저장하지 않고 매 요청마다 생성한다.

    일정이 하나도 없어도 200이며 VEVENT가 0개인 빈 달력을 준다(ADR-0008).
    없는 여행은 404 — 빈 파일로 숨기지 않는다(`get_trip_settlement`와 같은 기준).

    브라우저에서는 `<a href>` 링크 한 줄로 쓸 수 있다: 운영에서는 Vercel `/api/*` rewrite
    덕에 same-origin GET이라 세션 쿠키가 자동으로 실리고, 로컬(5173→8000)은 크로스 오리진이지만
    링크 클릭은 최상위 내비게이션이라 `SameSite=Lax` 쿠키도 실린다.
    """
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    days = db.exec(
        select(Day).where(Day.trip_id == trip_id).order_by(Day.sort_order, Day.date)
    ).all()

    items: list[ItineraryItem] = []
    if days:
        # Day별로 따로 조회하지 않고 한 번에 읽는다(Day 수가 최대 180이라 N+1이 실제로 아프다).
        items = db.exec(
            select(ItineraryItem)
            .where(ItineraryItem.day_id.in_([day.id for day in days]))
            .order_by(ItineraryItem.day_id, ItineraryItem.position)
        ).all()

    items_by_day: dict[int, list[ItineraryItem]] = defaultdict(list)
    for item in items:
        items_by_day[item.day_id].append(item)

    ics_days = [
        IcsDay(
            date=day.date,
            items=[
                IcsItem(
                    id=item.id,
                    title=item.title,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    address=item.address,
                    lat=item.lat,
                    lng=item.lng,
                    notes=item.notes,
                    url=item.url,
                    updated_at=item.updated_at,
                )
                for item in items_by_day[day.id]
            ],
        )
        for day in days
    ]

    body = build_calendar(trip.name, ics_days)
    filename = ics_filename(trip_id, trip.name)

    return Response(
        content=body,
        # charset을 명시하지 않으면 일부 클라이언트가 latin-1로 읽어 한글이 깨진다.
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(filename, trip_id)},
    )
