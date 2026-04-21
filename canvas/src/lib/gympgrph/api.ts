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
