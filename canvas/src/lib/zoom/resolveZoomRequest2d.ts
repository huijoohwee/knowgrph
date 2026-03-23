import type * as d3 from 'd3'

import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { resolveScaleExtentForZoomRequest } from '@/lib/zoom/scaleExtentPolicy'
import type { ToolbarZoomConfig } from '@/lib/zoom/toolbarZoom'

export type ZoomRequestResolve2dResult = {
  nextTransform: d3.ZoomTransform
  durationMs: number
  scaleExtent: { minK: number; maxK: number }
  nextMinScale?: number
}

export function resolveZoomRequest2d(args: {
  zoomRequest: ZoomRequest
  graphData: GraphData | null
  schema: GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
  graphDataRevision: number
  viewportW: number
  viewportH: number
  fitFillRatio?: number
  viewPinned: boolean
  durations?: Partial<{ fitMs: number; selectionMs: number }>
  toolbarZoom: ToolbarZoomConfig
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
  currentTransform: d3.ZoomTransform
  schemaExtent: { minK: number; maxK: number }
  currentExtent: { minK: number; maxK: number }
  cacheKeyBase: string
}): ZoomRequestResolve2dResult | null {
  const scaleExtent = resolveScaleExtentForZoomRequest({
    zoomRequest: args.zoomRequest,
    schemaExtent: args.schemaExtent,
    currentExtent: args.currentExtent,
    currentTransform: args.currentTransform,
    toolbarZoom: args.toolbarZoom,
  })
  const res = computeZoomTransformFromRequest(args.zoomRequest, {
    graphData: args.graphData,
    schema: args.schema,
    documentSemanticMode: args.documentSemanticMode,
    graphDataRevision: args.graphDataRevision,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    fitFillRatio: args.fitFillRatio,
    pinned: args.viewPinned,
    durations: args.durations,
    toolbarZoom: args.toolbarZoom,
    selectedNodeId: args.selectedNodeId,
    selectedEdgeId: args.selectedEdgeId,
    selectedGroupId: args.selectedGroupId,
    selectedNodeIds: args.selectedNodeIds,
    selectedEdgeIds: args.selectedEdgeIds,
    selectedGroupIds: args.selectedGroupIds,
    currentTransform: args.currentTransform,
    scaleExtent,
    cacheKeyBase: args.cacheKeyBase,
  })
  if (!res) return null
  return { nextTransform: res.nextTransform, durationMs: res.durationMs, scaleExtent, nextMinScale: res.nextMinScale }
}
