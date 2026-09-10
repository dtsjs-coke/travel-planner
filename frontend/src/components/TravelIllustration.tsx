interface TravelIllustrationProps {
  className?: string
}

/**
 * 여행 목록 페이지 상단 여백(여행 생성 폼이 접혀 있을 때)에 쓰는 작은 인라인 SVG
 * 일러스트(여행 가방 + 종이비행기). 외부 이미지 파일/URL 대신 인라인 SVG로 구현해
 * 오프라인/CSP 환경에서도 항상 동일하게 렌더링되고, 별도 에셋 파이프라인이 필요 없다.
 */
export default function TravelIllustration({ className }: TravelIllustrationProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="여행 가방과 비행기 일러스트">
      <circle cx="60" cy="50" r="48" className="fill-slate-100" />

      {/* 점선 비행 궤적 */}
      <path
        d="M26 32 Q52 10 92 22"
        fill="none"
        className="stroke-slate-300"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />

      {/* 종이비행기 */}
      <path d="M88 14 L102 20 L91 25 L87 34 L82 23 Z" className="fill-slate-500" />

      {/* 여행 가방 */}
      <rect x="34" y="48" width="52" height="36" rx="7" className="fill-white stroke-slate-400" strokeWidth="2" />
      <rect x="50" y="39" width="20" height="11" rx="3" className="fill-white stroke-slate-400" strokeWidth="2" />
      <line x1="34" y1="64" x2="86" y2="64" className="stroke-slate-300" strokeWidth="2" />
      <circle cx="60" cy="64" r="3" className="fill-amber-400" />
    </svg>
  )
}
