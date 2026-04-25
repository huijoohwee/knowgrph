export { LS_KEYS } from '../../../../gympgrph/src/lib/config'
export { useGympgrphStore } from '../../../../gympgrph/src/store'
export { addGeospatialDatasetUrl, loadDatasetFeatureCollection } from '../../../../gympgrph/src/datasets'
export { parseGeoJsonFromText, coerceGeoJsonToFeatureCollection } from '../../../../gympgrph/src/geojson'
export { ensureDatasetLayer } from '../../../../gympgrph/src/maplibreLayers'
export { setGeospatialModeEnabled } from '../../../../gympgrph/src/hostBridge'
export { hashStringToIndex } from 'grph-shared/hash/stringHash'

import { useGympgrphStore } from '../../../../gympgrph/src/store'

export function isGeospatialModeEnabled(): boolean {
  return Boolean(useGympgrphStore.getState().geospatialModeEnabled)
}

export function readGeospatialCursorLngLat(): { lng: number; lat: number } | null {
  const state = useGympgrphStore.getState() as { geospatialCursorLngLat?: unknown }
  const raw = state.geospatialCursorLngLat
  if (!raw || typeof raw !== 'object') return null
  const next = raw as { lng?: unknown; lat?: unknown }
  const lng = Number(next.lng)
  const lat = Number(next.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { lng, lat }
}
