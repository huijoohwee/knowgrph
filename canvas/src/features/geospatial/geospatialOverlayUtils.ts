import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import bbox from '@turf/bbox'
import type { AllGeoJSON } from '@turf/helpers'
import type { FeatureCollection, GeoJSON, GeoJsonProperties, Geometry } from 'geojson'
import { parseGeoJsonFromText, recordsToPointFeatureCollection } from '@/lib/geospatial/geojson'
import { fetchRemoteText, fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { hashStringToIndex } from '@/lib/hash/stringHash'
import type { LRUCache } from '@/lib/cache/LRUCache'

export { hashStringToIndex }

export const DATASET_COLOR_PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'] as const

export const buildBlankStyle = (): Record<string, unknown> => ({
  version: 8,
  sources: {},
  layers: [
    {
      id: 'kg-blank-bg',
      type: 'background',
      paint: { 'background-color': 'rgba(0,0,0,0)' },
    },
  ],
})

const isRasterTileUrl = (url: unknown): boolean => {
  if (typeof url !== 'string') return false
  return /\.(png|jpg|jpeg)(\?|$)/i.test(url)
}

const coerceVectorPreferredStyle = (raw: unknown): unknown => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const style = raw as Record<string, unknown>
  const sourcesRaw = style.sources
  if (!sourcesRaw || typeof sourcesRaw !== 'object' || Array.isArray(sourcesRaw)) return raw
  const sources = sourcesRaw as Record<string, unknown>

  const removedSourceIds: string[] = []
  const nextSources: Record<string, unknown> = {}
  let keptNonRaster = 0
  for (const [id, sourceRaw] of Object.entries(sources)) {
    if (!sourceRaw || typeof sourceRaw !== 'object' || Array.isArray(sourceRaw)) {
      nextSources[id] = sourceRaw
      continue
    }
    const source = sourceRaw as Record<string, unknown>
    const type = typeof source.type === 'string' ? source.type : ''
    const tiles = Array.isArray(source.tiles) ? source.tiles : []
    const hasRasterTiles = tiles.some(isRasterTileUrl)
    const isRaster = type === 'raster' || type === 'raster-dem' || hasRasterTiles
    if (isRaster) {
      removedSourceIds.push(id)
      continue
    }
    nextSources[id] = sourceRaw
    keptNonRaster += 1
  }

  if (removedSourceIds.length === 0) return raw
  if (keptNonRaster === 0) return raw

  const layersRaw = Array.isArray(style.layers) ? style.layers : null
  const nextLayers = layersRaw
    ? layersRaw.filter((layerRaw) => {
        if (!layerRaw || typeof layerRaw !== 'object' || Array.isArray(layerRaw)) return true
        const layer = layerRaw as Record<string, unknown>
        const sourceId = typeof layer.source === 'string' ? layer.source : ''
        return !removedSourceIds.includes(sourceId)
      })
    : undefined

  const next: Record<string, unknown> = { ...style, sources: nextSources }
  if (nextLayers) next.layers = nextLayers

  if (style.terrain && typeof style.terrain === 'object' && style.terrain && !Array.isArray(style.terrain)) {
    const terrain = style.terrain as Record<string, unknown>
    const sourceId = typeof terrain.source === 'string' ? terrain.source : ''
    if (sourceId && removedSourceIds.includes(sourceId)) {
      delete next.terrain
    }
  }

  return next
}

