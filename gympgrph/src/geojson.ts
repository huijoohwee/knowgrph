import type { Feature, FeatureCollection, GeoJsonObject, Geometry } from 'geojson'

const isObject = (v: unknown): v is Record<string, unknown> => {
  return !!v && typeof v === 'object'
}

const isFeatureCollection = (v: unknown): v is FeatureCollection => {
  return isObject(v) && v.type === 'FeatureCollection' && Array.isArray((v as Record<string, unknown>).features)
}

const isFeature = (v: unknown): v is Feature => {
  return isObject(v) && v.type === 'Feature' && isObject((v as Record<string, unknown>).geometry)
}

const isGeometry = (v: unknown): v is Geometry => {
  return isObject(v) && typeof (v as Record<string, unknown>).type === 'string'
}

export function parseGeoJsonFromText(text: string): FeatureCollection | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const parsed = JSON.parse(raw) as unknown
  return coerceGeoJsonToFeatureCollection(parsed)
}

export function coerceGeoJsonToFeatureCollection(v: unknown): FeatureCollection {
  if (isFeatureCollection(v)) return v
  if (isFeature(v)) return { type: 'FeatureCollection', features: [v] }
  if (isGeometry(v)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: v }],
    }
  }
  const obj = v as GeoJsonObject
  if (obj && typeof obj === 'object' && 'type' in obj) {
    throw new Error(`Unsupported GeoJSON type: ${String((obj as { type?: unknown }).type)}`)
  }
  throw new Error('Invalid GeoJSON')
}
