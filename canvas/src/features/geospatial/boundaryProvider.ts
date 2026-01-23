import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import { fetchRemoteText } from '@/features/toolbar/ingestUtils'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'

export function getBoundaryGeoJsonUrlFromEnv(): string {
  if (typeof import.meta === 'undefined') return ''
  const meta = import.meta as unknown as { env?: Record<string, unknown> }
  const env = meta.env
  const raw = env && env.VITE_GEOSPATIAL_BOUNDARY_GEOJSON_URL
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

export function parseGeoJsonFeatureCollection(text: string): FeatureCollection<Geometry, GeoJsonProperties> | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const t = (parsed as Record<string, unknown>).type
    if (t !== 'FeatureCollection') return null
    const features = (parsed as Record<string, unknown>).features
    if (!Array.isArray(features)) return null
    return parsed as FeatureCollection<Geometry, GeoJsonProperties>
  } catch {
    return null
  }
}

export async function loadBoundaryGeoJson(url: string): Promise<FeatureCollection<Geometry, GeoJsonProperties> | null> {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) return null
  const normalized = normalizeGitHubBlobLikeUrl(rawUrl) ?? rawUrl
  const text = await fetchRemoteText(normalized, {
    maxBytes: 12 * 1024 * 1024,
    validate: t => {
      const v = parseGeoJsonFeatureCollection(t)
      return Boolean(v)
    },
  })
  if (!text) return null
  return parseGeoJsonFeatureCollection(text)
}
