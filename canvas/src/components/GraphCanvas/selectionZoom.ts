import * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { callZoomTransform } from '@/components/GraphCanvas/helpers'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { computeZoomSubset as computeZoomSubsetCore, computeZoomTargetNodeIds as computeZoomTargetNodeIdsCore } from '@/lib/zoom/selectionTargets'

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
}: ZoomSelectionLogicParams): Set<string> => computeZoomTargetNodeIdsCore({
  graphData,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
})

export const computeZoomSubset = (params: ZoomSelectionLogicParams): GraphNode[] => computeZoomSubsetCore(params)

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
  const schema = useGraphStore.getState().schema
  const mode = readLayoutMode(schema)
  const opts = readFitAllOptions({ schema, mode, intent: 'fitSelection' })
  const t = fitAllTransform(subset, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)), opts)
  callZoomTransform(svg, zoom, t)
}
