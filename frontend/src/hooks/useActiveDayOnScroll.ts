import { useCallback, useEffect, useRef, useState } from 'react'

interface UseActiveDayOnScrollResult {
  activeDayId: number | null
  registerSection: (dayId: number, el: HTMLElement | null) => void // 각 Day 섹션의 ref로 넘김
}

interface EntryState {
  isIntersecting: boolean
  top: number
}

/**
 * 모바일 연속 스크롤 뷰에서 "지금 화면에 걸린 Day"를 IntersectionObserver로 판정한다.
 * 판정 밴드는 상단 고정 블록(지도) 바로 아래에서 시작해 뷰포트 하단 30% 지점까지이며,
 * 그 밴드 안에서 가장 위쪽에서 시작한 섹션을 활성 Day로 선택한다.
 */
export function useActiveDayOnScroll(dayIds: number[], topOffsetPx: number): UseActiveDayOnScrollResult {
  const [activeDayId, setActiveDayId] = useState<number | null>(null)
  const entriesRef = useRef<Map<number, EntryState>>(new Map())
  // dayId별로 등록된 엘리먼트를 추적한다(단순 Set이면 언마운트 시 어떤 엘리먼트가 사라졌는지
  // 알 수 없다 — ref 콜백은 el===null로만 호출되고 이전 노드를 넘겨주지 않기 때문).
  const elementsRef = useRef<Map<number, HTMLElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const registerSection = useCallback((dayId: number, el: HTMLElement | null) => {
    if (el) {
      elementsRef.current.set(dayId, el)
      observerRef.current?.observe(el)
    } else {
      // 컴포넌트 언마운트(예: 나중에 생길 Day 삭제 기능)로 React가 ref 콜백을 null로 호출한 경우.
      // observer 구독을 해제하고 내부 상태에서도 지워야 메모리 누수/유령 항목을 막을 수 있다.
      const prevEl = elementsRef.current.get(dayId)
      if (prevEl) observerRef.current?.unobserve(prevEl)
      elementsRef.current.delete(dayId)
      entriesRef.current.delete(dayId)
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const dayId = Number(entry.target.getAttribute('data-day-id'))
          if (!Number.isFinite(dayId)) continue
          entriesRef.current.set(dayId, {
            isIntersecting: entry.isIntersecting,
            top: entry.boundingClientRect.top,
          })
        }

        let bestDayId: number | null = null
        let bestTop = Infinity
        for (const [dayId, state] of entriesRef.current) {
          if (state.isIntersecting && state.top < bestTop) {
            bestTop = state.top
            bestDayId = dayId
          }
        }

        // 교차하는 게 하나도 없으면 이전 활성 Day를 그대로 유지(리셋 금지).
        if (bestDayId !== null) {
          setActiveDayId((prev) => (prev === bestDayId ? prev : bestDayId))
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${topOffsetPx}px 0px -30% 0px`,
      },
    )

    observerRef.current = observer
    elementsRef.current.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIds.join(','), topOffsetPx])

  return { activeDayId: activeDayId ?? dayIds[0] ?? null, registerSection }
}
