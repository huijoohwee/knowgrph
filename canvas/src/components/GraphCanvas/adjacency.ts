import type { GraphNode, GraphEdge } from '@/lib/graph/types'

type GraphLike = { nodes: GraphNode[]; edges: GraphEdge[] }

type EdgeEndpointLike = GraphEdge['source'] | { id?: string } | null | undefined

const coerceEndpointId = (value: EdgeEndpointLike): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

const getEdgeEndpoints = (edge: GraphEdge): { src: string | null; tgt: string | null } => ({
  src: coerceEndpointId(edge.source ?? null),
  tgt: coerceEndpointId(edge.target ?? null),
})

export const buildAdjacencyMap = (data: GraphLike) => {
  const map = new Map<string, Set<string>>()
  data.nodes.forEach(n => map.set(n.id, new Set<string>()))
  data.edges.forEach(e => {
    const { src, tgt } = getEdgeEndpoints(e)
    const s = src ?? ''
    const t = tgt ?? ''
    if (!s || !t) return
    if (!map.has(s)) map.set(s, new Set<string>())
    if (!map.has(t)) map.set(t, new Set<string>())
    map.get(s)!.add(t)
    map.get(t)!.add(s)
  })
  return map
}

const adjCache = new WeakMap<GraphLike, Map<string, Set<string>>>()

export const getAdjacencyMap = (data: GraphLike) => {
  const cached = adjCache.get(data)
  if (cached) return cached
  const built = buildAdjacencyMap(data)
  adjCache.set(data, built)
  return built
}

export const clearAdjacencyCacheFor = (data: GraphLike) => {
  try { adjCache.delete(data) } catch { void 0 }
}
