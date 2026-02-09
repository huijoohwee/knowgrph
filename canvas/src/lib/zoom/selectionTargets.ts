import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

type SelectionAnchorIds = {
  selectionNodeIds: string[]
  selectionEdgeIds: string[]
}

type ZoomSelectionLogicParams = {
  graphData: GraphData
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
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

const normalizeSelectionIds = (params: Pick<ZoomSelectionLogicParams, 'selectedNodeId' | 'selectedEdgeId' | 'selectedNodeIds' | 'selectedEdgeIds'>): SelectionAnchorIds => {
  const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = params
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
  return { selectionNodeIds, selectionEdgeIds }
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
  selectedNodeIds,
  selectedEdgeIds,
}: ZoomSelectionLogicParams): Set<string> => {
  const ids = new Set<string>()
  const { selectionNodeIds, selectionEdgeIds } = normalizeSelectionIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })
  if (selectionNodeIds.length === 0 && selectionEdgeIds.length === 0) {
    return ids
  }
  const adj = getAdjacencyMap(graphData)
  if (selectionNodeIds.length > 0) {
    for (const rawId of selectionNodeIds) {
      const id = String(rawId || '')
      if (!id) continue
      ids.add(id)
      const neighbors = adj.get(id)
      if (neighbors) {
        neighbors.forEach(n => ids.add(n))
      }
    }
    return ids
  }
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
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
    const sNeighbors = adj.get(sId)
    if (sNeighbors) {
      sNeighbors.forEach(n => ids.add(n))
    }
    const tNeighbors = adj.get(tId)
    if (tNeighbors) {
      tNeighbors.forEach(n => ids.add(n))
    }
  }
  return ids
}

export const computeZoomSubset = (params: ZoomSelectionLogicParams): GraphNode[] => {
  const ids = computeZoomTargetNodeIds(params)
  if (ids.size === 0) {
    return []
  }
  return params.graphData.nodes.filter(n => ids.has(String(n.id)))
}
