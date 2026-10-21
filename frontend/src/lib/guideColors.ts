/**
 * 여행 가이드 페이지의 Day 색 팔레트(ADR-0015). 마커/경로선/Day 칩/요약표/범례가 모두 이 함수 하나를 쓴다.
 * 빨강 계열은 일부러 뺐다 — 빨강(#dc2626)은 "필수 방문" 테두리/별표 전용 색이다.
 */
const PALETTE = [
  '#2563eb', // blue
  '#16a34a', // green
  '#ea580c', // orange
  '#9333ea', // purple
  '#0891b2', // cyan
  '#ca8a04', // yellow
  '#db2777', // pink
  '#4f46e5', // indigo
  '#0d9488', // teal
  '#b45309', // brown
]

/** 필수 방문 강조 전용 색. */
export const MUST_VISIT_COLOR = '#dc2626'

/** `index`는 `days` 배열에서의 위치(0부터) — `getDayLabel`과 같은 기준. */
export function getDayColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]
}
