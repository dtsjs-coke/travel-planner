import type { SortItineraryResult } from '../api/itinerarySort'

interface Props {
  result: SortItineraryResult
  onDismiss: () => void
}

/**
 * `POST /api/trips/{id}/sort-itinerary` 결과 배너(ADR-0012, ui-dev 후속 스펙 §6). 부분 성공이
 * 정상 경로이므로 "성공/실패" 이분법으로 만들지 않는다 — 세 갈래를 시각적으로 분리한다:
 *
 * - `sorted_days`(초록, 성공) — `changed=false`는 "이미 정리돼 있었다"는 뜻으로 다르게 표시.
 * - `skipped_days`(회색, 조치 불필요) — 일정이 0~1개라 정렬할 게 없었을 뿐.
 * - `failed_days`(빨강, 조치 필요) — 서버가 이미 한국어 문구를 주므로 그대로 보여준다.
 *
 * `message`/`warnings`는 서버가 이미 한국어로 준다(ADR-0012 결정 5) — 별도 번역이 필요 없다.
 */
export default function ItinerarySortResultBanner({ result, onDismiss }: Props) {
  const { sorted_days, skipped_days, failed_days, warnings } = result

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg bg-white p-4 shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">동선 정렬 결과</p>
        <button onClick={onDismiss} aria-label="닫기" className="shrink-0 text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>

      {sorted_days.length === 0 && skipped_days.length === 0 && failed_days.length === 0 && (
        <p className="text-sm text-slate-400">정렬할 날짜가 선택되지 않았습니다.</p>
      )}

      {sorted_days.length > 0 && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-700">정렬 완료</p>
          <ul className="mt-1 list-disc pl-5 text-emerald-700">
            {sorted_days.map((day) => (
              <li key={day.day_id}>
                {day.date} —{' '}
                {day.changed ? `일정 ${day.item_count}곳의 순서를 새로 정렬했습니다.` : '이미 정리되어 있었습니다.'}
                {day.unlocatable_item_count > 0 &&
                  ` (좌표 없는 일정 ${day.unlocatable_item_count}건은 순서 계산에서 제외됨)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {skipped_days.length > 0 && (
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-500">건너뜀 (조치 불필요)</p>
          <ul className="mt-1 list-disc pl-5 text-slate-500">
            {skipped_days.map((day) => (
              <li key={day.day_id}>
                {day.date} — {day.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed_days.length > 0 && (
        <div className="rounded-md bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-700">확인이 필요합니다</p>
          <ul className="mt-1 list-disc pl-5 text-red-700">
            {failed_days.map((day) => (
              <li key={day.day_id}>
                {day.date} — {day.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-600">
          {warnings.map((warning, idx) => (
            <li key={idx}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
