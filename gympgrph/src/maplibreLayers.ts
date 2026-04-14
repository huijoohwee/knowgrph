import type { FeatureCollection } from 'geojson'

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

const isStyleReady = (map: any): boolean => {
  if (!map) return false
  try {
    if (typeof map.isStyleLoaded === 'function') return map.isStyleLoaded() === true
  } catch {
    return false
  }
  return false
}

export function setGeoJsonSourceData(map: any, sourceId: string, fc: FeatureCollection): void {
  if (!map || !sourceId) return
  if (!isStyleReady(map)) return
  const src = map.getSource?.(sourceId)
  if (src && typeof src.setData === 'function') {
    src.setData(fc)
    return
  }
  if (!src && typeof map.addSource === 'function') {
    try {
      map.addSource(sourceId, { type: 'geojson', data: fc })
    } catch {
      void 0
    }
    return
  }
}

export function clearGeoJsonSourceData(map: any, sourceId: string): void {
  if (!map || !sourceId) return
  setGeoJsonSourceData(map, sourceId, EMPTY_FEATURE_COLLECTION)
}

export function ensureDatasetLayer(
  map: any,
  sourceId: string,
  color: string,
  options?: {
    cluster?: boolean
  },
): void {
  if (!map || !sourceId) return
  if (!isStyleReady(map)) return
  const cluster = options?.cluster === true

  if (!map.getSource?.(sourceId)) {
    try {
      map.addSource?.(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster })
    } catch {
      void 0
    }
  }

  const addLayerOnce = (layer: any) => {
    if (map.getLayer?.(layer.id)) return
    try {
      map.addLayer?.(layer)
    } catch {
      void 0
    }
  }

  if (cluster) {
    addLayerOnce({
      id: `${sourceId}:cluster-count`,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 12,
      },
      paint: { 'text-color': '#FFFFFF' },
    })
  }

  addLayerOnce({
    id: `${sourceId}:points`,
    type: 'circle',
    source: sourceId,
    paint: { 'circle-color': color, 'circle-radius': 4, 'circle-opacity': 0.9 },
  })
}
