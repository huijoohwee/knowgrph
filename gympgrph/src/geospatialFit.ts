import { useGympgrphStore } from './store'

export function requestGeospatialFitToSelection(): void {
  const store = useGympgrphStore.getState()
  store.requestGeospatialFitToSelection()
}

export function requestGeospatialFitToData(): void {
  const store = useGympgrphStore.getState()
  store.requestGeospatialFitToData()
}

export function requestGeospatialCurrentLocation(coords: { lat: number; lng: number; zoom?: number }): void {
  const store = useGympgrphStore.getState()
  store.requestGeospatialCurrentLocation(coords)
}
