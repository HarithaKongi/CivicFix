'use client'

export function useCurrentLocation(onSuccess: (point: [number, number]) => void, onError: (message: string) => void) {
  return () => {
    if (!navigator.geolocation) return onError('Location is not available in this browser.')
    navigator.geolocation.getCurrentPosition(({ coords }) => onSuccess([coords.latitude, coords.longitude]), () => onError('Location permission was unavailable. Choose a point on the map instead.'))
  }
}

export function formatCoordinates(point?: [number, number]) {
  return point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'No location selected'
}
