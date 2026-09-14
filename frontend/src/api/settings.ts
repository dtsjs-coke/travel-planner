import { apiClient } from './client'
import type { AppSettings } from '../types/models'

/** 마스터 환경설정(참가자 이름 + 일정 AI 정렬 토글) 조회. 로그인 세션 필요(401). */
export async function getSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<AppSettings>('/api/settings')
  return data
}

/** `PATCH /api/settings` 바디. 바뀐 항목만 담는다 — `participants`는 바뀐 슬롯만
 * (`{ participant_1: "새이름" }`), `route_sort_enabled`는 값을 바꿀 때만 포함한다
 * (생략 = "안 바꿈", 서버가 명시적 null은 422로 거부한다, ADR-0012). */
export interface SettingsUpdateInput {
  participants?: Record<string, string>
  route_sort_enabled?: boolean
}

/** 응답은 항상 전체 설정이라 그대로 캐시에 넣을 수 있다(ADR-0007). */
export async function updateSettings(input: SettingsUpdateInput): Promise<AppSettings> {
  const { data } = await apiClient.patch<AppSettings>('/api/settings', input)
  return data
}
