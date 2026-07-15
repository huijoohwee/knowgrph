import type { JSONValue } from '@/lib/graph/types'
import { isRecord, readFieldValue, toJsonValue } from './chatResponseStructuredRecord'

const DIRECT_KEYS = ['geoJson', 'geojson', 'geo_json', 'featureCollection', 'feature_collection', 'features', 'coordinates'] as const
const BUNDLE_KEYS = ['lat', 'lng', 'lon', 'latitude', 'longitude', 'location', 'geometry', 'bbox'] as const

const hasMeaningfulStructuredValue = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  return isRecord(value) && Object.keys(value).length > 0
}

export const readGeospatialStructuredPayload = (record: Record<string, unknown>): JSONValue | undefined => {
  for (const key of DIRECT_KEYS) {
    const raw = readFieldValue(record, key)
    if (!hasMeaningfulStructuredValue(raw)) continue
    const normalized = key === 'features' && Array.isArray(raw) ? toJsonValue({ type: 'FeatureCollection', features: raw }) : toJsonValue(raw)
    if (typeof normalized !== 'undefined') return normalized
  }
  const bundled: Record<string, JSONValue> = {}
  for (const key of BUNDLE_KEYS) {
    const raw = readFieldValue(record, key)
    if (!hasMeaningfulStructuredValue(raw)) continue
    const normalized = toJsonValue(raw)
    if (typeof normalized !== 'undefined') bundled[key] = normalized
  }
  return Object.keys(bundled).length > 0 ? bundled : undefined
}
