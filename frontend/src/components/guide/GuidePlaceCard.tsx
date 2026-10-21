import { forwardRef } from 'react'
import { getGoogleMapsLink } from '../../lib/googleMapsLink'
import { formatTime, hasCoords } from '../../lib/guideData'
import type { ItineraryItem } from '../../types/models'
import GuideMarkerPin from './GuideMarkerPin'

interface Props {
  item: ItineraryItem
  /** 순번(1부터, 필터 전 기준). */
  order: number
  color: string
  selected: boolean
  onSelect: (itemId: number) => void
}

/** 읽기 전용 장소 카드. 좌표가 없는 항목은 클릭 불가(cursor-default) + "위치 정보 없음" 배지. */
const GuidePlaceCard = forwardRef<HTMLLIElement, Props>(function GuidePlaceCard(
  { item, order, color, selected, onSelect },
  ref,
) {
  const clickable = hasCoords(item)
  const mapsLink = getGoogleMapsLink(item)
  const time = formatTime(item.start_time)
  const endTime = formatTime(item.end_time)

  const body = (
    <>
      {clickable ? (
        <GuideMarkerPin label={order} color={color} isMust={item.is_must_visit} size={28} />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-white">
          {order}
        </span>
      )}
      <div className="min-w-0 flex-1 pr-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-slate-800">{item.title}</span>
          {item.is_must_visit && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">★ 필수</span>
          )}
          {!clickable && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">위치 정보 없음</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          {time && (
            <span>
              {time}
              {endTime ? `~${endTime}` : ''}
            </span>
          )}
          {item.place_category && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{item.place_category}</span>
          )}
          {item.region_name && <span>{item.region_name}</span>}
        </div>
        {item.notes && <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-500">{item.notes}</p>}
      </div>
    </>
  )

  const base = 'flex w-full items-start gap-3 rounded-lg bg-white p-3 text-left shadow-sm ring-1'
  const ring = selected ? 'ring-2 ring-slate-700' : 'ring-slate-200'

  return (
    <li ref={ref} className="relative">
      {clickable ? (
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className={`${base} ${ring} min-h-11 hover:bg-slate-50`}
        >
          {body}
        </button>
      ) : (
        <div className={`${base} ${ring} cursor-default`}>{body}</div>
      )}
      {mapsLink && (
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 rounded p-1 text-sm text-blue-600 hover:bg-blue-50"
          title="구글지도에서 보기"
          aria-label="구글지도에서 보기"
        >
          📍
        </a>
      )}
    </li>
  )
})

export default GuidePlaceCard
