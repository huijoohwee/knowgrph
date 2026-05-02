import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { isPlainObject } from '@/lib/graph/value'

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const decodeUnsigned = (str: string, startIndex: number): { value: number; next: number } | null => {
  let result = 0
  let shift = 0
  let index = startIndex
  while (index < str.length) {
    const b = str.charCodeAt(index) - 63
    index += 1
    result |= (b & 0x1f) << shift
    shift += 5
    if (b < 0x20) {
      return { value: result, next: index }
    }
  }
  return null
}

const decodeSigned = (value: number): number => {
  const neg = (value & 1) === 1
  const shifted = value >> 1
  return neg ? ~shifted : shifted
}

export function decodePolyline6ToLngLatPairs(encoded: string): Array<[number, number]> {
  const raw = String(encoded || '').trim()
  if (!raw) return []
  const factor = 1_000_000
  let index = 0
  let lat = 0
  let lng = 0
  const out: Array<[number, number]> = []
  while (index < raw.length) {
    const latRes = decodeUnsigned(raw, index)
    if (!latRes) break
    index = latRes.next
    const lngRes = decodeUnsigned(raw, index)
    if (!lngRes) break
    index = lngRes.next
    lat += decodeSigned(latRes.value)
    lng += decodeSigned(lngRes.value)

    const latDeg = lat / factor
    const lngDeg = lng / factor

    const latOk = Number.isFinite(latDeg) && latDeg >= -90 && latDeg <= 90
    const lngOk = Number.isFinite(lngDeg) && lngDeg >= -180 && lngDeg <= 180
    if (latOk && lngOk) {
      out.push([lngDeg, latDeg])
      continue
    }

    const swappedLatOk = Number.isFinite(lngDeg) && lngDeg >= -90 && lngDeg <= 90
    const swappedLngOk = Number.isFinite(latDeg) && latDeg >= -180 && latDeg <= 180
    if (swappedLatOk && swappedLngOk) {
      out.push([latDeg, lngDeg])
      continue
    }
    out.push([clamp(lngDeg, -180, 180), clamp(latDeg, -90, 90)])
  }
  return out
}

const haversineMeters = (a: [number, number], b: [number, number]): number => {
  const toRad = (d: number) => (d * Math.PI) / 180
  const lng1 = a[0]
  const lat1 = a[1]
  const lng2 = b[0]
  const lat2 = b[1]
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const rLat1 = toRad(lat1)
  const rLat2 = toRad(lat2)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(rLat1) * Math.cos(rLat2) * sinLng * sinLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return 6_371_000 * c
}

const measurePolylineMeters = (coords: Array<[number, number]>): number => {
  if (coords.length < 2) return 0
  let total = 0
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineMeters(coords[i - 1]!, coords[i]!)
  }
  return total
}

export function tryBuildGrabMapsGraphDataFromJson(args: {
  name: string
  json: unknown
}): { graphData: GraphData; warnings: string[] } | null {
  const json = args.json
  if (!isPlainObject(json)) return null

  const routesRaw = (json as Record<string, unknown>).routes
  if (!Array.isArray(routesRaw) || routesRaw.length === 0) return null
  const r0 = routesRaw[0]
  if (!isPlainObject(r0)) return null

  const geometry = String((r0 as Record<string, unknown>).geometry || '').trim()
  if (!geometry) return null

  const coords = decodePolyline6ToLngLatPairs(geometry)
  if (coords.length < 2) return null

  const distanceMetersRaw = (r0 as Record<string, unknown>).distance
  const durationSecRaw = (r0 as Record<string, unknown>).duration
  const distanceMeters = typeof distanceMetersRaw === 'number' && Number.isFinite(distanceMetersRaw) && distanceMetersRaw > 0
    ? distanceMetersRaw
    : measurePolylineMeters(coords)
  const durationSec = typeof durationSecRaw === 'number' && Number.isFinite(durationSecRaw) && durationSecRaw > 0
    ? durationSecRaw
    : null

  const routeId = `grabmaps:route:${hashStringToHex(`${args.name}:${geometry.slice(0, 64)}`)}`
  const start = coords[0]!
  const end = coords[coords.length - 1]!
  const nodes: GraphNode[] = [
    {
      id: `${routeId}:start`,
      type: 'RoutePoint',
      label: 'Start',
      properties: {
        geo: { lng: start[0], lat: start[1] },
        kind: 'route',
      } as unknown as Record<string, JSONValue>,
    },
    {
      id: `${routeId}:end`,
      type: 'RoutePoint',
      label: 'End',
      properties: {
        geo: { lng: end[0], lat: end[1] },
        kind: 'route',
      } as unknown as Record<string, JSONValue>,
    },
  ]

  const lineFeature = {
    type: 'Feature',
    id: routeId,
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      id: routeId,
      label: 'GrabMaps route',
      kgCategory: 'route',
      distance_m: distanceMeters,
      ...(durationSec != null ? { duration_s: durationSec } : {}),
    },
  } satisfies JSONValue

  const graphData: GraphData = {
    type: 'Graph',
    context: 'grabmaps',
    nodes,
    edges: [],
    metadata: {
      kind: 'grabmaps',
      source: args.name,
      kgGeospatialLineFeatures: { type: 'FeatureCollection', features: [lineFeature] },
      kgGrabMaps: {
        routeId,
        distance_m: distanceMeters,
        ...(durationSec != null ? { duration_s: durationSec } : {}),
      },
    } as unknown as Record<string, JSONValue>,
  }

  return { graphData, warnings: [] }
}
