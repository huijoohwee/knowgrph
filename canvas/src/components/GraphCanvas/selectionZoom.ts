import * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { getAdjacencyMap, getEdgeEndpoints, type EdgeWithRuntime } from '@/components/GraphCanvas/simulation'
import { fitSubsetTransform } from '@/components/GraphCanvas/fit'
import { callZoomTransform } from '@/components/GraphCanvas/helpers'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import { useGraphStore } from '@/hooks/useGraphStore'

type ZoomOnSelectionParams = {
  graphData: GraphData
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  width: number
  height: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
}

type ZoomSelectionLogicParams = {
  graphData: GraphData
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
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
    for (const id of selectionNodeIds) {
      if (!id) continue
      ids.add(id)
      const neighbors = adj.get(id)
      if (neighbors) {
        neighbors.forEach(n => ids.add(n))
      }
    }
    return ids
  }
  for (const edgeId of selectionEdgeIds) {
    if (!edgeId) continue
    const e = graphData.edges.find(x => x.id === edgeId)
    if (!e) continue
    const endpoints = getEdgeEndpoints(e as EdgeWithRuntime)
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
  return params.graphData.nodes.filter(n => ids.has(n.id))
}

export const applyZoomOnSelection = ({
  graphData,
  svg,
  zoom,
  width,
  height,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
}: ZoomOnSelectionParams) => {
  if (useGraphStore.getState().viewPinned === true) return
  if (!graphData) return
  const subset = computeZoomSubset({ graphData, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds })
  if (subset.length === 0) return
  const t = fitSubsetTransform(subset, width, height)
  callZoomTransform(svg, zoom, t)
}
