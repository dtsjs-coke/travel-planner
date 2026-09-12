import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  suggestTrips,
  type AreaScope,
  type Pace,
  type Theme,
  type TripSuggestionResult,
} from '../api/aiSuggestion'
import { extractErrorMessage } from '../lib/errors'

// 백엔드 AI 전용 상한(ADR-0009 결정 3)과 정확히 맞춘 클라이언트 측 상한.
// 여기서 미리 막아두는 이유는 불필요한 422 왕복을 줄이기 위함이지, 서버 검증을 대신하는 것은 아니다
// (서버 상수가 바뀌면 이 값도 같이 맞춰야 한다).
const MAX_DAYS = 14
const MAX_CITIES_TOTAL = 3
const MAX_COUNTRIES = 2
const MAX_EXTRA_NOTES_LENGTH = 200

const PACE_OPTIONS: Array<{ value: Pace; label: string }> = [
  { value: 'relaxed', label: '느긋' },
  { value: 'normal', label: '적당' },
  { value: 'packed', label: '빡빡' },
]

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'food', label: '맛집탐방' },
  { value: 'heritage', label: '유적지탐방' },
  { value: 'landmark', label: '명소탐방' },
  { value: 'cafe', label: '카페탐방' },
]

const AREA_SCOPE_OPTIONS: Array<{ value: AreaScope; label: string }> = [
  { value: 'selected_only', label: '선택한 도시만' },
  { value: 'include_nearby', label: '주변 도시 포함' },
]

interface CountryBlock {
  country: string
  cities: string[]
  cityInput: string
}

function emptyCountryBlock(): CountryBlock {
  return { country: '', cities: [], cityInput: '' }
}

interface Props {
  onClose: () => void
  /** 성공 시 부모(TripListPage)에게 결과를 전달 — 목록 쿼리 무효화/안내 배너 표시는 부모가 담당. */
  onSuccess: (result: TripSuggestionResult) => void
}

/** 여행 목록 화면의 플로팅 "AI 추천" 버튼에서 여는 조건 입력 모달(ADR-0009, ui-dev 후속 스펙).
 *
 * 자유 프롬프트가 아니라 제한된 조건(국가/도시/기간/스타일)만 입력받는다 — 프롬프트는 서버가
 * 조립한다. 응답이 최대 75초까지 걸릴 수 있어(백엔드 시간 예산) 제출 중에는 닫기까지 막는다:
 * 이 API는 멱등하지 않아(같은 조건으로 다시 부르면 Trip이 또 생성된다) 사용자가 닫고 다시
 * 열어 재제출하는 경로 자체를 차단하는 게 가장 확실한 중복 클릭 방지다.
 */