async function loadStyleObject(styleUrl: string): Promise<unknown | null> {
  const text = await fetchRemoteText(styleUrl, {
    timeoutMs: 20_000,
    maxBytes: 2 * 1024 * 1024,
    validate: (t) => {
      const trimmed = t.trim()
      return trimmed.startsWith('{') && trimmed.includes('"version"')
    },
  })
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function resolveStyleUrls(styleUrl: string, raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const normalizedStyleUrl = normalizeGitHubBlobLikeUrl(styleUrl) ?? styleUrl
  let base: URL
  try {
    const baseUrl = (() => {
      const s = String(normalizedStyleUrl || '').trim()
      if (!s) return s
      if (/\.json(\?|#|$)/i.test(s)) return s
      if (s.endsWith('/')) return s
      return `${s}/`
    })()
    base = new URL(baseUrl)
  } catch {
    return raw
  }

  const resolve = (value: string): string => {
    const v = String(value || '').trim()
    if (!v) return value
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return value
    try {
      const resolved = new URL(v, base).toString()
      return resolved
        .replace(/%7B/gi, '{')
        .replace(/%7D/gi, '}')
    } catch {
      return value
    }
  }

  const style = raw as Record<string, unknown>
  let changed = false
  const next: Record<string, unknown> = { ...style }

  if (typeof style.sprite === 'string') {
    const resolved = resolve(style.sprite)
    if (resolved !== style.sprite) {
      next.sprite = resolved
      changed = true
    }
  }
  if (typeof style.glyphs === 'string') {
    const resolved = resolve(style.glyphs)
    if (resolved !== style.glyphs) {
      next.glyphs = resolved
      changed = true
    }
  }

  const sourcesRaw = style.sources
  if (sourcesRaw && typeof sourcesRaw === 'object' && !Array.isArray(sourcesRaw)) {
    const sources = sourcesRaw as Record<string, unknown>
    const nextSources: Record<string, unknown> = { ...sources }
    let sourcesChanged = false
    for (const [sourceId, sourceRaw] of Object.entries(sources)) {
      if (!sourceRaw || typeof sourceRaw !== 'object' || Array.isArray(sourceRaw)) continue
      const source = sourceRaw as Record<string, unknown>
      let sourceChanged = false
      const nextSource: Record<string, unknown> = { ...source }

      if (typeof source.url === 'string') {
        const resolved = resolve(source.url)
        if (resolved !== source.url) {
          nextSource.url = resolved
          sourceChanged = true
        }
      }
      if (Array.isArray(source.tiles)) {
        const tiles = source.tiles
        const nextTiles = tiles.map((t) => (typeof t === 'string' ? resolve(t) : t))
        const same = nextTiles.length === tiles.length && nextTiles.every((t, i) => t === tiles[i])
        if (!same) {
          nextSource.tiles = nextTiles
          sourceChanged = true
        }
      }

      if (sourceChanged) {
        nextSources[sourceId] = nextSource
        sourcesChanged = true
      }
    }
    if (sourcesChanged) {
      next.sources = nextSources
      changed = true
    }
  }

  return changed ? next : raw
}

export async function applyPreferredStyle(
  map: MapLibreMap,
  styleUrl: string,
  cancelled: () => boolean,
): Promise<boolean> {
  const normalizedStyleUrl = normalizeGitHubBlobLikeUrl(styleUrl) ?? styleUrl
  const raw = await loadStyleObject(normalizedStyleUrl)
  if (!raw) return false
  if (cancelled()) return false
  const resolved = resolveStyleUrls(normalizedStyleUrl, raw)
  const vectorPreferred = coerceVectorPreferredStyle(resolved)
  try {
    map.setStyle(vectorPreferred as never)
    return true
  } catch {
    return false
  }
}

export function colorForDataset(datasetId: string): string {
  const idx = hashStringToIndex(datasetId, DATASET_COLOR_PALETTE.length)
  return DATASET_COLOR_PALETTE[idx] || '#2563EB'
}

export function ensureGraphPointLayer(map: MapLibreMap, sourceId: string, layerId: string, color: string) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 6,
        'circle-color': color,
        'circle-opacity': 0.9,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    })
  }
}

export function ensureDatasetLayer(map: MapLibreMap, srcId: string, color: string) {
  if (!map.getSource(srcId)) {
    map.addSource(srcId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  const fillId = `${srcId}:fill`
  const lineId = `${srcId}:line`
  const pointId = `${srcId}:points`

  if (!map.getLayer(fillId)) {
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: srcId,
      filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
      paint: {
        'fill-color': color,
        'fill-opacity': 0.2,
      },
    })
  }
  if (!map.getLayer(lineId)) {
    map.addLayer({
      id: lineId,
      type: 'line',
      source: srcId,
      filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']]],
      paint: {
        'line-color': color,
        'line-opacity': 0.8,
        'line-width': 1.5,
      },
    })
  }
  if (!map.getLayer(pointId)) {
    map.addLayer({
      id: pointId,
      type: 'circle',
      source: srcId,
      filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
      paint: {
        'circle-radius': 3.5,
        'circle-color': color,
        'circle-opacity': 0.8,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 0.5,
      },
    })
  }
}

