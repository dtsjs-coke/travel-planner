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
}
