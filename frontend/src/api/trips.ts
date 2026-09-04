import { apiClient } from './client'
import type { Trip, TripDetail } from '../types/models'

export interface TripCreateInput {
  name: string
  destination?: string
  start_date?: string
  end_date?: string
  currency?: string
}

export async function listTrips(): Promise<Trip[]> {
  const { data } = await apiClient.get<Trip[]>('/api/trips')
  return data
}

export async function getTrip(tripId: number): Promise<TripDetail> {
  const { data } = await apiClient.get<TripDetail>(`/api/trips/${tripId}`)
  return data
}

export async function createTrip(input: TripCreateInput): Promise<Trip> {
  const { data } = await apiClient.post<Trip>('/api/trips', input)
  return data
}

export async function deleteTrip(tripId: number): Promise<void> {
  await apiClient.delete(`/api/trips/${tripId}`)
}
