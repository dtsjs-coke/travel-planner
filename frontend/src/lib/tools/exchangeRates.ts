import { readCache, writeCache } from './localCache'

/**
 * 환율: `https://open.er-api.com/v6/latest/KRW` — 키 없음, CORS `*`. 기준 통화(KRW) 하나만 받아
 * 교차환율(A→B = rates[B] / rates[A])로 계산하므로 캐시 키가 1개다. plain `fetch`만 쓴다(`apiClient`의
 * withCredentials와 ACAO `*`는 브라우저가 거부 — ADR-0014). 이 API는 하루 1회 갱신 + 과호출 시
 * 레이트리밋이라 `time_next_update_unix`까지 캐시를 재사용한다.
 */

const CACHE_KEY = 'tools:fx:v1:KRW'
const FALLBACK_TTL_MS = 12 * 60 * 60 * 1000
const MIN_TTL_MS = 60 * 60 * 1000

interface CachedRates {
  time_last_update_unix: number | null
  time_next_update_unix: number | null
  rates: Record<string, number>
}

export interface RatesResult {
  rates: Record<string, number>
  /** 캐시에 저장된 시각(ms). 화면의 "마지막 갱신"에 쓴다. */
  fetchedAt: number
  /** 네트워크 실패로 (만료됐을 수도 있는) 캐시를 대신 보여주는 중이면 true. */
  offline: boolean
}

export async function fetchRates(): Promise<RatesResult> {
  const cached = readCache<CachedRates>(CACHE_KEY)
  if (cached?.fresh) {
    return { rates: cached.value.rates, fetchedAt: cached.fetchedAt, offline: false }
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/KRW')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    if (json?.result !== 'success' || typeof json.rates !== 'object' || json.rates === null) {
      throw new Error('unexpected response')
    }
    const next = typeof json.time_next_update_unix === 'number' ? json.time_next_update_unix : null
    const last = typeof json.time_last_update_unix === 'number' ? json.time_last_update_unix : null
    let ttl = next ? next * 1000 - Date.now() : FALLBACK_TTL_MS
    if (ttl < MIN_TTL_MS) ttl = MIN_TTL_MS // 갱신 시각이 이미 지났어도 과호출하지 않도록 최소 1시간
    const value: CachedRates = {
      time_last_update_unix: last,
      time_next_update_unix: next,
      rates: json.rates as Record<string, number>,
    }
    writeCache(CACHE_KEY, value, ttl)
    return { rates: value.rates, fetchedAt: Date.now(), offline: false }
  } catch (err) {
    if (cached) {
      return { rates: cached.value.rates, fetchedAt: cached.fetchedAt, offline: true }
    }
    throw err
  }
}

/** A→B 교차환율. 지원하지 않는 통화면 null. */
export function crossRate(rates: Record<string, number>, from: string, to: string): number | null {
  if (from === to) return 1
  const a = rates[from]
  const b = rates[to]
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null
  return b / a
}

/** 자주 쓰는 통화(코드 → 한글 이름). 응답에 없는 코드는 화면에서 걸러낸다. */
export const CURRENCIES: Array<{ code: string; name: string }> = [
  { code: 'KRW', name: '대한민국 원' },
  { code: 'JPY', name: '일본 엔' },
  { code: 'USD', name: '미국 달러' },
  { code: 'EUR', name: '유로' },
  { code: 'CNY', name: '중국 위안' },
  { code: 'TWD', name: '대만 달러' },
  { code: 'HKD', name: '홍콩 달러' },
  { code: 'THB', name: '태국 바트' },
  { code: 'VND', name: '베트남 동' },
  { code: 'PHP', name: '필리핀 페소' },
  { code: 'SGD', name: '싱가포르 달러' },
  { code: 'GBP', name: '영국 파운드' },
  { code: 'AUD', name: '호주 달러' },
  { code: 'CAD', name: '캐나다 달러' },
  { code: 'CHF', name: '스위스 프랑' },
  { code: 'MYR', name: '말레이시아 링깃' },
  { code: 'IDR', name: '인도네시아 루피아' },
  { code: 'NZD', name: '뉴질랜드 달러' },
  { code: 'CZK', name: '체코 코루나' },
  { code: 'HUF', name: '헝가리 포린트' },
  { code: 'TRY', name: '튀르키예 리라' },
  { code: 'AED', name: 'UAE 디르함' },
  { code: 'MOP', name: '마카오 파타카' },
  { code: 'MXN', name: '멕시코 페소' },
  { code: 'INR', name: '인도 루피' },
  { code: 'LAK', name: '라오스 킵' },
  { code: 'KHR', name: '캄보디아 리엘' },
]

export function currencyLabel(code: string): string {
  const found = CURRENCIES.find((c) => c.code === code)
  return found ? `${code} · ${found.name}` : code
}
