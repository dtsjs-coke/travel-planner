import { MUST_VISIT_COLOR } from '../../lib/guideColors'
import { markerSize } from '../../lib/guideData'

interface Props {
  /** 마커 안에 표시할 숫자(Day 모드: 방문 순서 / 전체 경로 모드: Day 번호). */
  label: number
  color: string
  isMust: boolean
  selected?: boolean
  /** 카드 안에서 쓸 때는 그림자/확대를 줄이고 싶을 수 있어 크기를 직접 지정할 수 있다. */
  size?: number
}

/**
 * 가이드 지도/카드 공통 원형 핀. Day 색 배경 + 흰 글자 + 흰 테두리.
 * 필수 방문은 더 크고 빨간 3px 테두리 + 우상단 ★ 배지(원본 HTML과 같은 시각 언어).
 * 지도 위에서는 AdvancedMarker 안에 넣어 쓰므로 순수 HTML/CSS로만 그린다.
 */
export default function GuideMarkerPin({ label, color, isMust, selected = false, size }: Props) {
  const px = size ?? markerSize(isMust)
  return (
    <div
      className="relative flex items-center justify-center rounded-full font-semibold text-white shadow-md"
      style={{
        width: px,
        height: px,
        backgroundColor: color,
        border: isMust ? `3px solid ${MUST_VISIT_COLOR}` : '2px solid #ffffff',
        fontSize: isMust ? 14 : 12,
        transform: selected ? 'scale(1.15)' : undefined,
        boxShadow: selected ? '0 0 0 3px rgba(15,23,42,0.35), 0 2px 6px rgba(0,0,0,0.35)' : undefined,
      }}
    >
      {label}
      {isMust && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] leading-none shadow"
          style={{ color: MUST_VISIT_COLOR }}
        >
          ★
        </span>
      )}
    </div>
  )
}
