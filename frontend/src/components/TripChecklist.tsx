import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChecklistItem,
  deleteChecklistItem,
  listChecklist,
  updateChecklistItem,
} from '../api/checklist'
import { extractErrorMessage } from '../lib/errors'
import type { ChecklistItem } from '../types/models'

const MAX_CHECKLIST_TEXT_LENGTH = 200

interface Props {
  tripId: number
}

/** 여행 카드 안에 펼쳐지는 준비물(체크리스트) 섹션.
 *
 * 배지/펼치기 방식: 접혀 있을 때는 쿼리를 비활성화(`enabled: isOpen`)해 API를 호출하지
 * 않는다. 대신 같은 쿼리 키를 그대로 구독하고 있으므로, 한 번이라도 펼쳐서 데이터를
 * 받아온 뒤로는 React Query 캐시에 남은 값을 그대로 읽어 접힌 상태에서도 "N/M" 배지를
 * 보여줄 수 있다(추가 fetch 없음). 아직 한 번도 펼치지 않은 카드는 정확한 개수를 알 방법이
 * 없으므로 "준비물 보기"라는 문구만 둔다. 별도의 "개수만 미리 가져오는" API나 로컬 상태
 * 복제 없이 가장 단순하게 구현하는 방법이라 이 방식을 택했다.
 */
export default function TripChecklist({ tripId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['trips', tripId, 'checklist'] as const

  const [isOpen, setIsOpen] = useState(false)
  const [newText, setNewText] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => listChecklist(tripId),
    enabled: isOpen,
  })

  const checkedCount = data?.filter((item) => item.is_checked).length ?? 0
  const totalCount = data?.length ?? 0

  const addMutation = useMutation({
    mutationFn: (text: string) => createChecklistItem(tripId, text),
    onSuccess: (created) => {
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) => (old ? [...old, created] : [created]))
      setNewText('')
      setAddError(null)
    },
    onError: (err) => {
      setAddError(extractErrorMessage(err, '준비물을 추가하지 못했습니다.'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_checked }: { id: number; is_checked: boolean }) =>
      updateChecklistItem(id, { is_checked }),
    onMutate: async ({ id, is_checked }) => {
      const previous = queryClient.getQueryData<ChecklistItem[]>(queryKey)
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) =>
        old?.map((item) => (item.id === id ? { ...item, is_checked } : item)),
      )
      setActionError(null)
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      setActionError(extractErrorMessage(err, '체크 상태를 변경하지 못했습니다.'))
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) =>
        old?.map((item) => (item.id === updated.id ? updated : item)),
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteChecklistItem(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) => old?.filter((item) => item.id !== id))
      setActionError(null)
    },
    onError: (err) => {
      setActionError(extractErrorMessage(err, '준비물을 삭제하지 못했습니다.'))
    },
  })

  const trimmedNewText = newText.trim()
  const canAdd = trimmedNewText.length > 0 && trimmedNewText.length <= MAX_CHECKLIST_TEXT_LENGTH

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canAdd || addMutation.isPending) return
    addMutation.mutate(trimmedNewText)
  }

  function handleDelete(item: ChecklistItem) {
    if (!window.confirm(`"${item.text}" 항목을 삭제할까요?`)) return
    deleteMutation.mutate(item.id)
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        {data ? `준비물 ${checkedCount}/${totalCount}` : '준비물 보기'}
        <span className="ml-1 text-slate-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-2">
          {isLoading && <p className="text-sm text-slate-400">불러오는 중...</p>}
          {isError && <p className="text-sm text-red-600">준비물을 불러오지 못했습니다.</p>}

          {data && data.length === 0 && (
            <p className="text-sm text-slate-400">등록된 준비물이 없습니다.</p>
          )}

          {data && data.length > 0 && (
            <ul className="flex flex-col gap-1">
              {data.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={(e) => toggleMutation.mutate({ id: item.id, is_checked: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-slate-700"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      item.is_checked ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deleteMutation.isPending}
                    className="shrink-0 text-sm text-red-500 hover:underline disabled:opacity-50"
                    aria-label="준비물 삭제"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          {actionError && <p className="mt-1 text-sm text-red-600">{actionError}</p>}

          <form onSubmit={handleAddSubmit} className="mt-2 flex items-center gap-2">
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="준비물 추가 (예: 여권)"
              maxLength={MAX_CHECKLIST_TEXT_LENGTH}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canAdd || addMutation.isPending}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              추가
            </button>
          </form>
          {addError && <p className="mt-1 text-sm text-red-600">{addError}</p>}
        </div>
      )}
    </div>
  )
}
