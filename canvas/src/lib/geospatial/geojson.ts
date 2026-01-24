import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Point } from 'geojson'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { deriveGeoFromRecord, deriveIdFromRecord, deriveLabelFromRecord } from '@/lib/graph/geo/recordHeuristics'
import { coerceRecordEntries } from '@/lib/data/recordEntries'

type LngLat = { lng: number; lat: number }

const extractLngLatFromRecord = (rec: Record<string, unknown>): LngLat | null => {
  const geo = deriveGeoFromRecord(rec)
  if (!geo) return null
  return { lat: geo.lat, lng: geo.lng }
}

export function extractLngLatFromGraphNode(node: GraphNode): LngLat | null {
  const props = node.properties || {}
  return extractLngLatFromRecord(props as unknown as Record<string, unknown>)
}

export function isGeoJsonLike(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const t = (raw as Record<string, unknown>).type
  if (typeof t !== 'string') return false
  if (t === 'FeatureCollection') return Array.isArray((raw as Record<string, unknown>).features)
  if (t === 'Feature') return true
  if (
    t === 'Point' ||
    t === 'MultiPoint' ||
    t === 'LineString' ||
    t === 'MultiLineString' ||
    t === 'Polygon' ||
    t === 'MultiPolygon' ||
    t === 'GeometryCollection'
  ) {
    return true
  }
  return false
}

function isGeometryLike(raw: unknown): raw is Geometry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const t = (raw as Record<string, unknown>).type
  if (typeof t !== 'string' || !t.trim()) return false
  return true
}

export function coerceGeoJsonToFeatureCollection(raw: unknown): FeatureCollection | null {
  if (!raw || typeof raw !== 'object') return null
  if (Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return raw as FeatureCollection
  }
  if (obj.type === 'Feature' && isGeometryLike(obj.geometry)) {
    return { type: 'FeatureCollection', features: [raw as Feature] }
  }
  if (isGeometryLike(raw)) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: raw as Geometry, properties: {} }] }
  }
  return null
}

export function parseGeoJsonFromText(text: string): FeatureCollection | null {
  try {
    const raw = JSON.parse(text) as unknown
    return coerceGeoJsonToFeatureCollection(raw)
  } catch {
    return null
  }
}

export function recordsToPointFeatureCollection(raw: unknown): FeatureCollection<Point> | null {
  const entries = coerceRecordEntries(raw)
  if (entries.length === 0) return null
  const features: Array<Feature<Point>> = []
  for (let i = 0; i < entries.length; i += 1) {
    const rec = entries[i].value
    const key = entries[i].key.trim()
    const ll = extractLngLatFromRecord(rec)
    if (!ll) continue
    const id = deriveIdFromRecord(rec) ?? (key ? key : `row:${i}`)
    const label = deriveLabelFromRecord(rec, id)
    const properties: GeoJsonProperties = {
      ...((rec as unknown as Record<string, JSONValue>) || {}),
      id,
      label,
    }
    features.push({
      type: 'Feature',
      id,
      properties,
      geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] },
    })
  }
  if (features.length === 0) return null
  return { type: 'FeatureCollection', features }
}

export function graphNodesToPointFeatureCollection(graphData: GraphData): FeatureCollection<Point> {
  const features: Array<Feature<Point>> = []
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (const node of nodes) {
    const ll = extractLngLatFromGraphNode(node)
    if (!ll) continue
    const properties: GeoJsonProperties = {
      nodeId: node.id,
      label: node.label,
      type: node.type,
    }
    features.push({
      type: 'Feature',
      id: node.id,
      properties,
      geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}
