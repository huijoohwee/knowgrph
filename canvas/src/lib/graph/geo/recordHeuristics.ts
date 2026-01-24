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
  const inLatRange = (lat: number): boolean => Number.isFinite(lat) && Math.abs(lat) <= 90
  const inLngRange = (lng: number): boolean => Number.isFinite(lng) && Math.abs(lng) <= 180

  const geoRaw = rec.geo
  if (geoRaw && isPlainObject(geoRaw)) {
    const lat = coerceFiniteNumber((geoRaw as Record<string, unknown>).lat ?? (geoRaw as Record<string, unknown>).LAT)
    const lng = coerceFiniteNumber(
      (geoRaw as Record<string, unknown>).lng ??
        (geoRaw as Record<string, unknown>).lon ??
        (geoRaw as Record<string, unknown>).LNG ??
        (geoRaw as Record<string, unknown>).LON,
    )
    if (lat !== null && lng !== null && inLatRange(lat) && inLngRange(lng)) return { lat, lng }
  }
  const lat = coerceFiniteNumber(
    rec.lat ?? rec.latitude ?? rec.y ?? (rec as Record<string, unknown>).LAT ?? (rec as Record<string, unknown>).Latitude,
  )
  const lng = coerceFiniteNumber(
    rec.lng ??
      rec.lon ??
      rec.longitude ??
      rec.x ??
      (rec as Record<string, unknown>).LNG ??
      (rec as Record<string, unknown>).LON ??
      (rec as Record<string, unknown>).Longitude,
  )
  if (lat !== null && lng !== null && inLatRange(lat) && inLngRange(lng)) return { lat, lng }
  const locationRaw = rec.location
  if (locationRaw && isPlainObject(locationRaw)) {
    const llat = coerceFiniteNumber((locationRaw as Record<string, unknown>).lat ?? (locationRaw as Record<string, unknown>).latitude)
    const llng = coerceFiniteNumber((locationRaw as Record<string, unknown>).lng ?? (locationRaw as Record<string, unknown>).lon ?? (locationRaw as Record<string, unknown>).longitude)
    if (llat !== null && llng !== null && inLatRange(llat) && inLngRange(llng)) return { lat: llat, lng: llng }
  }

  const coordsRaw = (rec as Record<string, unknown>).coordinates
  if (coordsRaw && isPlainObject(coordsRaw)) {
    const llat = coerceFiniteNumber(
      (coordsRaw as Record<string, unknown>).lat ??
        (coordsRaw as Record<string, unknown>).latitude ??
        (coordsRaw as Record<string, unknown>).LAT ??
        (coordsRaw as Record<string, unknown>).Latitude,
    )
    const llng = coerceFiniteNumber(
      (coordsRaw as Record<string, unknown>).lng ??
        (coordsRaw as Record<string, unknown>).lon ??
        (coordsRaw as Record<string, unknown>).longitude ??
        (coordsRaw as Record<string, unknown>).LNG ??
        (coordsRaw as Record<string, unknown>).LON ??
        (coordsRaw as Record<string, unknown>).Longitude,
    )
    if (llat !== null && llng !== null && inLatRange(llat) && inLngRange(llng)) return { lat: llat, lng: llng }
  }
  if (Array.isArray(coordsRaw) && coordsRaw.length >= 2) {
    const a = coerceFiniteNumber(coordsRaw[0])
    const b = coerceFiniteNumber(coordsRaw[1])
    if (a !== null && b !== null) {
      if (inLngRange(a) && inLatRange(b)) return { lat: b, lng: a }
      if (inLngRange(b) && inLatRange(a)) return { lat: a, lng: b }
    }
  }

  const geometryRaw = (rec as Record<string, unknown>).geometry
  if (geometryRaw && isPlainObject(geometryRaw)) {
    const t = (geometryRaw as Record<string, unknown>).type
    const gCoords = (geometryRaw as Record<string, unknown>).coordinates
    if (t === 'Point' && Array.isArray(gCoords) && gCoords.length >= 2) {
      const a = coerceFiniteNumber(gCoords[0])
      const b = coerceFiniteNumber(gCoords[1])
      if (a !== null && b !== null && inLngRange(a) && inLatRange(b)) return { lat: b, lng: a }
    }
  }

  return null
}
