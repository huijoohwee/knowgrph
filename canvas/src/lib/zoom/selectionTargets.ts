import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeIdsByCanonicalIds } from '@/lib/graph/canonicalNodeIds'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'

type SelectionAnchorIds = {
  selectionNodeIds: string[]
  selectionEdgeIds: string[]
  selectionGroupIds: string[]
}

type ZoomSelectionLogicParams = {
  graphData: GraphData
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}

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

const normalizeSelectionIds = (params: Pick<ZoomSelectionLogicParams, 'selectedNodeId' | 'selectedEdgeId' | 'selectedGroupId' | 'selectedNodeIds' | 'selectedEdgeIds' | 'selectedGroupIds'>): SelectionAnchorIds => {
  const { selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds } = params
  const selectionNodeIds =
    Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
      ? selectedNodeIds
      : selectedNodeId
        ? [selectedNodeId]
        : []
  const selectionEdgeIds =
    Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0
      ? selectedEdgeIds
      : selectedEdgeId
        ? [selectedEdgeId]
        : []
  const selectionGroupIds =
    Array.isArray(selectedGroupIds) && selectedGroupIds.length > 0
      ? selectedGroupIds
      : selectedGroupId
        ? [selectedGroupId]
        : []
  return { selectionNodeIds, selectionEdgeIds, selectionGroupIds }
}

const resolveSelectionNodeIds = (graphData: GraphData, rawIds: ReadonlyArray<string>): string[] => {
  const resolved = resolveGraphNodeIdsByCanonicalIds(graphData, rawIds)
  return resolved.length > 0 ? resolved : rawIds.map(id => String(id || '').trim()).filter(Boolean)
}

const adjCache = new WeakMap<GraphData, Map<string, Set<string>>>()

const getAdjacencyMap = (data: GraphData): Map<string, Set<string>> => {
  const cached = adjCache.get(data)
  if (cached) return cached
  const map = new Map<string, Set<string>>()
  for (const node of data.nodes || []) {
    map.set(String(node.id), new Set<string>())
  }
  for (const edge of data.edges || []) {
    const { src, tgt } = getEdgeEndpoints(edge)
    const s = src ?? ''
    const t = tgt ?? ''
    if (!s || !t) continue
    if (!map.has(s)) map.set(s, new Set<string>())
    if (!map.has(t)) map.set(t, new Set<string>())
    map.get(s)!.add(t)
    map.get(t)!.add(s)
  }
  adjCache.set(data, map)
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
  const { selectionNodeIds, selectionEdgeIds, selectionGroupIds } = normalizeSelectionIds({
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
  const resolvedSelectionNodeIds = resolveSelectionNodeIds(graphData, selectionNodeIds)
  const adj = getAdjacencyMap(graphData)

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
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []

  const expandEdgeNeighbors =
    anchorCount === 1 && selectionEdgeIds.length === 1 && selectionNodeIds.length === 0 && selectionGroupIds.length === 0
  for (const rawEdgeId of selectionEdgeIds) {
    const edgeId = String(rawEdgeId || '')
    if (!edgeId) continue
    const edge = edges.find(e => String(e.id) === edgeId)
    if (!edge) continue
    const endpoints = getEdgeEndpoints(edge)
    const sId = endpoints.src
    const tId = endpoints.tgt
    if (!sId || !tId) continue
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
  const resolvedSelectionNodeIds = resolveSelectionNodeIds(params.graphData, normalizeSelectionIds(params).selectionNodeIds)
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
