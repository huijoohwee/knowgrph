import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

const EMPTY_RECORD = Object.freeze({}) as Record<string, JSONValue>
const cache = new WeakMap<object, GraphData>()

const coerceRecord = (value: unknown): Record<string, JSONValue> => {
  if (!value) return EMPTY_RECORD
  if (value instanceof Map) {
    const out: Record<string, JSONValue> = {}
    for (const [k, v] of value.entries()) {
      const key = typeof k === 'string' ? k : String(k || '').trim()
      if (!key) continue
      out[key] = v as JSONValue
    }
    return out
  }
  if (typeof value !== 'object' || Array.isArray(value)) return EMPTY_RECORD
  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) return value as Record<string, JSONValue>
  try {
    const out: Record<string, JSONValue> = {}
    for (const k of Object.keys(value as object)) {
      out[k] = (value as Record<string, unknown>)[k] as JSONValue
    }
    return out
  } catch {
    return EMPTY_RECORD
  }
}

export const cloneGraphDataForRender = (graphData: GraphData): GraphData => {
  const cached = cache.get(graphData as unknown as object)
  if (cached) return cached
  const nodes: GraphNode[] = Array.isArray(graphData.nodes)
    ? graphData.nodes.map(n => ({
        ...n,
        properties: coerceRecord(n.properties),
        metadata: n.metadata ? coerceRecord(n.metadata) : undefined,
      }))
    : []
  const edges: GraphEdge[] = Array.isArray(graphData.edges)
    ? graphData.edges.map(e => ({
        ...e,
        properties: coerceRecord(e.properties),
        metadata: e.metadata ? coerceRecord(e.metadata) : undefined,
      }))
    : []
  const cloned: GraphData = {
    ...graphData,
    nodes,
    edges,
    metadata: graphData.metadata ? coerceRecord(graphData.metadata) : undefined,
  }
  cache.set(graphData as unknown as object, cloned)
  return cloned
}
