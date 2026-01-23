import { isPlainObject } from '@/lib/graph/value'

export const coerceFiniteNumber = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const v = Number(x.trim())
    if (Number.isFinite(v)) return v
  }
  return null
}

export const coerceId = (x: unknown): string | null => {
  if (typeof x === 'string' && x.trim()) return x.trim()
  if (typeof x === 'number' && Number.isFinite(x)) return String(x)
  return null
}

export const deriveIdFromRecord = (rec: Record<string, unknown>): string | null => {
  const candidates = [rec.id, rec._id, rec.uuid, rec.key, rec.code, rec.slug]
  for (const c of candidates) {
    const hit = coerceId(c)
    if (hit) return hit
  }
  return null
}

export const deriveLabelFromRecord = (rec: Record<string, unknown>, fallback: string): string => {
  const candidates = [rec.name, rec.label, rec.title, rec.displayName, rec.description]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return fallback
}

export const deriveGeoFromRecord = (rec: Record<string, unknown>): { lat: number; lng: number } | null => {
  const geoRaw = rec.geo
  if (geoRaw && isPlainObject(geoRaw)) {
    const lat = coerceFiniteNumber((geoRaw as Record<string, unknown>).lat)
    const lng = coerceFiniteNumber((geoRaw as Record<string, unknown>).lng ?? (geoRaw as Record<string, unknown>).lon)
    if (lat !== null && lng !== null) return { lat, lng }
  }
  const lat = coerceFiniteNumber(rec.lat ?? rec.latitude ?? rec.y)
  const lng = coerceFiniteNumber(rec.lng ?? rec.lon ?? rec.longitude ?? rec.x)
  if (lat !== null && lng !== null) return { lat, lng }
  const locationRaw = rec.location
  if (locationRaw && isPlainObject(locationRaw)) {
    const llat = coerceFiniteNumber((locationRaw as Record<string, unknown>).lat ?? (locationRaw as Record<string, unknown>).latitude)
    const llng = coerceFiniteNumber((locationRaw as Record<string, unknown>).lng ?? (locationRaw as Record<string, unknown>).lon ?? (locationRaw as Record<string, unknown>).longitude)
    if (llat !== null && llng !== null) return { lat: llat, lng: llng }
  }
  return null
}

