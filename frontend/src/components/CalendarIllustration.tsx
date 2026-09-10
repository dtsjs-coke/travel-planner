interface CalendarIllustrationProps {
  className?: string
}

/**
 * Day 편집 페이지 상단 여백(날짜 추가 폼이 접혀 있을 때)에 쓰는 작은 인라인 SVG
 * 일러스트(달력 + 위치 핀). 같은 페이지에 이미 지도와 Day 탭이 있어 여행 가방/비행기
 * 모티프(TravelIllustration)를 반복하면 어색하므로 "날짜/일정" 느낌에 맞는 새 모티프를 쓴다.
 * TravelIllustration과 동일하게 외부 이미지 없이 인라인 SVG, slate 톤으로 구현한다.
 */
export default function CalendarIllustration({ className }: CalendarIllustrationProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="달력과 위치 핀 일러스트">
      <circle cx="60" cy="50" r="48" className="fill-slate-100" />

      {/* 달력 본체 */}
      <rect x="30" y="34" width="52" height="46" rx="6" className="fill-white stroke-slate-400" strokeWidth="2" />
      {/* 달력 헤더 바 */}
      <path d="M30 34 a6 6 0 0 1 6 -6 h40 a6 6 0 0 1 6 6 v8 h-52 z" className="fill-slate-400" />
      {/* 고리 */}
      <line x1="42" y1="24" x2="42" y2="32" className="stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
      <line x1="70" y1="24" x2="70" y2="32" className="stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
      {/* 날짜 그리드 점 */}
      <circle cx="41" cy="54" r="2.4" className="fill-slate-300" />
      <circle cx="51" cy="54" r="2.4" className="fill-slate-300" />
      <circle cx="61" cy="54" r="2.4" className="fill-amber-400" />
      <circle cx="71" cy="54" r="2.4" className="fill-slate-300" />
      <circle cx="41" cy="65" r="2.4" className="fill-slate-300" />
      <circle cx="51" cy="65" r="2.4" className="fill-slate-300" />
      <circle cx="61" cy="65" r="2.4" className="fill-slate-300" />
      <circle cx="71" cy="65" r="2.4" className="fill-slate-300" />

      {/* 위치 핀 (달력 오른쪽 위로 살짝 겹치게, 여행 경로/장소를 은유) */}
      <path
        d="M92 20 c8 0 13 6 13 13 c0 9 -13 22 -13 22 s-13 -13 -13 -22 c0 -7 5 -13 13 -13 z"
        className="fill-slate-500"
      />
      <circle cx="92" cy="33" r="5" className="fill-white" />
    </svg>
  )
}
