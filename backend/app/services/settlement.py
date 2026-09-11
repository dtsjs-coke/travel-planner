"""여행 지출 집계 + 더치페이 정산 (순수 계산 — DB/HTTP를 모른다).

이 앱은 **두 사람만** 쓰고 앞으로도 늘릴 계획이 없다(사용자 확인, 2026-09-10).
그래서 참가자 테이블도, 참가자 추가/삭제 API도 만들지 않는다 — 다만 **표시 이름은 런타임에
바꿀 수 있어야 한다**(사용자 요청, 2026-09-11). 그래서 "참가자 슬롯"은 아래 고정 키 2개로 두고,
각 슬롯의 이름만 DB 설정(`AppSettings`)에서 읽어온다.

설계 근거와 기각한 대안은 ADR-0007(ADR-0006을 대체) 참고.
"""

from dataclasses import dataclass, field
from typing import Sequence

# 참가자 슬롯 키. `ItineraryItem.paid_by`에 **이 값이 그대로 저장된다** (표시 이름이 아니라).
# 이름이 바뀌어도 이 키는 절대 바뀌지 않으므로, 이름 변경이 기존 지출 데이터를 건드리지 않는다.
#
# 리스트 순서/인덱스가 아니라 **이름 붙은 키**라는 점이 중요하다. ADR-0006이 기각했던
# `paid_by_index: int`(0/1)는 "상수 배열의 순서"에 의미가 매달려 있어서 순서를 바꾸면 기존
# 데이터 의미가 조용히 뒤집혔지만, 여기서는 `"participant_1"`이라는 키 자체가 식별자라
# 순서를 바꾸든 이름을 바꾸든 뒤집힐 것이 없다.
PARTICIPANT_1 = "participant_1"
PARTICIPANT_2 = "participant_2"
PARTICIPANT_KEYS: tuple[str, ...] = (PARTICIPANT_1, PARTICIPANT_2)

# 금액은 소수 둘째 자리에서 반올림해 응답한다. `cost_amount`가 float라(기존 컬럼) 나눗셈에서
# 0.1+0.2 류의 부동소수 찌꺼기가 그대로 노출되는 걸 막는 용도. 통화별 소수 자릿수(KRW=0,
# USD=2)는 표시 단계(프론트)의 몫으로 남긴다 — 서버가 통화표를 들고 있을 이유가 없다.
_MONEY_DIGITS = 2


def _round_money(value: float) -> float:
    return round(value, _MONEY_DIGITS)


def _normalize_currency(value: str | None) -> str | None:
    """통화 코드를 비교 가능한 형태로 정규화한다 ("krw " -> "KRW", "" -> None).

    대소문자/공백 차이 하나로 같은 통화가 "다른 통화"로 분류돼 정산에서 통째로 빠지는
    사고를 막는다. 저장 시점(schemas)에도 같은 정규화를 하지만, 이 함수는 그 이전에
    들어온 기존 행까지 안전하게 다루기 위해 읽는 쪽에서도 한 번 더 정규화한다.
    """
    if value is None:
        return None
    stripped = value.strip().upper()
    return stripped or None


@dataclass(frozen=True)
class Participant:
    """참가자 한 명 = 고정 슬롯 키 + 지금 설정된 표시 이름.

    key:  `ItineraryItem.paid_by`에 저장되는 값. 불변.
    name: 화면에 보여줄 이름. `AppSettings`에서 읽으며 언제든 바뀔 수 있다.
    """

    key: str
    name: str


@dataclass(frozen=True)
class ExpenseRow:
    """정산 계산의 입력 한 줄 = 일정(ItineraryItem) 하나의 비용 정보."""

    paid_by: str | None  # 참가자 슬롯 키 (표시 이름이 아님)
    amount: float | None
    currency: str | None


@dataclass
class ParticipantTotal:
    participant: Participant
    paid: float
    item_count: int


@dataclass
class Transfer:
    """"누가 누구에게 얼마를 주면 되는지" 한 줄. 정산할 게 없으면 None이 된다."""

    from_participant: Participant
    to_participant: Participant
    amount: float


@dataclass
class CurrencyBucket:
    currency: str
    amount: float
    item_count: int


@dataclass
class SettlementResult:
    """정산 계산 결과.

    currency:            정산 기준 통화 (= Trip.currency)
    participants:        참가자 목록(키 + 현재 이름). 프론트가 이름을 하드코딩하지 않아도 되게 함께 준다
    per_person:          참가자별 지출 합계 (항상 participants와 같은 순서, 0원이어도 포함)
    total:               정산 대상 지출 합계 (= per_person의 합)
    per_person_share:    1인당 부담액 (total / 인원수)
    transfer:            송금 한 줄. 이미 균형이면 None
    unassigned_*:        결제자가 지정되지 않은 지출 — 누가 냈는지 모르므로 정산에서 제외하되,
                         "빠뜨린 게 있다"는 걸 프론트가 알릴 수 있게 따로 보고한다
    excluded_currencies: 기준 통화와 다른 통화의 지출 (환율 변환을 하지 않으므로 제외)
    has_mixed_currency:  위 목록이 비어있지 않은지 (프론트 경고 배너용 편의 플래그)
    """

    currency: str
    participants: list[Participant]
    per_person: list[ParticipantTotal]
    total: float
    per_person_share: float
    transfer: Transfer | None = None
    unassigned_amount: float = 0.0
    unassigned_item_count: int = 0
    excluded_currencies: list[CurrencyBucket] = field(default_factory=list)
    has_mixed_currency: bool = False


