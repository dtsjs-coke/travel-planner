/**
 * localStorage TTL 캐시. 사파리 사생활 모드/용량 초과/저장소 차단 환경에서는 getItem/setItem이
 * 예외를 던지므로 전부 try/catch로 감싸 "캐시가 없는 것처럼" 조용히 동작한다(여행 도구함은
 * 캐시 없이도 온라인에서는 동작해야 한다 — ADR-0014).
 */

interface CacheEnvelope<T> {
  fetchedAt: number
  expiresAt: number
  value: T
}

export interface CacheEntry<T> {
  value: T
  fetchedAt: number
  /** TTL이 아직 안 지났으면 true. 만료됐어도 오프라인 폴백용으로 값은 돌려준다. */
  fresh: boolean
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.fetchedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }
    return { value: parsed.value, fetchedAt: parsed.fetchedAt, fresh: Date.now() < parsed.expiresAt }
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  try {
    const now = Date.now()
    const envelope: CacheEnvelope<T> = { fetchedAt: now, expiresAt: now + ttlMs, value }
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // 저장 실패는 무시 — 다음 요청 때 다시 네트워크를 탄다.
  }
}

/** "2026-09-30 14:05" 형식(로컬 시각). 오프라인 배지용. */
export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
