import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { getTrip } from '../api/trips'
import GuideHeader from '../components/guide/GuideHeader'
import GuideMap from '../components/guide/GuideMap'
import GuideSidebar, { GuideFilterBar } from '../components/guide/GuideSidebar'
import ItinerarySummaryModal from '../components/guide/ItinerarySummaryModal'
import TravelTipsModal from '../components/guide/TravelTipsModal'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useTripItems } from '../hooks/useTripItems'
import type { ItineraryItem } from '../types/models'

const GOOGLE_MAPS_BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? ''

/**
 * 여행 가이드 페이지(ADR-0015). 읽기 전용 — 유일한 예외는 팁·메모 모달의 편집.
 * 보기 설정(선택 Day/필터/지도 종류)은 개인 화면 상태라 저장하지 않는다(localStorage/URL 모두 X).
 * 데이터는 Day 편집 화면과 같은 queryKey를 써서 캐시를 공유한다.
 */
export default function TripGuidePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const tripIdNum = Number(tripId)
  const isDesktop = useIsDesktop()

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trips', tripIdNum],
    queryFn: () => getTrip(tripIdNum),
    enabled: Number.isFinite(tripIdNum),
  })

  const days = trip?.days ?? []
  const { itemsByDayId, isLoading: itemsLoading, errorDayIds } = useTripItems(days)

  const [rawSelectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [mustOnly, setMustOnly] = useState(false)
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list')
  const [fitNonce, setFitNonce] = useState(0)
  const [selectNonce, setSelectNonce] = useState(0)
  const [modal, setModal] = useState<'summary' | 'tips' | null>(null)

  if (tripLoading) return <p className="p-6 text-slate-500">불러오는 중...</p>
  if (!trip) return <p className="p-6 text-red-600">여행을 찾을 수 없습니다.</p>

  // 선택해 둔 Day가 (다른 기기 등에서) 삭제돼 사라졌다면 전체 경로로 되돌린다.
  const selectedDayId = days.some((d) => d.id === rawSelectedDayId) ? rawSelectedDayId : null

  const visibleDays = selectedDayId == null ? days : days.filter((d) => d.id === selectedDayId)
  // 로딩 중에는 0곳으로 오해되지 않게 null(표시 안 함).
  const mustCount = itemsLoading
    ? null
    : visibleDays.reduce(
        (sum, d) => sum + (itemsByDayId[d.id] ?? []).filter((i) => i.is_must_visit).length,
        0,
      )

  // 지도 마커용(필터 반영). 경로선/방문 순번은 필터와 무관하게 전체 항목을 쓴다.
  const displayItemsByDayId: Record<number, ItineraryItem[]> = {}
  for (const d of days) {
    const items = itemsByDayId[d.id] ?? []
    displayItemsByDayId[d.id] = mustOnly ? items.filter((i) => i.is_must_visit) : items
  }

  function handleSelectDay(dayId: number | null) {
    setSelectedDayId(dayId)
    setSelectedItemId(null)
  }

  function handleSelectItem(itemId: number | null) {
    setSelectedItemId(itemId)
    if (itemId !== null) setSelectNonce((n) => n + 1)
  }

  function handleToggleMustOnly() {
    setMustOnly((v) => !v)
    setSelectedItemId(null)
  }

  function handleSelectItemFromCard(itemId: number) {
    handleSelectItem(itemId)
    if (!isDesktop) setMobileTab('map')
  }

  function handleOverview() {
    setSelectedItemId(null)
    setFitNonce((n) => n + 1)
  }

  const filterProps = {
    days,
    selectedDayId,
    onSelectDay: handleSelectDay,
    mustOnly,
    onToggleMustOnly: handleToggleMustOnly,
    mustCount,
  }

  const sidebar = (
    <GuideSidebar
      {...filterProps}
      trip={trip}
      itemsByDayId={itemsByDayId}
      itemsLoading={itemsLoading}
      errorDayIds={errorDayIds}
      selectedItemId={selectedItemId}
      onSelectItem={handleSelectItemFromCard}
      scrollToSelected={isDesktop}
      stickyHeader={isDesktop}
    />
  )

  const map = (
    <GuideMap
      days={days}
      itemsByDayId={displayItemsByDayId}
      routeItemsByDayId={itemsByDayId}
      selectedDayId={selectedDayId}
      mustOnly={mustOnly}
      selectedItemId={selectedItemId}
      onSelectItem={handleSelectItem}
      mapType={mapType}
      onChangeMapType={setMapType}
      fitNonce={fitNonce}
      onOverview={handleOverview}
      legendDefaultOpen={isDesktop}
      itemsLoading={itemsLoading}
      selectNonce={selectNonce}
    />
  )

  let body
  if (days.length === 0) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-slate-500">아직 날짜가 없어요. 편집 화면에서 날짜와 일정을 먼저 추가해 주세요.</p>
        <Link
          to={`/trips/${tripIdNum}`}
          className="flex min-h-11 items-center rounded-md bg-slate-800 px-4 text-sm text-white"
        >
          일정 편집으로 가기
        </Link>
      </div>
    )
  } else if (isDesktop) {
    body = (
      <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr] lg:grid-cols-[440px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50">{sidebar}</aside>
        <main className="min-h-0">{map}</main>
      </div>
    )
  } else {
    const tabBtn = 'min-h-11 flex-1 text-sm font-medium'
    body = (
      <>
        <div className="flex border-b border-slate-200 bg-white" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'list'}
            onClick={() => setMobileTab('list')}
            className={`${tabBtn} ${mobileTab === 'list' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500'}`}
          >
            📋 일정 리스트
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'map'}
            onClick={() => setMobileTab('map')}
            className={`${tabBtn} ${mobileTab === 'map' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500'}`}
          >
            🗺️ 지도 보기
          </button>
        </div>
        {mobileTab === 'list' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">{sidebar}</div>
        ) : (
          // 지도 탭이 아닐 때는 GuideMap을 언마운트한다(display:none으로 숨기면 0 크기로 초기화돼 회색 타일이 난다).
          // 필터 바는 지도 위에 얹지 않고 지도 위쪽 별도 영역에 둔다(지도 컨트롤을 가리지 않게).
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 bg-white p-2 shadow">
              <GuideFilterBar {...filterProps} />
            </div>
            <div className="relative min-h-0 flex-1">{map}</div>
          </div>
        )}
      </>
    )
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_BROWSER_KEY}>
      <div className="flex h-dvh flex-col bg-slate-50">
        <GuideHeader trip={trip} onOpenSummary={() => setModal('summary')} onOpenTips={() => setModal('tips')} />
        {body}

        {modal === 'summary' && (
          <ItinerarySummaryModal
            days={days}
            itemsByDayId={itemsByDayId}
            itemsLoading={itemsLoading}
            errorDayIds={errorDayIds}
            onSelectDay={(dayId) => {
              handleSelectDay(dayId)
              setModal(null)
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'tips' && (
          <TravelTipsModal tripId={tripIdNum} tips={trip.travel_tips} onClose={() => setModal(null)} />
        )}
      </div>
    </APIProvider>
  )
}
