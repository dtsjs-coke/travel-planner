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
  /** 결제자 **슬롯 키**("participant_1"/"participant_2"). 이름 문자열을 보내면 422(ADR-0007). */
  paid_by?: string
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

export interface ItemUpdateInput {
  title?: string
  /** 명시적 `null`은 "지운다"는 뜻으로 서버가 200 처리한다(nullable 컬럼, ADR-0006). */
  cost_amount?: number | null
  cost_currency?: string | null
  /** 슬롯 키 또는 `null`(미지정으로 되돌리기). 이름 문자열은 422. */
  paid_by?: string | null
}

export async function updateItem(itemId: number, input: ItemUpdateInput): Promise<ItineraryItem> {
  const { data } = await apiClient.patch<ItineraryItem>(`/api/items/${itemId}`, input)
  return data
}

export async function reorderItems(dayId: number, orderedItemIds: number[]): Promise<ItineraryItem[]> {
  const { data } = await apiClient.post<ItineraryItem[]>(`/api/days/${dayId}/items/reorder`, {
    ordered_item_ids: orderedItemIds,
  })
  return data
}

/** 일정을 같은 여행의 다른 Day로 옮긴다. 목적지 Day 맨 뒤에 추가되며(ADR-0004),
 * 같은 Day로 "이동"하면 서버가 200으로 현재 상태를 그대로 돌려준다(멱등, no-op). */
export async function moveItem(itemId: number, targetDayId: number): Promise<ItineraryItem> {
  const { data } = await apiClient.post<ItineraryItem>(`/api/items/${itemId}/move`, {
    target_day_id: targetDayId,
  })
  return data
}
