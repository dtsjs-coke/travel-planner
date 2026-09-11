import { apiClient } from './client'
import type { AppSettings } from '../types/models'

/** 마스터 환경설정(참가자 이름) 조회. 로그인 세션 필요(401). */
export async function getSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<AppSettings>('/api/settings')
  return data
}

/** 바뀐 슬롯만 담아 보낸다: `{ participant_1: "새이름" }`. 응답은 항상 전체 목록이라
 * 그대로 캐시에 넣을 수 있다(ADR-0007). */
export async function updateSettings(patch: Record<string, string>): Promise<AppSettings> {
  const { data } = await apiClient.patch<AppSettings>('/api/settings', { participants: patch })
  return data
}
