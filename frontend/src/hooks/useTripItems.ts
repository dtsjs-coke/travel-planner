import { useQueries } from '@tanstack/react-query'
import { listItems } from '../api/items'
import type { Day, ItineraryItem } from '../types/models'

interface UseTripItemsResult {
  itemsByDayId: Record<number, ItineraryItem[]>
  isLoading: boolean
  isError: boolean
}

/**
 * 트립의 모든 Day에 대해 일정을 병렬로 조회한다. 백엔드에 트립 단위 집계 엔드포인트가 없으므로
 * 기존 Day별 API(`GET /api/days/{id}/items`)를 그대로 재사용한다.
 *
 * queryKey는 기존 단일 Day 조회 코드(`AddItemModal`의 invalidate, reorder 낙관적 업데이트)와
 * 완전히 동일하게 ['days', day.id, 'items']를 써야 캐시를 공유할 수 있다.
 */
export function useTripItems(days: Day[]): UseTripItemsResult {
  const results = useQueries({
    queries: days.map((day) => ({
      queryKey: ['days', day.id, 'items'],
      queryFn: () => listItems(day.id),
      staleTime: 60_000,
    })),
  })

  const itemsByDayId: Record<number, ItineraryItem[]> = {}
  days.forEach((day, index) => {
    itemsByDayId[day.id] = results[index]?.data ?? []
  })

  const isLoading = results.some((result) => result.isLoading)
  const isError = results.some((result) => result.isError)

  return { itemsByDayId, isLoading, isError }
}
