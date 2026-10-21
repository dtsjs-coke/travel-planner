import type { ItineraryItem, Trip } from '../types/models'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export type ItemWithCoords = ItineraryItem & { lat: number; lng: number }

export function hasCoords(item: ItineraryItem): item is ItemWithCoords {
  return item.lat != null && item.lng != null
}

/** "09:30:00" -> "09:30". 없으면 null. */
export function formatTime(startTime: string | null): string | null {
  return startTime ? startTime.slice(0, 5) : null
}

/** 'YYYY-MM-DD'를 로컬 Date로(new Date(str)은 UTC로 해석돼 하루 어긋날 수 있다 — dayLabel.ts와 같은 방식). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 'YYYY.MM.DD (요일)' */
export function formatDayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const date = parseLocalDate(dateStr)
  return `${y}.${m}.${d} (${WEEKDAYS[date.getDay()]})`
}

/** 'M/D(요일)' — 요약표용 짧은 날짜. */
export function formatShortDate(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`
}

export interface DaySummary {
  placeCount: number
  mustCount: number
  /** 중복 제거, 등장 순 최대 3개를 " · "로 연결 + 넘치면 " 외 N". 없으면 null. */
  regionText: string | null
  /** "09:30 ~ 18:00" (start_time 있는 항목의 최소~최대). 없으면 null. 하나뿐이면 "09:30". */
  timeRange: string | null
  mustTitles: string[]
}

export function summarizeDay(items: ItineraryItem[]): DaySummary {
  const regions: string[] = []
  for (const item of items) {
    const region = item.region_name?.trim()
    if (region && !regions.includes(region)) regions.push(region)
  }
  const regionText =
    regions.length === 0
      ? null
      : regions.slice(0, 3).join(' · ') + (regions.length > 3 ? ` 외 ${regions.length - 3}` : '')

  const times = items.map((i) => formatTime(i.start_time)).filter((t): t is string => t !== null).sort()
  const timeRange =
    times.length === 0 ? null : times[0] === times[times.length - 1] ? times[0] : `${times[0]} ~ ${times[times.length - 1]}`

  const must = items.filter((i) => i.is_must_visit)
  return {
    placeCount: items.length,
    mustCount: must.length,
    regionText,
    timeRange,
    mustTitles: must.map((i) => i.title),
  }
}

/** '2026.11.01 – 11.09 · 8박 9일'. start/end 둘 다 있을 때만, 아니면 null. */
export function formatTripPeriod(trip: Pick<Trip, 'start_date' | 'end_date'>): string | null {
  if (!trip.start_date || !trip.end_date) return null
  const start = parseLocalDate(trip.start_date)
  const end = parseLocalDate(trip.end_date)
  // DST 영향을 피하려고 UTC 자정으로 일수 차이를 계산한다.
  const diffDays = Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  )
  const [sy, sm, sd] = trip.start_date.split('-')
  const [ey, em, ed] = trip.end_date.split('-')
  const endText = ey === sy ? `${em}.${ed}` : `${ey}.${em}.${ed}`
  const base = `${sy}.${sm}.${sd} – ${endText}`
  if (diffDays < 0) return base
  const nights = diffDays
  return `${base} · ${nights === 0 ? '당일치기' : `${nights}박 ${nights + 1}일`}`
}

export function truncateText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 지도 마커/카드 공통 크기(px). */
export function markerSize(isMust: boolean): number {
  return isMust ? 36 : 28
}
