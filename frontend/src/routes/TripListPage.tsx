import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { createTrip, listTrips } from '../api/trips'

export default function TripListPage() {
  const queryClient = useQueryClient()
  const { data: trips, isLoading } = useQuery({ queryKey: ['trips'], queryFn: listTrips })
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createTrip({ name, destination: destination || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setName('')
      setDestination('')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate()
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">여행 목록</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2 rounded-lg bg-white p-4 shadow sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="여행 이름 (예: 오사카 여행)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="목적지 (선택)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {isLoading && <p className="text-slate-500">불러오는 중...</p>}

      <ul className="flex flex-col gap-2">
        {trips?.map((trip) => (
          <li key={trip.id}>
            <Link
              to={`/trips/${trip.id}`}
              className="block rounded-lg bg-white p-4 shadow transition hover:bg-slate-50"
            >
              <p className="font-medium text-slate-800">{trip.name}</p>
              {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
            </Link>
          </li>
        ))}
        {trips && trips.length === 0 && !isLoading && (
          <p className="text-slate-400">등록된 여행이 없습니다. 위에서 새로 추가해보세요.</p>
        )}
      </ul>
    </div>
  )
}
