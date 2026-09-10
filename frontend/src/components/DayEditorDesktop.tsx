import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { getDayLabel } from '../lib/dayLabel'
import { resolveDrop } from '../lib/dndDrop'
import { useItineraryDndSensors } from '../hooks/useItineraryDndSensors'
import ItineraryList from './ItineraryList'
import MapView from './MapView'
import type { DayEditorViewProps } from '../types/dayEditor'

// 데스크톱(웹) 레이아웃 — 기존 Day 탭 클릭 + 2단 그리드 방식 그대로. 동작/화면 변화 없음.
// DndContext는 화면에 보이는 활성 Day 하나만 감싼다(Day 탭 전환이라 다른 Day는 화면에 없음).
// 다른 Day로 옮기려면 카드의 "다른 날로" 드롭다운을 쓴다 — ADR-0005.
export default function DayEditorDesktop({
  days,
  itemsByDayId,
  itemsLoading,
  onAddItem,
  onDeleteItem,
  onUpdateItemTitle,
  onReorderItems,
  onMoveItem,
}: DayEditorViewProps) {
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const activeDayId = selectedDayId ?? days[0]?.id ?? null
  const items = activeDayId !== null ? itemsByDayId[activeDayId] ?? [] : []
  const sensors = useItineraryDndSensors()

  function handleDragEnd(event: DragEndEvent) {
    if (activeDayId === null) return
    // 활성 Day의 항목만 DndContext 안에 있으므로 결과는 항상 reorder(또는 변화 없음)다.
    const result = resolveDrop(event.active.id, event.over?.id, { [activeDayId]: items })
    if (result?.kind === 'reorder') onReorderItems(result.dayId, result.orderedItemIds)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {days.map((day, index) => (
          <button
            key={day.id}
            onClick={() => setSelectedDayId(day.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeDayId === day.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow'
            }`}
          >
            {getDayLabel(day, index)}
          </button>
        ))}
      </div>

      {activeDayId === null ? (
        <p className="text-slate-400">먼저 날짜를 추가해주세요.</p>
      ) : (
        <>
          <button
            onClick={() => onAddItem(activeDayId)}
            className="mb-4 rounded-md bg-slate-800 px-4 py-2 text-white"
          >
            + 일정 추가
          </button>

          {itemsLoading && <p className="text-slate-500">불러오는 중...</p>}

          <div className="grid gap-4 md:grid-cols-2">
            {!itemsLoading && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <ItineraryList
                  items={items}
                  dayId={activeDayId}
                  days={days}
                  moveVariant="dropdown"
                  onDelete={(itemId) => onDeleteItem(activeDayId, itemId)}
                  onUpdateTitle={(itemId, title) => onUpdateItemTitle(activeDayId, itemId, title)}
                  onMove={(itemId, targetDayId) => onMoveItem(activeDayId, itemId, targetDayId)}
                />
              </DndContext>
            )}
            <div className="md:sticky md:top-6 md:self-start">
              <MapView items={items} height="400px" />
            </div>
          </div>
        </>
      )}
    </>
  )
}
