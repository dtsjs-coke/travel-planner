"""여행 일정 → iCalendar(`.ics`, RFC 5545) 텍스트 변환.

DB도 HTTP도 모르는 **순수 모듈**이다(`trip_days.py`/`settlement.py`와 같은 패턴).
라우터가 ORM 행을 아래 `IcsItem`/`IcsDay` 데이터클래스로 옮겨 담아 넘기고, 이 모듈은
그 값만 보고 문자열을 만든다 — 덕분에 DB/브라우저 없이 출력 전체를 검증할 수 있다.

설계 결정(시간 없는 일정의 표현, 시간대, UID 안정성, 라이브러리 미사용)은 ADR-0008 참고.

RFC 5545에서 실수하기 쉬운 지점 세 가지를 이 모듈이 책임진다:

1. **줄바꿈은 반드시 CRLF**(`\\r\\n`). LF만 쓰면 일부 파서가 파일 전체를 한 줄로 본다.
2. **TEXT 값 이스케이프** — `\\` `;` `,` 와 줄바꿈. 이걸 빠뜨리면 쉼표가 든 제목 하나가
   그 속성을 두 값으로 쪼개서 이벤트가 통째로 깨진다.
3. **한 줄 75 옥텟 제한과 접기(folding)** — 한글은 UTF-8에서 3바이트라 25자만 넘어도
   걸린다. 접을 때 **문자가 아니라 옥텟**을 세야 하고, 멀티바이트 문자 중간에서 자르면 안 된다.
"""

import datetime as dt
import math
import re
from collections.abc import Sequence
from dataclasses import dataclass, field

# PRODID는 "이 파일을 만든 제품"을 나타내는 필수 속성이다. 형식은 관례적으로 FPI.
PRODID = "-//travel-planner//Travel Planner ICS Export//KO"

# UID의 도메인 부분. RFC 5545는 UID가 **전역적으로** 유일하길 요구하므로 오른쪽에는
# 우리가 소유한 도메인을 쓴다(배포 도메인 사용). 왼쪽은 DB의 `ItineraryItem.id`라
# 같은 일정을 몇 번을 다시 내보내도 UID가 변하지 않는다 = 캘린더가 "갱신"으로 인식한다.
UID_DOMAIN = "travel-planner-dtsjs.vercel.app"

# 시작 시각만 있고 종료 시각이 없는 일정에 줄 기본 길이.
DEFAULT_EVENT_MINUTES = 60

# RFC 5545 §3.1: 한 줄은 CRLF를 제외하고 75 옥텟을 넘으면 안 된다.
MAX_LINE_OCTETS = 75

# TEXT 값에 들어갈 수 없는 제어문자 (RFC 5545 CONTROL = %x00-08 / %x0A-1F / %x7F).
# TAB(%x09)은 허용되므로 남긴다. 줄바꿈은 이스케이프 단계에서 이미 `\n`으로 바뀐 뒤다.
_CONTROL_CHARS = frozenset(chr(code) for code in range(0x20) if code != 0x09) | {"\x7f"}

# 파일명에서 지우는 문자 — 윈도우/POSIX 양쪽에서 금지되거나 문제를 일으키는 것들.
_UNSAFE_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')

MAX_FILENAME_STEM = 60


@dataclass(frozen=True)
class IcsItem:
    """VEVENT 하나로 내보낼 일정. `ItineraryItem`에서 ICS에 필요한 필드만 추린 것.

    `cost_amount`/`paid_by`/`category` 등은 일부러 받지 않는다 — 캘린더 이벤트에 담을
    자연스러운 자리가 없고, 정산 화면이 이미 그 역할을 한다.
    """

    id: int
    title: str
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    notes: str | None = None
    url: str | None = None
    updated_at: dt.datetime | None = None


@dataclass(frozen=True)
class IcsDay:
    """하루치 일정. `items`는 화면에 보이는 순서(= `ItineraryItem.position` 오름차순)여야 한다.

    이 순서가 곧 SUMMARY 앞에 붙는 번호가 된다(ADR-0008) — 시간이 없는 일정은 종일
    이벤트가 되는데, 같은 날 종일 이벤트들 사이에는 캘린더가 보장하는 순서가 없기 때문이다.
    """

    date: dt.date
    items: Sequence[IcsItem] = field(default_factory=tuple)


