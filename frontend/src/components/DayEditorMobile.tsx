import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { getDayLabel } from '../lib/dayLabel'
import { resolveDrop } from '../lib/dndDrop'
import { useActiveDayOnScroll } from '../hooks/useActiveDayOnScroll'
import { useItineraryDndSensors } from '../hooks/useItineraryDndSensors'
import ItineraryList from './ItineraryList'
import MapView from './MapView'
import type { DayEditorViewProps } from '../types/dayEditor'
import type { ItineraryItem } from '../types/models'

/**
 * 드래그 중인 카드의 `DragOverlay` 프리뷰. `ItineraryItemCard`와 같은 place/스타일을 쓰되,
 * 실제 카드가 아니라 항상 body에 포탈로 렌더되는 오버레이 전용이라 `<li>` 대신 `<div>`를 쓴다
 * (오버레이는 `<ol>` 트리 밖에 그려지므로 `<li>`를 쓰면 잘못된 HTML 중첩이 된다).
 * 편집/삭제/이동 같은 상호작용은 없다 — 드래그 중 "무엇을 옮기는지" 보여주는 용도.
 */
function ItineraryItemDragPreview({ item, index }: { item: ItineraryItem; index: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white p-4 shadow-lg ring-1 ring-slate-200">
      <span className="px-1 text-slate-400">⠿</span>
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-white">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-800">{item.title}</span>
    </div>
  )
}

const DEFAULT_STICKY_HEIGHT = 320

// 모바일 레이아웃 — 지도를 화면 상단에 고정하고 Day1~DayN 일정을 이어붙여 연속 스크롤.
// 스크롤 중 화면에 걸린 Day에 맞춰 상단 지도 핀이 자동 전환된다(useActiveDayOnScroll).
//
// 데스크톱과 달리 Day1~DayN 전체를 **하나의 DndContext**가 감싼다(ADR-0005) — 연속 스크롤이라
// 다른 Day 섹션이 실제로 화면에 나타날 수 있어서, 항목을 다른 Day 섹션에 떨구면 이동이 된다.
// 드래그 중 화면 밖 Day로의 자동 스크롤은 dnd-kit의 내장 auto-scroll(기본 활성)이 처리한다.
export default function DayEditorMobile({
  days,
  itemsByDayId,
  itemsLoading,
  participants,
  onAddItem,
  onDeleteItem,
  onUpdateItemTitle,
  onUpdateItem,
  onReorderItems,
  onMoveItem,
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

  const sensors = useItineraryDndSensors()
  // 드래그 중 "여기에 떨구면 이 Day로 이동된다"를 표시할 대상. 같은 Day 안에서 정렬 중일 때는
  // null이라 하이라이트가 뜨지 않는다. 시각 표현은 각 섹션의 data-drop-target 속성으로 노출한다.
  const [dropTargetDayId, setDropTargetDayId] = useState<number | null>(null)
  // DragOverlay에 띄울 카드 프리뷰. 상단 sticky 지도(z-10)에 실제 카드(transform+opacity)가
  // 가려지는 문제를 DragOverlay(기본 z-index:999)로 해결한다.
  const [activeDragItem, setActiveDragItem] = useState<{ item: ItineraryItem; index: number } | null>(null)

  function findItemAndIndex(itemId: number): { item: ItineraryItem; index: number } | null {
    for (const items of Object.values(itemsByDayId)) {
      const index = items.findIndex((item) => item.id === itemId)
      if (index !== -1) return { item: items[index], index }
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    if (typeof event.active.id !== 'number') return
    setActiveDragItem(findItemAndIndex(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const result = resolveDrop(event.active.id, event.over?.id, itemsByDayId)
    setDropTargetDayId(result?.kind === 'move' ? result.toDayId : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDropTargetDayId(null)
    setActiveDragItem(null)
    const result = resolveDrop(event.active.id, event.over?.id, itemsByDayId)
    if (!result) return
    if (result.kind === 'reorder') {
      onReorderItems(result.dayId, result.orderedItemIds)
      return
    }
    // 드래그로 옮긴 경우엔 목적지 Day가 이미 화면에 있으므로 jumpToDay(onMoved)를 넘기지 않는다.
    // (하단 시트로 고를 때만 목적지로 자동 스크롤한다.)
    onMoveItem(result.fromDayId, result.itemId, result.toDayId)
  }

  function handleDragCancel() {
    setDropTargetDayId(null)
    setActiveDragItem(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // 상단 sticky 지도가 뷰포트 위쪽 상당 부분을 덮어서, dnd-kit 기본 임계값(위/아래 각 20%)의
      // 위쪽 발동 지점이 지도 뒤에 가려 손가락이 닿지 않는다. 가로 자동 스크롤은 쓰지 않으므로 0,
      // 세로는 지도 아래에서부터 발동하도록 기본값(0.2)보다 넉넉하게 0.3으로만 조정한다
      // (dnd-kit 내장 옵션 값 조정 — 별도 스크롤 로직 구현 없음, ADR-0005 결정 7).
      autoScroll={{ threshold: { x: 0, y: 0.3 } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
            data-drop-target={dropTargetDayId === day.id ? 'true' : undefined}
            ref={registerSection}
            style={{ scrollMarginTop: stickyHeight + 8 }}
            className="-mx-2 rounded-lg px-2 pt-4 pb-2 ring-2 ring-transparent transition-colors last:pb-[300px] data-[drop-target]:bg-slate-50 data-[drop-target]:ring-slate-400"
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
              dayId={day.id}
              days={days}
              moveVariant="sheet"
              participants={participants}
              onDelete={(itemId) => onDeleteItem(day.id, itemId)}
              onUpdateTitle={(itemId, title) => onUpdateItemTitle(day.id, itemId, title)}
              onUpdateItem={(itemId, patch, onError) => onUpdateItem(day.id, itemId, patch, onError)}
              onMove={(itemId, targetDayId) => onMoveItem(day.id, itemId, targetDayId, jumpToDay)}
            />
          </section>
        ))
      )}
    </div>
    <DragOverlay>
      {activeDragItem && (
        <ItineraryItemDragPreview item={activeDragItem.item} index={activeDragItem.index} />
      )}
    </DragOverlay>
    </DndContext>
  )
}
