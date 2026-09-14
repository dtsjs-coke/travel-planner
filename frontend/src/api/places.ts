import { apiClient } from './client'

export interface PlaceSearchResult {
  place_id: string
  name: string
  formatted_address: string
  lat: number
  lng: number
  types: string[]
  /** 사람이 읽는 분류 라벨("문화센터"). 검색 마스크에 추가 비용 없이 실려 온다(ADR-0011) —
   * 일정으로 등록할 때 `place_category`로 그대로 저장한다. */
  category: string | null
  /** 지역명("광주광역시 동구"). 등록 시 `region_name`으로 저장한다(ADR-0011). */
  region: string | null
}

export interface PlaceDetails extends Omit<PlaceSearchResult, 'types'> {
  phone: string | null
  website: string | null
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const { data } = await apiClient.get<PlaceSearchResult[]>('/api/places/search', { params: { query } })
  return data
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const { data } = await apiClient.get<PlaceDetails>(`/api/places/${placeId}`)
  return data
}
