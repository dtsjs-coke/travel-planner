import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import {
  sortItinerary,
  FIRST_DAY_ENDPOINTS_REQUIRED_DETAIL,
  type RouteSortStyle,
  type SortItineraryResult,
} from '../api/itinerarySort'
import { extractErrorMessage } from '../lib/errors'
import { getDayLabel } from '../lib/dayLabel'
import type { Day, ItineraryItem } from '../types/models'

const STYLE_OPTIONS: Array<{ value: RouteSortStyle; label: string; hint: string }> = [
  { value: 'nearest', label: '가까운곳 먼저', hint: '가까운 곳부터 차근차근 돕니다.' },
  { value: 'farthest', label: '먼곳 먼저', hint: '가장 먼 곳을 먼저 찍고 돌아옵니다.' },
  { value: 'balanced', label: '적당하게', hint: '너무 가깝지도 멀지도 않은 곳부터 시작합니다.' },
]

interface Props {
  tripId: number
  days: Day[]
  itemsByDayId: Record<number, ItineraryItem[]>
  onClose: () => void
  /** 성공(부분 성공 포함) 시 부모(DayEditorPage)에게 결과를 전달 — 캐시 무효화/결과 배너
   * 표시는 부모가 담당한다(ADR-0012, ui-dev 후속 스펙 §7). */
  onSuccess: (result: SortItineraryResult) => void
}

/**
 * Day 편집 페이지의 "AI 정렬" 버튼에서 여는 모달. 여행 목록의 "AI 추천"(ADR-0009,
 * `AiSuggestionModal`)과는 다른 기능이라 이름/설명 문구로 분명히 구분한다.
 *
 * 외부 API 호출이 없어 응답이 밀리초 단위라(ADR-0012), `AiSuggestionModal`과 달리 긴 대기
 * 상태 UI가 필요 없다.
 */
export default function ItinerarySortModal({ tripId, days, itemsByDayId, onClose, onSuccess }: Props) {
  // 기본값: 전체 날짜 선택 — 가장 흔한 사용 패턴("등록해둔 걸 한 번에 정리")에 맞춘다.
  const [selectedDayIds, setSelectedDayIds] = useState<number[]>(days.map((day) => day.id))
  const [style, setStyle] = useState<RouteSortStyle>('nearest')
  const [error, setError] = useState<string | null>(null)
  // 422("첫날 시작/끝점 미지정")는 일반 에러가 아니라 확인 알림으로 보여준다(사용자 요구,
  // ADR-0012 결정 6) — error(빨강)와 다른 톤으로 별도 state에 둔다.
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null)

  const firstDay = days[0] ?? null
  const firstDayItems = firstDay ? itemsByDayId[firstDay.id] ?? [] : []
  const firstDaySelected = firstDay !== null && selectedDayIds.includes(firstDay.id)
  // 첫날 항목이 1개 이하면 서버도 지정을 요구하지 않는다(ADR-0012 결정 6) — 여기서도 같은
  // 기준으로 힌트를 보여준다(불필요한 경고를 만들지 않기 위함).
  const firstDayNeedsEndpoints =
    firstDaySelected &&
    firstDayItems.length > 1 &&
    !(
      firstDayItems.some((item) => item.route_role === 'start') &&
      firstDayItems.some((item) => item.route_role === 'end')
    )

  const mutation = useMutation({
    mutationFn: () => sortItinerary(tripId, { day_ids: selectedDayIds, style }),
    onSuccess: (result) => {
      setError(null)
      setConfirmNotice(null)
      onSuccess(result)
    },
    onError: (err) => {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null
      if (detail === FIRST_DAY_ENDPOINTS_REQUIRED_DETAIL) {
        setError(null)
        setConfirmNotice(
          '첫째 날의 시작점과 끝점을 잘 정했는지 확인해주세요. 첫째 날 일정 목록에서 각 항목의 ' +
            '"동선" 메뉴로 지정할 수 있습니다.',
        )
        return
      }
      setConfirmNotice(null)
      setError(extractErrorMessage(err, '정렬하지 못했습니다. 잠시 후 다시 시도해주세요.'))
    },
  })

  function toggleDay(dayId: number) {
    setSelectedDayIds((prev) => (prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]))
  }

  function toggleAll() {
    setSelectedDayIds((prev) => (prev.length === days.length ? [] : days.map((day) => day.id)))
  }

  const canSubmit = selectedDayIds.length > 0 && !mutation.isPending

  function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setConfirmNotice(null)
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">일정 AI 정렬</h2>
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
          이미 등록해둔 일정을 날짜별로 가까운 동선 순서로 재정렬합니다. 외부 API를 호출하지 않아 결과가
          바로 나옵니다. 여행 목록의 "AI 추천"(새 여행 생성)과는 다른 기능입니다.
        </p>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <fieldset disabled={mutation.isPending} className="flex flex-col gap-4">
            {/* 날짜 다중 선택 */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">정렬할 날짜</p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-slate-500 hover:underline"
                >
                  {selectedDayIds.length === days.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {days.map((day, index) => (
                  <li key={day.id}>
                    <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedDayIds.includes(day.id)}
                        onChange={() => toggleDay(day.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {getDayLabel(day, index)}
                      {index === 0 && <span className="text-xs text-slate-400">(첫째 날)</span>}
                    </label>
                  </li>
                ))}
              </ul>
              {firstDayNeedsEndpoints && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠ 첫째 날의 시작점/끝점이 아직 지정되지 않았습니다. 지정 없이 실행하면 확인 알림이
                  뜹니다.
                </p>
              )}
            </div>

            {/* 정렬 스타일 */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">정렬 방식</p>
              <div className="flex flex-col gap-1.5">
                {STYLE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 text-sm text-slate-600">
                    <input
                      type="radio"
                      name="sort_style"
                      checked={style === opt.value}
                      onChange={() => setStyle(opt.value)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      {opt.label}
                      <span className="block text-xs text-slate-400">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          {confirmNotice && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <span aria-hidden="true">❓</span>
              <div className="flex-1">
                <p className="font-medium">시작점과 끝점을 확인해주세요</p>
                <p className="mt-1">{confirmNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmNotice(null)}
                aria-label="닫기"
                className="shrink-0 text-amber-500 hover:text-amber-700"
              >
                ✕
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {mutation.isPending ? '정렬 중...' : '정렬 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}
