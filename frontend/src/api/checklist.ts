import { apiClient } from './client'
import type { ChecklistItem } from '../types/models'

export interface ChecklistItemUpdateInput {
  text?: string
  is_checked?: boolean
}

export async function listChecklist(tripId: number): Promise<ChecklistItem[]> {
  const { data } = await apiClient.get<ChecklistItem[]>(`/api/trips/${tripId}/checklist`)
  return data
}

export async function createChecklistItem(tripId: number, text: string): Promise<ChecklistItem> {
  const { data } = await apiClient.post<ChecklistItem>(`/api/trips/${tripId}/checklist`, { text })
  return data
}

export async function updateChecklistItem(
  itemId: number,
  patch: ChecklistItemUpdateInput,
): Promise<ChecklistItem> {
  const { data } = await apiClient.patch<ChecklistItem>(`/api/checklist/${itemId}`, patch)
  return data
}

export async function deleteChecklistItem(itemId: number): Promise<void> {
  await apiClient.delete(`/api/checklist/${itemId}`)
}
