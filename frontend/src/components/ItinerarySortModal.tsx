import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sortItinerary, type RouteSortStyle, type SortItineraryResult } from '../api/itinerarySort'
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
   * 표시는 부모가 담당한다(ADR-0013, ui-dev 후속 스펙 §C). */
  onSuccess: (result: SortItineraryResult) => void
}

interface ConfirmLine {
  label: string
  dayLabel: string
  itemTitle: string
}

/**
 * 정렬 실행 전 사용자에게 확인시킬 세 지점(여행의 출발점 / 첫날의 종점 / 여행의 도착점)을
 * 현재 화면에 보이는 순서(`itemsByDayId`)에서 뽑는다(ADR-0013 결정 1) — 저장된 지정값이
 * 아니라 "지금 이 순간의 첫/마지막 항목"이 곧 앵커다.
 *
 * 항목이 1개 이하인 Day는 서버가 애초에 `skipped_days`로 건너뛰므로(정렬할 게 없음) 그 Day가
 * 기여하는 줄은 만들지 않는다 — 확인할 것이 없으면 확인 단계 자체를 건너뛰기 위함(아래
 * `needsConfirmation` 참고).
 */
function buildConfirmLines(
  days: Day[],
  selectedDayIds: number[],
  itemsByDayId: Record<number, ItineraryItem[]>,
): ConfirmLine[] {
  if (days.length === 0) return []

  const firstDay = days[0]
  const lastDay = days[days.length - 1]
  const isSingleDayTrip = firstDay.id === lastDay.id

  const firstDaySelected = selectedDayIds.includes(firstDay.id)
  const lastDaySelected = selectedDayIds.includes(lastDay.id)

  const firstDayItems = itemsByDayId[firstDay.id] ?? []
  const lastDayItems = itemsByDayId[lastDay.id] ?? []

  const lines: ConfirmLine[] = []

  if (firstDaySelected && firstDayItems.length > 1) {
    const firstDayLabel = getDayLabel(firstDay, 0)
    lines.push({ label: '여행 출발', dayLabel: firstDayLabel, itemTitle: firstDayItems[0].title })
    lines.push({
      label: '첫날 종점',
      dayLabel: firstDayLabel,
      itemTitle: firstDayItems[firstDayItems.length - 1].title,
    })
  }

  // 여행이 하루짜리면 "여행 도착"은 위 "첫날 종점"과 같은 항목이라 중복 표시하지 않는다
  // (그 하루가 첫날 규칙 하나로만 처리되기 때문 — ADR-0013 결정 5는 첫날과 마지막 날이
  // 서로 다른 Day일 때의 구분이다).
  if (!isSingleDayTrip && lastDaySelected && lastDayItems.length > 1) {
    lines.push({
      label: '여행 도착',
      dayLabel: getDayLabel(lastDay, days.length - 1),
      itemTitle: lastDayItems[lastDayItems.length - 1].title,
    })
  }

  return lines
}

/**
 * Day 편집 페이지의 "AI 정렬" 버튼에서 여는 모달. 여행 목록의 "AI 추천"(ADR-0009,
 * `AiSuggestionModal`)과는 다른 기능이라 이름/설명 문구로 분명히 구분한다.
 *
 * 외부 API 호출이 없어 응답이 밀리초 단위라(ADR-0012/0013), `AiSuggestionModal`과 달리 긴 대기
 * 상태 UI가 필요 없다.
 *
 * **확인 대화상자(ADR-0013)**: 선택한 날짜에 여행의 첫날/마지막 날이 포함돼 있으면, 서버 호출
 * 전에 모달 안에서 인라인 확인 화면(`step === 'confirm'`)을 한 번 보여준다. "예"를 눌러야
 * 실제 `sortItinerary()` 요청이 나간다 — 그 확인은 서버에 저장되는 상태가 아니라 이번 요청
 * 한 번에만 유효한 사용자의 의사다.
 */
export default function ItinerarySortModal({ tripId, days, itemsByDayId, onClose, onSuccess }: Props) {
  // 기본값: 전체 날짜 선택 — 가장 흔한 사용 패턴("등록해둔 걸 한 번에 정리")에 맞춘다.
  const [selectedDayIds, setSelectedDayIds] = useState<number[]>(days.map((day) => day.id))
  const [style, setStyle] = useState<RouteSortStyle>('nearest')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'confirm'>('select')

  const mutation = useMutation({
    mutationFn: () => sortItinerary(tripId, { day_ids: selectedDayIds, style }),
    onSuccess: (result) => {
      setError(null)
      onSuccess(result)
    },
    onError: (err) => {
      // 확인 화면까지 갔다가 실패한 경우에도 선택 화면으로 돌아가 에러를 보여준다.
      setStep('select')
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
    const confirmLines = buildConfirmLines(days, selectedDayIds, itemsByDayId)
    if (confirmLines.length > 0) {
      setStep('confirm')
      return
    }
    mutation.mutate()
  }

  function handleConfirmYes() {
    mutation.mutate()
  }

  function handleConfirmNo() {
    setStep('select')
  }

  const confirmLines = step === 'confirm' ? buildConfirmLines(days, selectedDayIds, itemsByDayId) : []

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {step === 'confirm' ? '출발/도착 지점을 확인해주세요' : '일정 AI 정렬'}
          </h2>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {step === 'select' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              <ul className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                {confirmLines.map((line, index) => (
                  <li key={index}>
                    <span className="font-medium">{line.label}</span>: <span>{line.dayLabel}</span>의{' '}
                    {line.label === '첫날 종점' ? '마지막' : line.label === '여행 도착' ? '마지막' : '첫'} 일정 —{' '}
                    <span className="font-medium">"{line.itemTitle}"</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600">
                이 지점이 실제 출발/도착 지점이 맞나요? 아니라면 취소하고 일정 목록에서 드래그로 순서를 바꾼
                뒤 다시 실행해주세요.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleConfirmNo}
                disabled={mutation.isPending}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                아니오, 취소
              </button>
              <button
                type="button"
                onClick={handleConfirmYes}
                disabled={mutation.isPending}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {mutation.isPending ? '정렬 중...' : '예, 정렬합니다'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
