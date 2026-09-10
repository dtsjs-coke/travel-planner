import { useState } from 'react'
import { getDayLabel } from '../lib/dayLabel'
import type { Day } from '../types/models'

interface Props {
  days: Day[]
  currentDayId: number
  onMove: (targetDayId: number) => void
  /** 데스크톱은 드롭다운, 모바일은 연속 스크롤에 묻히지 않도록 하단 시트로 띄운다. */
  variant: 'dropdown' | 'sheet'
}

/** "다른 날로" 이동 트리거 + Day 선택 UI. 데스크톱(드롭다운)과 모바일(하단 시트)이
 * 공유하는 부분(Day 목록 렌더링, 현재 Day 비활성화, 선택 시 onMove 호출)만 여기 두고,
 * 뜨는 방식 자체는 variant로 분기한다(DayEditorDesktop/Mobile의 레이아웃 차이 때문에
 * 완전히 하나로 합치지 않음). */
export default function MoveItemControl({ days, currentDayId, onMove, variant }: Props) {
  const [open, setOpen] = useState(false)

  function handleSelect(dayId: number) {
    setOpen(false)
    if (dayId === currentDayId) return // 서버도 멱등이지만 불필요한 요청은 만들지 않는다.
    onMove(dayId)
  }

  function renderDayList(itemClassName: string) {
    return days.map((day, index) => {
      const isCurrent = day.id === currentDayId
      return (
        <li key={day.id}>
          <button
            type="button"
            disabled={isCurrent}
            onClick={() => handleSelect(day.id)}
            className={
              isCurrent ? `${itemClassName} cursor-default text-slate-300` : `${itemClassName} text-slate-700`
            }
          >
            {isCurrent && <span aria-hidden="true">✓</span>}
            {getDayLabel(day, index)}
          </button>
        </li>
      )
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 text-sm text-slate-500 hover:underline"
      >
        다른 날로
      </button>

      {open && variant === 'dropdown' && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 max-h-64 w-48 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
            {renderDayList('flex w-full items-center gap-1 px-3 py-1.5 text-left text-sm hover:bg-slate-100')}
          </ul>
        </>
      )}

      {open && variant === 'sheet' && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-xl bg-white p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-500">이동할 날짜 선택</h3>
            <ul className="flex flex-col">
              {renderDayList('flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left active:bg-slate-100')}
            </ul>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-md py-2 text-center text-sm text-slate-500"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
