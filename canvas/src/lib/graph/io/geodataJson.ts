import type { GraphData, JSONValue } from '@/lib/graph/types'
import { isPlainObject } from '@/lib/graph/value'

type LngLat = { lng: number; lat: number }
type GeodataRecordSample = { key: string; record: Record<string, unknown> }

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

const coerceNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const getNestedRecord = (obj: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  return readPlainObject(obj[key])
}

const getNumber = (obj: Record<string, unknown>, key: string): number | null => {
  return coerceNumber(obj[key])
}

const deriveGeoFromRecord = (rec: Record<string, unknown>): LngLat | null => {
  const geo = getNestedRecord(rec, 'geo')
  if (geo) {
    const lat = getNumber(geo, 'lat') ?? getNumber(geo, 'latitude')
    const lng = getNumber(geo, 'lng') ?? getNumber(geo, 'lon') ?? getNumber(geo, 'longitude')
    if (lat != null && lng != null) return { lat, lng }
  }

  const loc = getNestedRecord(rec, 'location')
  if (loc) {
    const lat = getNumber(loc, 'lat') ?? getNumber(loc, 'latitude')
    const lng = getNumber(loc, 'lng') ?? getNumber(loc, 'lon') ?? getNumber(loc, 'longitude')
    if (lat != null && lng != null) return { lat, lng }
  }

  const lat = getNumber(rec, 'lat') ?? getNumber(rec, 'latitude') ?? getNumber(rec, 'y')
  const lng = getNumber(rec, 'lng') ?? getNumber(rec, 'lon') ?? getNumber(rec, 'longitude') ?? getNumber(rec, 'x')
  if (lat != null && lng != null) return { lat, lng }

  const coords = rec.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng2 = coerceNumber(coords[0])
    const lat2 = coerceNumber(coords[1])
    if (lat2 != null && lng2 != null) return { lat: lat2, lng: lng2 }
  }

  return null
}

const deriveIdFromRecord = (rec: Record<string, unknown>, fallback: string): string => {
  const candidates = ['id', 'icao', 'iata', 'code', 'key', 'name', 'label', 'title']
  for (const k of candidates) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return fallback
}

const deriveLabelFromRecord = (rec: Record<string, unknown>, fallback: string): string => {
  const candidates = ['label', 'name', 'title', 'icao', 'iata', 'id', 'code', 'key']
  for (const k of candidates) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return fallback
}

