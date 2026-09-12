import { useQueries } from '@tanstack/react-query'
import { listItems } from '../api/items'
import type { Day, ItineraryItem } from '../types/models'

interface UseTripItemsResult {
  itemsByDayId: Record<number, ItineraryItem[]>
  isLoading: boolean
  isError: boolean
  /** 조회가 실패한 Day의 id 목록. 화면에서 "일정이 없는 빈 Day"와 "로드 실패"를 구분해
   * 보여주는 데 쓴다(Day별 안내라 집계값인 `isError`만으로는 어느 Day인지 알 수 없다). */
  errorDayIds: number[]
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

  // ADR 문서(모바일 연속 스크롤, docs/PROJECT.md Architecture Decisions)는 `isPending` 기준으로
  // 적혀있다. `isLoading`은 TanStack Query v5에서 `isPending && isFetching`의 축약형이라
  // `fetchStatus: 'paused'`(예: 오프라인)일 때 `isPending`이 true여도 `isLoading`은 false가 되어
  // 로딩 중인데도 로딩 표시가 조기에 꺼질 수 있다 — 문서와 실제 동작을 일치시키기 위해 `isPending` 사용.
  const isLoading = results.some((result) => result.isPending)
  const isError = results.some((result) => result.isError)
  const errorDayIds = days.filter((_day, index) => results[index]?.isError).map((day) => day.id)

  return { itemsByDayId, isLoading, isError, errorDayIds }
}
