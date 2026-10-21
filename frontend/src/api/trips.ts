import { apiClient } from './client'
import type { Trip, TripDetail, TripUpdateResult } from '../types/models'

export interface TripCreateInput {
  name: string
  destination?: string
  start_date?: string
  end_date?: string
  currency?: string
}

export interface TripUpdateInput {
  name?: string
  destination?: string | null
  start_date?: string | null
  end_date?: string | null
  currency?: string
  /** 팁/추천 메모(ADR-0015). 최대 5000자. `null`이나 빈 문자열(공백만 포함)은 "지움"으로 저장된다.
   * 서버가 양끝 공백을 다듬어 저장하므로 화면은 응답값으로 갱신할 것. */
  travel_tips?: string | null
}

export async function listTrips(): Promise<Trip[]> {
  const { data } = await apiClient.get<Trip[]>('/api/trips')
  return data
}

export async function getTrip(tripId: number): Promise<TripDetail> {
  const { data } = await apiClient.get<TripDetail>(`/api/trips/${tripId}`)
  return data
}

export async function createTrip(input: TripCreateInput): Promise<TripDetail> {
  const { data } = await apiClient.post<TripDetail>('/api/trips', input)
  return data
}

export async function updateTrip(tripId: number, input: TripUpdateInput): Promise<TripUpdateResult> {
  const { data } = await apiClient.patch<TripUpdateResult>(`/api/trips/${tripId}`, input)
  return data
}

export async function deleteTrip(tripId: number): Promise<void> {
  await apiClient.delete(`/api/trips/${tripId}`)
}
