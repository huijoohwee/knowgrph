import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeIdsByCanonicalIds } from '@/lib/graph/canonicalNodeIds'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { readGraphEdgeEndpoints, readSelectedEdgeEndpointsById } from '@/lib/graph/edgeEndpoints'
import {
  normalizeSelectionAnchorIdsWithGroups,
  resolveSelectionAnchorNodeIds,
} from '@/lib/selection/anchorIds'

type ZoomSelectionLogicParams = {
  graphData: GraphData
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}

const ADJ_CACHE_LIMIT = 32
const adjCache = new Map<string, Map<string, Set<string>>>()

const getAdjacencyMap = (data: GraphData): Map<string, Set<string>> => {
  const graphSemanticKey = buildScopedGraphSemanticKey('selection-zoom-adjacency', { graphData: data })
  const cached = graphSemanticKey ? adjCache.get(graphSemanticKey) || null : null
  if (cached) {
    adjCache.delete(graphSemanticKey)
    adjCache.set(graphSemanticKey, cached)
    return cached
  }
  const map = new Map<string, Set<string>>()
  const graphLookup = getCachedGraphLookup({
    cacheScope: 'selection-zoom-adjacency',
    graphData: data,
    graphSemanticKey,
    preferCurrentGraphDataRefs: true,
  })
  const nodes = graphLookup?.nodes || []
  const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId || null
  for (const node of nodes) {
    map.set(String(node.id), new Set<string>())
  }
  if (incidentEdgesByNodeId) {
    incidentEdgesByNodeId.forEach((edges, nodeId) => {
      const sourceId = String(nodeId || '').trim()
      if (!sourceId) return
      const neighbors = map.get(sourceId) || new Set<string>()
      for (let i = 0; i < edges.length; i += 1) {
        const endpoints = readGraphEdgeEndpoints(edges[i]!)
        const neighborId = endpoints.src === sourceId ? endpoints.tgt : endpoints.src
        const targetId = String(neighborId || '').trim()
        if (targetId) neighbors.add(targetId)
      }
      map.set(sourceId, neighbors)
    })
  } else {
    for (const edge of data.edges || []) {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      const s = src ?? ''
      const t = tgt ?? ''
      if (!s || !t) continue
      if (!map.has(s)) map.set(s, new Set<string>())
      if (!map.has(t)) map.set(t, new Set<string>())
      map.get(s)!.add(t)
      map.get(t)!.add(s)
    }
  }
  if (graphSemanticKey) {
    adjCache.set(graphSemanticKey, map)
    if (adjCache.size > ADJ_CACHE_LIMIT) {
      const oldestKey = adjCache.keys().next().value
      if (typeof oldestKey === 'string') adjCache.delete(oldestKey)
    }
  }
  return map
}

export const computeZoomTargetNodeIds = ({
  graphData,
  selectedNodeId,
  selectedEdgeId,
  selectedGroupId,
  selectedNodeIds,
  selectedEdgeIds,
  selectedGroupIds,
}: ZoomSelectionLogicParams): Set<string> => {
  const ids = new Set<string>()
  const { selectionNodeIds, selectionEdgeIds, selectionGroupIds } = normalizeSelectionAnchorIdsWithGroups({
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
  })
  if (selectionNodeIds.length === 0 && selectionEdgeIds.length === 0 && selectionGroupIds.length === 0) {
    return ids
  }

  const anchorCount = selectionNodeIds.length + selectionEdgeIds.length + selectionGroupIds.length
  const resolvedSelectionNodeIds = resolveSelectionAnchorNodeIds(graphData, selectionNodeIds)
  const adj = getAdjacencyMap(graphData)
  const graphLookup = getCachedGraphLookup({
    cacheScope: 'selection-zoom-targets',
    graphData,
    graphSemanticKey: buildScopedGraphSemanticKey('selection-zoom-targets', { graphData }),
    preferCurrentGraphDataRefs: true,
  })

  if (selectionGroupIds.length > 0) {
    const groups = deriveGraphGroups(graphData)
    const membersByGroupId = new Map<string, string[]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      membersByGroupId.set(String(g.id), Array.isArray(g.memberNodeIds) ? g.memberNodeIds.map(v => String(v)).filter(Boolean) : [])
    }
    for (const rawGroupId of selectionGroupIds) {
      const groupId = String(rawGroupId || '')
      if (!groupId) continue
      const members = membersByGroupId.get(groupId) || []
      for (let i = 0; i < members.length; i += 1) ids.add(members[i])
    }
  }

  if (resolvedSelectionNodeIds.length > 0) {
    const expandNeighbors = anchorCount === 1 && resolvedSelectionNodeIds.length === 1
    for (const rawId of resolvedSelectionNodeIds) {
      const id = String(rawId || '')
      if (!id) continue
      ids.add(id)
      if (!expandNeighbors) continue
      const neighbors = adj.get(id)
      if (neighbors) neighbors.forEach(n => ids.add(n))
    }
  }
  const expandEdgeNeighbors =
    anchorCount === 1 && selectionEdgeIds.length === 1 && selectionNodeIds.length === 0 && selectionGroupIds.length === 0
  const selectedEdgeEndpoints = readSelectedEdgeEndpointsById(graphLookup?.edgeById, selectionEdgeIds)
  for (let i = 0; i < selectedEdgeEndpoints.length; i += 1) {
    const { src: sId, tgt: tId } = selectedEdgeEndpoints[i]!
    ids.add(sId)
    ids.add(tId)
    if (!expandEdgeNeighbors) continue
    const sNeighbors = adj.get(sId)
    if (sNeighbors) sNeighbors.forEach(n => ids.add(n))
    const tNeighbors = adj.get(tId)
    if (tNeighbors) tNeighbors.forEach(n => ids.add(n))
  }
  return ids
}


export const computeZoomSubset = (params: ZoomSelectionLogicParams): GraphNode[] => {
  const resolvedSelectionNodeIds = resolveSelectionAnchorNodeIds(
    params.graphData,
    normalizeSelectionAnchorIdsWithGroups(params).selectionNodeIds,
  )
  const ids = computeZoomTargetNodeIds({
    ...params,
    selectedNodeId: resolvedSelectionNodeIds.length === 1 ? resolvedSelectionNodeIds[0] || null : params.selectedNodeId,
    selectedNodeIds: resolvedSelectionNodeIds.length > 0 ? resolvedSelectionNodeIds : params.selectedNodeIds,
  })
  if (ids.size === 0) return []
  const subsetIds = resolveGraphNodeIdsByCanonicalIds(params.graphData, Array.from(ids.values()))
  if (subsetIds.length > 0) {
    const subsetIdSet = new Set(subsetIds)
    return params.graphData.nodes.filter(n => subsetIdSet.has(String(n.id || '').trim()))
  }
  return params.graphData.nodes.filter(n => ids.has(String(n.id || '').trim()))
}
