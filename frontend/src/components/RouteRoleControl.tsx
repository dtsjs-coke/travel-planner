import { useState } from 'react'
import type { RouteRole } from '../lib/routeEndpoints'

interface Props {
  role: RouteRole
  onSetRole: (role: RouteRole) => void
}

/**
 * 일정 AI 정렬의 시작점/끝점 지정 트리거(ADR-0012, ui-dev 후속 스펙). 첫날의 카드에서만
 * 렌더된다(`ItineraryItemCard`의 `canDesignateRouteRole`). `MoveItemControl`의 드롭다운
 * variant와 같은 z-index 체계(10/20)를 그대로 쓴다 — 이 페이지에서 이미 검증된 값이다.
 *
 * 같은 항목을 시작점이면서 끝점으로 만드는 조합은 메뉴에 아예 없다(이미 시작점인 항목에는
 * "시작점으로 지정"이 보이지 않는다) — 서버 422를 클라이언트에서 선제적으로 막는다.
 */
export default function RouteRoleControl({ role, onSetRole }: Props) {
  const [open, setOpen] = useState(false)

  function handleSelect(next: RouteRole) {
    setOpen(false)
    onSetRole(next)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 text-sm text-slate-400 hover:text-slate-600"
        aria-label="시작점/끝점 지정"
        title="일정 AI 정렬의 시작점/끝점 지정"
      >
        동선
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5">
            {role !== 'start' && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('start')}
                  className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                >
                  시작점으로 지정
                </button>
              </li>
            )}
            {role !== 'end' && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('end')}
                  className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                >
                  끝점으로 지정
                </button>
              </li>
            )}
            {role !== null && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
                >
                  지정 해제
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
