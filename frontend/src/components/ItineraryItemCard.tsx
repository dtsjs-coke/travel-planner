import { useState, type FormEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ItineraryItem } from '../types/models'

interface Props {
  item: ItineraryItem
  index: number
  onDelete: (itemId: number) => void
  onUpdateTitle: (itemId: number, title: string) => void
}

export default function ItineraryItemCard({ item, index, onDelete, onUpdateTitle }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)

  function startEditing() {
    setTitleDraft(item.title)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setTitleDraft(item.title)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === item.title) {
      cancelEditing()
      return
    }
    onUpdateTitle(item.id, trimmed)
    setIsEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-lg bg-white p-4 shadow"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none px-1 text-slate-400 active:cursor-grabbing"
          aria-label="순서 변경"
        >
          ⠿
        </button>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-white">
          {index + 1}
        </span>
        {isEditing ? (
          <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-1">
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEditing()
              }}
              onBlur={handleSubmit}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-slate-800 focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 text-sm text-slate-600 hover:underline"
              onMouseDown={(e) => e.preventDefault()}
            >
              저장
            </button>
          </form>
        ) : (
          <span
            className="min-w-0 flex-1 cursor-pointer truncate text-slate-800"
            onClick={startEditing}
            title="클릭하여 이름 수정"
          >
            {item.title}
            <button
              onClick={(e) => {
                e.stopPropagation()
                startEditing()
              }}
              className="ml-1 text-slate-400 hover:text-slate-600"
              aria-label="이름 수정"
            >
              ✎
            </button>
          </span>
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="ml-2 shrink-0 text-sm text-red-500 hover:underline"
      >
        삭제
      </button>
    </li>
  )
}
