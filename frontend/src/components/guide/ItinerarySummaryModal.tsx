import { getDayLabel } from '../../lib/dayLabel'
import { getDayColor } from '../../lib/guideColors'
import { formatShortDate, summarizeDay } from '../../lib/guideData'
import type { Day, ItineraryItem } from '../../types/models'
import GuideModalShell from './GuideModalShell'

interface Props {
  days: Day[]
  itemsByDayId: Record<number, ItineraryItem[]>
  itemsLoading: boolean
  errorDayIds: number[]
  onSelectDay: (dayId: number) => void
  onClose: () => void
}

/** 일정 요약표. "필수 명소만" 필터와 무관하게 여행 전체를 보여준다. 행 클릭 시 그 Day로 이동. */
export default function ItinerarySummaryModal({
  days,
  itemsByDayId,
  itemsLoading,
  errorDayIds,
  onSelectDay,
  onClose,
}: Props) {
  return (
    <GuideModalShell title="📋 일정 요약표" onRequestClose={onClose} widthClass="max-w-3xl">
      {itemsLoading ? (
        <p className="py-6 text-center text-sm text-slate-500">불러오는 중...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium">날짜</th>
                <th className="py-2 pr-3 font-medium">지역</th>
                <th className="py-2 pr-3 text-right font-medium">장소 수</th>
                <th className="py-2 pr-3 font-medium">필수 방문</th>
                <th className="py-2 font-medium">시간</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => {
                const failed = errorDayIds.includes(day.id)
                const summary = summarizeDay(itemsByDayId[day.id] ?? [])
                const shown = summary.mustTitles.slice(0, 3)
                const rest = summary.mustTitles.length - shown.length
                return (
                  <tr
                    key={day.id}
                    onClick={() => onSelectDay(day.id)}
                    className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <button type="button" className="flex items-center gap-1.5 text-left font-medium text-slate-800">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: getDayColor(index) }}
                        />
                        {getDayLabel(day, index)}
                      </button>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{formatShortDate(day.date)}</td>
                    {failed ? (
                      <td colSpan={4} className="py-2 text-red-600">
                        일정을 불러오지 못했어요
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-3 text-slate-600">{summary.regionText ?? '-'}</td>
                        <td className="py-2 pr-3 text-right text-slate-600">{summary.placeCount}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {shown.length === 0 ? (
                            '-'
                          ) : (
                            <>
                              <span className="text-red-600">★</span> {shown.join(', ')}
                              {rest > 0 ? ` 외 ${rest}` : ''}
                            </>
                          )}
                        </td>
                        <td className="py-2 whitespace-nowrap text-slate-600">{summary.timeRange ?? '-'}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </GuideModalShell>
  )
}
