import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItem, type ItemCreateInput } from '../api/items'
import { searchPlaces, type PlaceSearchResult } from '../api/places'
import MapView from './MapView'
import type { ItineraryItem } from '../types/models'

interface Props {
  dayId: number
  existingItems: ItineraryItem[]
  onClose: () => void
}

type Tab = 'google' | 'manual'

export default function AddItemModal({ dayId, existingItems, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('google')
  const queryClient = useQueryClient()
  const itemsQueryKey = ['days', dayId, 'items']

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const [manualTitle, setManualTitle] = useState('')

  const addMutation = useMutation({
    mutationFn: (input: ItemCreateInput) => createItem(dayId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQueryKey })
    },
  })

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError(false)
    try {
      const data = await searchPlaces(query)
      setResults(data)
    } catch {
      setSearchError(true)
    } finally {
      setSearching(false)
    }
  }

  function handleAddFromGoogle(place: PlaceSearchResult) {
    addMutation.mutate({
      source: 'google_places',
      title: place.name,
      address: place.formatted_address,
      lat: place.lat,
      lng: place.lng,
      place_id: place.place_id,
    })
  }

  function handleAddManual(e: FormEvent) {
    e.preventDefault()
    if (!manualTitle.trim()) return
    addMutation.mutate({ source: 'manual', title: manualTitle })
    setManualTitle('')
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">일정 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab('google')}
            className={`px-3 py-2 text-sm ${tab === 'google' ? 'border-b-2 border-slate-800 font-medium text-slate-800' : 'text-slate-500'}`}
          >
            구글 검색
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`px-3 py-2 text-sm ${tab === 'manual' ? 'border-b-2 border-slate-800 font-medium text-slate-800' : 'text-slate-500'}`}
          >
            직접 입력
          </button>
        </div>

        {tab === 'google' ? (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto md:flex-row md:overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden md:w-1/2">
              <form onSubmit={handleSearch} className="mb-3 flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="장소 검색 (예: 오사카성)"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
                >
                  검색
                </button>
              </form>

              {searching && <p className="text-slate-500">검색 중...</p>}
              {searchError && <p className="text-red-600">검색 실패. 잠시 후 다시 시도해주세요.</p>}

              <ul className="flex-1 overflow-y-auto">
                {results.map((place) => (
                  <li
                    key={place.place_id}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{place.name}</p>
                      <p className="truncate text-xs text-slate-500">{place.formatted_address}</p>
                    </div>
                    <button
                      onClick={() => handleAddFromGoogle(place)}
                      disabled={addMutation.isPending}
                      className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      추가
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex-1 md:w-1/2">
              <MapView
                items={existingItems}
                searchResults={results}
                onSelectSearchResult={handleAddFromGoogle}
                height="280px"
              />
              <p className="mt-1 text-xs text-slate-400">
                검정 번호 핀: 이미 등록된 일정 · 초록 핀: 검색 결과 (클릭하면 바로 추가됩니다)
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddManual} className="flex gap-2">
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="일정 이름 (예: 호텔 체크인)"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={addMutation.isPending || !manualTitle.trim()}
              className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
            >
              추가
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
