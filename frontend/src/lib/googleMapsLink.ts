import type { ItineraryItem } from '../types/models'

/**
 * 일정 항목(`ItineraryItem`)에서 구글지도 바로가기 링크를 만든다. 영업시간 조회(ADR-0011,
 * 철회됨)와 달리 **API 호출이 전혀 없다** — 이미 저장돼 있는 `place_id`/`address`/`title`
 * 문자열만으로 구글 "Place Details" 링크 포맷을 조합할 뿐이다.
 *
 * - `place_id`가 있으면(구글 검색으로 추가한 장소) place_id 기반 링크를 만든다. `query`는
 *   구글 공식 문서가 권장하는 대로 place_id 조회 실패 시 폴백 텍스트 역할도 하므로 항상
 *   장소명을 넣는다.
 * - `place_id`가 없는 수동 입력 장소는 `address`(있으면) 또는 `title`로 일반 검색 링크를
 *   만든다.
 * - 링크를 만들 최소한의 정보(제목)조차 없으면 `null`을 반환한다 — 호출부는 이 경우
 *   링크 자체를 렌더링하지 않아야 한다.
 */
export function getGoogleMapsLink(item: Pick<ItineraryItem, 'title' | 'place_id' | 'address'>): string | null {
  const title = item.title?.trim()

  if (item.place_id) {
    const query = encodeURIComponent(title || item.place_id)
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(item.place_id)}`
  }

  const fallbackText = item.address?.trim() || title
  if (!fallbackText) return null

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackText)}`
}