def escape_text(value: str) -> str:
    """RFC 5545 §3.3.11 TEXT 이스케이프.

    백슬래시를 **가장 먼저** 치환해야 한다 — 나중에 하면 방금 만든 이스케이프
    시퀀스(`\\,`)의 백슬래시까지 다시 이스케이프해서 `\\\\,`가 된다.
    콜론은 TEXT 값에서 이스케이프 대상이 아니다(속성 이름과 값의 구분자는 **첫** 콜론뿐).
    """
    value = value.replace("\\", "\\\\")
    value = value.replace(";", "\\;")
    value = value.replace(",", "\\,")
    # 줄바꿈은 세 형태(CRLF/LF/CR) 모두 리터럴 `\n` 두 글자로. CRLF를 먼저 처리하지 않으면
    # `\n\n`(두 줄 바뀜)이 되어버린다.
    value = value.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")
    return "".join(ch for ch in value if ch not in _CONTROL_CHARS)


def fold_line(line: str) -> str:
    """75 옥텟이 넘는 줄을 CRLF + 공백 한 칸으로 접는다(RFC 5545 §3.1).

    **문자 수가 아니라 UTF-8 옥텟 수**로 센다. 한글은 한 글자가 3옥텟이라 25자 남짓이면
    이미 한계이고, 옥텟 기준으로 자르면서 문자 경계를 무시하면 깨진 바이트가 나온다.
    그래서 문자 단위로 누적하되 길이는 인코딩 결과로 센다.

    이어지는 줄은 맨 앞 공백 1옥텟도 75에 포함되므로 내용은 74옥텟까지만 담는다.
    """
    if len(line.encode("utf-8")) <= MAX_LINE_OCTETS:
        return line

    pieces: list[str] = []
    current: list[str] = []
    current_octets = 0
    limit = MAX_LINE_OCTETS  # 첫 줄은 접힘 표시 공백이 없다

    for ch in line:
        ch_octets = len(ch.encode("utf-8"))
        if current_octets + ch_octets > limit:
            pieces.append("".join(current))
            current = [ch]
            current_octets = ch_octets
            limit = MAX_LINE_OCTETS - 1  # 이후 줄은 선행 공백 몫 1옥텟을 뺀다
        else:
            current.append(ch)
            current_octets += ch_octets

    pieces.append("".join(current))
    return "\r\n ".join(pieces)


def _format_date(value: dt.date) -> str:
    return f"{value.year:04d}{value.month:02d}{value.day:02d}"


def _format_floating(date_part: dt.date, time_part: dt.time) -> str:
    """시간대 정보 없는 "floating" 로컬 시각(`20260915T100000`).

    `Z`도 `TZID`도 붙이지 않는다 — 이 앱은 여행지 시간대를 저장하지 않으므로 어느
    시간대라고 주장할 근거가 없다(ADR-0008). RFC 5545에서 허용되는 형식이며, 읽는
    캘린더의 시간대에서 "적힌 그대로의 시각"으로 해석된다.
    """
    return f"{_format_date(date_part)}T{time_part.hour:02d}{time_part.minute:02d}{time_part.second:02d}"


def _format_utc(value: dt.datetime) -> str:
    """`20260915T010203Z` 형식. DTSTAMP/LAST-MODIFIED는 UTC여야 한다."""
    if value.tzinfo is not None:
        value = value.astimezone(dt.timezone.utc).replace(tzinfo=None)
    # 이 저장소의 `created_at`/`updated_at`은 `dt.datetime.utcnow()`라 tz 정보 없는 UTC다.
    return (
        f"{_format_date(value.date())}T"
        f"{value.hour:02d}{value.minute:02d}{value.second:02d}Z"
    )


def _is_usable_url(value: str) -> bool:
    """URL 속성에 실어도 되는 값인지. URI 값은 TEXT가 아니라 이스케이프하지 않으므로,
    이스케이프로 무해화할 수 없는 값(줄바꿈/공백/비 http)은 아예 싣지 않는다."""
    return (
        value.startswith(("http://", "https://"))
        and not any(ch.isspace() for ch in value)
        and not any(ch in _CONTROL_CHARS for ch in value)
    )


