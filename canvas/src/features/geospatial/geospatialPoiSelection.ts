import type { GeospatialDataset } from '@/lib/geospatial/types'

export type PoiSelection =
  | {
      kind: 'graph-node'
      nodeId: string
      label: string
    }
  | {
      kind: 'dataset-feature'
      datasetId: string
      datasetLabel: string
      featureId: string
      featureLabel: string
      lngLat: { lng: number; lat: number } | null
      geometryType: string
    }

export type PoiMapFeature = {
  id?: string | number
  source?: string
  layer?: { id?: string }
  properties?: Record<string, unknown>
  geometry?: { type?: string; coordinates?: unknown }
}

const coerceLngLatFromCoordinates = (coords: unknown): { lng: number; lat: number } | null => {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = typeof coords[0] === 'number' ? coords[0] : Number(coords[0])
  const lat = typeof coords[1] === 'number' ? coords[1] : Number(coords[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { lng, lat }
}

export function getDatasetIdFromSourceId(args: { datasetSourcePrefix: string; sourceId: string }): string | null {
  const prefix = String(args.datasetSourcePrefix || '')
  const src = String(args.sourceId || '')
  if (!prefix || !src) return null
  if (!src.startsWith(prefix)) return null
  const rest = src.slice(prefix.length)
  if (!rest.startsWith(':')) return null
  const id = rest.slice(1)
  return id ? id : null
}

export function pickPoiSelection(args: {
  features: PoiMapFeature[]
  datasets: GeospatialDataset[]
  graphLayerIds: string[]
  datasetSourcePrefix: string
}): PoiSelection | null {
  const graphLayerIds = (args.graphLayerIds || []).map(String).filter(Boolean)
  for (const f of args.features || []) {
    const nodeId = String((f.properties as Record<string, unknown> | undefined)?.nodeId || '').trim()
    const layerId = String(f.layer?.id || '')
    if (nodeId && (graphLayerIds.length === 0 || graphLayerIds.includes(layerId))) {
      const label = String((f.properties as Record<string, unknown> | undefined)?.label || nodeId).trim() || nodeId
      return { kind: 'graph-node', nodeId, label }
    }
  }

  for (const f of args.features || []) {
    const sourceId = String(f.source || '')
    const datasetId = getDatasetIdFromSourceId({ datasetSourcePrefix: args.datasetSourcePrefix, sourceId })
    if (!datasetId) continue
    const dataset = (args.datasets || []).find(d => d.id === datasetId)
    const datasetLabel = dataset?.label || datasetId
    const featureId = String(f.id ?? (f.properties as Record<string, unknown> | undefined)?.id ?? '').trim() || 'feature:unknown'
    const featureLabel =
      String((f.properties as Record<string, unknown> | undefined)?.label ?? (f.properties as Record<string, unknown> | undefined)?.name ?? featureId).trim() ||
      featureId
    const geometryType = String(f.geometry?.type || '').trim() || 'unknown'
    const lngLat = geometryType === 'Point' ? coerceLngLatFromCoordinates(f.geometry?.coordinates) : null
    return {
      kind: 'dataset-feature',
      datasetId,
      datasetLabel,
      featureId,
      featureLabel,
      lngLat,
      geometryType,
    }
  }

  return null
}
