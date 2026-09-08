import { useCallback, useEffect, useRef, useState } from 'react'

interface UseActiveDayOnScrollResult {
  activeDayId: number | null
  registerSection: (el: HTMLElement | null) => void // 각 Day 섹션의 ref로 넘김
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
  const elementsRef = useRef<Set<HTMLElement>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const registerSection = useCallback((el: HTMLElement | null) => {
    if (el) {
      elementsRef.current.add(el)
      observerRef.current?.observe(el)
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
