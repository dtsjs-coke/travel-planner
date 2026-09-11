import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/settings'
import { extractErrorMessage } from '../lib/errors'
import type { AppSettings } from '../types/models'

const MAX_PARTICIPANT_NAME_LENGTH = 20

interface Props {
  onClose: () => void
}

/** 메인페이지(여행 목록) 전역에서 여는 마스터 환경설정 모달. 참가자 2명의 표시 이름만 다룬다
 * (참가자 추가/삭제는 범위 밖 — ADR-0007). 여행 카드에 속하지 않는 페이지 전역 기능이라
 * `TripChecklist`처럼 카드 안 펼치기 섹션이 아니라 모달로 띄운다(`OutOfRangeDaysModal`과 같은 패턴). */
export default function AppSettingsModal({ onClose }: Props) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">마스터 환경설정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
            ✕
          </button>
        </div>

        {isLoading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {isError && <p className="text-sm text-red-600">설정을 불러오지 못했습니다.</p>}

        {/* `data`가 로딩되기 전에는 마운트하지 않는다 — `TripEditForm`(trip prop)과 같은 패턴으로,
            로컬 입력 state를 이펙트로 나중에 동기화하지 않고 처음부터 서버 값으로 초기화한다. */}
        {data && <SettingsForm settings={data} onClose={onClose} />}
      </div>
    </div>
  )
}

interface SettingsFormProps {
  settings: AppSettings
  onClose: () => void
}

function SettingsForm({ settings, onClose }: SettingsFormProps) {
  const queryClient = useQueryClient()
  const [name1, setName1] = useState(settings.participants[0]?.name ?? '')
  const [name2, setName2] = useState(settings.participants[1]?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, string>) => updateSettings(patch),
    onSuccess: () => {
      // 이것 하나만 무효화하면 결제자 선택박스/일정 카드/정산 화면이 전부 새 이름으로 갱신된다
      // — 일정 응답에는 키만 있고 이름이 없어서 `['days', dayId, 'items']`는 건드릴 필요가 없다(ADR-0007).
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setError(null)
      onClose()
    },
    onError: (err) => {
      setError(extractErrorMessage(err, '설정을 저장하지 못했습니다.'))
    },
  })

  const trimmed1 = name1.trim()
  const trimmed2 = name2.trim()
  const bothFilled = trimmed1.length > 0 && trimmed2.length > 0
  const isDuplicate = bothFilled && trimmed1 === trimmed2
  const withinLength =
    trimmed1.length <= MAX_PARTICIPANT_NAME_LENGTH && trimmed2.length <= MAX_PARTICIPANT_NAME_LENGTH
  const canSubmit = bothFilled && !isDuplicate && withinLength && !updateMutation.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    // 바뀐 슬롯만 body에 담는다 — 안 바뀐 슬롯을 보내면 서버가 거부하진 않지만 불필요한 전송이다.
    const patch: Record<string, string> = {}
    const [p1, p2] = settings.participants
    if (p1 && trimmed1 !== p1.name) patch[p1.key] = trimmed1
    if (p2 && trimmed2 !== p2.name) patch[p2.key] = trimmed2

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    setError(null)
    updateMutation.mutate(patch)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        참가자 1 이름
        <input
          value={name1}
          onChange={(e) => setName1(e.target.value)}
          maxLength={MAX_PARTICIPANT_NAME_LENGTH}
          autoFocus
          className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        참가자 2 이름
        <input
          value={name2}
          onChange={(e) => setName2(e.target.value)}
          maxLength={MAX_PARTICIPANT_NAME_LENGTH}
          className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
      </label>

      {!bothFilled && <p className="text-xs text-amber-600">이름은 비워둘 수 없습니다.</p>}
      {isDuplicate && <p className="text-xs text-amber-600">두 이름은 서로 달라야 합니다.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {updateMutation.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
