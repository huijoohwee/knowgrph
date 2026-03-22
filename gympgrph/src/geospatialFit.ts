import { useGympgrphStore } from './store'

export function requestGeospatialFitToSelection(): void {
  const store = useGympgrphStore.getState()
  store.requestGeospatialFitToSelection()
}

export function requestGeospatialFitToData(): void {
  const store = useGympgrphStore.getState()
  store.requestGeospatialFitToData()
}
