import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { isPlainObject } from '@/lib/graph/value'

const coerceId = (x: unknown): string | null => {
  if (typeof x === 'string' && x.trim()) return x.trim()
  if (typeof x === 'number' && Number.isFinite(x)) return String(x)
  return null
}

const deriveLabelFromProperties = (props: Record<string, unknown> | null, fallback: string): string => {
  if (!props) return fallback
  const candidates = [props.name, props.label, props.title, props.displayName, props.description]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return fallback
}

const pointToGeo = (geom: Geometry | null | undefined): { lat: number; lng: number } | null => {
  if (!geom || geom.type !== 'Point') return null
  const g = geom as Point
  const coords = Array.isArray(g.coordinates) ? g.coordinates : []
  const lng = coords[0]
  const lat = coords[1]
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function geojsonToGraphData(
  fc: FeatureCollection,
  opts?: { sourceName?: string },
): GraphData {
  const nodes: GraphNode[] = []
  const features = Array.isArray(fc.features) ? (fc.features as Feature[]) : []
  for (let i = 0; i < features.length; i += 1) {
    const f = features[i]
    const geom = f && typeof f === 'object' ? (f.geometry as Geometry | null | undefined) : null
    const propsRaw = f && typeof f === 'object' ? (f.properties as unknown) : null
    const props = propsRaw && isPlainObject(propsRaw) ? (propsRaw as Record<string, unknown>) : null
    const id = coerceId((f as unknown as { id?: unknown }).id) ?? coerceId(props?.id) ?? `feature:${i}`
    const label = deriveLabelFromProperties(props, id)
    const type = geom && typeof geom.type === 'string' && geom.type.trim() ? `Geo:${geom.type.trim()}` : 'Geo:Feature'

    const nodeProps: Record<string, JSONValue> = {
      ...(props ? (props as unknown as Record<string, JSONValue>) : {}),
      geojson: {
        type: 'Feature',
        geometry: geom as unknown as JSONValue,
      },
    }
    const geo = pointToGeo(geom)
    if (geo) nodeProps.geo = geo as unknown as JSONValue

    nodes.push({
      id,
      label,
      type,
      properties: nodeProps,
      metadata: {
        provenance: {
          kind: 'geojson',
          source: opts?.sourceName ? String(opts.sourceName) : undefined,
        },
      },
    })
  }

  return {
    type: 'Graph',
    context: 'geojson',
    nodes,
    edges: [],
    metadata: {
      ingestionMetrics: {
        kind: 'geojson',
        featureCount: nodes.length,
      },
    },
  }
}