def _event_lines(day_date: dt.date, item: IcsItem, order: int, dtstamp: str) -> list[str]:
    lines = [
        "BEGIN:VEVENT",
        # 같은 일정은 언제 다시 내보내도 같은 UID다 → 재가져오기가 "추가"가 아니라 "갱신"이 된다.
        f"UID:item-{item.id}@{UID_DOMAIN}",
        f"DTSTAMP:{dtstamp}",
    ]

    if item.start_time is not None:
        lines.append(f"DTSTART:{_format_floating(day_date, item.start_time)}")
        if item.end_time is not None and item.end_time > item.start_time:
            lines.append(f"DTEND:{_format_floating(day_date, item.end_time)}")
        else:
            # 종료 시각이 없거나(입력 안 함) 시작보다 이르면(자정 넘김/오타 — 구분할 근거가
            # 없다) 기본 길이를 준다. DTEND를 아예 빼면 "시각은 있는데 길이가 0"인 이벤트가
            # 되어 캘린더마다 표시가 제각각이다.
            end_at = dt.datetime.combine(day_date, item.start_time) + dt.timedelta(
                minutes=DEFAULT_EVENT_MINUTES
            )
            lines.append(f"DTEND:{_format_floating(end_at.date(), end_at.time())}")
    else:
        # 종일 이벤트. DTEND는 **다음 날**이다(RFC 5545에서 DTEND는 비포함 경계) —
        # 같은 날짜를 넣으면 길이 0이 되고, 빼면 클라이언트마다 해석이 갈린다.
        lines.append(f"DTSTART;VALUE=DATE:{_format_date(day_date)}")
        lines.append(f"DTEND;VALUE=DATE:{_format_date(day_date + dt.timedelta(days=1))}")

    # 순번을 제목에 붙이는 이유: 종일 이벤트는 같은 날 여러 개가 나란히 놓이는데 그 사이
    # 표시 순서를 캘린더가 보장하지 않는다. 이 앱에서 "그날의 방문 순서"는 데이터의 의미
    # 자체라 잃어버리면 안 된다(ADR-0008).
    lines.append(f"SUMMARY:{escape_text(f'{order}. {item.title}')}")

    if item.address and item.address.strip():
        lines.append(f"LOCATION:{escape_text(item.address.strip())}")

    if item.notes and item.notes.strip():
        lines.append(f"DESCRIPTION:{escape_text(item.notes.strip())}")

    # GEO는 TEXT가 아니라 float 쌍이라 이스케이프하지 않는다. 세미콜론이 구분자다.
    if (
        item.lat is not None
        and item.lng is not None
        and math.isfinite(item.lat)
        and math.isfinite(item.lng)
    ):
        lines.append(f"GEO:{item.lat:.6f};{item.lng:.6f}")

    if item.url and _is_usable_url(item.url.strip()):
        lines.append(f"URL:{item.url.strip()}")

    if item.updated_at is not None:
        lines.append(f"LAST-MODIFIED:{_format_utc(item.updated_at)}")

    lines.append("END:VEVENT")
    return lines


def build_calendar(
    calendar_name: str,
    days: Sequence[IcsDay],
    *,
    generated_at: dt.datetime | None = None,
) -> str:
    """VCALENDAR 텍스트 전체를 만든다. 반환값은 CRLF로 끝나는 완성된 `.ics` 본문.

    `generated_at`은 DTSTAMP에 쓰인다. 인자로 뺀 이유는 검증에서 출력 전체를 고정값과
    비교할 수 있게 하기 위함(기본값은 지금 UTC).

    일정이 하나도 없으면 VEVENT 0개짜리 달력을 돌려준다 — 에러가 아니다(ADR-0008).
    """
    dtstamp = _format_utc(generated_at or dt.datetime.now(dt.timezone.utc))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
    ]
    # METHOD:PUBLISH는 일부러 넣지 않는다 — iTIP(RFC 5546)에서 PUBLISH는 ORGANIZER를
    # 요구하는데 이 앱에는 계정/주최자 개념이 없다.
    if calendar_name and calendar_name.strip():
        # 비표준이지만 구글/애플이 읽는 확장. 구독 시 달력 이름으로 쓰인다.
        lines.append(f"X-WR-CALNAME:{escape_text(calendar_name.strip())}")

    for day in days:
        for order, item in enumerate(day.items, start=1):
            lines.extend(_event_lines(day.date, item, order, dtstamp))

    lines.append("END:VCALENDAR")

    return "".join(f"{fold_line(line)}\r\n" for line in lines)


def ics_filename(trip_id: int, trip_name: str | None) -> str:
    """다운로드 파일명. 여행 이름을 쓰되 경로/제어문자는 제거하고, 비면 `trip-{id}`로 떨어진다."""
    stem = _UNSAFE_FILENAME_CHARS.sub("", (trip_name or "").strip()).strip(" .")
    if not stem:
        stem = f"trip-{trip_id}"
    return f"{stem[:MAX_FILENAME_STEM].strip()}.ics"
