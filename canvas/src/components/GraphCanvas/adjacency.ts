import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'

type GraphLike = { nodes: GraphNode[]; edges: GraphEdge[] }
const ADJACENCY_CACHE_LIMIT = 16
const adjacencyCache = new Map<string, Map<string, Set<string>>>()

function asGraphData(data: GraphLike): GraphData {
  return data as GraphData
}

function buildAdjacencyCacheKey(data: GraphLike): string {
  return buildScopedGraphSemanticKey('graph-canvas-adjacency', {
    graphData: asGraphData(data),
  })
}

function readCachedAdjacencyMap(cacheKey: string): Map<string, Set<string>> | null {
  if (!cacheKey) return null
  const cached = adjacencyCache.get(cacheKey) || null
  if (!cached) return null
  adjacencyCache.delete(cacheKey)
  adjacencyCache.set(cacheKey, cached)
  return cached
}

function writeCachedAdjacencyMap(
  cacheKey: string,
  adjacencyByNodeId: Map<string, Set<string>>,
): Map<string, Set<string>> {
  if (!cacheKey) return adjacencyByNodeId
  adjacencyCache.set(cacheKey, adjacencyByNodeId)
  if (adjacencyCache.size > ADJACENCY_CACHE_LIMIT) {
    const oldestKey = adjacencyCache.keys().next().value
    if (typeof oldestKey === 'string') adjacencyCache.delete(oldestKey)
  }
  return adjacencyByNodeId
}

export const buildAdjacencyMap = (data: GraphLike) => {
  const map = new Map<string, Set<string>>()
  data.nodes.forEach(n => map.set(n.id, new Set<string>()))
  data.edges.forEach(e => {
    const { src, tgt } = readGraphEdgeEndpoints(e)
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

export const getAdjacencyMap = (data: GraphLike) => {
  const cacheKey = buildAdjacencyCacheKey(data)
  const cached = readCachedAdjacencyMap(cacheKey)
  if (cached) return cached
  const built = buildAdjacencyMap(data)
  return writeCachedAdjacencyMap(cacheKey, built)
}

export const clearAdjacencyCacheFor = (data: GraphLike) => {
  const cacheKey = buildAdjacencyCacheKey(data)
  if (!cacheKey) return
  adjacencyCache.delete(cacheKey)
}
