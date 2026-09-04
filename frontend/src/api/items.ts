import { apiClient } from './client'
import type { ItineraryItem, ItemSource } from '../types/models'

export interface ItemCreateInput {
  source: ItemSource
  title: string
  category?: string
  place_id?: string
  address?: string
  lat?: number
  lng?: number
  start_time?: string
  end_time?: string
  notes?: string
  cost_amount?: number
  cost_currency?: string
  url?: string
}

export async function listItems(dayId: number): Promise<ItineraryItem[]> {
  const { data } = await apiClient.get<ItineraryItem[]>(`/api/days/${dayId}/items`)
  return data
}

export async function createItem(dayId: number, input: ItemCreateInput): Promise<ItineraryItem> {
  const { data } = await apiClient.post<ItineraryItem>(`/api/days/${dayId}/items`, input)
  return data
}

export async function deleteItem(itemId: number): Promise<void> {
  await apiClient.delete(`/api/items/${itemId}`)
}

export async function reorderItems(dayId: number, orderedItemIds: number[]): Promise<ItineraryItem[]> {
  const { data } = await apiClient.post<ItineraryItem[]>(`/api/days/${dayId}/items/reorder`, {
    ordered_item_ids: orderedItemIds,
  })
  return data
}
