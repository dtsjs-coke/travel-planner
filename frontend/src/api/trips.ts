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
