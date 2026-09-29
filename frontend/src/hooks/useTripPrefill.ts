import { useQuery } from '@tanstack/react-query'
import { getTrip } from '../api/trips'
import { geocode, type GeoPlace } from '../lib/tools/openMeteo'
import { findCountry } from '../lib/tools/countries'

export interface ToolsPrefill {
  tripName: string
  destination: string | null
  startDate: string | null
  endDate: string | null
  /** 환율 "현지 통화" 프리필: trip.currency가 KRW가 아니면 그 값, 아니면 국가 통화. */
  currency: string | null
  place: GeoPlace | null
  countryCode: string | null
  timezone: string | null
  phraseLang: string | null
  translateLang: string | null
}

/**
 * `/tools?trip=<id>` 프리필. 여행 정보(기존 쿼리 `['trips', id]`) → 목적지 첫 토큰 지오코딩.
 * 어느 단계든 실패하면 조용히 프리필 없이 진행한다(에러 표시 금지 — 프리필은 편의 기능).
 */
export function useTripPrefill(tripId: number | null): ToolsPrefill | null {
  const enabled = tripId !== null && Number.isFinite(tripId)

  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => getTrip(tripId as number),
    enabled,
    retry: 0,
  })
  const trip = tripQuery.data

  const firstToken = trip?.destination?.split(/[,/·]/)[0]?.trim() ?? ''
  const geoQuery = useQuery({
    queryKey: ['tools', 'geo', firstToken],
    queryFn: async () => {
      const first = await geocode(firstToken)
      // "일본 오사카"처럼 공백 구분이면 통째 검색이 실패하므로, 결과가 없을 때만 마지막 공백 토큰으로 1회 재시도.
      if (first.data.length === 0 && /\s/.test(firstToken)) {
        const lastWord = firstToken.split(/\s+/).pop() ?? ''
        if (lastWord.length >= 2 && lastWord !== firstToken) return geocode(lastWord)
      }
      return first
    },
    enabled: firstToken.length >= 2,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 0,
  })

  if (!trip) return null

  const place = geoQuery.data?.data[0] ?? null
  const country = findCountry(place?.country_code)
  const currency = trip.currency && trip.currency !== 'KRW' ? trip.currency : (country?.currency ?? null)

  return {
    tripName: trip.name,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    currency,
    place,
    countryCode: country?.code ?? null,
    timezone: place?.timezone ?? country?.timezone ?? null,
    phraseLang: country?.phraseLang ?? null,
    translateLang: country?.translateLang ?? null,
  }
}
