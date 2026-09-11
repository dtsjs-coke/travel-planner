import { apiClient } from './client'
import type { SettlementResult } from '../types/models'

/** 여행 하나의 지출 집계 + 더치페이 정산 결과. 저장되지 않고 매번 계산된다(ADR-0006). */
export async function getSettlement(tripId: number): Promise<SettlementResult> {
  const { data } = await apiClient.get<SettlementResult>(`/api/trips/${tripId}/settlement`)
  return data
}
