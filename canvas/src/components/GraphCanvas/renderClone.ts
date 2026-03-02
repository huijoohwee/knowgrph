import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

const EMPTY_RECORD = Object.freeze({}) as Record<string, JSONValue>
const cache = new WeakMap<object, GraphData>()

const coerceRecord = (value: unknown): Record<string, JSONValue> => {
  if (!value) return EMPTY_RECORD
  if (typeof value !== 'object' || Array.isArray(value)) return EMPTY_RECORD
  return value as Record<string, JSONValue>
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
