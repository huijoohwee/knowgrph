import { useGympgrphStore } from './store.js'

export function setGeospatialModeEnabled(enabled: boolean): void {
  const s = useGympgrphStore.getState()
  if (enabled) {
    s.setGeospatialInteractionMode('always')
  }
  s.setGeospatialModeEnabled(enabled)
}
