import type { FeatureCollection } from 'geojson'

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function setGeoJsonSourceData(map: any, sourceId: string, fc: FeatureCollection): void {
  if (!map || !sourceId) return
  const src = map.getSource?.(sourceId)
  if (src && typeof src.setData === 'function') {
    src.setData(fc)
    return
  }
  if (!src && typeof map.addSource === 'function') {
    map.addSource(sourceId, { type: 'geojson', data: fc })
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
  const cluster = options?.cluster === true

  if (!map.getSource?.(sourceId)) {
    map.addSource?.(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster })
  }

  const addLayerOnce = (layer: any) => {
    if (map.getLayer?.(layer.id)) return
    map.addLayer?.(layer)
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
