import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeIdsByCanonicalIds } from '@/lib/graph/canonicalNodeIds'
import { getAdjacencyMap } from '@/components/GraphCanvas/adjacency'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { readSelectedEdgeEndpointsById } from '@/lib/graph/edgeEndpoints'
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
