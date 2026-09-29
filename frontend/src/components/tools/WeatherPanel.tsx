import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { describeWeather, fetchForecast, geocode, type GeoPlace } from '../../lib/tools/openMeteo'
import { formatDateTime } from '../../lib/tools/localCache'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 24 * 60 * 60 * 1000

function todayString(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD 두 날짜의 일수 차(b - a). 시간대 영향을 없애려고 UTC 자정으로 해석한다. */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${WEEKDAYS[d.getUTCDay()]})`
}

function placeLabel(p: GeoPlace): string {
  return [p.name, p.admin1, p.country].filter(Boolean).join(', ')
}

interface Props {
  prefill: ToolsPrefill | null
}

export default function WeatherPanel({ prefill }: Props) {
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selected, setSelected] = useState<GeoPlace | null>(null)

  const place = selected ?? prefill?.place ?? null

  const searchQuery = useQuery({
    queryKey: ['tools', 'geo', submitted],
    queryFn: () => geocode(submitted),
    enabled: submitted.length >= 2,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const forecastQuery = useQuery({
    queryKey: ['tools', 'wx', place?.latitude.toFixed(2), place?.longitude.toFixed(2)],
    queryFn: () => fetchForecast(place!.latitude, place!.longitude),
    enabled: place !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (q.length >= 2) setSubmitted(q)
  }

  const forecast = forecastQuery.data?.data
  const start = prefill?.startDate ?? null
  const end = prefill?.endDate ?? prefill?.startDate ?? null
  const today = todayString()
  const tripTooFar = start !== null && dayDiff(today, start) > 15

  return (
    <section aria-labelledby="wx-title" className="flex flex-col gap-4">
      <h2 id="wx-title" className="sr-only">
        여행지 날씨
      </h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="도시 검색 (예: 오사카, Bangkok)"
          aria-label="도시 검색"
          enterKeyHint="search"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        />
        <button
          type="submit"
          disabled={input.trim().length < 2}
          className="min-h-11 rounded-md bg-slate-800 px-4 text-sm text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        >
          검색
        </button>
      </form>

      {submitted && searchQuery.isLoading && <p className="text-sm text-slate-500">검색 중...</p>}
      {submitted && searchQuery.isError && (
        <p className="text-sm text-amber-700">도시를 검색하지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      )}
      {submitted && searchQuery.data && searchQuery.data.data.length === 0 && (
        <p className="text-sm text-slate-500">"{submitted}" 검색 결과가 없습니다.</p>
      )}
      {searchQuery.data && searchQuery.data.data.length > 0 && submitted && (
        <ul className="flex flex-col gap-1" aria-label="검색 결과">
          {searchQuery.data.data.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  setSelected(p)
                  setSubmitted('')
                }}
                className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
              >
                {placeLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!place && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          도시를 검색해서 선택하면 16일 예보를 보여줍니다.
        </p>
      )}

      {place && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{placeLabel(place)}</h3>
            {forecast?.current && (
              <p className="text-sm text-slate-600">
                현재 {describeWeather(forecast.current.weatherCode).emoji}{' '}
                {describeWeather(forecast.current.weatherCode).label} · {Math.round(forecast.current.temperature)}°C
              </p>
            )}
          </div>

          {forecastQuery.isLoading && <p className="text-sm text-slate-500">예보 불러오는 중...</p>}

          {forecastQuery.isError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              날씨 정보를 불러오지 못했습니다.
              <button type="button" onClick={() => forecastQuery.refetch()} className="ml-2 min-h-11 underline">
                다시 시도
              </button>
            </div>
          )}

          {forecastQuery.data && (
            <p
              className={`w-fit rounded-full px-3 py-1 text-xs ${
                forecastQuery.data.offline ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              마지막 갱신: {formatDateTime(forecastQuery.data.fetchedAt)}
              {forecastQuery.data.offline ? ' (오프라인)' : ''}
            </p>
          )}

          {tripTooFar && (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
              예보는 최대 16일까지만 제공됩니다 — 여행 기간이 아직 멀어서 지금은 앞으로 16일간의 예보를 보여줍니다.
            </p>
          )}

          {forecast && (
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {forecast.daily.map((day) => {
                const w = describeWeather(day.weatherCode)
                const inTrip = !tripTooFar && start !== null && end !== null && day.date >= start && day.date <= end
                return (
                  <li
                    key={day.date}
                    aria-label={`${formatDay(day.date)} ${w.label}`}
                    className={`flex min-h-12 items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 ${
                      inTrip ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="w-20 shrink-0 text-sm text-slate-700">
                      {formatDay(day.date)}
                      {inTrip && <span className="block text-[11px] font-medium text-indigo-600">여행 기간</span>}
                    </div>
                    <span className="text-2xl" role="img" aria-label={w.label}>
                      {w.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{w.label}</span>
                    <div className="shrink-0 text-right text-sm">
                      <span className="font-medium text-red-600">{Math.round(day.max)}°</span>
                      <span className="text-slate-400"> / </span>
                      <span className="font-medium text-blue-600">{Math.round(day.min)}°</span>
                      {day.precipProb !== null && (
                        <span className="block text-xs text-slate-500">💧 {day.precipProb}%</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
          Weather data by Open-Meteo.com
        </a>
      </p>
    </section>
  )
}
