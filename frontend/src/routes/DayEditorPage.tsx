import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { getTrip } from '../api/trips'
import { createDay } from '../api/days'
import { deleteItem, reorderItems, updateItem } from '../api/items'
import { extractErrorMessage } from '../lib/errors'
import AddItemModal from '../components/AddItemModal'
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
  const { itemsByDayId, isLoading: itemsLoading } = useTripItems(days)

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

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, title }: { dayId: number; itemId: number; title: string }) => updateItem(itemId, { title }),
    onSuccess: (_data, { dayId }) => queryClient.invalidateQueries({ queryKey: ['days', dayId, 'items'] }),
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
    onAddItem: (dayId: number) => setAddModalDayId(dayId),
    onDeleteItem: (dayId: number, itemId: number) => deleteItemMutation.mutate({ dayId, itemId }),
    onUpdateItemTitle: (dayId: number, itemId: number, title: string) =>
      updateItemMutation.mutate({ dayId, itemId, title }),
    onReorderItems: (dayId: number, orderedItemIds: number[]) =>
      reorderMutation.mutate({ dayId, orderedItemIds }),
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_BROWSER_KEY}>
    <div className="mx-auto min-h-screen max-w-5xl p-6">
      <Link to="/trips" className="text-sm text-slate-500 hover:underline">
        &larr; 여행 목록
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold text-slate-800">{trip.name}</h1>

      <form onSubmit={handleCreateDay} className="mb-6 flex flex-col gap-2 rounded-lg bg-white p-4 shadow sm:flex-row">
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
        <button
          type="submit"
          disabled={createDayMutation.isPending || !newDayDate}
          className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          날짜 추가
        </button>
        {createDayError && <p className="text-sm text-red-600 sm:w-full">{createDayError}</p>}
      </form>

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
