import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

const GRAPH_LOOKUP_CACHE_LIMIT = 16

export type CachedGraphLookup = {
  cacheKey: string
  graphData: GraphData
  nodes: GraphNode[]
  edges: GraphEdge[]
  nodeById: Map<string, GraphNode>
  edgeById: Map<string, GraphEdge>
  incidentEdgesByNodeId: Map<string, GraphEdge[]>
}

type GetCachedGraphLookupArgs = {
  cacheScope: string
  graphData?: GraphData | null
  graphRevision?: number | null
  graphSemanticKey?: string | null
  sourceLayerHash?: string | null
  sourceLayerOrderHash?: string | null
  preferCurrentGraphDataRefs?: boolean
}

const graphLookupCache = new Map<string, CachedGraphLookup>()

function readCachedGraphLookup(cacheKey: string): CachedGraphLookup | null {
  const cached = graphLookupCache.get(cacheKey) || null
  if (!cached) return null
  graphLookupCache.delete(cacheKey)
  graphLookupCache.set(cacheKey, cached)
  return cached
}

function writeCachedGraphLookup(cacheKey: string, value: CachedGraphLookup): CachedGraphLookup {
  graphLookupCache.set(cacheKey, value)
  if (graphLookupCache.size > GRAPH_LOOKUP_CACHE_LIMIT) {
    const oldestKey = graphLookupCache.keys().next().value
    if (typeof oldestKey === 'string') graphLookupCache.delete(oldestKey)
  }
  return value
}

function buildGraphLookup(cacheKey: string, graphData: GraphData): CachedGraphLookup {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  const nodeById = new Map<string, GraphNode>()
  const edgeById = new Map<string, GraphEdge>()
  const incidentEdgesByNodeId = new Map<string, GraphEdge[]>()

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    nodeById.set(id, node)
  }

  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const edgeId = String(edge?.id || '').trim()
    if (edgeId) edgeById.set(edgeId, edge)

    const sourceId = String(edge?.source || '').trim()
    const targetId = String(edge?.target || '').trim()
    if (sourceId) {
      const current = incidentEdgesByNodeId.get(sourceId)
      if (current) current.push(edge)
      else incidentEdgesByNodeId.set(sourceId, [edge])
    }
    if (targetId && targetId !== sourceId) {
      const current = incidentEdgesByNodeId.get(targetId)
      if (current) current.push(edge)
      else incidentEdgesByNodeId.set(targetId, [edge])
    }
  }

  return {
    cacheKey,
    graphData,
    nodes,
    edges,
    nodeById,
    edgeById,
    incidentEdgesByNodeId,
  }
}

export function getCachedGraphLookup(args: GetCachedGraphLookupArgs): CachedGraphLookup | null {
  const graphData = args.graphData || null
  if (!graphData) return null

  const cacheKey = buildScopedGraphSemanticKey(args.cacheScope, {
    graphData,
    graphRevision: args.graphRevision,
    graphSemanticKey: args.graphSemanticKey,
    sourceLayerHash: args.sourceLayerHash,
    sourceLayerOrderHash: args.sourceLayerOrderHash,
  })
  if (!cacheKey) return null

  const cached = readCachedGraphLookup(cacheKey)
  if (cached) {
    if (cached.graphData !== graphData) {
      if (args.preferCurrentGraphDataRefs === true) {
        return writeCachedGraphLookup(cacheKey, buildGraphLookup(cacheKey, graphData))
      }
      cached.graphData = graphData
    }
    return cached
  }

  return writeCachedGraphLookup(cacheKey, buildGraphLookup(cacheKey, graphData))
}
