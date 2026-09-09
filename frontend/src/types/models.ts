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
  url: string | null
}
