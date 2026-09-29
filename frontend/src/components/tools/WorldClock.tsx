import { useEffect, useMemo, useState } from 'react'
import { COUNTRIES, FALLBACK_TIMEZONES } from '../../lib/tools/countries'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

const HOME_TZ = 'Asia/Seoul'

function listTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    const values = intl.supportedValuesOf?.('timeZone')
    if (values && values.length > 0) return values
  } catch {
    // 미지원 → 폴백
  }
  return FALLBACK_TIMEZONES
}

/** 해당 시각에 tz의 UTC 오프셋(분). Intl 부분값으로 계산해 `longOffset` 미지원 브라우저에서도 동작한다. */
function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

function dateKey(tz: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

function tzLabel(tz: string): string {
  const country = COUNTRIES.find((c) => c.timezone === tz)
  if (tz === HOME_TZ) return '🇰🇷 서울'
  if (country) return `${country.flag} ${country.name}`
  return tz.replace(/_/g, ' ')
}

function ClockCard({ tz, now, removable, onRemove }: { tz: string; now: Date; removable: boolean; onRemove: () => void }) {
  let time = '--:--'
  let dateText = ''
  let diffText = ''
  try {
    time = new Intl.DateTimeFormat('ko-KR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now)
    dateText = new Intl.DateTimeFormat('ko-KR', {
      timeZone: tz,
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(now)
    if (tz !== HOME_TZ) {
      const diffMin = offsetMinutes(tz, now) - offsetMinutes(HOME_TZ, now)
      const hours = Math.abs(diffMin) / 60
      const hoursText = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
      if (diffMin === 0) diffText = '서울과 같은 시각'
      else diffText = `서울보다 ${hoursText}시간 ${diffMin > 0 ? '빠름' : '느림'} (${diffMin > 0 ? '+' : '-'}${hoursText}h)`
      const dayGap = dateKey(tz, now) === dateKey(HOME_TZ, now) ? '' : dateKey(tz, now) > dateKey(HOME_TZ, now) ? ' · 서울 기준 내일' : ' · 서울 기준 어제'
      diffText += dayGap
    }
  } catch {
    diffText = '지원하지 않는 시간대입니다'
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700">{tzLabel(tz)}</p>
        <p className="text-xs text-slate-500">{dateText}</p>
        {diffText && <p className="text-xs text-indigo-600">{diffText}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold tabular-nums text-slate-800">{time}</span>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${tzLabel(tz)} 시계 삭제`}
            className="min-h-11 min-w-11 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  )
}

interface Props {
  prefill: ToolsPrefill | null
}

export default function WorldClock({ prefill }: Props) {
  const [now, setNow] = useState(() => new Date())
  const [extra, setExtra] = useState<string[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [pick, setPick] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const allZones = useMemo(() => listTimezones(), [])

  const prefillTz = prefill?.timezone && !removed.includes(prefill.timezone) ? prefill.timezone : null
  const zones = [HOME_TZ, ...(prefillTz ? [prefillTz] : []), ...extra].filter((z, i, arr) => arr.indexOf(z) === i)

  function addZone(tz: string) {
    if (!tz || zones.includes(tz)) return
    setExtra((prev) => [...prev, tz])
    setRemoved((prev) => prev.filter((z) => z !== tz))
    setPick('')
  }

  function removeZone(tz: string) {
    setExtra((prev) => prev.filter((z) => z !== tz))
    setRemoved((prev) => [...prev, tz])
  }

  return (
    <section aria-labelledby="clock-title" className="flex flex-col gap-4">
      <h2 id="clock-title" className="sr-only">
        시차 · 세계시계
      </h2>

      <ul className="flex flex-col gap-2" aria-live="off">
        {zones.map((tz) => (
          <ClockCard key={tz} tz={tz} now={now} removable={tz !== HOME_TZ} onRemove={() => removeZone(tz)} />
        ))}
      </ul>

      <div className="flex flex-wrap gap-2" aria-label="빠른 추가">
        {COUNTRIES.filter((c) => !zones.includes(c.timezone)).map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => addZone(c.timezone)}
            className="min-h-11 rounded-full border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            + {c.flag} {c.name}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        다른 시간대 추가
        <select
          value={pick}
          onChange={(e) => addZone(e.target.value)}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:border-slate-500 focus:outline-none"
        >
          <option value="">시간대 선택...</option>
          {allZones
            .filter((z) => !zones.includes(z))
            .map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
        </select>
      </label>

      <p className="text-xs text-slate-500">
        시각은 기기 시계를 기준으로 계산되며, 서머타임이 적용되는 지역은 현재 날짜 기준 시차가 표시됩니다.
      </p>
    </section>
  )
}
