import { GEOSPATIAL_MODE_CHANGED_EVENT } from './constants.js'

export type GeospatialViewMode = '2d-svg' | '2d' | '3d' | '3d-modern'

export type GeospatialModeChangedDetail = {
  enabled?: boolean
  viewMode?: GeospatialViewMode
}

export function emitGeospatialModeChanged(detail: GeospatialModeChangedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<GeospatialModeChangedDetail>(GEOSPATIAL_MODE_CHANGED_EVENT, { detail }))
}

export function onGeospatialModeChanged(handler: (detail: GeospatialModeChangedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (ev: Event) => {
    const e = ev as CustomEvent<GeospatialModeChangedDetail | undefined>
    if (!e.detail) return
    handler(e.detail)
  }
  window.addEventListener(GEOSPATIAL_MODE_CHANGED_EVENT, wrapped as EventListener)
  return () => window.removeEventListener(GEOSPATIAL_MODE_CHANGED_EVENT, wrapped as EventListener)
}
