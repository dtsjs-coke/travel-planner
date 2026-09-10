import { arrayMove } from '@dnd-kit/sortable'
import type { UniqueIdentifier } from '@dnd-kit/core'
import type { ItineraryItem } from '../types/models'

/**
 * dnd-kit 드롭 결과를 "같은 Day 정렬(reorder)"과 "다른 Day 이동(move)" 중 하나로 해석하는
 * 단일 소스. 데스크톱(Day 하나짜리 DndContext)과 모바일(전체 Day를 아우르는 DndContext)이
 * 같은 함수를 쓴다 — 근거는 ADR-0005.
 *
 * 항목 droppable의 id는 숫자(`item.id`), Day 컨테이너 droppable의 id는 문자열(`day:<dayId>`)로
 * 구분한다. 컨테이너 droppable은 **항목이 하나도 없는 Day에만** 등록된다(항목이 있는 Day는
 * 항목 droppable만으로 closestCenter가 해당 Day를 항상 찾아낸다).
 */

const DAY_DROPPABLE_PREFIX = 'day:'

export function dayDroppableId(dayId: number): string {
  return `${DAY_DROPPABLE_PREFIX}${dayId}`
}

function parseDayDroppableId(id: UniqueIdentifier): number | null {
  if (typeof id !== 'string' || !id.startsWith(DAY_DROPPABLE_PREFIX)) return null
  const dayId = Number(id.slice(DAY_DROPPABLE_PREFIX.length))
  return Number.isFinite(dayId) ? dayId : null
}

function findDayIdOfItem(itemId: number, itemsByDayId: Record<number, ItineraryItem[]>): number | null {
  for (const [dayId, items] of Object.entries(itemsByDayId)) {
    if (items.some((item) => item.id === itemId)) return Number(dayId)
  }
  return null
}

/** 드롭 대상 id가 가리키는 Day. 항목 id면 그 항목이 속한 Day, 컨테이너 id면 그 Day. */
export function resolveDayIdOfDropTarget(
  overId: UniqueIdentifier,
  itemsByDayId: Record<number, ItineraryItem[]>,
): number | null {
  const containerDayId = parseDayDroppableId(overId)
  if (containerDayId !== null) return containerDayId
  if (typeof overId !== 'number') return null
  return findDayIdOfItem(overId, itemsByDayId)
}

export type DropResult =
  | { kind: 'reorder'; dayId: number; orderedItemIds: number[] }
  | { kind: 'move'; itemId: number; fromDayId: number; toDayId: number }

/**
 * `null`을 돌려주면 "아무 일도 일어나지 않음"(제자리 드롭, 대상 없음, 알 수 없는 id)이다.
 * 서버 호출은 호출부에서 결과 종류에 따라 정한다.
 */
export function resolveDrop(
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null | undefined,
  itemsByDayId: Record<number, ItineraryItem[]>,
): DropResult | null {
  if (overId == null || typeof activeId !== 'number') return null

  const fromDayId = findDayIdOfItem(activeId, itemsByDayId)
  if (fromDayId === null) return null

  const toDayId = resolveDayIdOfDropTarget(overId, itemsByDayId)
  if (toDayId === null) return null

  if (fromDayId !== toDayId) {
    return { kind: 'move', itemId: activeId, fromDayId, toDayId }
  }

  // 같은 Day 안: 기존 드래그 정렬 그대로. 자기 자신 위/빈 영역(컨테이너)에 떨구면 순서 변화 없음.
  if (typeof overId !== 'number' || activeId === overId) return null
  const items = itemsByDayId[fromDayId] ?? []
  const oldIndex = items.findIndex((item) => item.id === activeId)
  const newIndex = items.findIndex((item) => item.id === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null

  return {
    kind: 'reorder',
    dayId: fromDayId,
    orderedItemIds: arrayMove(items, oldIndex, newIndex).map((item) => item.id),
  }
}
