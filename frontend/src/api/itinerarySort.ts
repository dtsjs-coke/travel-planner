import { apiClient } from './client'
import type { ItineraryItem } from '../types/models'

export type RouteSortStyle = 'nearest' | 'farthest' | 'balanced'

export interface RouteEndpointsInput {
  start_item_id: number | null
  end_item_id: number | null
}

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
 * 그 Day의 시작점/끝점을 지정한다(둘 다 한 번에 교체, `null`이면 해제). PATCH가 아니라
 * **PUT**인 이유는 ADR-0012 참고 — 두 역할은 함께 의미를 갖고, 매번 전체를 보내면 "생략 vs
 * 명시적 null" 구분이 필요 없어진다.
 *
 * 응답은 `POST /api/days/{id}/items/reorder`와 같이 **그 Day의 전체 일정 목록**이다 —
 * 호출부는 `['days', dayId, 'items']`를 무효화하면 새 `route_role`이 반영된다.
 */
export async function setRouteEndpoints(dayId: number, input: RouteEndpointsInput): Promise<ItineraryItem[]> {
  const { data } = await apiClient.put<ItineraryItem[]>(`/api/days/${dayId}/route-endpoints`, input)
  return data
}

/**
 * 선택한 날짜들의 일정을 최적 방문 순서로 재정렬한다(ADR-0012). 외부 API 호출이 없는 순수
 * 서버 계산이라 밀리초 단위로 끝난다 — AI 추천(`suggestTrips`)처럼 긴 타임아웃이 필요 없다.
 *
 * **부분 실패도 200**이다: 어떤 날짜를 정렬하지 못해도 다른 날짜는 이미 저장까지 끝난
 * 상태이고, 그 사실은 응답의 `skipped_days`/`failed_days`로 드러난다. 요청 전체가 막히는
 * 유일한 경우는 422(`FIRST_DAY_ENDPOINTS_REQUIRED_DETAIL` 참고)뿐이다.
 */
export async function sortItinerary(
  tripId: number,
  input: { day_ids: number[]; style: RouteSortStyle },
): Promise<SortItineraryResult> {
  const { data } = await apiClient.post<SortItineraryResult>(`/api/trips/${tripId}/sort-itinerary`, input)
  return data
}

/**
 * `POST /api/trips/{id}/sort-itinerary`가 돌려주는 422 `detail` 중, 다른 검증 실패와 달리
 * **일반 에러로 취급하면 안 되는** 값(사용자 요구사항, ADR-0012 결정 6). 첫날(달력상 가장
 * 이른 Day)의 시작점/끝점이 지정돼 있지 않을 때만 오고, 프론트는 이걸 "시작점/끝점을 잘
 * 정했는지 확인해달라"는 안내(확인 대화상자 톤)로 보여줘야 한다 — 에러 배너와는 다른 톤이다.
 */
export const FIRST_DAY_ENDPOINTS_REQUIRED_DETAIL =
  'the first day of this trip must have its start and end points designated'
