import { pickPoiSelection, coerceFeatureCollectionIds, isPointOnlyFeatureCollection } from 'gympgrph/testkit'
import { ensureDatasetLayer } from '@/lib/gympgrph/api'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

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
  const raw: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { label: 'A' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: 'keep', properties: { label: 'B' }, geometry: { type: 'Point', coordinates: [1, 1] } },
    ],
  }

  const out = coerceFeatureCollectionIds(raw, 'layer-01')
  if (!out.features[0]?.id) throw new Error('expected first feature id to be set')
  if (out.features[1]?.id !== 'keep') throw new Error('expected existing id to be preserved')
}

export const testGympgrphIsPointOnlyFeatureCollectionDetectsPointOnly = () => {
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 1, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: 2, properties: {}, geometry: { type: 'MultiPoint', coordinates: [[0, 0]] } },
    ],
  }
  if (!isPointOnlyFeatureCollection(fc, 10)) throw new Error('expected point-only collection to be true')
}

export const testGympgrphIsPointOnlyFeatureCollectionRejectsPolygon = () => {
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 1, properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] } }],
  }
  if (isPointOnlyFeatureCollection(fc, 10)) throw new Error('expected polygon collection to be false')
}

export const testGympgrphEnsureDatasetLayerClusterCountUsesNotoSans = () => {
  type LayerStub = { id: string; layout?: Record<string, unknown> } & Record<string, unknown>
  type SourceStub = Record<string, unknown>
  type MapStub = {
    loaded: () => boolean
    getLayer: (id: string) => LayerStub | null
    addLayer: (layer: LayerStub) => void
    removeLayer: (id: string) => void
    getSource: (id: string) => SourceStub | null
    addSource: (id: string, src: SourceStub) => void
    removeSource: (id: string) => void
  }

  const layersById = new Map<string, LayerStub>()
  const sourcesById = new Map<string, SourceStub>()

  const map: MapStub = {
    loaded: () => true,
    getLayer: (id: string) => layersById.get(id) || null,
    addLayer: (layer: LayerStub) => {
      layersById.set(layer.id, layer)
    },
    removeLayer: (id: string) => {
      layersById.delete(id)
    },
    getSource: (id: string) => sourcesById.get(id) || null,
    addSource: (id: string, src: SourceStub) => {
      sourcesById.set(id, src)
    },
    removeSource: (id: string) => {
      sourcesById.delete(id)
    },
  }

  ensureDatasetLayer(map as unknown as MapLibreMap, 'kg-ds:test', '#2563EB', { cluster: true })

  const clusterCount = layersById.get('kg-ds:test:cluster-count')
  if (!clusterCount) throw new Error('expected cluster-count symbol layer to be created')

  const tf = clusterCount.layout ? clusterCount.layout['text-font'] : null
  const ok = Array.isArray(tf) && tf.some((v: unknown) => String(v) === 'Noto Sans Regular')
  if (!ok) {
    throw new Error(`expected cluster-count text-font to include Noto Sans Regular. got=${JSON.stringify(tf)}`)
  }
}