export function sampleGeodataRecordsFromJsonText(
  text: string,
  maxRecords: number,
): GeodataRecordSample[] | null {
  const s = String(text || '').trim()
  if (!s) return null
  const max = Math.max(1, Math.floor(maxRecords || 1))

  const parseJsonStringAt = (input: string, start: number): { value: string; next: number } | null => {
    const quote = input[start]
    if (quote !== '"') return null
    let i = start + 1
    let escaped = false
    for (; i < input.length; i += 1) {
      const ch = input[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        try {
          const raw = input.slice(start, i + 1)
          const value = JSON.parse(raw) as unknown
          return typeof value === 'string' ? { value, next: i + 1 } : null
        } catch {
          return null
        }
      }
    }
    return null
  }

  const skipWs = (input: string, start: number): number => {
    let i = start
    for (; i < input.length; i += 1) {
      const ch = input[i]
      if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') break
    }
    return i
  }

  const scanJsonValueEnd = (input: string, start: number): number | null => {
    let i = skipWs(input, start)
    if (i >= input.length) return null
    const open = input[i]
    if (open !== '{' && open !== '[' && open !== '"') {
      for (; i < input.length; i += 1) {
        const ch = input[i]
        if (ch === ',' || ch === '}' || ch === ']') return i
      }
      return input.length
    }
    if (open === '"') {
      const res = parseJsonStringAt(input, i)
      return res ? res.next : null
    }

    const stack: string[] = [open]
    let inString = false
    let escaped = false
    i += 1
    for (; i < input.length; i += 1) {
      const ch = input[i]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{' || ch === '[') {
        stack.push(ch)
        continue
      }
      if (ch === '}' || ch === ']') {
        const last = stack[stack.length - 1]
        const ok = (last === '{' && ch === '}') || (last === '[' && ch === ']')
        if (!ok) return null
        stack.pop()
        if (stack.length === 0) return i + 1
      }
    }
    return null
  }

  const out: GeodataRecordSample[] = []
  const first = s[0]

  if (first === '{') {
    let i = 1
    while (i < s.length && out.length < max) {
      i = skipWs(s, i)
      if (s[i] === '}') break
      const k = parseJsonStringAt(s, i)
      if (!k) return null
      i = skipWs(s, k.next)
      if (s[i] !== ':') return null
      i = skipWs(s, i + 1)
      const end = scanJsonValueEnd(s, i)
      if (end == null) return null
      const rawValue = s.slice(i, end)
      try {
        const value = JSON.parse(rawValue) as unknown
        const record = readPlainObject(value)
        if (record) out.push({ key: k.value, record })
      } catch {
        void 0
      }
      i = skipWs(s, end)
      if (s[i] === ',') i += 1
    }
    return out.length > 0 ? out : null
  }

  if (first === '[') {
    let i = 1
    let idx = 0
    while (i < s.length && out.length < max) {
      i = skipWs(s, i)
      if (s[i] === ']') break
      const end = scanJsonValueEnd(s, i)
      if (end == null) return null
      const rawValue = s.slice(i, end)
      try {
        const value = JSON.parse(rawValue) as unknown
        const record = readPlainObject(value)
        if (record) out.push({ key: String(idx), record })
      } catch {
        void 0
      }
      idx += 1
      i = skipWs(s, end)
      if (s[i] === ',') i += 1
    }
    return out.length > 0 ? out : null
  }

  return null
}

const GEODATA_CANDIDATE_CONTAINER_KEYS = [
  'results',
  'items',
  'data',
  'places',
  'pois',
  'records',
  'features',
  'nearby',
  'hits',
  'entries',
] as const

function collectGeodataRecordsFromJsonValue(args: {
  value: unknown
  maxRecords: number
  preferredKey?: string
}): GeodataRecordSample[] {
  const { value, maxRecords, preferredKey } = args
  const out: GeodataRecordSample[] = []
  const seen = new WeakSet<object>()
  const preferred = new Set<string>(preferredKey ? [preferredKey, ...GEODATA_CANDIDATE_CONTAINER_KEYS] : GEODATA_CANDIDATE_CONTAINER_KEYS)

  const pushRecord = (key: string, record: Record<string, unknown>) => {
    if (out.length >= maxRecords) return
    out.push({ key, record })
  }

  const visit = (node: unknown, path: string, depth: number) => {
    if (out.length >= maxRecords || depth > 6) return
    if (Array.isArray(node)) {
      const recordItems = node.map(readPlainObject).filter((item): item is Record<string, unknown> => item != null)
      if (recordItems.length > 0) {
        for (let i = 0; i < recordItems.length && out.length < maxRecords; i += 1) {
          pushRecord(path ? `${path}[${i}]` : String(i), recordItems[i]!)
        }
        return
      }
      for (let i = 0; i < node.length && out.length < maxRecords; i += 1) {
        visit(node[i], path ? `${path}[${i}]` : String(i), depth + 1)
      }
      return
    }
    const record = readPlainObject(node)
    if (!record) return
    if (seen.has(record)) return
    seen.add(record)

    const entries = Object.entries(record)
    for (let i = 0; i < entries.length && out.length < maxRecords; i += 1) {
      const [key, child] = entries[i]!
      if (!preferred.has(key)) continue
      visit(child, path ? `${path}.${key}` : key, depth + 1)
    }
    for (let i = 0; i < entries.length && out.length < maxRecords; i += 1) {
      const [key, child] = entries[i]!
      if (preferred.has(key)) continue
      visit(child, path ? `${path}.${key}` : key, depth + 1)
    }
  }

  visit(value, preferredKey || '', 0)
  return out
}

function buildGeodataGraphData(args: {
  name: string
  sampled: GeodataRecordSample[]
  maxRecords: number
  sampledVia: 'json-text' | 'json-object'
}): { graphData: GraphData; warnings: string[] } | null {
  const { name, sampled, maxRecords, sampledVia } = args
  if (!sampled.length) return null

  let geoCount = 0
  for (let i = 0; i < sampled.length; i += 1) {
    if (deriveGeoFromRecord(sampled[i]!.record)) geoCount += 1
  }
  if (geoCount === 0) return null

  const nodes: GraphData['nodes'] = []
  for (let i = 0; i < sampled.length; i += 1) {
    const { key, record } = sampled[i]!
    const geo = deriveGeoFromRecord(record)
    if (!geo) continue
    const idBase = deriveIdFromRecord(record, key || `row:${i}`)
    const id = `geo:${idBase}`
    const label = deriveLabelFromRecord(record, idBase)
    const properties = {
      ...record,
      id: idBase,
      label,
      geo: {
        ...(readPlainObject(record.geo) || {}),
        lat: geo.lat,
        lng: geo.lng,
      },
    } as unknown as Record<string, JSONValue>
    nodes.push({ id, label, type: 'GeoRecord', properties })
  }
  if (nodes.length === 0) return null

  const warnings = sampled.length >= maxRecords ? [`Large geodata JSON sampled to ${maxRecords} records for performance.`] : []
  const graphData: GraphData = {
    type: 'Graph',
    context: 'geodata',
    metadata: {
      ingestionMetrics: {
        kind: sampledVia === 'json-object' ? 'geodata-json-object-sampled' : 'geodata-json-sampled',
        sampledRecords: sampled.length,
        sampledGeoRecords: nodes.length,
      },
      source: name,
    },
    nodes,
    edges: [],
  }
  return { graphData, warnings }
}

export function tryBuildGeodataGraphDataFromJson(args: {
  name: string
  json: unknown
  maxRecords?: number
  preferredKey?: string
}): { graphData: GraphData; warnings: string[] } | null {
  const maxRecords = typeof args.maxRecords === 'number' && Number.isFinite(args.maxRecords) ? Math.floor(args.maxRecords) : 5000
  const sampled = collectGeodataRecordsFromJsonValue({
    value: args.json,
    maxRecords,
    preferredKey: args.preferredKey,
  })
  return buildGeodataGraphData({
    name: args.name,
    sampled,
    maxRecords,
    sampledVia: 'json-object',
  })
}

export function tryBuildGeodataGraphDataFromJsonText(args: {
  name: string
  text: string
  maxRecords?: number
}): { graphData: GraphData; warnings: string[] } | null {
  const maxRecords = typeof args.maxRecords === 'number' && Number.isFinite(args.maxRecords) ? Math.floor(args.maxRecords) : 5000
  const sampled = sampleGeodataRecordsFromJsonText(args.text, maxRecords)
  if (!sampled || sampled.length === 0) return null
  return buildGeodataGraphData({
    name: args.name,
    sampled,
    maxRecords,
    sampledVia: 'json-text',
  })
}