export default function AiSuggestionModal({ onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()

  const [multiCountry, setMultiCountry] = useState(false)
  const [countries, setCountries] = useState<CountryBlock[]>([emptyCountryBlock()])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [areaScope, setAreaScope] = useState<AreaScope>('selected_only')
  const [pace, setPace] = useState<Pace>('normal')
  const [themes, setThemes] = useState<Theme[]>([])
  const [extraNotes, setExtraNotes] = useState('')
  const [planCount, setPlanCount] = useState(3)
  const [error, setError] = useState<string | null>(null)

  const totalCities = countries.reduce((sum, c) => sum + c.cities.length, 0)

  const mutation = useMutation({
    mutationFn: () =>
      suggestTrips({
        regions: countries
          .filter((c) => c.country.trim() && c.cities.length > 0)
          .map((c) => ({ country: c.country.trim(), cities: c.cities })),
        start_date: startDate,
        end_date: endDate,
        area_scope: areaScope,
        pace,
        themes,
        extra_notes: extraNotes.trim() ? extraNotes.trim() : undefined,
        plan_count: planCount,
      }),
    onSuccess: (result) => {
      // 응답의 created_trips는 목록에 필요한 전체 필드를 담고 있지 않으므로 캐시에 직접 넣지
      // 않고 ['trips']를 무효화해 다시 불러온다(ADR-0009 API 계약 절 / ui-dev 후속 스펙).
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      onSuccess(result)
    },
    onError: (err) => {
      setError(extractErrorMessage(err, 'AI 추천 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'))
    },
  })

  function toggleMultiCountry(next: boolean) {
    setMultiCountry(next)
    setCountries((prev) => {
      if (next) {
        return prev.length >= MAX_COUNTRIES ? prev : [...prev, emptyCountryBlock()]
      }
      return prev.slice(0, 1)
    })
  }

  function updateCountryName(index: number, value: string) {
    setCountries((prev) => prev.map((c, i) => (i === index ? { ...c, country: value } : c)))
  }

  function updateCityInput(index: number, value: string) {
    setCountries((prev) => prev.map((c, i) => (i === index ? { ...c, cityInput: value } : c)))
  }

  function addCity(index: number) {
    setCountries((prev) => {
      const block = prev[index]
      const city = block.cityInput.trim()
      if (!city || totalCities >= MAX_CITIES_TOTAL || block.cities.includes(city)) return prev
      return prev.map((c, i) => (i === index ? { ...c, cities: [...c.cities, city], cityInput: '' } : c))
    })
  }

  function removeCity(index: number, city: string) {
    setCountries((prev) =>
      prev.map((c, i) => (i === index ? { ...c, cities: c.cities.filter((existing) => existing !== city) } : c)),
    )
  }

  function toggleTheme(value: Theme) {
    setThemes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))
  }

  const dayCount =
    startDate && endDate
      ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1
      : null
  const dateRangeInvalid = !!startDate && !!endDate && endDate < startDate
  const dateRangeTooLong = dayCount !== null && dayCount > MAX_DAYS
  const hasValidRegion = countries.some((c) => c.country.trim() && c.cities.length > 0)

  const canSubmit =
    hasValidRegion &&
    !!startDate &&
    !!endDate &&
    !dateRangeInvalid &&
    !dateRangeTooLong &&
    planCount >= 1 &&
    planCount <= 3 &&
    !mutation.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">AI 여행 추천</h2>
          {/* 제출 중에는 닫기를 막는다 — 멱등하지 않은 요청이라 닫고 다시 열어 재제출하면 중복 생성된다. */}
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">
          조건을 입력하면 AI가 실존하는 장소로 채워진 여행 일정 초안을 최대 3개까지 자동으로 만들어줍니다.
          마음에 안 드는 안은 목록에서 바로 삭제할 수 있어요.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <fieldset disabled={mutation.isPending} className="flex flex-col gap-4">
            {/* 여러 나라 여부 */}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={multiCountry}
                onChange={(e) => toggleMultiCountry(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              여러 나라를 함께 방문해요
            </label>

            {/* 국가 + 도시 */}
            <div className="flex flex-col gap-3">
              {countries.map((block, index) => (
                <div key={index} className="rounded-md border border-slate-200 p-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    국가{multiCountry ? ` ${index + 1}` : ''}
                  </label>
                  <input
                    value={block.country}
                    onChange={(e) => updateCountryName(index, e.target.value)}
                    placeholder="예: 대한민국"
                    className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <label className="mb-1 block text-xs font-medium text-slate-500">도시 (최대 {MAX_CITIES_TOTAL}곳)</label>
                  <div className="flex gap-2">
                    <input
                      value={block.cityInput}
                      onChange={(e) => updateCityInput(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCity(index)
                        }
                      }}
                      placeholder="예: 광주"
                      disabled={totalCities >= MAX_CITIES_TOTAL}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => addCity(index)}
                      disabled={!block.cityInput.trim() || totalCities >= MAX_CITIES_TOTAL}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      추가
                    </button>
                  </div>
                  {block.cities.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {block.cities.map((city) => (
                        <li
                          key={city}
                          className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                        >
                          {city}
                          <button
                            type="button"
                            onClick={() => removeCity(index, city)}
                            aria-label={`${city} 삭제`}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {totalCities >= MAX_CITIES_TOTAL && (
                <p className="text-xs text-amber-600">
                  도시는 총 {MAX_CITIES_TOTAL}곳까지만 선택할 수 있습니다.
                </p>
              )}
            </div>

            {/* 기간 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
                시작일
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
                종료일
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>
            </div>
            <p className="-mt-2 text-xs text-slate-400">최대 {MAX_DAYS}일까지 만들 수 있습니다.</p>
            {dateRangeInvalid && <p className="text-xs text-red-600">종료일은 시작일보다 빠를 수 없습니다.</p>}
            {dateRangeTooLong && (
              <p className="text-xs text-red-600">
                여행 기간은 최대 {MAX_DAYS}일까지 설정할 수 있습니다(현재 {dayCount}일).
              </p>
            )}

            {/* 지역 제한 */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">지역 범위</p>
              <div className="flex gap-4">
                {AREA_SCOPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="radio"
                      name="area_scope"
                      checked={areaScope === opt.value}
                      onChange={() => setAreaScope(opt.value)}
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 여행 밀도 */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">여행 밀도</p>
              <div className="flex gap-4">
                {PACE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="radio"
                      name="pace"
                      checked={pace === opt.value}
                      onChange={() => setPace(opt.value)}
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 여행 스타일 (다중) */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">여행 스타일 (복수 선택 가능)</p>
              <div className="flex flex-wrap gap-4">
                {THEME_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={themes.includes(opt.value)}
                      onChange={() => toggleTheme(opt.value)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 추가 서술형 입력 */}
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              추가 요청 (선택)
              <textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value.slice(0, MAX_EXTRA_NOTES_LENGTH))}
                maxLength={MAX_EXTRA_NOTES_LENGTH}
                rows={2}
                placeholder="예: 아이와 함께 갑니다"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <span className="self-end text-xs text-slate-400">
                {extraNotes.length}/{MAX_EXTRA_NOTES_LENGTH}
              </span>
            </label>

            {/* 안 개수 */}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              추천 안 개수
              <select
                value={planCount}
                onChange={(e) => setPlanCount(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value={1}>1개</option>
                <option value={2}>2개</option>
                <option value={3}>3개</option>
              </select>
            </label>
          </fieldset>

          {mutation.isPending && (
            <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
              />
              AI가 일정을 만들고 있습니다. 최대 1분 정도 걸릴 수 있어요.
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {mutation.isPending ? '생성 중...' : 'AI 추천 받기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
