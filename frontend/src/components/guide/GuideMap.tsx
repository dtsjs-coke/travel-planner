import { useEffect, useRef, useState } from 'react'
import { AdvancedMarker, AdvancedMarkerAnchorPoint, InfoWindow, Map, Polyline, useMap } from '@vis.gl/react-google-maps'
import { getDayLabel } from '../../lib/dayLabel'
import { getGoogleMapsLink } from '../../lib/googleMapsLink'
import { getDayColor, MUST_VISIT_COLOR } from '../../lib/guideColors'
import { formatTime, hasCoords, markerSize, truncateText, type ItemWithCoords } from '../../lib/guideData'
import type { Day, ItineraryItem } from '../../types/models'
import GuideMarkerPin from './GuideMarkerPin'

interface LatLng {
  lat: number
  lng: number
}

interface Props {
  days: Day[]
  /** 필터(필수 명소만)가 반영된 표시용 항목. */
  itemsByDayId: Record<number, ItineraryItem[]>
  /** 필터 미반영 전체 항목 — 경로선/방문 순번 계산용. */
  routeItemsByDayId: Record<number, ItineraryItem[]>
  selectedDayId: number | null
  mustOnly: boolean
  selectedItemId: number | null
  onSelectItem: (itemId: number | null) => void
  mapType: 'roadmap' | 'hybrid'
  onChangeMapType: (type: 'roadmap' | 'hybrid') => void
  fitNonce: number
  onOverview: () => void
  /** 모바일은 기본 접힘. */
  legendDefaultOpen: boolean
  /** 항목 로딩 중에는 "위치 정보 없음" 안내를 숨긴다. */
  itemsLoading: boolean
  /** 항목을 선택할 때마다 올라가는 값 — 같은 항목을 다시 눌러도 그 위치로 다시 이동시킨다. */
  selectNonce: number
}

const DEFAULT_CENTER: LatLng = { lat: 37.5665, lng: 126.978 } // 서울(표시할 좌표가 없을 때)
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
const MIN_FOCUS_ZOOM = 15

function focusPoint(map: google.maps.Map, point: LatLng) {
  map.panTo(point)
  if ((map.getZoom() ?? 0) < MIN_FOCUS_ZOOM) map.setZoom(MIN_FOCUS_ZOOM)
}

interface ViewportProps {
  points: LatLng[]
  selectedPoint: LatLng | null
  selectedDayId: number | null
  mustOnly: boolean
  fitNonce: number
  selectNonce: number
}

/**
 * 지도 시점 제어. 맞춤(fitBounds)은 Day/필터/전체 조망 nonce/좌표 개수가 바뀔 때만 다시 한다 —
 * 항목 refetch(창 포커스 등)로 사용자가 움직이는 지도가 튀지 않게 하려는 의도라, points 배열 자체는
 * 의존성에 넣지 않고 ref로 최신 값만 읽는다. 선택 항목이 있는 채로 처음 마운트되면(모바일 탭 전환)
 * 맞춤 대신 그 항목으로 이동한다.
 */
function MapViewport({ points, selectedPoint, selectedDayId, mustOnly, fitNonce, selectNonce }: ViewportProps) {
  const map = useMap()
  const pointsRef = useRef(points)
  const selectedRef = useRef(selectedPoint)
  const firstFitDone = useRef(false)

  useEffect(() => {
    pointsRef.current = points
    selectedRef.current = selectedPoint
  })

  const pointCount = points.length

  useEffect(() => {
    if (!map) return
    const isFirst = !firstFitDone.current
    firstFitDone.current = true
    if (isFirst && selectedRef.current) {
      focusPoint(map, selectedRef.current)
      return
    }
    const pts = pointsRef.current
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.setCenter(pts[0])
      map.setZoom(MIN_FOCUS_ZOOM)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    pts.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 48)
  }, [map, selectedDayId, mustOnly, fitNonce, pointCount])

  const selLat = selectedPoint?.lat
  const selLng = selectedPoint?.lng
  useEffect(() => {
    if (!map || selLat == null || selLng == null) return
    focusPoint(map, { lat: selLat, lng: selLng })
  }, [map, selLat, selLng, selectNonce])

  return null
}

function InfoBody({ item }: { item: ItemWithCoords }) {
  const time = formatTime(item.start_time)
  const endTime = formatTime(item.end_time)
  const meta = [item.place_category, item.region_name].filter(Boolean).join(' · ')
  const link = getGoogleMapsLink(item)
  return (
    <div className="max-w-60 text-sm text-slate-700">
      {item.is_must_visit && <p className="font-medium" style={{ color: MUST_VISIT_COLOR }}>★ 필수 방문</p>}
      {time && (
        <p>
          {time}
          {endTime ? `~${endTime}` : ''}
        </p>
      )}
      {meta && <p className="text-slate-500">{meta}</p>}
      {item.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{truncateText(item.notes, 120)}</p>}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
        >
          📍 구글지도에서 보기
        </a>
      )}
    </div>
  )
}

