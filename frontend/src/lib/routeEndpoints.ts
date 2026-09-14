import type { ItineraryItem } from '../types/models'

export type RouteRole = 'start' | 'end' | null

/**
 * 카드에서 "시작점으로 지정" / "끝점으로 지정" / "지정 해제"를 눌렀을 때, `PUT
 * /api/days/{day_id}/route-endpoints`에 보낼 **다음 전체 상태**를 계산한다.
 *
 * 서버는 이 API를 Day 단위 PUT(항상 전체 교체)으로만 받는다(ADR-0012) — "Day당 시작 하나,
 * 끝 하나"를 지키려면 다른 항목의 같은 역할을 같은 트랜잭션에서 지워야 하기 때문이다. 그래서
 * 프론트도 먼저 "지금 이 Day의 시작/끝이 누구인지"를 읽고, 클릭된 항목의 역할만 바뀐 상태를
 * 통째로 계산해 보낸다.
 *
 * 같은 항목이 시작점이면서 끝점인 조합(422 "start and end points must be different items")은
 * 여기서 미리 막는다 — 예를 들어 현재 끝점인 항목을 시작점으로 지정하면, 그 항목의 끝점 역할은
 * 자동으로 사라진다(한 항목이 둘 다일 수 없다).
 */
export function computeNextRouteEndpoints(
  items: ItineraryItem[],
  itemId: number,
  role: RouteRole,
): { start_item_id: number | null; end_item_id: number | null } {
  const currentStartId = items.find((item) => item.route_role === 'start')?.id ?? null
  const currentEndId = items.find((item) => item.route_role === 'end')?.id ?? null

  if (role === 'start') {
    return { start_item_id: itemId, end_item_id: currentEndId === itemId ? null : currentEndId }
  }
  if (role === 'end') {
    return { start_item_id: currentStartId === itemId ? null : currentStartId, end_item_id: itemId }
  }
  // role === null: 이 항목의 지정만 해제한다. 다른 항목의 지정은 그대로 둔다.
  return {
    start_item_id: currentStartId === itemId ? null : currentStartId,
    end_item_id: currentEndId === itemId ? null : currentEndId,
  }
}