def compute_settlement(
    rows: list[ExpenseRow],
    trip_currency: str,
    participants: Sequence[Participant],
) -> SettlementResult:
    """지출 목록에서 참가자별 합계와 송금 한 줄을 계산한다.

    `participants`는 호출자(라우터)가 `app.services.app_settings.load_participants()`로 읽어
    넘긴다. 기본값을 두지 않는 이유: 이름은 이제 DB에 있는 런타임 값이라, 이 순수 함수가
    "어딘가에서 알아서 가져오는" 숨은 전역을 갖게 하면 DB 없이 테스트할 수 없어진다.

    분류 규칙 (순서대로):
      1. `amount`가 None이면 지출이 아니다 (비용을 입력하지 않은 일반 일정) — 완전히 무시.
      2. 통화가 기준 통화와 다르면 `excluded_currencies`로 빼놓는다. 환율 변환은 하지 않는다.
         `cost_currency`가 비어 있으면 기준 통화로 간주한다 — 지금까지 이 필드를 채우는 UI가
         없어서 전부 NULL이고, "통화 미상"으로 취급하면 모든 지출이 정산에서 빠져버린다.
      3. `paid_by`가 참가자 키 목록에 없으면(미지정이거나 모르는 키) `unassigned`로 뺀다.
         정산에 끼워 넣으려면 "누가 냈는지"를 추측해야 하는데, 그건 서버가 할 판단이 아니다.

    2명 기준의 정산이라 "최소 송금 횟수" 같은 알고리즘이 필요 없다: 합계를 반으로 나눠
    덜 낸 사람이 더 낸 사람에게 차액의 절반을 주면 끝난다.
    """
    base_currency = _normalize_currency(trip_currency) or "KRW"

    paid: dict[str, float] = {p.key: 0.0 for p in participants}
    counts: dict[str, int] = {p.key: 0 for p in participants}
    unassigned_amount = 0.0
    unassigned_count = 0
    excluded: dict[str, CurrencyBucket] = {}

    for row in rows:
        if row.amount is None:
            continue

        currency = _normalize_currency(row.currency) or base_currency
        if currency != base_currency:
            bucket = excluded.get(currency)
            if bucket is None:
                bucket = excluded[currency] = CurrencyBucket(
                    currency=currency, amount=0.0, item_count=0
                )
            bucket.amount += row.amount
            bucket.item_count += 1
            continue

        if row.paid_by in paid:
            paid[row.paid_by] += row.amount
            counts[row.paid_by] += 1
        else:
            unassigned_amount += row.amount
            unassigned_count += 1

    total = sum(paid.values())
    share = total / len(participants) if participants else 0.0

    return SettlementResult(
        currency=base_currency,
        participants=list(participants),
        per_person=[
            ParticipantTotal(
                participant=p, paid=_round_money(paid[p.key]), item_count=counts[p.key]
            )
            for p in participants
        ],
        total=_round_money(total),
        per_person_share=_round_money(share),
        transfer=_build_transfer(paid, share, participants),
        unassigned_amount=_round_money(unassigned_amount),
        unassigned_item_count=unassigned_count,
        excluded_currencies=[
            CurrencyBucket(
                currency=bucket.currency,
                amount=_round_money(bucket.amount),
                item_count=bucket.item_count,
            )
            for bucket in sorted(excluded.values(), key=lambda b: b.currency)
        ],
        has_mixed_currency=bool(excluded),
    )


def _build_transfer(
    paid: dict[str, float], share: float, participants: Sequence[Participant]
) -> Transfer | None:
    """덜 낸 사람 → 더 낸 사람으로 가는 송금 한 줄. 균형이면 None.

    참가자가 정확히 2명일 때만 계산한다. 3명 이상이면 "누가 누구에게"의 조합이 여러 개라
    한 줄로 표현할 수 없고, 그 경우 이 함수(와 응답 스키마)를 다시 설계해야 한다 —
    참가자를 늘리는 순간 조용히 틀린 답을 주지 않도록 여기서 None을 반환한다(ADR-0006/0007).
    """
    if len(participants) != 2:
        return None

    first, second = participants
    # 각자의 잔고 = 낸 돈 - 부담해야 할 몫. 양수면 받을 사람, 음수면 줄 사람.
    balance = paid[first.key] - share
    amount = _round_money(abs(balance))
    if amount == 0:
        return None

    if balance < 0:
        return Transfer(from_participant=first, to_participant=second, amount=amount)
    return Transfer(from_participant=second, to_participant=first, amount=amount)
