import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { dayDroppableId } from '../lib/dndDrop'
import type { Day, ItineraryItem, Participant } from '../types/models'
import type { ItineraryItemPatch } from '../types/dayEditor'
import ItineraryItemCard from './ItineraryItemCard'

interface Props {
  items: ItineraryItem[]
  /** 이 목록이 속한 Day. 빈 Day를 드롭 대상으로 등록하는 데 쓴다. */
  dayId: number
  days: Day[]
  moveVariant: 'dropdown' | 'sheet'
  participants: Participant[]
  onDelete: (itemId: number) => void
  onUpdateTitle: (itemId: number, title: string) => void
  onUpdateItem: (itemId: number, patch: ItineraryItemPatch, onError?: (message: string) => void) => void
  onMove: (itemId: number, targetDayId: number) => void
}

/**
 * `DndContext`는 이 컴포넌트가 아니라 상위 화면(DayEditorDesktop / DayEditorMobile)이 소유한다
 * (ADR-0005). 모바일 연속 스크롤에서 Day 섹션 간 드래그가 가능하려면 여러 Day가 **하나의**
 * DndContext 안에 있어야 하기 때문이다. 이 컴포넌트는 Day 하나의 `SortableContext`만 담당한다.
 */
export default function ItineraryList({
  items,
  dayId,
  days,
  moveVariant,
  participants,
  onDelete,
  onUpdateTitle,
  onUpdateItem,
  onMove,
}: Props) {
  // 항목이 없는 Day는 드롭 대상으로 삼을 항목 droppable이 하나도 없어서 드래그로 옮겨올 수가 없다.
  // 그래서 빈 목록일 때만 목록 영역 자체를 컨테이너 droppable로 등록한다(항목이 있으면 setNodeRef를
  // 붙이지 않으므로 측정되지 않아 충돌 판정에서 제외된다).
  const { setNodeRef } = useDroppable({ id: dayDroppableId(dayId) })

  if (items.length === 0) {
    return (
      <p ref={setNodeRef} className="py-3 text-slate-400">
        등록된 일정이 없습니다. 위에서 추가해보세요.
      </p>
    )
  }

  return (
    <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <ItineraryItemCard
            key={item.id}
            item={item}
            index={index}
            days={days}
            moveVariant={moveVariant}
            participants={participants}
            onDelete={onDelete}
            onUpdateTitle={onUpdateTitle}
            onUpdateItem={onUpdateItem}
            onMove={onMove}
          />
        ))}
      </ol>
    </SortableContext>
  )
}
