import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ItineraryItem } from '../types/models'

interface Props {
  item: ItineraryItem
  index: number
  onDelete: (itemId: number) => void
}

export default function ItineraryItemCard({ item, index, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-lg bg-white p-4 shadow"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none px-1 text-slate-400 active:cursor-grabbing"
          aria-label="순서 변경"
        >
          ⠿
        </button>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white">
          {index + 1}
        </span>
        <span className="text-slate-800">{item.title}</span>
      </div>
      <button onClick={() => onDelete(item.id)} className="text-sm text-red-500 hover:underline">
        삭제
      </button>
    </li>
  )
}
