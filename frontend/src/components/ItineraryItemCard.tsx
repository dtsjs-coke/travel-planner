import { useState, type FormEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Day, ItineraryItem, Participant } from '../types/models'
import type { ItineraryItemPatch } from '../types/dayEditor'
import MoveItemControl from './MoveItemControl'

interface Props {
  item: ItineraryItem
  index: number
  days: Day[]
  moveVariant: 'dropdown' | 'sheet'
  /** 결제자 선택박스/표시용 참가자 목록(`GET /api/settings`). */
  participants: Participant[]
  onDelete: (itemId: number) => void
  onUpdateTitle: (itemId: number, title: string) => void
  onUpdateItem: (itemId: number, patch: ItineraryItemPatch, onError?: (message: string) => void) => void
  onMove: (itemId: number, targetDayId: number) => void
}

export default function ItineraryItemCard({
  item,
  index,
  days,
  moveVariant,
  participants,
  onDelete,
  onUpdateTitle,
  onUpdateItem,
  onMove,
}: Props) {
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

  // 금액 입력은 제목과 달리 "지우기"(빈 값 -> null)가 정상 조작이라 별도 draft로 관리한다
  // (ADR-0006). `null` = "편집 중이 아니다" — 이펙트로 나중에 동기화하지 않고, 편집 중이
  // 아닐 때는 항상 `item.cost_amount`(서버 값)에서 파생시킨다. 커밋 후 draft를 다시 null로
  // 돌려 다음 렌더에서 최신 서버 값을 따르게 한다.
  const [costDraft, setCostDraft] = useState<string | null>(null)
  const costValue = costDraft ?? (item.cost_amount != null ? String(item.cost_amount) : '')

  // 비용/결제자 수정 실패(예: 서버 422) 시 표시할 메시지. 클라이언트 사전 검증을 통과한 값이라도
  // 서버가 거부할 수 있어서(다른 이유), 조용히 무시하지 않고 폼 근처에 보여준다.
  const [updateError, setUpdateError] = useState<string | null>(null)

  function commitCost() {
    const trimmed = costValue.trim()
    if (trimmed === '') {
      if (item.cost_amount !== null) {
        setUpdateError(null)
        onUpdateItem(item.id, { cost_amount: null }, setUpdateError)
      }
    } else {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed) && parsed >= 0 && parsed !== item.cost_amount) {
        setUpdateError(null)
        onUpdateItem(item.id, { cost_amount: parsed }, setUpdateError)
      }
      // 잘못된 값(음수/NaN)이면 서버에 보내지 않는다(클라이언트 1차 차단) — 아래 draft 초기화로
      // 화면은 기존 서버 값으로 되돌아간다.
    }
    setCostDraft(null)
  }

  function handlePaidByChange(value: string) {
    setUpdateError(null)
    onUpdateItem(item.id, { paid_by: value || null }, setUpdateError)
  }

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
    <li ref={setNodeRef} style={style} className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-center justify-between">
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
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <MoveItemControl
          days={days}
          currentDayId={item.day_id}
          variant={moveVariant}
          onMove={(targetDayId) => onMove(item.id, targetDayId)}
        />
        <button onClick={() => onDelete(item.id)} className="text-sm text-red-500 hover:underline">
          삭제
        </button>
      </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8 text-sm text-slate-500">
        <input
          type="number"
          min="0"
          value={costValue}
          onChange={(e) => setCostDraft(e.target.value)}
          onBlur={commitCost}
          placeholder="금액"
          className="w-24 rounded-md border border-slate-200 px-2 py-1 focus:border-slate-500 focus:outline-none"
        />
        <select
          value={item.paid_by ?? ''}
          onChange={(e) => handlePaidByChange(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 focus:border-slate-500 focus:outline-none"
        >
          <option value="">미지정</option>
          {participants.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        {updateError && <p className="w-full text-xs text-red-600">{updateError}</p>}
      </div>
    </li>
  )
}
