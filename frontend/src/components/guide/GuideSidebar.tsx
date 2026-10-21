import { useEffect, useRef } from 'react'
import { getDayLabel } from '../../lib/dayLabel'
import { getDayColor, MUST_VISIT_COLOR } from '../../lib/guideColors'
import { formatDayDate, formatTripPeriod, summarizeDay } from '../../lib/guideData'
import type { Day, ItineraryItem, TripDetail } from '../../types/models'
import GuidePlaceCard from './GuidePlaceCard'

interface FilterBarProps {
  days: Day[]
  selectedDayId: number | null
  onSelectDay: (dayId: number | null) => void
  mustOnly: boolean
  onToggleMustOnly: () => void
  /** "필수 N곳" — 현재 보기 범위 기준. */
  mustCount: number | null
}

/** Day 칩 가로 스크롤 + "필수 명소만" 토글. 모바일 지도 탭에서는 지도 위에 이것만 얹는다. */
export function GuideFilterBar({
  days,
  selectedDayId,
  onSelectDay,
  mustOnly,
  onToggleMustOnly,
  mustCount,
}: FilterBarProps) {
  const selectedChipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [selectedDayId])

  const chipBase = 'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm'
  const chipOn = 'border-slate-800 bg-slate-800 text-white'
  const chipOff = 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Day 선택">
        <button
          type="button"
          role="tab"
          aria-selected={selectedDayId === null}
          ref={selectedDayId === null ? selectedChipRef : undefined}
          onClick={() => onSelectDay(null)}
          className={`${chipBase} ${selectedDayId === null ? chipOn : chipOff}`}
        >
          <span aria-hidden="true">🗺️</span> 전체 경로
        </button>
        {days.map((day, index) => {
          const active = day.id === selectedDayId
          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={active}
              ref={active ? selectedChipRef : undefined}
              onClick={() => onSelectDay(day.id)}
              className={`${chipBase} ${active ? chipOn : chipOff}`}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
                style={{ backgroundColor: getDayColor(index) }}
              />
              {getDayLabel(day, index)}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={mustOnly}
          onClick={onToggleMustOnly}
          className={`flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm font-medium ${
            mustOnly ? 'border-red-600 bg-red-600 text-white' : 'border-red-300 bg-white text-red-600 hover:bg-red-50'
          }`}
        >
          ★ 필수 명소만
        </button>
        {mustCount !== null && <span className="text-xs text-slate-500">필수 {mustCount}곳</span>}
      </div>
    </div>
  )
}

interface Props extends FilterBarProps {
  trip: TripDetail
  itemsByDayId: Record<number, ItineraryItem[]>
  itemsLoading: boolean
  errorDayIds: number[]
  selectedItemId: number | null
  onSelectItem: (itemId: number) => void
  /** 데스크톱: 마커 클릭으로 선택됐을 때 해당 카드로 스크롤. */
  scrollToSelected: boolean
  /** 데스크톱: 필터/메타 카드를 스크롤 영역 상단에 고정. 모바일은 페이지 스크롤이라 고정하지 않는다. */
  stickyHeader: boolean
}

export default function GuideSidebar({
  trip,
  days,
  itemsByDayId,
  itemsLoading,
  errorDayIds,
  selectedDayId,
  onSelectDay,
  mustOnly,
  onToggleMustOnly,
  mustCount,
  selectedItemId,
  onSelectItem,
  scrollToSelected,
  stickyHeader,
}: Props) {
  const cardRefs = useRef(new Map<number, HTMLLIElement>())

  useEffect(() => {
    if (!scrollToSelected || selectedItemId == null) return
    cardRefs.current.get(selectedItemId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [scrollToSelected, selectedItemId])

  const visible = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => selectedDayId == null || day.id === selectedDayId)

  const selectedEntry = selectedDayId == null ? null : (visible[0] ?? null)
  const allItems = days.flatMap((d) => itemsByDayId[d.id] ?? [])
  const totalMust = allItems.filter((i) => i.is_must_visit).length
  const period = formatTripPeriod(trip)

  let metaCard
  if (selectedEntry) {
    const summary = summarizeDay(itemsByDayId[selectedEntry.day.id] ?? [])
    metaCard = (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-sm font-semibold text-white"
            style={{ backgroundColor: getDayColor(selectedEntry.index) }}
          >
            {getDayLabel(selectedEntry.day, selectedEntry.index)}
          </span>
          <span className="text-sm text-slate-600">{formatDayDate(selectedEntry.day.date)}</span>
        </div>
        {summary.regionText && <p className="mt-1.5 text-sm text-slate-600">📍 {summary.regionText}</p>}
        {!itemsLoading && (
          <p className="mt-1 text-xs text-slate-500">
            장소 {summary.placeCount}곳 · 필수 {summary.mustCount}곳
            {summary.timeRange ? ` · ${summary.timeRange}` : ''}
          </p>
        )}
      </div>
    )
  } else {
    metaCard = (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-800">여행 개요</p>
        {trip.destination && <p className="mt-0.5 text-sm text-slate-600">{trip.destination}</p>}
        {period && <p className="text-xs text-slate-500">{period}</p>}
        {!itemsLoading && (
          <p className="mt-1 text-xs text-slate-500">
            Day {days.length}개 · 장소 {allItems.length}곳 · 필수 {totalMust}곳
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        className={`flex flex-col gap-2 ${
          stickyHeader ? 'sticky top-0 z-10 -mx-3 -mt-3 border-b border-slate-200 bg-slate-50 p-3' : ''
        }`}
      >
        <GuideFilterBar
          days={days}
          selectedDayId={selectedDayId}
          onSelectDay={onSelectDay}
          mustOnly={mustOnly}
          onToggleMustOnly={onToggleMustOnly}
          mustCount={mustCount}
        />
        {metaCard}
      </div>

      {itemsLoading ? (
        <p className="py-6 text-center text-sm text-slate-500">불러오는 중...</p>
      ) : (
        visible.map(({ day, index }) => {
          const items = itemsByDayId[day.id] ?? []
          const color = getDayColor(index)
          const rows = items
            .map((item, i) => ({ item, order: i + 1 }))
            .filter(({ item }) => !mustOnly || item.is_must_visit)
          const failed = errorDayIds.includes(day.id)
          return (
            <section key={day.id} className="flex flex-col gap-2">
              {selectedDayId == null && (
                <h3 className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {getDayLabel(day, index)}
                </h3>
              )}
              {failed ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  이 날짜의 일정을 불러오지 못했어요
                </p>
              ) : rows.length === 0 ? (
                <p className="rounded-md bg-white px-3 py-4 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                  {mustOnly ? (
                    <>
                      필수 방문으로 표시한 장소가 없어요.
                      <br />
                      편집 화면에서 장소를 눌러 <span style={{ color: MUST_VISIT_COLOR }}>★ 필수 방문</span>을 켤 수
                      있어요.
                    </>
                  ) : (
                    '이 날은 아직 일정이 없어요.'
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rows.map(({ item, order }) => (
                    <GuidePlaceCard
                      key={item.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(item.id, el)
                        else cardRefs.current.delete(item.id)
                      }}
                      item={item}
                      order={order}
                      color={color}
                      selected={item.id === selectedItemId}
                      onSelect={onSelectItem}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
