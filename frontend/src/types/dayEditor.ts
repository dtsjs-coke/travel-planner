import type { Day, ItineraryItem, Participant } from './models'

/** 일정 카드에서 바꿀 수 있는 비용/결제자 필드. `cost_amount`/`paid_by`의 명시적 `null`은
 * "지운다"/"미지정으로 되돌린다"는 뜻으로 서버가 200 처리한다(ADR-0006/0007). */
export interface ItineraryItemPatch {
  cost_amount?: number | null
  paid_by?: string | null
}

/**
 * DayEditorDesktop / DayEditorMobile 공통 props.
 * 모든 콜백 첫 인자에 dayId가 붙는 이유: 모바일은 화면에 여러 Day가 동시에 있어서
 * "활성 Day"를 클로저로 캡처할 수 없다.
 */
export interface DayEditorViewProps {
  days: Day[]
  itemsByDayId: Record<number, ItineraryItem[]>
  itemsLoading: boolean
  /** 결제자 선택박스/표시에 쓰는 참가자 목록(`GET /api/settings`). 이름이 바뀌면 이 배열도
   * 자동으로 갱신되므로 일정 응답(`paid_by` 키)과 조합해 표시 이름을 구한다(ADR-0007). */
  participants: Participant[]
  onAddItem: (dayId: number) => void
  onDeleteItem: (dayId: number, itemId: number) => void
  onUpdateItemTitle: (dayId: number, itemId: number, title: string) => void
  /** 비용/결제자 수정. 제목과 검증 방향이 반대라(명시적 null 허용) 별도 콜백으로 둔다.
   * `onError`는 선택적 콜백으로, 서버 실패(예: 422) 시 카드가 폼 근처에 에러 메시지를
   * 표시할 수 있게 사용자 메시지 문자열을 전달한다. */
  onUpdateItem: (
    dayId: number,
    itemId: number,
    patch: ItineraryItemPatch,
    onError?: (message: string) => void,
  ) => void
  onReorderItems: (dayId: number, orderedItemIds: number[]) => void
  /** 일정을 다른 Day로 옮긴다. `onMoved`는 이동 성공 후(캐시 무효화 이후) 호출되는 선택적
   * 콜백으로, 모바일 연속 스크롤에서 목적지 Day 섹션으로 스크롤하는 데 쓰인다(DayEditorMobile). */
  onMoveItem: (dayId: number, itemId: number, targetDayId: number, onMoved?: (targetDayId: number) => void) => void
}
