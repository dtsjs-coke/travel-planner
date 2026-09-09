import datetime as dt
from collections.abc import Sequence
from dataclasses import dataclass, field

from sqlalchemy.exc import IntegrityError

from app.models import Day

# 여행 하나가 가질 수 있는 Day 최대 개수. 오타(예: 2026 -> 2036)로 수천 개의 행이
# 한 번에 생성돼 무료 티어 DB를 소모하는 사고를 막기 위한 상한선.
MAX_TRIP_DAYS = 90

# 기간 PATCH는 범위 밖 Day를 자동 삭제하지 않으므로, 기간을 통째로 옮기는 PATCH를
# 반복하면 (범위 밖 Day + 새로 추가된 Day)가 계속 쌓일 수 있다. MAX_TRIP_DAYS만으로는
# "한 번의 요청"만 막을 뿐 이 누적을 막지 못하므로, 트립 하나가 보유할 수 있는
# Day 총개수에도 상한을 둔다. 기간을 한 번 통째로 옮기는 정상 시나리오
# (범위 밖 최대 90 + 신규 최대 90)는 통과시켜야 하므로 2배로 잡는다.
MAX_TRIP_TOTAL_DAYS = MAX_TRIP_DAYS * 2

# `Day.__table_args__`의 유니크 제약 이름. 이 제약이 "한 여행에 같은 날짜의 Day는 하나"를
# DB 레벨에서 보장한다(애플리케이션 레벨 중복 체크는 동시 트랜잭션을 못 막는다).
DAY_UNIQUE_CONSTRAINT = "uq_day_trip_id_date"

# 유니크 위반 메시지는 DB마다 다르고, SQLite는 제약 이름을 아예 알려주지 않는다.
#   Postgres(운영): 'duplicate key value violates unique constraint "uq_day_trip_id_date"'
#   SQLite(로컬)  : 'UNIQUE constraint failed: day.trip_id, day.date'
# 그래서 제약 이름과 컬럼 조합 둘 다 본다.
_DAY_UNIQUE_MARKERS = (DAY_UNIQUE_CONSTRAINT, "day.trip_id, day.date")


def is_duplicate_day_error(exc: IntegrityError) -> bool:
    """이 IntegrityError가 "같은 여행에 같은 날짜 Day 중복" 위반인지 판별한다.

    IntegrityError를 무조건 409로 바꾸지 않는 이유: NOT NULL 위반이나 FK 위반 같은
    다른 무결성 오류까지 "다른 사용자와 충돌했다"고 잘못 안내하면 진짜 버그가 숨는다.
    이 함수가 False면 호출자는 예외를 그대로 올려보내(=500) 문제를 드러내야 한다.
    """
    message = str(exc.orig) if exc.orig is not None else str(exc)
    return any(marker in message for marker in _DAY_UNIQUE_MARKERS)


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


@dataclass
class DayRangeDiff:
    """기존 Day 목록을 새 기간과 맞춰볼 때 나오는 두 부류.

    to_add:       새 범위 안인데 Day가 없는 날짜들 (아직 DB에 저장 전인 Day 객체)
    out_of_range: 이미 있지만 새 범위를 벗어나는 Day들 (일정이 딸려있을 수 있어
                  서버가 임의로 지우지 않는다 — 사용자 확인용으로 돌려주기만 한다)
    """

    to_add: list[Day] = field(default_factory=list)
    out_of_range: list[Day] = field(default_factory=list)


def diff_days_for_range(
    trip_id: int, start: dt.date, end: dt.date, existing: Sequence[Day]
) -> DayRangeDiff:
    """새 기간(start~end, 양끝 포함) 기준으로 "추가할 Day"와 "범위 밖 Day"를 계산한다.

    삭제는 절대 계산하지 않는다 — 범위 밖 Day에는 이미 일정(ItineraryItem)이
    붙어 있을 수 있어 서버가 임의로 지우면 데이터 손실이 된다. 호출자(라우터)는
    to_add만 저장하고, out_of_range는 응답에 담아 사용자에게 확인을 받는다.

    같은 날짜에 Day가 이미 있으면(수동 생성 포함) 중복 추가하지 않는다.
    DB 저장은 호출자 책임이며, 이 함수 자체는 순수 함수다.
    """
    existing_dates = {day.date for day in existing}
    return DayRangeDiff(
        to_add=[
            day
            for day in build_days_for_range(trip_id, start, end)
            if day.date not in existing_dates
        ],
        out_of_range=sorted(
            (day for day in existing if day.date < start or day.date > end),
            key=lambda day: day.date,
        ),
    )
