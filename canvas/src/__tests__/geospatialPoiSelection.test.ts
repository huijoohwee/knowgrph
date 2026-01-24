import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GeospatialDataset } from '@/lib/geospatial/types'
import { pickPoiSelection } from '@/features/geospatial/geospatialPoiSelection'

type RegistryItem = {
  id: string
  label: string
  url: string
  format: 'auto' | 'geojson' | 'records'
  fixturePath: string
}

const readRegistry = (): RegistryItem[] => {
  const path = resolve(process.cwd(), 'src/__tests__/demo/geospatial-datasets.layers.json')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('geospatial dataset registry is not an array')
  return raw as RegistryItem[]
}

const registryToDatasets = (items: RegistryItem[]): GeospatialDataset[] =>
  items
    .filter(i => i && typeof i.id === 'string' && typeof i.url === 'string')
    .map(i => ({
      id: i.id,
      label: i.label,
      enabled: true,
      source: { kind: 'url', url: i.url },
      format: i.format,
    }))

export async function testGeospatialPoiPickGraphNode() {
  const datasets = registryToDatasets(readRegistry())
  const res = pickPoiSelection({
    features: [
      {
        id: '00AK',
        source: 'kg-geo-ds:layer-01',
        layer: { id: 'kg-geo-ds:layer-01:points' },
        properties: { label: 'Lowell Field' },
        geometry: { type: 'Point', coordinates: [-151.695999146, 59.94919968] },
      },
      {
        id: 'node-123',
        source: 'kg-geo-graph-nodes',
        layer: { id: 'kg-geo-graph-nodes-layer' },
        properties: { nodeId: 'node-123', label: 'Selected Node' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
    datasets,
    graphLayerIds: ['kg-geo-graph-nodes-layer'],
    datasetSourcePrefix: 'kg-geo-ds',
  })

  if (!res) throw new Error('Expected selection result')
  if (res.kind !== 'graph-node') throw new Error(`Expected graph-node, got ${res.kind}`)
  if (res.nodeId !== 'node-123') throw new Error('Expected nodeId to be node-123')
}

export async function testGeospatialPoiPickDatasetFeature() {
  const datasets = registryToDatasets(readRegistry())
  const airportsPath = resolve(process.cwd(), 'src/__tests__/demo/airports.sample.json')
  const airportsRaw = JSON.parse(readFileSync(airportsPath, 'utf8')) as Record<string, unknown>
  const airportEntries = Object.entries(airportsRaw)
  if (airportEntries.length === 0) throw new Error('Expected airport fixture entries')
  const [airportId, airportRecRaw] = airportEntries[0] as [string, unknown]
  const airportRec = airportRecRaw as Record<string, unknown>
  const lng = Number(airportRec.lon)
  const lat = Number(airportRec.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('Expected airport fixture to include lat/lon')

  const res = pickPoiSelection({
    features: [
      {
        id: airportId,
        source: 'kg-geo-ds:layer-01',
        layer: { id: 'kg-geo-ds:layer-01:points' },
        properties: { ...airportRec },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      },
    ],
    datasets,
    graphLayerIds: ['kg-geo-graph-nodes-layer'],
    datasetSourcePrefix: 'kg-geo-ds',
  })

  if (!res) throw new Error('Expected selection result')
  if (res.kind !== 'dataset-feature') throw new Error(`Expected dataset-feature, got ${res.kind}`)
  if (res.datasetId !== 'layer-01') throw new Error('Expected datasetId layer-01')
  if (!res.datasetLabel) throw new Error('Expected datasetLabel')
  if (!res.lngLat) throw new Error('Expected lngLat')
  if (Math.abs(res.lngLat.lng - lng) > 1e-9) throw new Error('Lng mismatch')
  if (Math.abs(res.lngLat.lat - lat) > 1e-9) throw new Error('Lat mismatch')
}
