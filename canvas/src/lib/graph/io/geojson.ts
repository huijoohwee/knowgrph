import type { GraphData, JSONValue } from '@/lib/graph/types'
import { isPlainObject } from '@/lib/graph/value'

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id?: string
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: Record<string, JSONValue>
  }>
}

const toFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN
  return Number.isFinite(n) ? n : null
}

const readGeoPoint = (properties: Record<string, JSONValue>): { lat: number; lng: number } | null => {
  const geoRaw = properties.geo
  if (!isPlainObject(geoRaw)) return null
  const geo = geoRaw as Record<string, unknown>
  const lat = toFiniteNumber(geo.lat)
  const lng = toFiniteNumber(geo.lng)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

export const graphToGeoJsonFeatureCollection = (data: GraphData): GeoJsonFeatureCollection => {
  const features: GeoJsonFeatureCollection['features'] = []
  for (const node of data.nodes || []) {
    const props = (node.properties || {}) as Record<string, JSONValue>
    const p = readGeoPoint(props)
    if (!p) continue
    const properties: Record<string, JSONValue> = {
      id: node.id,
      label: node.label,
      type: node.type,
      ...props,
    }
    features.push({
      type: 'Feature',
      id: node.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties,
    })
  }
  return { type: 'FeatureCollection', features }
}

export const exportAsGeoJsonBlob = (data: GraphData): Blob => {
  const fc = graphToGeoJsonFeatureCollection(data)
  return new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
}
