import { readCache, writeCache } from './localCache'

/**
 * Open-Meteo(키 없음, CORS `*`) — 지오코딩 + 예보. plain `fetch`만 쓴다(ADR-0014).
 * 캐시: 지오코딩 30일, 예보 1시간. 네트워크 실패 시 만료된 캐시라도 있으면 그걸 돌려주고
 * `offline: true`로 표시한다(에러 모달 금지).
 */

const DAY_MS = 24 * 60 * 60 * 1000

export interface GeoPlace {
  id?: number
  name: string
  admin1?: string
  country?: string
  country_code?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface Forecast {
  timezone: string
  current: { temperature: number; weatherCode: number } | null
  daily: Array<{
    date: string // YYYY-MM-DD (해당 지역 현지 날짜)
    weatherCode: number
    max: number
    min: number
    precipProb: number | null
  }>
}

export interface Cached<T> {
  data: T
  fetchedAt: number
  offline: boolean
}

function isGeoPlace(r: unknown): r is GeoPlace {
  const o = r as GeoPlace
  return typeof o?.name === 'string' && Number.isFinite(o.latitude) && Number.isFinite(o.longitude)
}

export async function geocode(query: string): Promise<Cached<GeoPlace[]>> {
  const q = query.trim()
  const key = `tools:geo:v1:${q.toLowerCase()}`
  const cached = readCache<GeoPlace[]>(key)
  if (cached?.fresh) return { data: cached.value, fetchedAt: cached.fetchedAt, offline: false }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=ko`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    const results: GeoPlace[] = Array.isArray(json?.results)
      ? (json.results as unknown[]).filter(isGeoPlace).map((r) => ({
          id: r.id,
          name: r.name,
          admin1: r.admin1,
          country: r.country,
          country_code: r.country_code,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone,
        }))
      : []
    // 결과가 비었을 때도 캐시한다(같은 오타를 반복 호출하지 않도록) — 대신 1일만.
    writeCache(key, results, results.length > 0 ? 30 * DAY_MS : DAY_MS)
    return { data: results, fetchedAt: Date.now(), offline: false }
  } catch (err) {
    if (cached) return { data: cached.value, fetchedAt: cached.fetchedAt, offline: true }
    throw err
  }
}

export async function fetchForecast(lat: number, lng: number): Promise<Cached<Forecast>> {
  const key = `tools:wx:v1:${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = readCache<Forecast>(key)
  if (cached?.fresh) return { data: cached.value, fetchedAt: cached.fetchedAt, offline: false }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      '&current=temperature_2m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=16'
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    const d = json?.daily
    if (!d || !Array.isArray(d.time)) throw new Error('unexpected response')

    const forecast: Forecast = {
      timezone: typeof json.timezone === 'string' ? json.timezone : 'UTC',
      current:
        json.current && Number.isFinite(json.current.temperature_2m)
          ? { temperature: json.current.temperature_2m, weatherCode: json.current.weather_code ?? 0 }
          : null,
      daily: (d.time as string[]).map((date, i) => ({
        date,
        weatherCode: d.weather_code?.[i] ?? 0,
        max: d.temperature_2m_max?.[i],
        min: d.temperature_2m_min?.[i],
        precipProb: d.precipitation_probability_max?.[i] ?? null,
      })),
    }
    writeCache(key, forecast, 60 * 60 * 1000)
    return { data: forecast, fetchedAt: Date.now(), offline: false }
  } catch (err) {
    if (cached) return { data: cached.value, fetchedAt: cached.fetchedAt, offline: true }
    throw err
  }
}

/** WMO weather_code → 이모지 + 한글 (Open-Meteo 문서의 코드 표). */
export function describeWeather(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: '맑음' }
  if (code === 1) return { emoji: '🌤️', label: '대체로 맑음' }
  if (code === 2) return { emoji: '⛅', label: '구름 조금' }
  if (code === 3) return { emoji: '☁️', label: '흐림' }
  if (code === 45 || code === 48) return { emoji: '🌫️', label: '안개' }
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: '이슬비' }
  if (code === 61 || code === 63 || code === 65) return { emoji: '🌧️', label: '비' }
  if (code === 66 || code === 67) return { emoji: '🌧️', label: '어는 비' }
  if (code === 71 || code === 73 || code === 75) return { emoji: '🌨️', label: '눈' }
  if (code === 77) return { emoji: '🌨️', label: '싸락눈' }
  if (code >= 80 && code <= 82) return { emoji: '🌧️', label: '소나기' }
  if (code === 85 || code === 86) return { emoji: '🌨️', label: '눈 소나기' }
  if (code === 95) return { emoji: '⛈️', label: '뇌우' }
  if (code === 96 || code === 99) return { emoji: '⛈️', label: '우박 동반 뇌우' }
  return { emoji: '❔', label: '알 수 없음' }
}
