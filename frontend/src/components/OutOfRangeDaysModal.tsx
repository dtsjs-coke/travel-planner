import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { deleteDay } from '../api/days'
import { extractErrorMessage } from '../lib/errors'
import type { OutOfRangeDay } from '../types/models'

interface Props {
  days: OutOfRangeDay[]
  /** 사용자가 "유지"를 선택 — 아무것도 지우지 않고 모달만 닫는다. */
  onKeep: () => void
  /** 목록에 남아있던 Day가 전부 삭제에 성공해 모달을 닫아도 되는 상태. */
  onAllDeleted: () => void
}

export default function OutOfRangeDaysModal({ days, onKeep, onAllDeleted }: Props) {
  const queryClient = useQueryClient()
  const [remainingDays, setRemainingDays] = useState(days)
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDeleteAll() {
    setIsDeleting(true)
    const targets = remainingDays
    const results = await Promise.allSettled(targets.map((day) => deleteDay(day.id)))

    const stillRemaining: OutOfRangeDay[] = []
    const nextErrors: Record<number, string> = {}
    results.forEach((result, idx) => {
      const day = targets[idx]
      if (result.status === 'rejected') {
        stillRemaining.push(day)
        nextErrors[day.id] = extractErrorMessage(result.reason, '삭제하지 못했습니다.')
      }
    })

    // 성공한 만큼은 목록/캐시에 반영 — 'trips' 접두 쿼리(목록 + 상세 둘 다)를 갱신한다.
    queryClient.invalidateQueries({ queryKey: ['trips'] })

    setIsDeleting(false)
    setRemainingDays(stillRemaining)
    setDayErrors(nextErrors)

    if (stillRemaining.length === 0) {
      onAllDeleted()
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white p-4 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">범위 밖 날짜 삭제</h2>
        <p className="mb-3 text-sm text-slate-600">
          변경된 기간 밖으로 밀려난 날짜가 {remainingDays.length}개 있습니다. 삭제하지 않으면 그대로 남아있고,
          나중에 다시 정리할 수 있습니다.
        </p>

        <ul className="mb-3 flex flex-col gap-2 overflow-y-auto">
          {remainingDays.map((day) => (
            <li key={day.id} className="rounded-md border border-slate-200 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  {day.date}
                  {day.label ? ` · ${day.label}` : ''}
                </span>
                {day.item_count > 0 && (
                  <span className="shrink-0 text-xs font-medium text-red-600">일정 {day.item_count}개</span>
                )}
              </div>
              {day.item_count > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  삭제하면 그 안의 일정 {day.item_count}개도 함께 사라지고 되돌릴 수 없습니다.
                </p>
              )}
              {dayErrors[day.id] && <p className="mt-1 text-xs text-red-600">{dayErrors[day.id]}</p>}
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onKeep}
            disabled={isDeleting}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            유지
          </button>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={isDeleting || remainingDays.length === 0}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? '삭제 중...' : `삭제 (${remainingDays.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
