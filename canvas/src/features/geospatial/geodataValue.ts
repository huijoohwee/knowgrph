type LngLat = { lat: number; lng: number }

const toFiniteNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
  }
  return null
}

const readRecord = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

const pickLatLngFromNumbers = (aRaw: unknown, bRaw: unknown): LngLat | null => {
  const a = toFiniteNumber(aRaw)
  const b = toFiniteNumber(bRaw)
  if (a == null || b == null) return null
  const absA = Math.abs(a)
  const absB = Math.abs(b)
  const looksLikeLatLng = absA <= 90 && absB <= 180
  const looksLikeLngLat = absA <= 180 && absB <= 90
  if (looksLikeLatLng && !looksLikeLngLat) return { lat: a, lng: b }
  if (looksLikeLngLat && !looksLikeLatLng) return { lat: b, lng: a }
  if (absA <= 90 && absB <= 90) return { lat: a, lng: b }
  return { lat: a, lng: b }
}

const readLatLngFromRecord = (rec: Record<string, unknown>): LngLat | null => {
  const direct =
    pickLatLngFromNumbers(rec.lat, rec.lng) ||
    pickLatLngFromNumbers(rec.latitude, rec.longitude) ||
    pickLatLngFromNumbers(rec.latitude, rec.lon) ||
    pickLatLngFromNumbers(rec.y, rec.x)
  if (direct) return direct

  const geo = readRecord(rec.geo)
  if (geo) {
    const nested =
      pickLatLngFromNumbers(geo.lat, geo.lng) ||
      pickLatLngFromNumbers(geo.latitude, geo.longitude) ||
      pickLatLngFromNumbers(geo.latitude, geo.lon)
    if (nested) return nested
  }

  const location = readRecord(rec.location)
  if (location) {
    const nested =
      pickLatLngFromNumbers(location.lat, location.lng) ||
      pickLatLngFromNumbers(location.latitude, location.longitude) ||
      pickLatLngFromNumbers(location.latitude, location.lon)
    if (nested) return nested
  }

  if (Array.isArray(rec.coordinates) && rec.coordinates.length >= 2) {
    return pickLatLngFromNumbers(rec.coordinates[1], rec.coordinates[0])
  }

  return null
}

const parseStringAsRecord = (text: string): Record<string, unknown> | null => {
  const trimmed = text.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const latLng = pickLatLngFromNumbers(parsed[1], parsed[0]) || pickLatLngFromNumbers(parsed[0], parsed[1])
      if (!latLng) return null
      return { geo: latLng }
    }
    return readRecord(parsed)
  } catch {
    return null
  }
}

const parseStringAsPair = (text: string): LngLat | null => {
  const m = /(-?\d+(?:\.\d+)?)\s*[,;/\s]\s*(-?\d+(?:\.\d+)?)/.exec(text)
  if (!m) return null
  return pickLatLngFromNumbers(m[1], m[2])
}

export const parseGeodataValueToLatLng = (raw: unknown): LngLat | null => {
  if (raw == null) return null
  if (typeof raw === 'number' || typeof raw === 'boolean') return null
  if (Array.isArray(raw) && raw.length >= 2) {
    const arrMatch = pickLatLngFromNumbers(raw[1], raw[0]) || pickLatLngFromNumbers(raw[0], raw[1])
    if (arrMatch) return arrMatch
  }

  const rec = readRecord(raw)
  if (rec) {
    const fromRecord = readLatLngFromRecord(rec)
    if (fromRecord) return fromRecord
  }

  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    const fromStringRecord = parseStringAsRecord(text)
    if (fromStringRecord) {
      const nested = readLatLngFromRecord(fromStringRecord)
      if (nested) return nested
    }
    return parseStringAsPair(text)
  }

  return null
}