export function setGeoJsonSourceData(map: MapLibreMap, sourceId: string, data: FeatureCollection) {
  const src = map.getSource(sourceId)
  if (!src) return
  const geo = src as GeoJSONSource
  geo.setData(data as unknown as GeoJSON<Geometry, GeoJsonProperties>)
}

export async function loadDatasetFeatureCollection(
  url: string,
  format: 'auto' | 'geojson' | 'records',
  options: { timeoutMs: number; maxBytes: number; onProgress?: (args: { loadedBytes: number; totalBytes?: number }) => void },
  datasetCache: LRUCache<string, FeatureCollection>,
  fetcher: (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<string | null> = fetchRemoteText,
): Promise<FeatureCollection> {
  const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
  const cached = datasetCache.get(normalized)
  if (cached) return cached

  const text = await (async () => {
    if (fetcher === fetchRemoteText) {
      const res = await fetchRemoteTextDetailed(normalized, {
        timeoutMs: options.timeoutMs,
        maxBytes: options.maxBytes,
        onProgress: options.onProgress,
      })
      if (res.ok === false) {
        if (res.kind === 'too_large') {
          const mb = options.maxBytes / (1024 * 1024)
          const gotMb = res.contentLength != null ? res.contentLength / (1024 * 1024) : null
          const got = gotMb != null ? ` (${gotMb.toFixed(1)} MB)` : ''
          throw new Error(`Dataset too large${got}. Increase max bytes (currently ${mb.toFixed(1)} MB).`)
        }
        if (res.kind === 'timeout') {
          throw new Error(`Dataset fetch timed out. Increase timeoutMs (currently ${options.timeoutMs}ms).`)
        }
        if (res.kind === 'http' && res.status) {
          throw new Error(`Dataset request failed (status ${res.status}).`)
        }
        throw new Error(`Unable to fetch dataset (timeoutMs=${options.timeoutMs}, maxBytes=${options.maxBytes}).`)
      }
      return res.text
    }

    const t = await fetcher(normalized, {
      maxBytes: options.maxBytes,
      timeoutMs: options.timeoutMs,
    })
    if (!t) {
      throw new Error(`Unable to fetch dataset (timeoutMs=${options.timeoutMs}, maxBytes=${options.maxBytes}).`)
    }
    return t
  })()

  // Try parsing as GeoJSON first if auto or geojson
  if (format === 'geojson' || format === 'auto') {
    const fc = parseGeoJsonFromText(text)
    if (fc) {
      datasetCache.set(normalized, fc)
      return fc
    }
    if (format === 'geojson') throw new Error('Expected GeoJSON, but parsing failed.')
  }

  // Fallback to records parsing
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const points = recordsToPointFeatureCollection(parsed)
  if (!points) {
    throw new Error(
      'No GeoJSON parsed and no record points derived (expected fields like lat/lng, latitude/longitude, geo.lat/geo.lng, location.lat/location.lng, or geometry.coordinates).',
    )
  }
  datasetCache.set(normalized, points)
  return points
}

export function computeBoundsFromCollections(collections: FeatureCollection[]): [[number, number], [number, number]] | null {
  const boxes: Array<[number, number, number, number]> = []
  for (const fc of collections) {
    try {
      const b = bbox(fc as unknown as AllGeoJSON) as unknown
      if (!Array.isArray(b) || b.length !== 4) continue
      const [minX, minY, maxX, maxY] = b as number[]
      if (![minX, minY, maxX, maxY].every(v => typeof v === 'number' && Number.isFinite(v))) continue
      boxes.push([minX, minY, maxX, maxY])
    } catch {
      void 0
    }
  }
  if (boxes.length === 0) return null
  let minX = boxes[0][0]
  let minY = boxes[0][1]
  let maxX = boxes[0][2]
  let maxY = boxes[0][3]
  for (let i = 1; i < boxes.length; i += 1) {
    const b = boxes[i]
    minX = Math.min(minX, b[0])
    minY = Math.min(minY, b[1])
    maxX = Math.max(maxX, b[2])
    maxY = Math.max(maxY, b[3])
  }
  return [[minX, minY], [maxX, maxY]]
}
