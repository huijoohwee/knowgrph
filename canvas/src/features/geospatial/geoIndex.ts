import type { FeatureCollection, Point } from 'geojson'
import { SimpleTtlLruCache } from '../../lib/cache/SimpleTtlLruCache'

export type GeoIndexHit = {
  datasetKey: string
  featureId: string
  label: string
  lng: number
  lat: number
  properties: Record<string, unknown>
}

const GEO_INDEX_MAX_TOKENS = 50_000
const GEO_INDEX_TTL_MS = 30 * 60 * 1000
const GEO_INDEX_MAX_FEATURES_PER_DATASET = 30_000

const tokenToHit = new SimpleTtlLruCache<string, GeoIndexHit>(GEO_INDEX_MAX_TOKENS, GEO_INDEX_TTL_MS)

const normalizeCodeToken = (raw: string): string => {
  const s = String(raw || '').trim().toUpperCase()
  if (!s) return ''
  const kept = s.replace(/[^A-Z0-9]/g, '')
  return kept.length >= 2 ? kept : ''
}

const normalizeTextToken = (raw: string): string => {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
  if (!s) return ''
  const collapsed = s
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return collapsed.length >= 3 ? collapsed : ''
}

const coercePointLngLat = (coords: unknown): { lng: number; lat: number } | null => {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = typeof coords[0] === 'number' ? coords[0] : Number(coords[0])
  const lat = typeof coords[1] === 'number' ? coords[1] : Number(coords[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lng, lat }
}

const readString = (props: Record<string, unknown>, key: string): string => {
  const v = props[key]
  return typeof v === 'string' ? v.trim() : ''
}

const buildFeatureTokens = (props: Record<string, unknown>): string[] => {
  const tokens: string[] = []
  const add = (raw: string, kind: 'code' | 'text') => {
    const normalized = kind === 'code' ? normalizeCodeToken(raw) : normalizeTextToken(raw)
    if (!normalized) return
    tokens.push(normalized)
  }

  add(readString(props, 'iata'), 'code')
  add(readString(props, 'icao'), 'code')
  add(readString(props, 'code'), 'code')
  add(readString(props, 'id'), 'code')

  add(readString(props, 'label'), 'text')
  add(readString(props, 'name'), 'text')
  add(readString(props, 'title'), 'text')
  add(readString(props, 'city'), 'text')
  add(readString(props, 'country'), 'text')

  return Array.from(new Set(tokens)).slice(0, 16)
}

export function updateGeoIndexFromPointFeatureCollection(args: {
  datasetKey: string
  collection: FeatureCollection<Point>
}): { indexedFeatures: number; indexedTokens: number } {
  const datasetKey = String(args.datasetKey || '').trim() || 'dataset:unknown'
  const fc = args.collection
  const features = Array.isArray(fc?.features) ? fc.features : []
  const limit = Math.min(features.length, GEO_INDEX_MAX_FEATURES_PER_DATASET)

  let indexedFeatures = 0
  let indexedTokens = 0
  for (let i = 0; i < limit; i += 1) {
    const f = features[i] as unknown as {
      type?: unknown
      geometry?: { type?: unknown; coordinates?: unknown } | null
      properties?: unknown
      id?: unknown
    }
    if (!f || f.type !== 'Feature') continue
    const geom = f.geometry
    if (!geom || geom.type !== 'Point') continue
    const ll = coercePointLngLat(geom.coordinates)
    if (!ll) continue
    const props = (f.properties || {}) as Record<string, unknown>
    const featureId = String(f.id ?? props.id ?? '').trim() || `row:${i}`
    const label = String(props.label ?? props.name ?? props.title ?? featureId).trim() || featureId
    const tokens = buildFeatureTokens(props)
    if (tokens.length === 0) continue

    const hit: GeoIndexHit = { datasetKey, featureId, label, lng: ll.lng, lat: ll.lat, properties: props }
    for (const t of tokens) {
      tokenToHit.set(t, hit)
      indexedTokens += 1
    }
    indexedFeatures += 1
  }

  return { indexedFeatures, indexedTokens }
}

export function resolveGeoFromIndex(args: { tokens: string[] }): GeoIndexHit | null {
  const inputs = Array.isArray(args.tokens) ? args.tokens : []
  for (const raw of inputs) {
    const code = normalizeCodeToken(raw)
    if (code) {
      const hit = tokenToHit.get(code)
      if (hit) return hit
    }
    const text = normalizeTextToken(raw)
    if (text) {
      const hit = tokenToHit.get(text)
      if (hit) return hit
    }
  }
  return null
}
