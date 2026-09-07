import datetime as dt

from app.models import Day

# 여행 하나가 가질 수 있는 Day 최대 개수. 오타(예: 2026 -> 2036)로 수천 개의 행이
# 한 번에 생성돼 무료 티어 DB를 소모하는 사고를 막기 위한 상한선.
MAX_TRIP_DAYS = 90


def validate_date_range(start: dt.date | None, end: dt.date | None) -> None:
    """여행 기간(start~end)이 Day 자동 생성에 쓰기 안전한 범위인지 검증한다.

    유효하지 않으면 ValueError를 던진다 (호출자가 컨텍스트에 맞게 변환:
    pydantic validator는 그대로 두면 422, 라우터는 HTTPException(422)으로 감쌈).

    둘 중 하나라도 없으면 비교할 대상이 없으므로 통과시킨다 —
    날짜가 둘 다 있을 때만 Day를 생성한다는 기존 `create_trip` 정책과 동일한 기준.
    """
    if start is None or end is None:
        return
    if end < start:
        raise ValueError("end_date must be on or after start_date")
    if (end - start).days + 1 > MAX_TRIP_DAYS:
        raise ValueError(f"trip cannot span more than {MAX_TRIP_DAYS} days")


def build_days_for_range(trip_id: int, start: dt.date, end: dt.date) -> list[Day]:
    """start~end(양끝 포함) 각 날짜에 대한 Day 객체 목록을 만든다 (DB 저장은 호출자 책임).

    sort_order는 0으로 둔다 — 조회 시 (sort_order, date)로 정렬되므로 날짜순이 되고,
    나중에 단건 API로 추가되는 Day(sort_order 기본값 0)와도 정렬 기준이 어긋나지 않는다.
    """
    return [
        Day(trip_id=trip_id, date=start + dt.timedelta(days=offset))
        for offset in range((end - start).days + 1)
    ]
