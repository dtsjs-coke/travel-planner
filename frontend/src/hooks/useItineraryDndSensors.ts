import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

/**
 * 일정 목록 드래그용 센서 구성. 원래 `ItineraryList` 안에 있던 것을 그대로 옮겨온 것으로,
 * 값은 M3(2026-09-04)에서 안드로이드 스크롤 제스처와의 충돌을 피하려고 맞춰둔 그대로다.
 * (`TouchSensor` 150ms 지연 = 손가락을 얹고 잠깐 멈춰야 드래그 시작 → 그 전에는 브라우저
 * 세로 스크롤/당겨서 새로고침이 정상 동작한다.) 데스크톱/모바일이 같은 구성을 쓰도록 훅으로 뺐다.
 */
export function useItineraryDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )
}
