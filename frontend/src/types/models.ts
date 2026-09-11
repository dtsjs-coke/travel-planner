export interface Trip {
  id: number
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface TripDetail extends Trip {
  days: Day[]
}

export interface Day {
  id: number
  trip_id: number
  date: string
  label: string | null
  sort_order: number
}

/** 여행 기간(PATCH)을 벗어나게 된 기존 Day. `item_count`는 그 Day에 딸린 일정 수로,
 * 삭제 확인 모달에서 "일정 N개도 함께 사라진다"고 경고하는 데 쓴다. */
export interface OutOfRangeDay extends Day {
  item_count: number
}

/** `PATCH /api/trips/{id}` 응답. `TripDetail`의 상위집합이라 날짜를 안 건드리는
 * 호출부는 추가 필드를 무시하면 그대로 동작한다. */
export interface TripUpdateResult extends TripDetail {
  /** 이번 PATCH로 새로 생성된 Day의 id */
  added_day_ids: number[]
  /** 새 기간을 벗어난 기존 Day (서버는 지우지 않음 — 사용자 확인 후 `deleteDay()`로 개별 삭제) */
  out_of_range_days: OutOfRangeDay[]
}

export type ItemSource = 'google_places' | 'manual'

/** 여행(Trip) 단위 준비물 체크리스트 항목. Day에 귀속되지 않는다(ADR-0003). */
export interface ChecklistItem {
  id: number
  trip_id: number
  text: string
  is_checked: boolean
  created_at: string
}

export interface ItineraryItem {
  id: number
  day_id: number
  position: number
  title: string
  category: string | null
  source: ItemSource
  place_id: string | null
  address: string | null
  lat: number | null
  lng: number | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  cost_currency: string | null
  /** 결제자 **슬롯 키**("participant_1"/"participant_2") 또는 미지정(null). 표시 이름이 아니다 —
   * 이름은 `/api/settings`(`AppSettings`)에서 조회해 붙인다(ADR-0007). */
  paid_by: string | null
  url: string | null
}

/** 마스터 환경설정의 참가자 한 명. `key`는 저장/전송에, `name`은 표시에 쓴다. */
export interface Participant {
  key: string
  name: string
}

export interface AppSettings {
  participants: Participant[]
}

export interface ParticipantTotal {
  participant: Participant
  paid: number
  item_count: number
}

/** "from_participant가 to_participant에게 amount를 주면 정산 끝". */
export interface Transfer {
  from_participant: Participant
  to_participant: Participant
  amount: number
}

export interface CurrencyBucket {
  currency: string
  amount: number
  item_count: number
}

/** `GET /api/trips/{trip_id}/settlement` 응답. 저장되지 않고 매번 계산된다(ADR-0006).
 *
 * `transfer`가 null이면 정산할 것이 없다는 뜻(에러 아님). `unassigned_*`/`excluded_currencies`는
 * 정산에서 제외된 지출이라 화면에 반드시 안내해야 한다(결제자 미지정 / 통화 혼합).
 */
export interface SettlementResult {
  trip_id: number
  currency: string
  participants: Participant[]
  per_person: ParticipantTotal[]
  total: number
  per_person_share: number
  transfer: Transfer | null
  unassigned_amount: number
  unassigned_item_count: number
  excluded_currencies: CurrencyBucket[]
  has_mixed_currency: boolean
}
