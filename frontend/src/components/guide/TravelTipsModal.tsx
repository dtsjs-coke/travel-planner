import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getTrip, updateTrip } from '../../api/trips'
import { extractErrorMessage } from '../../lib/errors'
import GuideModalShell from './GuideModalShell'

// 백엔드 MAX_TRIP_TRAVEL_TIPS_LENGTH와 동일(ADR-0015).
const MAX_TIPS_LENGTH = 5000

const PLACEHOLDER = '■ 이동 팁\n- 칼사다 돌길은 비 오면 미끄러워요\n\n■ 예약 필수\n- \n\n■ 맛집 메모\n- '

interface Props {
  tripId: number
  /** 현재 캐시된 팁(보기 모드 표시용). */
  tips: string | null
  onClose: () => void
}

/** 팁/추천 메모 모달. 가이드 페이지에서 유일하게 쓰기가 가능한 곳(ADR-0015). 순수 텍스트만 다룬다. */
export default function TravelTipsModal({ tripId, tips, onClose }: Props) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [baseline, setBaseline] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = editing && draft !== baseline

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('저장하지 않은 내용이 있어요. 닫을까요?')) return
    onClose()
  }, [dirty, onClose])

  async function startEditing() {
    setError(null)
    setLoadingEdit(true)
    try {
      // 상대가 방금 고친 내용을 덮어쓰지 않도록, 편집을 시작할 때 최신 값을 서버에서 다시 받는다(ADR-0015).
      const latest = await queryClient.fetchQuery({
        queryKey: ['trips', tripId],
        queryFn: () => getTrip(tripId),
        staleTime: 0,
      })
      const text = latest.travel_tips ?? ''
      setDraft(text)
      setBaseline(text)
      setEditing(true)
    } catch (err) {
      setError(extractErrorMessage(err, '최신 내용을 불러오지 못했습니다.'))
    } finally {
      setLoadingEdit(false)
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const result = await updateTrip(tripId, { travel_tips: draft })
      queryClient.setQueryData(['trips', tripId], result)
      queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
      setEditing(false)
    } catch (err) {
      setError(extractErrorMessage(err, '저장하지 못했습니다.'))
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm('저장하지 않은 내용이 있어요. 취소할까요?')) return
    setEditing(false)
    setError(null)
  }

  return (
    <GuideModalShell title="💡 팁·메모" onRequestClose={requestClose}>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_TIPS_LENGTH}
            rows={14}
            placeholder={PLACEHOLDER}
            autoFocus
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
          />
          <p className="text-right text-xs text-slate-500">
            {draft.length} / {MAX_TIPS_LENGTH}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="min-h-11 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 rounded-md bg-slate-800 px-4 text-sm text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tips ? (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{tips}</p>
          ) : (
            <p className="text-sm text-slate-500">
              아직 적어둔 팁이 없어요. 이동 팁, 예약 필수 스팟, 맛집 메모 등을 적어두면 두 사람 모두 여기서 볼 수
              있어요.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={startEditing}
              disabled={loadingEdit}
              className="min-h-11 rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loadingEdit ? '불러오는 중...' : '편집'}
            </button>
          </div>
        </div>
      )}
    </GuideModalShell>
  )
}
