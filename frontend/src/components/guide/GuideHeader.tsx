import { Link } from 'react-router-dom'
import { formatTripPeriod } from '../../lib/guideData'
import type { TripDetail } from '../../types/models'

interface Props {
  trip: TripDetail
  onOpenSummary: () => void
  onOpenTips: () => void
}

export default function GuideHeader({ trip, onOpenSummary, onOpenTips }: Props) {
  const period = formatTripPeriod(trip)
  const hasTips = Boolean(trip.travel_tips)
  const btn =
    'relative flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100'

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-2">
      <Link to={`/trips/${trip.id}`} className="text-sm text-slate-500 hover:underline">
        &larr; 일정 편집
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-slate-800">{trip.name}</h1>
            {period && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{period}</span>
            )}
          </div>
          {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenSummary} className={btn}>
            <span aria-hidden="true">📋</span> <span className="hidden sm:inline">일정 </span>요약표
          </button>
          <button type="button" onClick={onOpenTips} className={btn}>
            <span aria-hidden="true">💡</span> 팁·메모
            {hasTips && (
              <span
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"
                aria-label="저장된 팁 있음"
              />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
