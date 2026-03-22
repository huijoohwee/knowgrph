import React from 'react'
import { hashStringToIndex } from 'grph-shared/hash/stringHash'
import { LS_KEYS } from './lib/config'
import { applyMediaProxySrc, coerceFetchUrl, MEDIA_PROXY_ENDPOINT } from './lib/url'
import { parseGeoJsonFromText, coerceGeoJsonToFeatureCollection } from './geojson'
import { addGeospatialDatasetUrl, loadDatasetFeatureCollection } from './datasets'
import { useGympgrphStore } from './store'
import { computeBoundsFromCollections } from './geo'
import { ensureDatasetLayer, setGeoJsonSourceData } from './maplibreLayers'
import { coerceFeatureCollectionIds, isPointOnlyFeatureCollection, pickPoiSelection } from './selection'
import { colorForDataset } from './colors'
import { useMapLibreBasemap } from './features/geospatial/useMapLibreBasemap'
import { GeospatialOverlayHost as GeospatialOverlayHostComponent } from './GeospatialHost'
import { GeospatialPanelHost } from './GeospatialPanelHost'
import { requestGeospatialFitToData, requestGeospatialFitToSelection } from './geospatialFit'
import { setGeospatialModeEnabled as setGeospatialModeEnabledViaHostBridge } from './hostBridge'

export { LS_KEYS }
export { useGympgrphStore }
export { hashStringToIndex }

export { applyMediaProxySrc, coerceFetchUrl, MEDIA_PROXY_ENDPOINT }

export { parseGeoJsonFromText, coerceGeoJsonToFeatureCollection }
export { addGeospatialDatasetUrl, loadDatasetFeatureCollection }

export { computeBoundsFromCollections }
export { ensureDatasetLayer, setGeoJsonSourceData }
export { coerceFeatureCollectionIds, isPointOnlyFeatureCollection, pickPoiSelection }
export { colorForDataset }
export { useMapLibreBasemap }

export const GeospatialOverlayHostLazy = React.lazy(async () => ({
  default: GeospatialOverlayHostComponent,
}))

export const GeospatialOverlayHost = GeospatialOverlayHostComponent

export { GeospatialPanelHost }

export function isGeospatialModeEnabled(): boolean {
  return useGympgrphStore.getState().geospatialModeEnabled
}

export function toggleGeospatialModeEnabled(): void {
  const enabled = isGeospatialModeEnabled()
  setGeospatialModeEnabled(!enabled)
}

export function setGeospatialModeEnabled(enabled: boolean): void {
  setGeospatialModeEnabledViaHostBridge(enabled)
}

export function setGeospatialAutoFitEnabled(enabled: boolean): void {
  useGympgrphStore.getState().setGeospatialAutoFitEnabled(enabled)
}

export function requestGeospatialTraversalRun(_args?: { edgeIds?: string[] | null }): void {
  void 0
}

export { requestGeospatialFitToData, requestGeospatialFitToSelection }
