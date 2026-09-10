import type { Day, ItineraryItem } from './models'

/**
 * DayEditorDesktop / DayEditorMobile 공통 props.
 * 모든 콜백 첫 인자에 dayId가 붙는 이유: 모바일은 화면에 여러 Day가 동시에 있어서
 * "활성 Day"를 클로저로 캡처할 수 없다.
 */
export interface DayEditorViewProps {
  days: Day[]
  itemsByDayId: Record<number, ItineraryItem[]>
  itemsLoading: boolean
  onAddItem: (dayId: number) => void
  onDeleteItem: (dayId: number, itemId: number) => void
  onUpdateItemTitle: (dayId: number, itemId: number, title: string) => void
  onReorderItems: (dayId: number, orderedItemIds: number[]) => void
  /** 일정을 다른 Day로 옮긴다. `onMoved`는 이동 성공 후(캐시 무효화 이후) 호출되는 선택적
   * 콜백으로, 모바일 연속 스크롤에서 목적지 Day 섹션으로 스크롤하는 데 쓰인다(DayEditorMobile). */
  onMoveItem: (dayId: number, itemId: number, targetDayId: number, onMoved?: (targetDayId: number) => void) => void
}
