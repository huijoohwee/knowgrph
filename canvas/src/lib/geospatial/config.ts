import { readEnvString } from '@/lib/config.env'
import type { GeospatialDataset, GeospatialDatasetFormat } from '@/lib/geospatial/types'
import { OPENFREEMAP_STYLE_URL } from '@/lib/geospatial/styles'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { clamp01 } from '@/lib/math/clamp01'

export const DEFAULT_GEOSPATIAL_STYLE_URL = readEnvString(
  'VITE_GEOSPATIAL_STYLE_URL',
  OPENFREEMAP_STYLE_URL,
)

const readFirstEnvNumber = (keys: string[]): number | null => {
  for (const key of keys) {
    const raw = readEnvString(key, '')
    const n = raw ? Number(raw) : NaN
    if (Number.isFinite(n)) return n
  }
  return null
}

export const DEFAULT_GEOSPATIAL_OVERLAY_OPACITY = (() => {
  const n = readFirstEnvNumber(['VITE_GEOSPATIAL_OVERLAY_OPACITY'])
  if (n === null) return 0.65
  return n
})()

export function coerceGeospatialOverlayOpacity(enabled: boolean, raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw)
  const clamped = clamp01(Number.isFinite(n) ? n : DEFAULT_GEOSPATIAL_OVERLAY_OPACITY)
  if (enabled && !(clamped > 0)) return DEFAULT_GEOSPATIAL_OVERLAY_OPACITY
  return clamped
}

export const DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS = (() => {
  const n = readFirstEnvNumber(['VITE_GEOSPATIAL_DATASET_TIMEOUT_MS', 'VITE_GEOSPATIAL_TIMEOUT_MS'])
  if (n === null) return 20_000
  return Math.max(1_000, Math.min(60_000, Math.floor(n)))
})()

export const DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES = (() => {
  const n = readFirstEnvNumber(['VITE_GEOSPATIAL_DATASET_MAX_BYTES', 'VITE_GEOSPATIAL_MAX_BYTES'])
  if (n === null) return 25 * 1024 * 1024
  return Math.max(64 * 1024, Math.min(50 * 1024 * 1024, Math.floor(n)))
})()

export const parseGeospatialDatasetFormat = (raw: unknown): GeospatialDatasetFormat => {
  if (raw === 'geojson') return 'geojson'
  if (raw === 'records') return 'records'
  return 'auto'
}

export function parseGeospatialDatasetsFromEnv(): GeospatialDataset[] | null {
  const raw = readEnvString('VITE_GEOSPATIAL_DATASETS_JSON', '')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const out: GeospatialDataset[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const rec = item as Record<string, unknown>
      const idRaw = typeof rec.id === 'string' ? rec.id.trim() : ''
      const label = typeof rec.label === 'string' ? rec.label.trim() : ''
      const enabled = rec.enabled !== false
      const url = typeof rec.url === 'string' ? rec.url.trim() : ''
      const format = parseGeospatialDatasetFormat(rec.format)
      if (!label || !url) continue
      const id = idRaw || `geo:env:${hashStringToHex(`${label}|${url}`)}`
      out.push({
        id,
        label,
        enabled,
        source: { kind: 'url', url },
        format,
      })
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}
