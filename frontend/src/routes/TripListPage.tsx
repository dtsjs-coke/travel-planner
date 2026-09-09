import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { createTrip, deleteTrip, listTrips, updateTrip, type TripUpdateInput } from '../api/trips'
import { extractErrorMessage } from '../lib/errors'
import OutOfRangeDaysModal from '../components/OutOfRangeDaysModal'
import TripChecklist from '../components/TripChecklist'
import type { OutOfRangeDay, Trip } from '../types/models'

export default function TripListPage() {
  const queryClient = useQueryClient()
  const { data: trips, isLoading } = useQuery({ queryKey: ['trips'], queryFn: listTrips })

  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingTripId, setEditingTripId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<{ tripId: number; message: string } | null>(null)
  const [infoMessage, setInfoMessage] = useState<{ tripId: number; message: string } | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createTrip({
        name,
        destination: destination || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setName('')
      setDestination('')
      setStartDate('')
      setEndDate('')
      setCreateError(null)
    },
    onError: (err) => {
      setCreateError(extractErrorMessage(err, '여행을 만들지 못했습니다. 입력값을 확인해주세요.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (tripId: number) => deleteTrip(tripId),
    onSuccess: (_data, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setDeleteError((prev) => (prev?.tripId === tripId ? null : prev))
    },
    onError: (err, tripId) => {
      setDeleteError({ tripId, message: extractErrorMessage(err, '여행을 삭제하지 못했습니다.') })
    },
  })

  // 날짜는 둘 다 입력하거나 둘 다 비워야 함(부분 입력 상태로는 제출 불가)
  const dateRangePartial = (!!startDate && !endDate) || (!startDate && !!endDate)
  const dateRangeInvalid = !!startDate && !!endDate && endDate < startDate
  const canSubmitCreate = name.trim().length > 0 && !dateRangePartial && !dateRangeInvalid

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmitCreate) return
    createMutation.mutate()
  }

  function handleDelete(trip: Trip) {
    if (!window.confirm(`"${trip.name}" 여행을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
    setDeleteError((prev) => (prev?.tripId === trip.id ? null : prev))
    deleteMutation.mutate(trip.id)
  }

  function handleStartEdit(tripId: number) {
    setInfoMessage((prev) => (prev?.tripId === tripId ? null : prev))
    setEditingTripId(tripId)
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">여행 목록</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2 rounded-lg bg-white p-4 shadow">
        <div className="flex flex-col gap-2 sm:flex-row">
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
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending || !canSubmitCreate}
            className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>

        <p className="text-xs text-slate-400">
          시작일/종료일을 입력하면 그 기간의 일정 날짜(Day)가 자동으로 생성됩니다. 둘 다 비워두면 날짜 없이 여행만
          만들어집니다.
        </p>
        {dateRangePartial && (
          <p className="text-xs text-amber-600">시작일과 종료일을 둘 다 입력하거나, 둘 다 비워주세요.</p>
        )}
        {dateRangeInvalid && <p className="text-xs text-red-600">종료일은 시작일보다 빠를 수 없습니다.</p>}
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </form>

      {isLoading && <p className="text-slate-500">불러오는 중...</p>}

      <ul className="flex flex-col gap-2">
        {trips?.map((trip) =>
          editingTripId === trip.id ? (
            <TripEditForm
              key={trip.id}
              trip={trip}
              onCancel={() => setEditingTripId(null)}
              onSaved={(message) => {
                setEditingTripId(null)
                setInfoMessage(message ? { tripId: trip.id, message } : null)
              }}
            />
          ) : (
            <li key={trip.id} className="rounded-lg bg-white p-4 shadow transition hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/trips/${trip.id}`} className="block min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{trip.name}</p>
                  {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
                  {trip.start_date && trip.end_date && (
                    <p className="text-xs text-slate-400">
                      {trip.start_date} ~ {trip.end_date}
                    </p>
                  )}
                </Link>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleStartEdit(trip.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(trip)}
                    disabled={deleteMutation.isPending}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {deleteError?.tripId === trip.id && (
                <p className="mt-2 text-sm text-red-600">{deleteError.message}</p>
              )}
              {infoMessage?.tripId === trip.id && (
                <p className="mt-2 text-sm text-emerald-600">{infoMessage.message}</p>
              )}
              <TripChecklist tripId={trip.id} />
            </li>
          ),
        )}
        {trips && trips.length === 0 && !isLoading && (
          <p className="text-slate-400">등록된 여행이 없습니다. 위에서 새로 추가해보세요.</p>
        )}
      </ul>
    </div>
  )
}

interface TripEditFormProps {
  trip: Trip
  onCancel: () => void
  /** 저장 완료 후 호출. 추가된 날짜가 있으면 안내 문구를 message로 함께 전달한다. */
  onSaved: (message?: string) => void
}

function TripEditForm({ trip, onCancel, onSaved }: TripEditFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination ?? '')
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [outOfRangeDays, setOutOfRangeDays] = useState<OutOfRangeDay[] | null>(null)
  const [pendingAddedCount, setPendingAddedCount] = useState(0)

  function finishSaving(addedCount: number) {
    onSaved(addedCount > 0 ? `${addedCount}일이 추가되었습니다.` : undefined)
  }

  const updateMutation = useMutation({
    mutationFn: (input: TripUpdateInput) => updateTrip(trip.id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      if (data.out_of_range_days.length > 0) {
        // 범위 밖 Day가 있으면 삭제 여부를 먼저 물어야 하므로, 폼을 닫지 않고 모달을 띈다.
        setPendingAddedCount(data.added_day_ids.length)
        setOutOfRangeDays(data.out_of_range_days)
      } else {
        finishSaving(data.added_day_ids.length)
      }
    },
    onError: (err) => {
      setError(extractErrorMessage(err, '여행 정보를 수정하지 못했습니다.'))
    },
  })

  const dateRangePartial = (!!startDate && !endDate) || (!startDate && !!endDate)
  const dateRangeInvalid = !!startDate && !!endDate && endDate < startDate
  const canSubmit = name.trim().length > 0 && !dateRangePartial && !dateRangeInvalid

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    updateMutation.mutate({
      name,
      destination: destination.trim() ? destination : null,
      start_date: startDate || null,
      end_date: endDate || null,
    })
  }

  return (
    <li className="rounded-lg border border-slate-300 bg-white p-4 shadow">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="여행 이름"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="목적지 (선택)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
        </div>

        <p className="text-xs text-slate-400">
          기간을 늘리면 부족한 날짜(Day)가 자동으로 추가됩니다. 범위 밖으로 밀려난 날짜는 바로 지워지지 않고,
          저장 후 삭제할지 확인할 수 있습니다.
        </p>
        {dateRangePartial && (
          <p className="text-xs text-amber-600">시작일과 종료일을 둘 다 입력하거나, 둘 다 비워주세요.</p>
        )}
        {dateRangeInvalid && <p className="text-xs text-red-600">종료일은 시작일보다 빠를 수 없습니다.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending || !canSubmit}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </form>

      {outOfRangeDays && (
        <OutOfRangeDaysModal
          days={outOfRangeDays}
          onKeep={() => {
            setOutOfRangeDays(null)
            finishSaving(pendingAddedCount)
          }}
          onAllDeleted={() => {
            setOutOfRangeDays(null)
            finishSaving(pendingAddedCount)
          }}
        />
      )}
    </li>
  )
}
