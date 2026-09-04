import { apiClient } from './client'

export interface PlaceSearchResult {
  place_id: string
  name: string
  formatted_address: string
  lat: number
  lng: number
  types: string[]
}

export interface PlaceDetails extends Omit<PlaceSearchResult, 'types'> {
  phone: string | null
  website: string | null
  opening_hours: string[] | null
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const { data } = await apiClient.get<PlaceSearchResult[]>('/api/places/search', { params: { query } })
  return data
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const { data } = await apiClient.get<PlaceDetails>(`/api/places/${placeId}`)
  return data
}
