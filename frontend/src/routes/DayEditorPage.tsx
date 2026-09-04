import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { getTrip } from '../api/trips'
import { createDay } from '../api/days'
import { deleteItem, listItems, reorderItems } from '../api/items'
import ItineraryList from '../components/ItineraryList'
import AddItemModal from '../components/AddItemModal'
import MapView from '../components/MapView'
import type { ItineraryItem } from '../types/models'

const GOOGLE_MAPS_BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? ''

export default function DayEditorPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const tripIdNum = Number(tripId)
  const queryClient = useQueryClient()

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trips', tripIdNum],
    queryFn: () => getTrip(tripIdNum),
    enabled: Number.isFinite(tripIdNum),
  })

  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const activeDayId = selectedDayId ?? trip?.days[0]?.id ?? null

  const [newDayDate, setNewDayDate] = useState('')
  const [newDayLabel, setNewDayLabel] = useState('')

  const createDayMutation = useMutation({
    mutationFn: () => createDay(tripIdNum, { date: newDayDate, label: newDayLabel || undefined }),
    onSuccess: (day) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripIdNum] })
      setSelectedDayId(day.id)
      setNewDayDate('')
      setNewDayLabel('')
    },
  })

  function handleCreateDay(e: FormEvent) {
    e.preventDefault()
    if (!newDayDate) return
    createDayMutation.mutate()
  }

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['days', activeDayId, 'items'],
    queryFn: () => listItems(activeDayId as number),
    enabled: activeDayId !== null,
  })

  const [showAddModal, setShowAddModal] = useState(false)

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => deleteItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['days', activeDayId, 'items'] }),
  })

  const itemsQueryKey = ['days', activeDayId, 'items']

  const reorderMutation = useMutation({
    mutationFn: (orderedItemIds: number[]) => reorderItems(activeDayId as number, orderedItemIds),
    onMutate: async (orderedItemIds) => {
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
    onError: (_err, _vars, context) => {
      if (context?.previousItems) queryClient.setQueryData(itemsQueryKey, context.previousItems)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemsQueryKey }),
  })

  if (tripLoading) return <p className="p-6 text-slate-500">불러오는 중...</p>
  if (!trip) return <p className="p-6 text-red-600">여행을 찾을 수 없습니다.</p>

  return (
    <APIProvider apiKey={GOOGLE_MAPS_BROWSER_KEY}>
    <div className="mx-auto min-h-screen max-w-5xl p-6">
      <Link to="/trips" className="text-sm text-slate-500 hover:underline">
        &larr; 여행 목록
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold text-slate-800">{trip.name}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {trip.days.map((day) => (
          <button
            key={day.id}
            onClick={() => setSelectedDayId(day.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeDayId === day.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow'
            }`}
          >
            {day.label || day.date}
          </button>
        ))}
      </div>

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
      </form>

      {activeDayId === null ? (
        <p className="text-slate-400">먼저 날짜를 추가해주세요.</p>
      ) : (
        <>
          <button
            onClick={() => setShowAddModal(true)}
            className="mb-4 rounded-md bg-slate-800 px-4 py-2 text-white"
          >
            + 일정 추가
          </button>

          {itemsLoading && <p className="text-slate-500">불러오는 중...</p>}

          <div className="grid gap-4 md:grid-cols-2">
            {items && (
              <ItineraryList
                items={items}
                onDelete={(itemId) => deleteItemMutation.mutate(itemId)}
                onReorder={(orderedItemIds) => reorderMutation.mutate(orderedItemIds)}
              />
            )}
            <div className="md:sticky md:top-6 md:self-start">
              <MapView items={items ?? []} height="400px" />
            </div>
          </div>

          {showAddModal && (
            <AddItemModal
              dayId={activeDayId}
              existingItems={items ?? []}
              onClose={() => setShowAddModal(false)}
            />
          )}
        </>
      )}
    </div>
    </APIProvider>
  )
}
