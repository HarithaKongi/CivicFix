'use client'

import { useEffect, useRef } from 'react'
import { MapContainer as LeafletMapContainer, Marker as LeafletMarker, TileLayer as LeafletTileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const icon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] })
const DEFAULT: [number, number] = [37.7749, -122.4194]

function SelectLocation({ onSelect }: { onSelect: (point: [number, number]) => void }) {
  useMapEvents({ click: (event) => onSelect([event.latlng.lat, event.latlng.lng]) })
  return null
}

export function LocationMap({ value, onChange, className = 'h-52' }: { value?: [number, number]; onChange?: (point: [number, number]) => void; className?: string }) {
  const mapRef = useRef<L.Map | null>(null)
  const point = value ?? DEFAULT
  useEffect(() => { if (value && mapRef.current) mapRef.current.setView(value) }, [value])
  return <LeafletMapContainer center={point} zoom={value ? 16 : 12} scrollWheelZoom className={`z-0 w-full overflow-hidden rounded-xl ${className}`} ref={(map) => { mapRef.current = map }}>
    <LeafletTileLayer attribution='&copy; OpenStreetMap contributors' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
    <SelectLocation onSelect={(next) => onChange?.(next)} />
    {value && <LeafletMarker position={value} icon={icon} />}
  </LeafletMapContainer>
}

export function useCurrentLocation(onSuccess: (point: [number, number]) => void, onError: (message: string) => void) {
  return () => { if (!navigator.geolocation) return onError('Location is not available in this browser.'); navigator.geolocation.getCurrentPosition(({ coords }) => onSuccess([coords.latitude, coords.longitude]), () => onError('Location permission was unavailable. Choose a point on the map instead.')) }
}

export function formatCoordinates(point?: [number, number]) { return point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'No location selected' }

export { DEFAULT as DEFAULT_LOCATION }
export default LocationMap

