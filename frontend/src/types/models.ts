export interface Trip {
  id: number
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface TripDetail extends Trip {
  days: Day[]
}

export interface Day {
  id: number
  trip_id: number
  date: string
  label: string | null
  sort_order: number
}

export type ItemSource = 'google_places' | 'manual'

export interface ItineraryItem {
  id: number
  day_id: number
  position: number
  title: string
  category: string | null
  source: ItemSource
  place_id: string | null
  address: string | null
  lat: number | null
  lng: number | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  cost_currency: string | null
  url: string | null
}
