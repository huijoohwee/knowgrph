import type { FeatureCollection } from 'geojson'
import { LS_KEYS } from './lib/config'
import { coerceFetchUrl } from './lib/url'
import { coerceGeoJsonToFeatureCollection } from './geojson'
import { LRUCache } from 'grph-shared/cache/LRUCache'

export type GeospatialDatasetSource = { kind: 'url'; url: string }

export type GeospatialDataset = {
  id: string
  label: string
  enabled: boolean
  source: GeospatialDatasetSource
  format: 'auto' | 'geojson'
}

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    void 0
  }
}

const coerceDatasets = (raw: unknown): GeospatialDataset[] => {
  if (!Array.isArray(raw)) return []
  const out: GeospatialDataset[] = []
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue
    const rec = v as Record<string, unknown>
    const source = rec.source as Record<string, unknown> | null
    const url = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    const id = String(rec.id || '').trim() || url || `kg:geo:${out.length + 1}`
    if (!url) continue
    out.push({
      id,
      label: String(rec.label || '').trim() || 'GeoJSON dataset',
      enabled: rec.enabled !== false,
      source: { kind: 'url', url },
      format: rec.format === 'geojson' ? 'geojson' : 'auto',
    })
  }
  return out
}

export function addGeospatialDatasetUrl(args: { url: string; label?: string; format?: 'auto' | 'geojson' }): void {
  const url = String(args.url || '').trim()
  if (!url) return
  const label = String(args.label || '').trim() || 'GeoJSON dataset'
  const format = args.format === 'geojson' ? 'geojson' : 'auto'

  const prev = coerceDatasets(readJson(LS_KEYS.geospatialDatasets, []))
  const exists = prev.some(d => d.source.url === url)
  if (exists) return
  const next: GeospatialDataset[] = [
    ...prev,
    {
      id: url,
      label,
      enabled: true,
      source: { kind: 'url', url },
      format,
    },
  ]
  writeJson(LS_KEYS.geospatialDatasets, next)
}

export async function loadDatasetFeatureCollection(args: { url: string; timeoutMs?: number | null }): Promise<FeatureCollection | null> {
  const url = String(args.url || '').trim()
  if (!url) return null
  const fetchUrl = coerceFetchUrl(url)
  if (!fetchUrl) return null

  const timeoutMs = typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs) ? Math.max(0, args.timeoutMs) : 20_000
  const maxBytes = (() => {
    const anyArgs = args as unknown as { maxBytes?: number | null }
    const raw = typeof anyArgs.maxBytes === 'number' && Number.isFinite(anyArgs.maxBytes) ? Math.floor(anyArgs.maxBytes) : 25 * 1024 * 1024
    return Math.max(64 * 1024, Math.min(100 * 1024 * 1024, raw))
  })()

  const cache = (() => {
    const anyArgs = args as unknown as { cache?: LRUCache<string, FeatureCollection | null> | null }
    return anyArgs.cache || defaultDatasetCache
  })()

  const cacheKey = fetchUrl
  if (cache) {
    const cached = cache.get(cacheKey)
    if (cached != null) return cached
  }

  const inFlight = getInFlightMap()
  const existing = inFlight.get(cacheKey)
  if (existing) return existing

  const task = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const t = ctrl && timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    try {
      const res = await fetch(fetchUrl, { signal: ctrl?.signal })
      if (!res.ok) return null

      const contentLengthRaw = res.headers.get('content-length')
      const contentLength = contentLengthRaw ? Number(contentLengthRaw) : NaN
      if (Number.isFinite(contentLength) && contentLength > maxBytes) return null

      const buf = await res.arrayBuffer()
      if (buf.byteLength > maxBytes) return null
      const text = new TextDecoder('utf-8').decode(buf)
      const json = JSON.parse(text) as unknown
      const fc = coerceGeoJsonToFeatureCollection(json)
      if (cache) cache.set(cacheKey, fc)
      return fc
    } catch {
      return null
    } finally {
      if (t) clearTimeout(t)
      inFlight.delete(cacheKey)
    }
  })()

  inFlight.set(cacheKey, task)
  return task
}

const getInFlightMap = (() => {
  let map: Map<string, Promise<FeatureCollection | null>> | null = null
  return () => {
    if (!map) map = new Map()
    return map
  }
})()

const defaultDatasetCache = new LRUCache<string, FeatureCollection | null>(40, 60_000)
