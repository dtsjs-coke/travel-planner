import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { getTrip } from '../api/trips'
import { createDay } from '../api/days'
import { deleteItem, moveItem, reorderItems, updateItem, type ItemUpdateInput } from '../api/items'
import { getSettings } from '../api/settings'
import { extractErrorMessage } from '../lib/errors'
import AddItemModal from '../components/AddItemModal'
import CalendarIllustration from '../components/CalendarIllustration'
import DayEditorDesktop from '../components/DayEditorDesktop'
import DayEditorMobile from '../components/DayEditorMobile'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useTripItems } from '../hooks/useTripItems'
import type { ItineraryItem } from '../types/models'

const GOOGLE_MAPS_BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? ''

export default function DayEditorPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const tripIdNum = Number(tripId)
  const queryClient = useQueryClient()
  const isDesktop = useIsDesktop()

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trips', tripIdNum],
    queryFn: () => getTrip(tripIdNum),
    enabled: Number.isFinite(tripIdNum),
  })

  const days = trip?.days ?? []
  const { itemsByDayId, isLoading: itemsLoading, errorDayIds: itemsErrorDayIds } = useTripItems(days)

  // 결제자 선택박스/표시에 쓰는 참가자 목록. 이름이 바뀌면 `['settings']`만 무효화해도
  // 여기서 자동으로 새 이름을 받아온다(ADR-0007) — 일정 캐시를 따로 건드릴 필요가 없다.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const participants = settings?.participants ?? []

  const [showCreateDayForm, setShowCreateDayForm] = useState(false)
  const [newDayDate, setNewDayDate] = useState('')
  const [newDayLabel, setNewDayLabel] = useState('')
  const [createDayError, setCreateDayError] = useState<string | null>(null)

  const createDayMutation = useMutation({
    mutationFn: () => createDay(tripIdNum, { date: newDayDate, label: newDayLabel || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripIdNum] })
      setNewDayDate('')
      setNewDayLabel('')
      setCreateDayError(null)
      setShowCreateDayForm(false)
    },
    onError: (err) => {
      setCreateDayError(extractErrorMessage(err, '날짜를 추가하지 못했습니다.'))
    },
  })

  function handleCreateDay(e: FormEvent) {
    e.preventDefault()
    if (!newDayDate) return
    setCreateDayError(null)
    createDayMutation.mutate()
  }

  const [addModalDayId, setAddModalDayId] = useState<number | null>(null)

  const deleteItemMutation = useMutation({
    mutationFn: ({ itemId }: { dayId: number; itemId: number }) => deleteItem(itemId),
    onSuccess: (_data, { dayId }) => queryClient.invalidateQueries({ queryKey: ['days', dayId, 'items'] }),
  })

  // 제목 수정과 비용/결제자 수정을 같은 mutation으로 처리한다(둘 다 `PATCH /api/items/{id}`).
  // 콜백을 분리해둔 이유는 검증 방향이 반대이기 때문 — title은 명시적 null을 거부하지만
  // cost_amount/paid_by는 null이 "지운다"는 정상 조작이다(ADR-0006).
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, patch }: { dayId: number; itemId: number; patch: ItemUpdateInput }) =>
      updateItem(itemId, patch),
    onSuccess: (_data, { dayId }) => queryClient.invalidateQueries({ queryKey: ['days', dayId, 'items'] }),
  })

  const [moveItemError, setMoveItemError] = useState<string | null>(null)

  // 낙관적 업데이트는 하지 않는다(senior-dev 권장, ADR-0004) — 원본/목적지 두 Day 캐시와
  // 서버의 position 재번호를 동시에 흉내 내야 해서 복잡도 대비 이득이 적다.
  const moveItemMutation = useMutation({
    mutationFn: ({ itemId, targetDayId }: { dayId: number; itemId: number; targetDayId: number }) =>
      moveItem(itemId, targetDayId),
    onSuccess: (movedItem, { dayId }) => {
      setMoveItemError(null)
      // 원본 Day: 남은 항목들이 서버에서 position 재번호됨(ADR-0004 #4). 목적지 Day: 새 항목 추가.
      // 같은 Day로의 no-op 이동이면 dayId === movedItem.day_id라 사실상 한 번만 무효화된다.
      queryClient.invalidateQueries({ queryKey: ['days', dayId, 'items'] })
      queryClient.invalidateQueries({ queryKey: ['days', movedItem.day_id, 'items'] })
    },
    onError: (err) => {
      setMoveItemError(extractErrorMessage(err, '일정을 옮기지 못했습니다.'))
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ dayId, orderedItemIds }: { dayId: number; orderedItemIds: number[] }) =>
      reorderItems(dayId, orderedItemIds),
    onMutate: async ({ dayId, orderedItemIds }) => {
      const itemsQueryKey = ['days', dayId, 'items']
      await queryClient.cancelQueries({ queryKey: itemsQueryKey })
      const previousItems = queryClient.getQueryData<ItineraryItem[]>(itemsQueryKey)
      if (previousItems) {
        const byId = new Map(previousItems.map((item) => [item.id, item]))
        const optimistic = orderedItemIds
          .map((id, index) => {
            const item = byId.get(id)
            return item ? { ...item, position: index } : null
          })
          .filter((item): item is ItineraryItem => item !== null)
        queryClient.setQueryData(itemsQueryKey, optimistic)
      }
      return { previousItems }
    },
    onError: (_err, { dayId }, context) => {
      if (context?.previousItems) queryClient.setQueryData(['days', dayId, 'items'], context.previousItems)
    },
    onSettled: (_data, _error, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: ['days', dayId, 'items'] })
    },
  })

  if (tripLoading) return <p className="p-6 text-slate-500">불러오는 중...</p>
  if (!trip) return <p className="p-6 text-red-600">여행을 찾을 수 없습니다.</p>

  const viewProps = {
    days,
    itemsByDayId,
    itemsLoading,
    itemsErrorDayIds,
    participants,
    onAddItem: (dayId: number) => setAddModalDayId(dayId),
    onDeleteItem: (dayId: number, itemId: number) => deleteItemMutation.mutate({ dayId, itemId }),
    onUpdateItemTitle: (dayId: number, itemId: number, title: string) =>
      updateItemMutation.mutate({ dayId, itemId, patch: { title } }),
    onUpdateItem: (dayId: number, itemId: number, patch: ItemUpdateInput, onError?: (message: string) => void) =>
      updateItemMutation.mutate(
        { dayId, itemId, patch },
        { onError: (err) => onError?.(extractErrorMessage(err, '수정하지 못했습니다.')) },
      ),
    onReorderItems: (dayId: number, orderedItemIds: number[]) =>
      reorderMutation.mutate({ dayId, orderedItemIds }),
    onMoveItem: (dayId: number, itemId: number, targetDayId: number, onMoved?: (targetDayId: number) => void) =>
      moveItemMutation.mutate(
        { dayId, itemId, targetDayId },
        { onSuccess: () => onMoved?.(targetDayId) },
      ),
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_BROWSER_KEY}>
    <div className="mx-auto min-h-screen max-w-5xl p-6">
      <Link to="/trips" className="text-sm text-slate-500 hover:underline">
        &larr; 여행 목록
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold text-slate-800">{trip.name}</h1>

      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        {!showCreateDayForm ? (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setShowCreateDayForm(true)}
              className="rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
            >
              + 날짜 추가
            </button>
            <CalendarIllustration className="w-16 shrink-0 md:w-24" />
          </div>
        ) : (
          <form onSubmit={handleCreateDay} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">날짜 추가</p>
              <button
                type="button"
                onClick={() => setShowCreateDayForm(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                접기 ▲
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              />
              <input
                value={newDayLabel}
                onChange={(e) => setNewDayLabel(e.target.value)}
                placeholder="라벨 (예: Day 1 - 도착)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDayForm(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createDayMutation.isPending || !newDayDate}
                  className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
                >
                  날짜 추가
                </button>
              </div>
            </div>
            {createDayError && <p className="text-sm text-red-600">{createDayError}</p>}
          </form>
        )}
      </div>

      {/* 데스크톱: 기존 위치(상단 고정 배너) 그대로. 모바일: 리스트 하단에서 드래그하다 실패한
          경우 상단 배너가 화면 밖이라 안 보이므로 하단 고정 배너로 표시(레이아웃만 다름, 상태/mutation은 공유). */}
      {moveItemError && isDesktop && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{moveItemError}</p>
      )}
      {moveItemError && !isDesktop && (
        <button
          type="button"
          onClick={() => setMoveItemError(null)}
          className="fixed inset-x-4 bottom-4 z-40 rounded-md bg-red-50 px-3 py-2 text-left text-sm text-red-600 shadow-lg ring-1 ring-red-200"
        >
          {moveItemError}
        </button>
      )}

      {days.length === 0 ? (
        <p className="text-slate-400">먼저 날짜를 추가해주세요.</p>
      ) : isDesktop ? (
        <DayEditorDesktop {...viewProps} />
      ) : (
        <DayEditorMobile {...viewProps} />
      )}

      {addModalDayId !== null && (
        <AddItemModal
          dayId={addModalDayId}
          existingItems={itemsByDayId[addModalDayId] ?? []}
          onClose={() => setAddModalDayId(null)}
        />
      )}
    </div>
    </APIProvider>
  )
}
