import { pickPoiSelection } from '../../../../gympgrph/src/features/geospatial/geospatialPoiSelection'
import { coerceFeatureCollectionIds, isPointOnlyFeatureCollection } from '../../../../gympgrph/src/features/geospatial/geospatialOverlayUtils'

export const testGympgrphPickPoiSelectionSkipsClusterFeatures = () => {
  const picked = pickPoiSelection({
    features: [
      {
        source: 'kg-geo-ds:layer-01',
        id: 1,
        properties: { cluster: true, cluster_id: 7, point_count: 10, point_count_abbreviated: '10' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
      {
        source: 'kg-geo-ds:layer-01',
        id: 'feature-2',
        properties: { label: 'Airport A' },
        geometry: { type: 'Point', coordinates: [1, 2] },
      },
    ],
    datasets: [
      {
        id: 'layer-01',
        label: 'Airports',
        enabled: true,
        source: { kind: 'url', url: 'https://example.invalid/airports.json' },
        format: 'auto',
      },
    ],
    graphLayerIds: [],
    datasetSourcePrefix: 'kg-geo-ds',
  })
  if (!picked || picked.kind !== 'dataset-feature') throw new Error('expected dataset feature pick')
  if (picked.featureLabel !== 'Airport A') throw new Error('expected unclustered feature to be chosen')
}

export const testGympgrphCoerceFeatureCollectionIdsAddsMissingIds = () => {
  const raw = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { label: 'A' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: 'keep', properties: { label: 'B' }, geometry: { type: 'Point', coordinates: [1, 1] } },
    ],
  } as any

  const out = coerceFeatureCollectionIds(raw, 'layer-01') as any
  if (!out.features[0].id) throw new Error('expected first feature id to be set')
  if (out.features[1].id !== 'keep') throw new Error('expected existing id to be preserved')
}

export const testGympgrphIsPointOnlyFeatureCollectionDetectsPointOnly = () => {
  const fc = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 1, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: 2, properties: {}, geometry: { type: 'MultiPoint', coordinates: [[0, 0]] } },
    ],
  } as any
  if (!isPointOnlyFeatureCollection(fc, 10)) throw new Error('expected point-only collection to be true')
}

export const testGympgrphIsPointOnlyFeatureCollectionRejectsPolygon = () => {
  const fc = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 1, properties: {}, geometry: { type: 'Polygon', coordinates: [] } }],
  } as any
  if (isPointOnlyFeatureCollection(fc, 10)) throw new Error('expected polygon collection to be false')
}

