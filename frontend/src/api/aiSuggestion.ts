import { apiClient } from './client'

export type AreaScope = 'selected_only' | 'include_nearby'
export type Pace = 'relaxed' | 'normal' | 'packed'
export type Theme = 'food' | 'heritage' | 'landmark' | 'cafe'

export interface SuggestionRegionInput {
  country: string
  cities: string[]
}

export interface TripSuggestionInput {
  regions: SuggestionRegionInput[]
  start_date: string
  end_date: string
  area_scope: AreaScope
  pace: Pace
  themes: Theme[]
  extra_notes?: string
  plan_count: number
}

export interface SuggestedTripSummary {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  day_count: number
  item_count: number
}

export interface TripSuggestionResult {
  created_trips: SuggestedTripSummary[]
  requested_plan_count: number
  failed_plan_count: number
  dropped_place_count: number
  warnings: string[]
}

/**
 * AI 여행 추천 생성(`POST /api/ai/trip-suggestions`). 응답이 최대 75초까지 걸릴 수 있다
 * (LLM 최대 3회 병렬 호출 + Places 검증 수십~수백 회, ADR-0009 결정 2). `apiClient`는
 * 별도 `timeout`을 두지 않아 axios 기본값(무제한)을 물려받지만, 이 요청만은 의도를 코드로도
 * 남기기 위해 명시적으로 넉넉한 타임아웃(2분)을 지정한다 — Render 콜드 스타트가 겹치는 경우까지
 * 감안한 여유값이며, 백엔드 자체 시간 예산(75초)보다 크게 잡아 백엔드가 먼저 응답을 끝내게 한다.
 *
 * 멱등하지 않다(같은 조건으로 다시 호출하면 Trip이 또 생성된다) — 호출부(`AiSuggestionModal`)가
 * 중복 클릭을 막아야 한다.
 */
export async function suggestTrips(input: TripSuggestionInput): Promise<TripSuggestionResult> {
  const { data } = await apiClient.post<TripSuggestionResult>('/api/ai/trip-suggestions', input, {
    timeout: 120_000,
  })
  return data
}
