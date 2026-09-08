import { useEffect, useRef, useState } from 'react'
import { getDayLabel } from '../lib/dayLabel'
import { useActiveDayOnScroll } from '../hooks/useActiveDayOnScroll'
import ItineraryList from './ItineraryList'
import MapView from './MapView'
import type { DayEditorViewProps } from '../types/dayEditor'

const DEFAULT_STICKY_HEIGHT = 320

// 모바일 레이아웃 — 지도를 화면 상단에 고정하고 Day1~DayN 일정을 이어붙여 연속 스크롤.
// 스크롤 중 화면에 걸린 Day에 맞춰 상단 지도 핀이 자동 전환된다(useActiveDayOnScroll).
export default function DayEditorMobile({
  days,
  itemsByDayId,
  itemsLoading,
  onAddItem,
  onDeleteItem,
  onUpdateItemTitle,
  onReorderItems,
}: DayEditorViewProps) {
  const stickyRef = useRef<HTMLDivElement>(null)
  const [stickyHeight, setStickyHeight] = useState(DEFAULT_STICKY_HEIGHT)

  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setStickyHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const dayIds = days.map((day) => day.id)
  const { activeDayId, registerSection } = useActiveDayOnScroll(dayIds, stickyHeight + 16)

  function jumpToDay(dayId: number) {
    document
      .querySelector(`[data-day-id="${dayId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeItems = activeDayId !== null ? itemsByDayId[activeDayId] ?? [] : []

  return (
    <div>
      <div ref={stickyRef} className="sticky top-0 z-10 -mx-6 bg-white px-6 py-2">
        <MapView items={activeItems} height="260px" />
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {days.map((day, index) => (
            <button
              key={day.id}
              onClick={() => jumpToDay(day.id)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                activeDayId === day.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow'
              }`}
            >
              {getDayLabel(day, index)}
            </button>
          ))}
        </div>
      </div>

      {itemsLoading ? (
        <p className="pt-4 text-slate-500">불러오는 중...</p>
      ) : (
        days.map((day, index) => (
          <section
            key={day.id}
            data-day-id={day.id}
            ref={registerSection}
            style={{ scrollMarginTop: stickyHeight + 8 }}
            className="pt-4 pb-2 last:pb-[300px]"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">{getDayLabel(day, index)}</h2>
              <button
                onClick={() => onAddItem(day.id)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white"
              >
                + 일정 추가
              </button>
            </div>
            <ItineraryList
              items={itemsByDayId[day.id] ?? []}
              onDelete={(itemId) => onDeleteItem(day.id, itemId)}
              onReorder={(orderedItemIds) => onReorderItems(day.id, orderedItemIds)}
              onUpdateTitle={(itemId, title) => onUpdateItemTitle(day.id, itemId, title)}
            />
          </section>
        ))
      )}
    </div>
  )
}
