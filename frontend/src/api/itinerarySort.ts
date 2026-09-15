import { apiClient } from './client'

export type RouteSortStyle = 'nearest' | 'farthest' | 'balanced'

export interface SortedDay {
  day_id: number
  date: string
  item_count: number
  changed: boolean
  unlocatable_item_count: number
}

/** 정렬하지 못한 날짜. `skipped`(조치 불필요, 일정 0~1개)와 `failed`(조치 필요, 시작점을 정할
 * 수 없음)에 공통으로 쓰는 형태 — `message`는 서버가 이미 한국어로 준다(ADR-0012 결정 5). */
export interface DaySortIssue {
  day_id: number
  date: string
  reason_code: string
  message: string
}

export interface SortItineraryResult {
  trip_id: number
  style: RouteSortStyle
  sorted_days: SortedDay[]
  skipped_days: DaySortIssue[]
  failed_days: DaySortIssue[]
  warnings: string[]
}

/**
 * 선택한 날짜들의 일정을 최적 방문 순서로 재정렬한다(ADR-0013). 외부 API 호출이 없는 순수
 * 서버 계산이라 밀리초 단위로 끝난다 — AI 추천(`suggestTrips`)처럼 긴 타임아웃이 필요 없다.
 *
 * **부분 실패도 200**이다: 어떤 날짜를 정렬하지 못해도 다른 날짜는 이미 저장까지 끝난
 * 상태이고, 그 사실은 응답의 `skipped_days`/`failed_days`로 드러난다. 시작/끝점을 사용자가
 * 잘 배치해뒀는지에 대한 확인은 서버 API가 아니라 **프론트가 이 함수를 부르기 전에** 모달
 * 안에서 끝낸다(ADR-0013) — "지정 미비"로 막히는 422는 더 이상 없다.
 */
export async function sortItinerary(
  tripId: number,
  input: { day_ids: number[]; style: RouteSortStyle },
): Promise<SortItineraryResult> {
  const { data } = await apiClient.post<SortItineraryResult>(`/api/trips/${tripId}/sort-itinerary`, input)
  return data
}
