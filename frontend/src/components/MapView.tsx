import { useEffect } from 'react'
import { AdvancedMarker, Map, Pin, Polyline, useMap } from '@vis.gl/react-google-maps'
import type { ItineraryItem } from '../types/models'
import type { PlaceSearchResult } from '../api/places'

interface LatLng {
  lat: number
  lng: number
}

interface Props {
  items: ItineraryItem[]
  searchResults?: PlaceSearchResult[]
  onSelectSearchResult?: (place: PlaceSearchResult) => void
  height?: string
  mapId?: string
}

const DEFAULT_CENTER: LatLng = { lat: 37.5665, lng: 126.978 } // Seoul fallback when nothing to show yet

function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return
    if (points.length === 1) {
      map.setCenter(points[0])
      map.setZoom(15)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, 48)
  }, [map, JSON.stringify(points)])

  return null
}

const DEFAULT_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

export default function MapView({ items, searchResults = [], onSelectSearchResult, height = '300px', mapId = DEFAULT_MAP_ID }: Props) {
  const itemPoints: LatLng[] = items
    .filter((item): item is ItineraryItem & { lat: number; lng: number } => item.lat != null && item.lng != null)
    .map((item) => ({ lat: item.lat, lng: item.lng }))

  const searchPoints: LatLng[] = searchResults.map((place) => ({ lat: place.lat, lng: place.lng }))
  const allPoints = [...itemPoints, ...searchPoints]

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-slate-200">
      <Map
        mapId={mapId}
        defaultCenter={allPoints[0] ?? DEFAULT_CENTER}
        defaultZoom={allPoints.length ? 13 : 4}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitToPoints points={allPoints} />

        {items.map((item, index) =>
          item.lat != null && item.lng != null ? (
            <AdvancedMarker key={`item-${item.id}`} position={{ lat: item.lat, lng: item.lng }} title={item.title}>
              <Pin background="#1e293b" borderColor="#0f172a" glyphColor="#ffffff" glyphText={String(index + 1)} />
            </AdvancedMarker>
          ) : null,
        )}

        {searchResults.map((place) => (
          <AdvancedMarker
            key={`search-${place.place_id}`}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
            onClick={() => onSelectSearchResult?.(place)}
          >
            <Pin background="#22c55e" borderColor="#15803d" glyphColor="#ffffff" />
          </AdvancedMarker>
        ))}

        {itemPoints.length > 1 && (
          <Polyline path={itemPoints} strokeColor="#1e293b" strokeOpacity={0.7} strokeWeight={3} />
        )}
      </Map>
    </div>
  )
}
