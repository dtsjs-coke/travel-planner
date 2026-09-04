import { apiClient } from './client'
import type { Day } from '../types/models'

export interface DayCreateInput {
  date: string
  label?: string
}

export async function createDay(tripId: number, input: DayCreateInput): Promise<Day> {
  const { data } = await apiClient.post<Day>(`/api/trips/${tripId}/days`, input)
  return data
}

export async function deleteDay(dayId: number): Promise<void> {
  await apiClient.delete(`/api/days/${dayId}`)
}
