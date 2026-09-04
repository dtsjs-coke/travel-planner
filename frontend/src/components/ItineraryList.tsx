import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { ItineraryItem } from '../types/models'
import ItineraryItemCard from './ItineraryItemCard'

interface Props {
  items: ItineraryItem[]
  onDelete: (itemId: number) => void
  onReorder: (orderedItemIds: number[]) => void
}

export default function ItineraryList({ items, onDelete, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    onReorder(reordered.map((item) => item.id))
  }

  if (items.length === 0) {
    return <p className="text-slate-400">등록된 일정이 없습니다. 위에서 추가해보세요.</p>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <ItineraryItemCard key={item.id} item={item} index={index} onDelete={onDelete} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
