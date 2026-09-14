import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateItem, type ItemUpdateInput } from '../api/items'
import { extractErrorMessage } from '../lib/errors'
import { getGoogleMapsLink } from '../lib/googleMapsLink'
import type { ItineraryItem } from '../types/models'

interface Props {
  item: ItineraryItem
  onClose: () => void
}

// 백엔드 검증 상한과 동일하게 맞춘다(ADR-0011, `backend/app/schemas.py`의
// MAX_PLACE_CATEGORY_LENGTH/MAX_REGION_NAME_LENGTH/MAX_ITEM_NOTES_LENGTH).
// `maxLength`로 브라우저 단에서 미리 막아 불필요한 422 왕복을 줄인다.
const MAX_PLACE_CATEGORY_LENGTH = 50
const MAX_REGION_NAME_LENGTH = 100
const MAX_NOTES_LENGTH = 2000

/** `item.start_time`("09:30:00" | null)을 `<input type="time">`이 받는 "09:30" 형태로 변환. */
function toTimeInputValue(startTime: string | null): string {
  return startTime ? startTime.slice(0, 5) : ''
}

/**
 * 일정 상세보기 모달(트리플 여행앱 스타일, ADR-0011). 장소명 / 카테고리+지역 /
 * 시작 시간 / 자유 입력칸(notes)을 한 화면에서 보고 고친다.
 *
 * 카테고리/지역이 비어 있으면 "정보 없음"만 보여주지 않고 **바로 입력할 수 있는 칸**으로
 * 둔다 — 일부 지역은 구글이 원래 못 주는 정상 케이스라 사용자가 직접 채울 수 있어야
 * 한다. 저장은 바뀐 필드만 `PATCH /api/items/{id}`로 보낸다.
 *
 * 이 모달은 **어떤 구글 API도 호출하지 않는다.** 보여주는 값은 전부 일정 등록 시점에
 * 이미 받아둔 것이거나 사용자가 입력한 것이다(영업시간 조회는 요금 티어 때문에 철회 —
 * ADR-0011 "철회 기록"). 여기에 "열 때 뭔가 조회해오는" 로직을 다시 넣지 말 것.
 */
export default function ItineraryItemDetailModal({ item, onClose }: Props) {
  const queryClient = useQueryClient()
  const itemsQueryKey = ['days', item.day_id, 'items']

  const [categoryDraft, setCategoryDraft] = useState(item.place_category ?? '')
  const [regionDraft, setRegionDraft] = useState(item.region_name ?? '')
  const [startTimeDraft, setStartTimeDraft] = useState(toTimeInputValue(item.start_time))
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mapsLink = getGoogleMapsLink(item)

  const updateMutation = useMutation({
    mutationFn: (patch: ItemUpdateInput) => updateItem(item.id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<ItineraryItem[] | undefined>(itemsQueryKey, (old) =>
        old?.map((it) => (it.id === updated.id ? updated : it)),
      )
      setSaveError(null)
      setSaved(true)
    },
    onError: (err) => {
      setSaveError(extractErrorMessage(err, '저장하지 못했습니다.'))
    },
  })

  function handleSave() {
    setSaved(false)
    const patch: ItemUpdateInput = {}
    if (categoryDraft !== (item.place_category ?? '')) patch.place_category = categoryDraft
    if (regionDraft !== (item.region_name ?? '')) patch.region_name = regionDraft
    if (notesDraft !== (item.notes ?? '')) patch.notes = notesDraft
    if (startTimeDraft !== toTimeInputValue(item.start_time)) {
      // 시간 입력을 비우면 서버는 빈 문자열이 아니라 명시적 null을 원한다(dt.time 파싱 대상이라
      // 텍스트 필드처럼 "빈 문자열 = 지움"을 스스로 처리하지 않는다).
      patch.start_time = startTimeDraft || null
    }
    if (Object.keys(patch).length === 0) return
    setSaveError(null)
    updateMutation.mutate(patch)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline"
              >
                📍 구글지도에서 보기
              </a>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              장소 카테고리
              <input
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                maxLength={MAX_PLACE_CATEGORY_LENGTH}
                placeholder="정보 없음 (직접 입력 가능)"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              지역
              <input
                value={regionDraft}
                onChange={(e) => setRegionDraft(e.target.value)}
                maxLength={MAX_REGION_NAME_LENGTH}
                placeholder="정보 없음 (직접 입력 가능)"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            시작 시간
            <input
              type="time"
              value={startTimeDraft}
              onChange={(e) => setStartTimeDraft(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            메모 (자유 입력)
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              maxLength={MAX_NOTES_LENGTH}
              rows={5}
              placeholder="알아본 정보, 링크 등을 자유롭게 적어두세요."
              className="rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:border-slate-500 focus:outline-none"
            />
          </label>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saved && !saveError && <p className="text-sm text-green-600">저장했습니다.</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
