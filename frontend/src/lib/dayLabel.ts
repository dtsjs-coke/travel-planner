import type { Day } from '../types/models'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * Day 라벨의 단일 소스. 데스크톱 탭/모바일 섹션 헤더/Day 점프 칩 모두 이 함수를 통해서만 라벨을 만든다.
 * - `day.label`이 있으면 그 값을 그대로 반환한다 (자동 포맷 미적용).
 * - 없으면 `Day{순번} {M}/{D}({요일})` 형식으로 자동 생성한다. 순번/월/일 모두 0 패딩 없음, 대시 없음.
 */
export function getDayLabel(day: Day, index: number): string {
  const trimmedLabel = day.label?.trim()
  if (trimmedLabel) return trimmedLabel

  // day.date는 'YYYY-MM-DD' 형태의 로컬 날짜 문자열. new Date('YYYY-MM-DD')는 UTC로 해석돼
  // 로컬 타임존에 따라 하루 어긋날 수 있으므로 연/월/일을 직접 분해해 로컬 Date를 만든다.
  const [year, month, dateNum] = day.date.split('-').map(Number)
  const parsed = new Date(year, (month ?? 1) - 1, dateNum ?? 1)
  const m = parsed.getMonth() + 1
  const d = parsed.getDate()
  const weekday = WEEKDAY_LABELS[parsed.getDay()]
  return `Day${index + 1} ${m}/${d}(${weekday})`
}