export default function GuideMap({
  days,
  itemsByDayId,
  routeItemsByDayId,
  selectedDayId,
  mustOnly,
  selectedItemId,
  onSelectItem,
  mapType,
  onChangeMapType,
  fitNonce,
  onOverview,
  legendDefaultOpen,
  itemsLoading,
  selectNonce,
}: Props) {
  const [legendOpen, setLegendOpen] = useState(legendDefaultOpen)

  const visibleDays = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => selectedDayId == null || day.id === selectedDayId)

  const markers = visibleDays.flatMap(({ day, index }) => {
    const order = new globalThis.Map<number, number>()
    ;(routeItemsByDayId[day.id] ?? []).forEach((it, i) => order.set(it.id, i + 1))
    return (itemsByDayId[day.id] ?? []).filter(hasCoords).map((item) => ({
      item,
      color: getDayColor(index),
      // Day 모드: 그 Day 안 방문 순서(필터 전 기준) / 전체 경로 모드: Day 번호
      label: selectedDayId == null ? index + 1 : (order.get(item.id) ?? 0),
    }))
  })

  const points: LatLng[] = markers.map(({ item }) => ({ lat: item.lat, lng: item.lng }))
  const selectedMarker = markers.find(({ item }) => item.id === selectedItemId) ?? null
  const selectedPoint = selectedMarker ? { lat: selectedMarker.item.lat, lng: selectedMarker.item.lng } : null

  const polylines = visibleDays
    .map(({ day, index }) => ({
      dayId: day.id,
      color: getDayColor(index),
      path: (routeItemsByDayId[day.id] ?? []).filter(hasCoords).map((it) => ({ lat: it.lat, lng: it.lng })),
    }))
    .filter((line) => line.path.length >= 2)

  const baseOpacity = selectedDayId == null ? 0.55 : 0.85
  const lineOpacity = mustOnly ? 0.3 : baseOpacity
  const lineWeight = selectedDayId == null ? 3 : 4

  const initialCenter = points[0] ?? DEFAULT_CENTER

  const segBase = 'min-h-11 px-3 text-sm font-medium'

  return (
    <div className="relative h-full w-full">
      <Map
        mapId={MAP_ID}
        mapTypeId={mapType}
        mapTypeControl={false}
        streetViewControl={false}
        gestureHandling="greedy"
        reuseMaps
        defaultCenter={initialCenter}
        defaultZoom={points.length ? 12 : 4}
        style={{ width: '100%', height: '100%' }}
      >
        <MapViewport
          points={points}
          selectedPoint={selectedPoint}
          selectedDayId={selectedDayId}
          mustOnly={mustOnly}
          fitNonce={fitNonce}
          selectNonce={selectNonce}
        />

        {polylines.map((line) => (
          <Polyline
            key={line.dayId}
            path={line.path}
            strokeColor={line.color}
            strokeOpacity={lineOpacity}
            strokeWeight={lineWeight}
          />
        ))}

        {markers.map(({ item, color, label }) => {
          const selected = item.id === selectedItemId
          return (
            <AdvancedMarker
              key={item.id}
              position={{ lat: item.lat, lng: item.lng }}
              title={item.title}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={selected ? 1000 : item.is_must_visit ? 100 : 10}
              onClick={() => onSelectItem(item.id)}
            >
              <GuideMarkerPin label={label} color={color} isMust={item.is_must_visit} selected={selected} />
            </AdvancedMarker>
          )
        })}

        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.item.lat, lng: selectedMarker.item.lng }}
            pixelOffset={[0, -(markerSize(selectedMarker.item.is_must_visit) / 2 + 4)]}
            onCloseClick={() => onSelectItem(null)}
            headerContent={<span className="font-semibold text-slate-800">{selectedMarker.item.title}</span>}
          >
            <InfoBody item={selectedMarker.item} />
          </InfoWindow>
        )}
      </Map>

      {points.length === 0 && !itemsLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-white/80 px-3 py-2 text-sm text-slate-600 shadow">
            지도에 표시할 위치 정보가 없어요
          </p>
        </div>
      )}

      <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
        <div className="flex overflow-hidden rounded-md bg-white shadow ring-1 ring-slate-300" role="group" aria-label="지도 종류">
          <button
            type="button"
            aria-pressed={mapType === 'roadmap'}
            onClick={() => onChangeMapType('roadmap')}
            className={`${segBase} ${mapType === 'roadmap' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            일반
          </button>
          <button
            type="button"
            aria-pressed={mapType === 'hybrid'}
            onClick={() => onChangeMapType('hybrid')}
            className={`${segBase} ${mapType === 'hybrid' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            위성
          </button>
        </div>
        <button
          type="button"
          onClick={onOverview}
          title="전체 조망"
          aria-label="전체 조망"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md bg-white text-lg text-slate-700 shadow ring-1 ring-slate-300 hover:bg-slate-100"
        >
          ⤢
        </button>
      </div>

      <div className="absolute bottom-6 left-2 max-w-[220px] rounded-md bg-white/95 text-xs text-slate-700 shadow ring-1 ring-slate-300">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 font-medium"
        >
          범례 <span aria-hidden="true">{legendOpen ? '▾' : '▸'}</span>
        </button>
        {legendOpen && (
          <div className="flex flex-col gap-1 px-3 pb-2">
            {visibleDays.slice(0, 10).map(({ day, index }) => (
              <div key={day.id} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getDayColor(index) }} />
                <span className="truncate">{getDayLabel(day, index)}</span>
              </div>
            ))}
            {visibleDays.length > 10 && <span>…</span>}
            <div className="mt-1 flex items-center gap-1.5 border-t border-slate-200 pt-1">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-slate-500"
                style={{ border: `2px solid ${MUST_VISIT_COLOR}` }}
              />
              <span>
                <span style={{ color: MUST_VISIT_COLOR }}>★</span> = 필수 방문
              </span>
            </div>
            <p className="text-slate-500">
              숫자 = 방문 순서{selectedDayId == null ? '(전체 경로에선 Day 번호)' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
